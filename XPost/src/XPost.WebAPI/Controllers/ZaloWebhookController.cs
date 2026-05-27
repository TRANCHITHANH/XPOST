using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Infrastructure.Persistence;
using XPost.WebAPI.Hubs;

namespace XPost.WebAPI.Controllers;

/// <summary>
/// Receives webhook events from Zalo OA platform.
/// Handles message events (user_send_*, oa_send_*), follow/unfollow events.
/// Stores messages in the database and pushes real-time updates via SignalR.
/// </summary>
[ApiController]
[Route("api/zalo-webhook")]
public class ZaloWebhookController : ControllerBase
{
    private readonly ILogger<ZaloWebhookController> _logger;
    private readonly IHubContext<ZaloHub> _hubContext;
    private readonly ApplicationDbContext _dbContext;
    private readonly ISensitiveContentDetector _sensitiveContentDetector;
    private readonly IConfiguration _configuration;

    public ZaloWebhookController(
        ILogger<ZaloWebhookController> logger,
        IHubContext<ZaloHub> hubContext,
        ApplicationDbContext dbContext,
        ISensitiveContentDetector sensitiveContentDetector,
        IConfiguration configuration)
    {
        _logger = logger;
        _hubContext = hubContext;
        _dbContext = dbContext;
        _sensitiveContentDetector = sensitiveContentDetector;
        _configuration = configuration;
    }

    /// <summary>
    /// POST — Receives webhook events from Zalo.
    /// Zalo sends JSON payload with event_name, sender, recipient, message, timestamp.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> ReceiveEvent()
    {
        try
        {
            // Read the raw body for signature verification
            using var reader = new StreamReader(Request.Body, Encoding.UTF8);
            var rawBody = await reader.ReadToEndAsync();

            _logger.LogInformation("Received Zalo Webhook: {Payload}", rawBody);

            // Verify signature if configured
            if (!VerifySignature(rawBody))
            {
                _logger.LogWarning("Zalo webhook signature verification failed.");
                return Unauthorized("Invalid signature");
            }

            var payload = JsonSerializer.Deserialize<JsonElement>(rawBody);

            if (!payload.TryGetProperty("event_name", out var eventNameProp))
            {
                _logger.LogWarning("Zalo webhook missing event_name.");
                return Ok("NO_EVENT");
            }

            var eventName = eventNameProp.GetString() ?? "";
            _logger.LogInformation("Zalo event: {EventName}", eventName);

            // Route to appropriate handler
            if (eventName.StartsWith("user_send_") || eventName.StartsWith("oa_send_"))
            {
                await HandleMessageEvent(payload, eventName);
            }
            else if (eventName == "follow")
            {
                await HandleFollowEvent(payload);
            }
            else if (eventName == "unfollow")
            {
                await HandleUnfollowEvent(payload);
            }
            else
            {
                _logger.LogInformation("Unhandled Zalo event type: {EventName}", eventName);
            }

            return Ok("EVENT_RECEIVED");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing Zalo webhook payload.");
            return Ok("ERROR_PROCESSING");
        }
    }

    private async Task HandleMessageEvent(JsonElement payload, string eventName)
    {
        // Extract sender / recipient
        var senderId = GetNestedString(payload, "sender", "id");
        var recipientId = GetNestedString(payload, "recipient", "id");
        var timestamp = payload.TryGetProperty("timestamp", out var tsProp) ? tsProp.GetInt64() : 0;
        var appId = payload.TryGetProperty("app_id", out var appProp) ? appProp.GetString() ?? "" : "";

        // Determine if message is from OA or user
        bool isFromOA = eventName.StartsWith("oa_send_");
        var zaloUserId = isFromOA ? recipientId : senderId;
        var oaId = isFromOA ? senderId : recipientId;

        // Extract message content
        string? text = null;
        string? attachmentUrl = null;
        string msgId = "";
        string attachmentType = "text";

        if (payload.TryGetProperty("message", out var msgObj))
        {
            text = msgObj.TryGetProperty("text", out var textProp) ? textProp.GetString() : null;
            msgId = msgObj.TryGetProperty("msg_id", out var midProp) ? midProp.GetString() ?? "" : "";

            // Handle attachments
            if (msgObj.TryGetProperty("attachments", out var attachments) &&
                attachments.ValueKind == JsonValueKind.Array)
            {
                foreach (var att in attachments.EnumerateArray())
                {
                    if (att.TryGetProperty("payload", out var attPayload))
                    {
                        attachmentUrl = attPayload.TryGetProperty("url", out var urlProp) ? urlProp.GetString() : null;

                        // Try thumbnail for images
                        if (string.IsNullOrEmpty(attachmentUrl) &&
                            attPayload.TryGetProperty("thumbnail", out var thumbProp))
                        {
                            attachmentUrl = thumbProp.GetString();
                        }
                    }

                    if (att.TryGetProperty("type", out var typeProp))
                    {
                        attachmentType = typeProp.GetString() ?? "text";
                    }
                    break; // Take first attachment
                }
            }
        }

        // Determine attachment type from event name if not set
        if (attachmentType == "text" && eventName.Contains("_image")) attachmentType = "image";
        else if (attachmentType == "text" && eventName.Contains("_file")) attachmentType = "file";
        else if (attachmentType == "text" && eventName.Contains("_sticker")) attachmentType = "sticker";
        else if (attachmentType == "text" && eventName.Contains("_audio")) attachmentType = "audio";
        else if (attachmentType == "text" && eventName.Contains("_video")) attachmentType = "video";
        else if (attachmentType == "text" && eventName.Contains("_link")) attachmentType = "link";

        if (string.IsNullOrEmpty(msgId))
        {
            msgId = $"zalo_{timestamp}_{zaloUserId}";
        }

        // Check for sensitive content
        bool isSensitive = false;
        string sensitiveType = "";
        if (!string.IsNullOrEmpty(text))
        {
            isSensitive = _sensitiveContentDetector.ContainsSensitiveContent(text, out sensitiveType);
        }

        // Find the SocialAccount matching this OA
        // We search ignoring tenant filter since webhook has no auth context
        var socialAccount = await _dbContext.SocialAccounts
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(sa => sa.Platform == 9 && sa.AccountIdentifier == oaId);

        if (socialAccount == null)
        {
            _logger.LogWarning("No Zalo OA SocialAccount found for OA ID: {OAId}", oaId);
            return;
        }

        // Find or create conversation
        var conversation = await _dbContext.ZaloConversations
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.SocialAccountId == socialAccount.Id && c.ZaloUserId == zaloUserId);

        if (conversation == null)
        {
            conversation = new ZaloConversation
            {
                TenantId = socialAccount.TenantId,
                SocialAccountId = socialAccount.Id,
                ZaloUserId = zaloUserId,
                LastMessagePreview = text ?? $"[{attachmentType}]",
                LastMessageAtUtc = DateTimeOffset.FromUnixTimeMilliseconds(timestamp).UtcDateTime,
                IsRead = isFromOA // If OA sent it, it's "read"
            };
            _dbContext.ZaloConversations.Add(conversation);
            await _dbContext.SaveChangesAsync();
        }
        else
        {
            conversation.LastMessagePreview = text ?? $"[{attachmentType}]";
            conversation.LastMessageAtUtc = DateTimeOffset.FromUnixTimeMilliseconds(timestamp).UtcDateTime;
            if (!isFromOA) conversation.IsRead = false;
            conversation.UpdatedAt = DateTime.UtcNow;
        }

        // Check for duplicate message
        var exists = await _dbContext.ZaloMessages
            .IgnoreQueryFilters()
            .AnyAsync(m => m.ZaloMessageId == msgId);

        if (!exists)
        {
            var message = new ZaloMessage
            {
                TenantId = socialAccount.TenantId,
                ConversationId = conversation.Id,
                ZaloMessageId = msgId,
                SenderId = senderId,
                IsFromOA = isFromOA,
                Text = text,
                AttachmentUrl = attachmentUrl,
                AttachmentType = attachmentType,
                SentAtUtc = DateTimeOffset.FromUnixTimeMilliseconds(timestamp).UtcDateTime,
                IsSensitive = isSensitive,
                SensitiveType = sensitiveType
            };
            _dbContext.ZaloMessages.Add(message);
        }

        await _dbContext.SaveChangesAsync();

        // Push real-time update via SignalR
        var maskedText = isSensitive && !string.IsNullOrEmpty(text)
            ? _sensitiveContentDetector.MaskSensitiveContent(text)
            : text;

        var signalRPayload = new
        {
            conversationId = conversation.Id,
            zaloUserId,
            messageId = msgId,
            message = maskedText,
            originalMessage = text,
            attachmentUrl,
            attachmentType,
            isFromOA,
            isSensitive,
            sensitiveType,
            timestamp = DateTimeOffset.FromUnixTimeMilliseconds(timestamp).ToString("o"),
            senderDisplayName = conversation.UserDisplayName ?? zaloUserId,
            socialAccountId = socialAccount.Id
        };

        await _hubContext.Clients.All.SendAsync("ReceiveZaloEvent", signalRPayload);
    }

    private async Task HandleFollowEvent(JsonElement payload)
    {
        var followerId = GetNestedString(payload, "follower", "id");
        var oaId = GetNestedString(payload, "oa_id", null) ??
                   (payload.TryGetProperty("oa_id", out var oaProp) ? oaProp.GetString() : "");

        _logger.LogInformation("Zalo user {UserId} followed OA {OAId}", followerId, oaId);

        await _hubContext.Clients.All.SendAsync("ZaloFollowEvent", new
        {
            userId = followerId,
            oaId,
            eventType = "follow"
        });
    }

    private async Task HandleUnfollowEvent(JsonElement payload)
    {
        var followerId = GetNestedString(payload, "follower", "id");
        var oaId = payload.TryGetProperty("oa_id", out var oaProp) ? oaProp.GetString() : "";

        _logger.LogInformation("Zalo user {UserId} unfollowed OA {OAId}", followerId, oaId);

        await _hubContext.Clients.All.SendAsync("ZaloFollowEvent", new
        {
            userId = followerId,
            oaId,
            eventType = "unfollow"
        });
    }

    /// <summary>
    /// Verify Zalo webhook signature: sha256(appId + data + timestamp + OASecretKey).
    /// </summary>
    private bool VerifySignature(string rawBody)
    {
        var secret = _configuration["Zalo:OASecretKey"];
        if (string.IsNullOrEmpty(secret))
        {
            // If no secret configured, skip verification (dev mode)
            _logger.LogWarning("Zalo OASecretKey not configured — skipping signature verification.");
            return true;
        }

        var signature = Request.Headers["X-ZEvent-Signature"].FirstOrDefault();
        if (string.IsNullOrEmpty(signature))
        {
            _logger.LogWarning("Missing X-ZEvent-Signature header.");
            return false;
        }

        var appId = _configuration["Zalo:AppId"] ?? "";
        var timestamp = Request.Headers["X-ZEvent-Ts"].FirstOrDefault() ?? "";

        var dataToSign = $"{appId}{rawBody}{timestamp}{secret}";
        using var sha256 = SHA256.Create();
        var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(dataToSign));
        var computed = $"mac={Convert.ToHexStringLower(hash)}";

        return string.Equals(computed, signature, StringComparison.OrdinalIgnoreCase);
    }

    private static string GetNestedString(JsonElement element, string prop, string? childProp)
    {
        if (!element.TryGetProperty(prop, out var parent)) return "";

        if (childProp == null)
        {
            return parent.ValueKind == JsonValueKind.String ? parent.GetString() ?? "" : "";
        }

        return parent.TryGetProperty(childProp, out var child) && child.ValueKind == JsonValueKind.String
            ? child.GetString() ?? ""
            : "";
    }
}
