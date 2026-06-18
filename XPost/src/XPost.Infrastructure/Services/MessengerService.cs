using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using XPost.Application.Interfaces;

namespace XPost.Infrastructure.Services;

/// <summary>
/// Communicates with the Meta Messenger Send API (Graph API v21.0).
/// Handles text splitting, typing indicators, quick replies, and profile fetching.
/// </summary>
public class MessengerService : IMessengerService
{
    private const string GraphApiBase = "https://graph.facebook.com/v21.0";
    private const int MaxMessageLength = 2000;
    private const int ChunkDelayMs = 300;
    private const int MaxQuickReplies = 13;
    private const int MaxQuickReplyLabelLength = 20;

    private readonly HttpClient _httpClient;
    private readonly ILogger<MessengerService> _logger;

    public MessengerService(HttpClient httpClient, ILogger<MessengerService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task SendTextAsync(string pageToken, string recipientId, string text, CancellationToken ct = default)
    {
        var chunks = SplitMessage(text);

        foreach (var chunk in chunks)
        {
            var body = new
            {
                recipient = new { id = recipientId },
                message = new { text = chunk },
                messaging_type = "RESPONSE"
            };

            await PostToSendApiAsync(pageToken, body, ct);

            if (chunks.Count > 1 && chunk != chunks.Last())
                await Task.Delay(ChunkDelayMs, ct);
        }
    }

    /// <inheritdoc />
    public async Task SendTypingAsync(string pageToken, string recipientId, CancellationToken ct = default)
    {
        var body = new
        {
            recipient = new { id = recipientId },
            sender_action = "typing_on"
        };

        await PostToSendApiAsync(pageToken, body, ct);
    }

    /// <inheritdoc />
    public async Task SendReadReceiptAsync(string pageToken, string recipientId, CancellationToken ct = default)
    {
        var body = new
        {
            recipient = new { id = recipientId },
            sender_action = "mark_seen"
        };

        await PostToSendApiAsync(pageToken, body, ct);
    }


    /// <inheritdoc />
    public async Task SendQuickRepliesAsync(
        string pageToken,
        string recipientId,
        string text,
        List<string> options,
        CancellationToken ct = default)
    {
        // Enforce Meta constraints
        var safeOptions = options
            .Take(MaxQuickReplies)
            .Select(o => o.Length > MaxQuickReplyLabelLength ? o[..MaxQuickReplyLabelLength] : o)
            .ToList();

        var quickReplies = safeOptions.Select(o => new
        {
            content_type = "text",
            title = o,
            payload = o.ToUpperInvariant().Replace(" ", "_")
        }).ToArray();

        var body = new
        {
            recipient = new { id = recipientId },
            message = new
            {
                text,
                quick_replies = quickReplies
            },
            messaging_type = "RESPONSE"
        };

        await PostToSendApiAsync(pageToken, body, ct);
    }

    private object[] MapQuickReplies(List<ChatbotButtonDto>? buttons)
    {
        if (buttons == null || !buttons.Any()) return Array.Empty<object>();

        return buttons.Take(13).Select(b => {
            string payload = b.Payload;
            
            // Map payloads according to button types
            if (b.Icon == "📞" || b.Type == "phone_number")
            {
                payload = $"CALL_PHONE_NUMBER:{b.Payload}";
            }
            else if (b.Payload != null && (b.Payload.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase) || b.Payload.Contains("@")) && !b.Payload.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            {
                var email = b.Payload.Replace("mailto:", "", StringComparison.OrdinalIgnoreCase).Trim();
                payload = $"SEND_EMAIL:{email}";
            }
            else if (b.Icon == "🌐" || b.Type == "web_url")
            {
                payload = $"VISIT_WEBSITE:{b.Payload}";
            }
            else if (b.Icon == "🛒" || b.Icon == "🛍️")
            {
                payload = $"ORDER_FORM:{b.Payload}";
            }

            var titleText = $"{b.Icon} {b.Title}".Trim();
            if (titleText.Length > 20)
            {
                titleText = titleText[..20];
            }

            return new
            {
                content_type = "text",
                title = titleText,
                payload = payload
            };
        }).ToArray();
    }

    /// <inheritdoc />
    public async Task SendTextWithQuickRepliesAsync(
        string pageToken,
        string recipientId,
        string text,
        List<ChatbotButtonDto> buttons,
        CancellationToken ct = default)
    {
        var quickReplies = MapQuickReplies(buttons);
        if (quickReplies.Length == 0)
        {
            await SendTextAsync(pageToken, recipientId, text, ct);
            return;
        }

        var body = new
        {
            recipient = new { id = recipientId },
            message = new
            {
                text,
                quick_replies = quickReplies
            },
            messaging_type = "RESPONSE"
        };

        await PostToSendApiAsync(pageToken, body, ct);
    }

    /// <inheritdoc />
    public async Task SendUrlButtonAsync(
        string pageToken,
        string recipientId,
        string text,
        string buttonTitle,
        string url,
        List<ChatbotButtonDto>? quickReplies = null,
        CancellationToken ct = default)
    {
        var quickRepliesArray = MapQuickReplies(quickReplies);

        var body = new
        {
            recipient = new { id = recipientId },
            message = quickRepliesArray.Any() ? (object)new
            {
                attachment = new
                {
                    type = "template",
                    payload = new
                    {
                        template_type = "button",
                        text = text,
                        buttons = new[]
                        {
                            new
                            {
                                type = "web_url",
                                url = url,
                                title = buttonTitle
                            }
                        }
                    }
                },
                quick_replies = quickRepliesArray
            } : new
            {
                attachment = new
                {
                    type = "template",
                    payload = new
                    {
                        template_type = "button",
                        text = text,
                        buttons = new[]
                        {
                            new
                            {
                                type = "web_url",
                                url = url,
                                title = buttonTitle
                            }
                        }
                    }
                }
            },
            messaging_type = "RESPONSE"
        };

        await PostToSendApiAsync(pageToken, body, ct);
    }

    /// <inheritdoc />
    public async Task SendMultipleUrlButtonsAsync(
        string pageToken,
        string recipientId,
        string text,
        List<ChatbotUrlButtonInfo> buttons,
        List<ChatbotButtonDto>? quickReplies = null,
        CancellationToken ct = default)
    {
        var quickRepliesArray = MapQuickReplies(quickReplies);

        var fbButtons = buttons.Select(b => new
        {
            type = "web_url",
            url = b.Url,
            title = b.Title
        }).ToArray();

        var body = new
        {
            recipient = new { id = recipientId },
            message = quickRepliesArray.Any() ? (object)new
            {
                attachment = new
                {
                    type = "template",
                    payload = new
                    {
                        template_type = "button",
                        text = text,
                        buttons = fbButtons
                    }
                },
                quick_replies = quickRepliesArray
            } : new
            {
                attachment = new
                {
                    type = "template",
                    payload = new
                    {
                        template_type = "button",
                        text = text,
                        buttons = fbButtons
                    }
                }
            },
            messaging_type = "RESPONSE"
        };

        await PostToSendApiAsync(pageToken, body, ct);
    }

    /// <inheritdoc />
    public async Task SendCallButtonAsync(
        string pageToken,
        string recipientId,
        string text,
        string buttonTitle,
        string phoneNumber,
        List<ChatbotButtonDto>? quickReplies = null,
        CancellationToken ct = default)
    {
        var quickRepliesArray = MapQuickReplies(quickReplies);

        var body = new
        {
            recipient = new { id = recipientId },
            message = quickRepliesArray.Any() ? (object)new
            {
                attachment = new
                {
                    type = "template",
                    payload = new
                    {
                        template_type = "button",
                        text = text,
                        buttons = new[]
                        {
                            new
                            {
                                type = "phone_number",
                                title = buttonTitle,
                                payload = phoneNumber
                            }
                        }
                    }
                },
                quick_replies = quickRepliesArray
            } : new
            {
                attachment = new
                {
                    type = "template",
                    payload = new
                    {
                        template_type = "button",
                        text = text,
                        buttons = new[]
                        {
                            new
                            {
                                type = "phone_number",
                                title = buttonTitle,
                                payload = phoneNumber
                            }
                        }
                    }
                }
            },
            messaging_type = "RESPONSE"
        };

        await PostToSendApiAsync(pageToken, body, ct);
    }

    /// <inheritdoc />
    public async Task<MessengerUserProfile?> GetProfileAsync(string pageToken, string psid, CancellationToken ct = default)
    {
        try
        {
            var url = $"{GraphApiBase}/{psid}?fields=first_name,last_name,profile_pic&access_token={pageToken}";
            var response = await _httpClient.GetAsync(url, ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch Messenger profile for PSID {Psid}: {Status}", psid, response.StatusCode);
                return null;
            }

            var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
            var firstName = json.TryGetProperty("first_name", out var fn) ? fn.GetString() ?? "" : "";
            var lastName = json.TryGetProperty("last_name", out var ln) ? ln.GetString() ?? "" : "";
            var profilePic = json.TryGetProperty("profile_pic", out var pp) ? pp.GetString() : null;

            return new MessengerUserProfile(firstName, lastName, profilePic);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception while fetching Messenger profile for PSID {Psid}", psid);
            return null;
        }
    }

    /// <inheritdoc />
    public async Task SyncIceBreakersAsync(string pageToken, List<string> questions, CancellationToken ct = default)
    {
        try
        {
            if (questions == null || !questions.Any())
            {
                var deleteUrl = $"{GraphApiBase}/me/messenger_profile?access_token={pageToken}";
                var deleteBody = new { fields = new[] { "ice_breakers" } };
                var request = new HttpRequestMessage(HttpMethod.Delete, deleteUrl)
                {
                    Content = JsonContent.Create(deleteBody)
                };
                var deleteResponse = await _httpClient.SendAsync(request, ct);
                if (!deleteResponse.IsSuccessStatusCode)
                {
                    var err = await deleteResponse.Content.ReadAsStringAsync(ct);
                    _logger.LogError("Failed to delete Messenger Ice Breakers: {Status} — {Error}", deleteResponse.StatusCode, err);
                }
                else
                {
                    _logger.LogInformation("Successfully deleted Messenger Ice Breakers.");
                }
                return;
            }

            var body = new
            {
                ice_breakers = new[]
                {
                    new
                    {
                        locale = "default",
                        call_to_actions = questions.Select(q => new
                        {
                            question = q,
                            payload = q
                        }).ToArray()
                    }
                }
            };

            var postUrl = $"{GraphApiBase}/me/messenger_profile?access_token={pageToken}";
            var postResponse = await _httpClient.PostAsJsonAsync(postUrl, body, ct);

            if (!postResponse.IsSuccessStatusCode)
            {
                var err = await postResponse.Content.ReadAsStringAsync(ct);
                _logger.LogError("Failed to synchronize Messenger Ice Breakers: {Status} — {Error}", postResponse.StatusCode, err);
            }
            else
            {
                _logger.LogInformation("Successfully synchronized Messenger Ice Breakers.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception while synchronizing Messenger Ice Breakers.");
        }
    }

    /// <inheritdoc />
    public async Task SyncPersistentMenuAsync(string pageToken, List<ChatbotButtonDto> buttons, CancellationToken ct = default)
    {
        try
        {
            var deleteUrl = $"{GraphApiBase}/me/messenger_profile?access_token={pageToken}";

            if (buttons == null || !buttons.Any())
            {
                // Delete the persistent menu
                var deleteBody = new { fields = new[] { "persistent_menu" } };
                var request = new HttpRequestMessage(HttpMethod.Delete, deleteUrl)
                {
                    Content = JsonContent.Create(deleteBody)
                };
                var deleteResponse = await _httpClient.SendAsync(request, ct);
                if (!deleteResponse.IsSuccessStatusCode)
                {
                    var err = await deleteResponse.Content.ReadAsStringAsync(ct);
                    _logger.LogError("Failed to delete Messenger Persistent Menu: {Status} — {Error}", deleteResponse.StatusCode, err);
                }
                else
                {
                    _logger.LogInformation("Successfully deleted Messenger Persistent Menu.");
                }

                // Also make sure get_started payload is still set
                var getStartedBody = new
                {
                    get_started = new
                    {
                        payload = "GET_STARTED"
                    }
                };
                var getStartedResponse = await _httpClient.PostAsJsonAsync(deleteUrl, getStartedBody, ct);
                if (!getStartedResponse.IsSuccessStatusCode)
                {
                    var err = await getStartedResponse.Content.ReadAsStringAsync(ct);
                    _logger.LogError("Failed to register Messenger Get Started during menu deletion: {Status} — {Error}", getStartedResponse.StatusCode, err);
                }

                return;
            }

            // Build call_to_actions array with correct button types
            var callToActions = buttons.Select(b =>
            {
                var type = DetermineButtonType(b);

                if (b.Icon == "🛒" || b.Icon == "🛍️")
                {
                    return BuildMenuAction("postback", b.Title, $"ORDER_FORM:{b.Payload}");
                }
                
                // If it is a web_url button but contains a comma (multiple URLs) or is JSON list
                if (type == "web_url" && b.Payload != null && (b.Payload.Contains(',') || b.Payload.TrimStart().StartsWith("[")))
                {
                    // Map it to a postback button so we can handle multi-links on our webhook
                    return BuildMenuAction("postback", b.Title, $"VISIT_WEBSITE:{b.Payload}");
                }

                if (type == "phone_number")
                {
                    // Facebook Persistent Menu does not support phone_number buttons.
                    // We map it to a postback button with CALL_PHONE_NUMBER: prefix instead.
                    return BuildMenuAction("postback", b.Title, $"CALL_PHONE_NUMBER:{b.Payload}");
                }
                
                // If it is an email button (starts with mailto: or contains @)
                if (b.Payload != null && (b.Payload.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase) || b.Payload.Contains("@")) && !b.Payload.StartsWith("http", StringComparison.OrdinalIgnoreCase))
                {
                    var email = b.Payload.Replace("mailto:", "", StringComparison.OrdinalIgnoreCase).Trim();
                    return BuildMenuAction("postback", b.Title, $"SEND_EMAIL:{email}");
                }

                return BuildMenuAction(type, b.Title, b.Payload);
            }).ToArray();

            var body = new
            {
                get_started = new
                {
                    payload = "GET_STARTED"
                },
                persistent_menu = new[]
                {
                    new
                    {
                        locale = "default",
                        composer_input_disabled = false,
                        call_to_actions = callToActions
                    }
                }
            };

            var postUrl = $"{GraphApiBase}/me/messenger_profile?access_token={pageToken}";
            var json = JsonSerializer.Serialize(body);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var postResponse = await _httpClient.PostAsync(postUrl, content, ct);

            if (!postResponse.IsSuccessStatusCode)
            {
                var err = await postResponse.Content.ReadAsStringAsync(ct);
                _logger.LogError("Failed to synchronize Messenger Persistent Menu: {Status} — {Error}", postResponse.StatusCode, err);
            }
            else
            {
                _logger.LogInformation("Successfully synchronized Messenger Persistent Menu with {Count} button(s).", buttons.Count);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception while synchronizing Messenger Persistent Menu.");
        }
    }

    /// <summary>
    /// Determines the Facebook button type from a ChatbotButtonDto.
    /// Priority: explicit Type field → icon heuristic → payload heuristic.
    /// </summary>
    private static string DetermineButtonType(ChatbotButtonDto b)
    {
        // Explicit type wins
        if (!string.IsNullOrWhiteSpace(b.Type) && b.Type != "postback")
            return b.Type;

        // Phone icon → phone_number
        if (b.Icon == "📞")
            return "phone_number";

        // URL payload → web_url
        if (!string.IsNullOrWhiteSpace(b.Payload) &&
            (b.Payload.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
             b.Payload.StartsWith("https://", StringComparison.OrdinalIgnoreCase)))
            return "web_url";

        return "postback";
    }

    /// <summary>
    /// Builds the appropriate anonymous object for a persistent menu action.
    /// </summary>
    private static object BuildMenuAction(string type, string title, string payload)
    {
        return type switch
        {
            "phone_number" => new { type, title, payload } as object,
            "web_url"      => new { type, title, url = payload } as object,
            _              => new { type, title, payload } as object,
        };
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /// <summary>
    /// Splits <paramref name="text"/> into chunks of at most <see cref="MaxMessageLength"/>
    /// characters, breaking on word boundaries where possible.
    /// </summary>
    private static List<string> SplitMessage(string text)
    {
        if (text.Length <= MaxMessageLength)
            return new List<string> { text };

        var chunks = new List<string>();
        var remaining = text.AsSpan();

        while (remaining.Length > MaxMessageLength)
        {
            // Try to break at the last space within the limit
            var slice = remaining[..MaxMessageLength];
            var breakIndex = slice.LastIndexOf(' ');
            if (breakIndex <= 0) breakIndex = MaxMessageLength; // no space found — hard cut

            chunks.Add(remaining[..breakIndex].ToString());
            remaining = remaining[breakIndex..].TrimStart();
        }

        if (!remaining.IsEmpty)
            chunks.Add(remaining.ToString());

        return chunks;
    }

    private async Task PostToSendApiAsync(string pageToken, object body, CancellationToken ct)
    {
        var url = $"{GraphApiBase}/me/messages?access_token={pageToken}";
        var json = JsonSerializer.Serialize(body);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync(url, content, ct);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(ct);
            _logger.LogError("Messenger Send API error: {Status} — {Error}", response.StatusCode, error);
        }
    }
}
