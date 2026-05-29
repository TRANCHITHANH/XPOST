using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Headers;
using System.Text.Json;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;

namespace XPost.WebAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/pages")]
public class PageManagementController : ControllerBase
{
    private readonly IRepository<SocialAccount> _accountRepository;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ISensitiveContentDetector _sensitiveContentDetector;
    private readonly IConfiguration _configuration;
    private readonly string _graphApiBase = "https://graph.facebook.com/v19.0";

    public PageManagementController(
        IRepository<SocialAccount> accountRepository,
        IHttpClientFactory httpClientFactory,
        ISensitiveContentDetector sensitiveContentDetector,
        IConfiguration configuration)
    {
        _accountRepository = accountRepository;
        _httpClientFactory = httpClientFactory;
        _sensitiveContentDetector = sensitiveContentDetector;
        _configuration = configuration;
    }

    private async Task<SocialAccount?> GetValidAccount(Guid accountId)
    {
        var account = await _accountRepository.GetByIdAsync(accountId);
        if (account == null || (account.Platform != 1 && account.Platform != 3)) // 1 is FB, 3 is IG
            return null;

        return account;
    }

    [HttpGet("{accountId}/posts")]
    public async Task<IActionResult> GetPosts(Guid accountId)
    {
        var account = await GetValidAccount(accountId);
        if (account == null) return NotFound("Account not found or not an Instagram/Facebook account");

        var client = _httpClientFactory.CreateClient();
        string url = account.Platform == 3 
            ? $"{_graphApiBase}/{account.AccountIdentifier}/media?fields=id,caption,media_type,media_url,timestamp,comments_count,like_count&access_token={account.AccessToken}"
            : $"{_graphApiBase}/{account.AccountIdentifier}/published_posts?fields=id,message,full_picture,created_time,comments.summary(1),likes.summary(1)&access_token={account.AccessToken}";
        
        var response = await client.GetAsync(url);
        var content = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            int code = (int)response.StatusCode;
            return StatusCode(code == 401 || code == 403 ? 400 : code, content);
        }

        if (account.Platform == 1)
        {
            // Map Facebook to Instagram-like structure
            using var document = JsonDocument.Parse(content);
            var root = document.RootElement;
            if (root.TryGetProperty("data", out var data))
            {
                var mappedData = new List<object>();
                foreach (var post in data.EnumerateArray())
                {
                    var mappedPost = new Dictionary<string, object>
                    {
                        { "id", post.TryGetProperty("id", out var idProp) ? idProp.GetString() : "" },
                        { "caption", post.TryGetProperty("message", out var msgProp) ? msgProp.GetString() : "" },
                        { "media_url", post.TryGetProperty("full_picture", out var picProp) ? picProp.GetString() : "" },
                        { "timestamp", post.TryGetProperty("created_time", out var timeProp) ? timeProp.GetString() : "" }
                    };
                    
                    if (post.TryGetProperty("comments", out var commObj) && commObj.TryGetProperty("summary", out var commSum) && commSum.TryGetProperty("total_count", out var cCount))
                        mappedPost["comments_count"] = cCount.GetInt32();
                    else mappedPost["comments_count"] = 0;

                    if (post.TryGetProperty("likes", out var likeObj) && likeObj.TryGetProperty("summary", out var likeSum) && likeSum.TryGetProperty("total_count", out var lCount))
                        mappedPost["like_count"] = lCount.GetInt32();
                    else mappedPost["like_count"] = 0;

                    mappedData.Add(mappedPost);
                }
                var result = new Dictionary<string, object> { { "data", mappedData } };
                if (root.TryGetProperty("paging", out var paging)) result["paging"] = JsonSerializer.Deserialize<object>(paging.GetRawText());
                return Ok(result);
            }
        }

        return Content(content, "application/json");
    }

    [HttpDelete("{accountId}/posts/{postId}")]
    public async Task<IActionResult> DeletePost(Guid accountId, string postId)
    {
        var account = await GetValidAccount(accountId);
        if (account == null) return NotFound("Account not found");

        var client = _httpClientFactory.CreateClient();
        string url = $"{_graphApiBase}/{postId}?access_token={account.AccessToken}";

        try
        {
            var response = await client.DeleteAsync(url);
            var content = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                return BadRequest($"Failed to delete post from Facebook: {content}");
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            return BadRequest($"Error deleting post: {ex.Message}");
        }
    }

    [HttpGet("{accountId}/posts/{postId}/comments")]
    public async Task<IActionResult> GetComments(Guid accountId, string postId)
    {
        var account = await GetValidAccount(accountId);
        if (account == null) return NotFound();

        var client = _httpClientFactory.CreateClient();
        
        string fields = account.Platform == 3 
            ? "id,text,timestamp,username,from,hidden,replies{id,text,timestamp,username,from,hidden}"
            : "id,message,created_time,from{id,name},is_hidden,comments{id,message,created_time,from{id,name},is_hidden}";
            
        var url = $"{_graphApiBase}/{postId}/comments?fields={fields}&access_token={account.AccessToken}";
        
        var response = await client.GetAsync(url);
        if (!response.IsSuccessStatusCode)
        {
            int code = (int)response.StatusCode;
            return StatusCode(code == 401 || code == 403 ? 400 : code, await response.Content.ReadAsStringAsync());
        }

        var content = await response.Content.ReadAsStringAsync();
        
        Console.WriteLine($"\n=== FB/IG COMMENTS API DEBUG ===");
        Console.WriteLine($"URL: {url}");
        Console.WriteLine($"CONTENT: {content}");
        Console.WriteLine($"==================================\n");
        
        // Parse and mask sensitive content
        using var document = JsonDocument.Parse(content);
        var root = document.RootElement;
        
        var options = new JsonSerializerOptions { WriteIndented = true };
        
        // We'll create a dictionary to hold the modified response
        // Note: For a robust implementation, we should deserialize to strong types, but for proxying JsonDocument is okay
        var modifiedData = ProcessCommentsForSensitiveData(root, account.AccountIdentifier, account.AccessToken, account.Platform);

        return Ok(modifiedData);
    }

    private object ProcessCommentsForSensitiveData(JsonElement root, string? accountIdentifier, string? accessToken, int platform)
    {
        if (!root.TryGetProperty("data", out var data)) return root;

        var processedComments = new List<object>();
        foreach (var comment in data.EnumerateArray())
        {
            var textPropName = platform == 1 ? "message" : "text";
            var timePropName = platform == 1 ? "created_time" : "timestamp";
            var hiddenPropName = platform == 1 ? "is_hidden" : "hidden";
            var repliesPropName = platform == 1 ? "comments" : "replies";

            var text = comment.TryGetProperty(textPropName, out var tp) ? tp.GetString() ?? "" : "";
            var isSensitive = _sensitiveContentDetector.ContainsSensitiveContent(text, out var detectedType);
            var maskedText = isSensitive ? _sensitiveContentDetector.MaskSensitiveContent(text) : text;

            var isHidden = comment.TryGetProperty(hiddenPropName, out var hiddenProp) && hiddenProp.GetBoolean();

            if (isSensitive && !isHidden && !string.IsNullOrEmpty(accessToken))
            {
                var commentId = comment.GetProperty("id").GetString();
                if (!string.IsNullOrEmpty(commentId))
                {
                    Task.Run(() => HideCommentInternal(commentId, accessToken, platform));
                }
            }

            var username = "";
            if (platform == 3) username = comment.TryGetProperty("username", out var up) ? up.GetString() : "";
            else if (comment.TryGetProperty("from", out var fp) && fp.TryGetProperty("name", out var np)) username = np.GetString();

            var commentObj = new Dictionary<string, object>
            {
                { "id", comment.GetProperty("id").GetString() },
                { "text", maskedText },
                { "originalText", text },
                { "username", username },
                { "timestamp", comment.TryGetProperty(timePropName, out var tip) ? tip.GetString() : "" },
                { "isSensitive", isSensitive },
                { "sensitiveType", detectedType },
                { "hidden", isHidden }
            };

            if (comment.TryGetProperty("from", out var fromProp))
            {
                commentObj.Add("from", JsonSerializer.Deserialize<object>(fromProp.GetRawText()));
            }

            if (comment.TryGetProperty(repliesPropName, out var repliesWrapper) && repliesWrapper.TryGetProperty("data", out var repliesData))
            {
                var processedReplies = new List<object>();
                foreach (var reply in repliesData.EnumerateArray())
                {
                    var repText = reply.TryGetProperty(textPropName, out var rtp) ? rtp.GetString() ?? "" : "";
                    var repSensitive = _sensitiveContentDetector.ContainsSensitiveContent(repText, out var repType);
                    var repMaskedText = repSensitive ? _sensitiveContentDetector.MaskSensitiveContent(repText) : repText;

                    var repHidden = reply.TryGetProperty(hiddenPropName, out var repHiddenProp) && repHiddenProp.GetBoolean();

                    if (repSensitive && !repHidden && !string.IsNullOrEmpty(accessToken))
                    {
                        var repId = reply.GetProperty("id").GetString();
                        if (!string.IsNullOrEmpty(repId))
                        {
                            Task.Run(() => HideCommentInternal(repId, accessToken, platform));
                        }
                    }

                    var repUsername = "";
                    if (platform == 3) repUsername = reply.TryGetProperty("username", out var rup) ? rup.GetString() : "";
                    else if (reply.TryGetProperty("from", out var rfp) && rfp.TryGetProperty("name", out var rnp)) repUsername = rnp.GetString();

                    var repDict = new Dictionary<string, object>
                    {
                        { "id", reply.GetProperty("id").GetString() },
                        { "text", repMaskedText },
                        { "originalText", repText },
                        { "username", repUsername },
                        { "timestamp", reply.TryGetProperty(timePropName, out var rtip) ? rtip.GetString() : "" },
                        { "isSensitive", repSensitive },
                        { "sensitiveType", repType },
                        { "hidden", repHidden }
                    };

                    if (reply.TryGetProperty("from", out var repFromProp))
                    {
                        repDict.Add("from", JsonSerializer.Deserialize<object>(repFromProp.GetRawText()));
                    }

                    processedReplies.Add(repDict);
                }
                commentObj.Add("replies", new { data = processedReplies });
            }

            processedComments.Add(commentObj);
        }

        var result = new Dictionary<string, object> { 
            { "data", processedComments },
            { "pageId", accountIdentifier }
        };
        if (root.TryGetProperty("paging", out var paging))
        {
            // Just copy paging object
            result.Add("paging", JsonSerializer.Deserialize<object>(paging.GetRawText()));
        }

        return result;
    }

    private async Task HideCommentInternal(string commentId, string accessToken, int platform)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            var url = $"{_graphApiBase}/{commentId}";
            
            var hideKey = platform == 1 ? "is_hidden" : "hide";

            var content = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>(hideKey, "true"),
                new KeyValuePair<string, string>("access_token", accessToken)
            });

            var response = await client.PostAsync(url, content);
            var respString = await response.Content.ReadAsStringAsync();
            Console.WriteLine($"\n=== HIDE COMMENT API DEBUG ===");
            Console.WriteLine($"URL: {url}");
            Console.WriteLine($"STATUS: {response.StatusCode}");
            Console.WriteLine($"RESPONSE: {respString}");
            Console.WriteLine($"==============================\n");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"HideCommentInternal Error: {ex.Message}");
        }
    }

    public class ReplyRequest { public string Message { get; set; } = string.Empty; }

    [HttpPost("{accountId}/comments/{commentId}/reply")]
    public async Task<IActionResult> ReplyComment(Guid accountId, string commentId, [FromBody] ReplyRequest request)
    {
        var account = await GetValidAccount(accountId);
        if (account == null) return NotFound();

        var client = _httpClientFactory.CreateClient();
        var url = $"{_graphApiBase}/{commentId}/replies";
        
        var content = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("message", request.Message),
            new KeyValuePair<string, string>("access_token", account.AccessToken!)
        });

        var response = await client.PostAsync(url, content);
        var respString = await response.Content.ReadAsStringAsync();
        
        int code = (int)response.StatusCode;
        return StatusCode(code == 401 || code == 403 ? 400 : code, respString);
    }

    [HttpPost("{accountId}/comments/{commentId}/hide")]
    public async Task<IActionResult> HideComment(Guid accountId, string commentId)
    {
        var account = await GetValidAccount(accountId);
        if (account == null) return NotFound();

        var client = _httpClientFactory.CreateClient();
        var url = $"{_graphApiBase}/{commentId}";
        
        var hideKey = account.Platform == 1 ? "is_hidden" : "hide";

        var content = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>(hideKey, "true"),
            new KeyValuePair<string, string>("access_token", account.AccessToken!)
        });

        var response = await client.PostAsync(url, content);
        var respString = await response.Content.ReadAsStringAsync();
        
        int code = (int)response.StatusCode;
        return StatusCode(code == 401 || code == 403 ? 400 : code, respString);
    }

    [HttpGet("{accountId}/conversations")]
    public async Task<IActionResult> GetConversations(Guid accountId)
    {
        try
        {
            var account = await GetValidAccount(accountId);
            if (account == null) 
            {
                Console.WriteLine($"[ERROR] GetConversations: Account {accountId} not found or invalid platform.");
                return NotFound(new { error = "Account not found or invalid platform." });
            }

            var client = _httpClientFactory.CreateClient();
            
            // 1. Lấy Facebook Page ID từ Page Access Token
            string pageId = account.AccountIdentifier ?? "";
            var pageMeUrl = $"{_graphApiBase}/me?fields=id&access_token={account.AccessToken}";
            var pageMeResponse = await client.GetAsync(pageMeUrl);
            
            if (pageMeResponse.IsSuccessStatusCode)
            {
                var meJsonContent = await pageMeResponse.Content.ReadAsStringAsync();
                var meJson = JsonDocument.Parse(meJsonContent).RootElement;
                if (meJson.TryGetProperty("id", out var idProp))
                {
                    pageId = idProp.GetString() ?? pageId;
                }
            }
            else
            {
                var errorMe = await pageMeResponse.Content.ReadAsStringAsync();
                Console.WriteLine($"\n[ERROR] GetConversations: Failed to fetch /me. Status: {pageMeResponse.StatusCode}, Response: {errorMe}");
                // We don't fail here yet, we try to fallback to account.AccountIdentifier
            }

            // 2. Lấy danh sách hội thoại
            string platformQuery = account.Platform == 3 ? "platform=instagram&" : "";
            var url = $"{_graphApiBase}/{pageId}/conversations?{platformQuery}fields=id,updated_time,participants,messages.limit(20){{message,from,attachments,created_time}}&access_token={account.AccessToken}";
            
            var response = await client.GetAsync(url);
            var content = await response.Content.ReadAsStringAsync();

            Console.WriteLine($"\n=== IG CONVERSATIONS API DEBUG ===");
            Console.WriteLine($"URL: {url}");
            Console.WriteLine($"STATUS: {response.StatusCode}");
            Console.WriteLine($"CONTENT: {content}");
            Console.WriteLine($"==================================\n");

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[ERROR] GetConversations: Graph API returned {(int)response.StatusCode}. Details: {content}");
                int code = (int)response.StatusCode;
                return StatusCode(code == 401 || code == 403 ? 400 : code, new { 
                    error = "Graph API Error fetching conversations", 
                    details = content, 
                    statusCode = code,
                    url = url // Useful for debugging
                });
            }

            using var document = JsonDocument.Parse(content);
            var root = document.RootElement;
            
            var result = new Dictionary<string, object>();
            if (root.TryGetProperty("data", out var data))
            {
                result.Add("data", JsonSerializer.Deserialize<object>(data.GetRawText())!);
            }
            else 
            {
                Console.WriteLine($"[WARNING] GetConversations: Missing 'data' array in Graph API response. Content: {content}");
            }

            if (root.TryGetProperty("paging", out var paging))
            {
                result.Add("paging", JsonSerializer.Deserialize<object>(paging.GetRawText())!);
            }
            // Trả về AccountIdentifier (IG ID) làm pageId để Frontend đánh dấu "tin nhắn của mình"
            result.Add("pageId", account.AccountIdentifier!);

            return Ok(result);
        }
        catch (JsonException jsonEx)
        {
            Console.WriteLine($"[ERROR] GetConversations JSON Parsing Error: {jsonEx.Message}");
            return StatusCode(500, new { error = "Failed to parse JSON response from Graph API", details = jsonEx.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] GetConversations Exception: {ex.Message}\n{ex.StackTrace}");
            return StatusCode(500, new { error = "Internal server error in GetConversations", details = ex.Message });
        }
    }

    [HttpGet("{accountId}/conversations/{convId}/messages")]
    public async Task<IActionResult> GetMessages(Guid accountId, string convId)
    {
        try
        {
            var account = await GetValidAccount(accountId);
            if (account == null) 
            {
                Console.WriteLine($"[ERROR] GetMessages: Account {accountId} not found or invalid platform.");
                return NotFound(new { error = "Account not found or invalid platform." });
            }

            var client = _httpClientFactory.CreateClient();
            var url = $"{_graphApiBase}/{convId}?fields=messages.limit(20){{id,created_time,message,from,attachments}}&access_token={account.AccessToken}";
            
            var response = await client.GetAsync(url);
            var content = await response.Content.ReadAsStringAsync();
            
            Console.WriteLine($"\n=== IG MESSAGES API DEBUG ===");
            Console.WriteLine($"URL: {url}");
            Console.WriteLine($"STATUS: {response.StatusCode}");
            // Limit logging content to avoid flooding the console if it's too long, but for debug it's fine.
            Console.WriteLine($"CONTENT: {content}");
            Console.WriteLine($"=============================\n");

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[ERROR] GetMessages: Graph API returned {(int)response.StatusCode}. Details: {content}");
                int code = (int)response.StatusCode;
                return StatusCode(code == 401 || code == 403 ? 400 : code, new { 
                    error = "Graph API Error fetching messages", 
                    details = content, 
                    statusCode = code 
                });
            }

            // Process sensitive content in messages
            using var document = JsonDocument.Parse(content);
            var root = document.RootElement;

            if (root.TryGetProperty("messages", out var messagesObj) && messagesObj.TryGetProperty("data", out var messagesData))
            {
                var processedMessages = new List<object>();
                foreach (var msg in messagesData.EnumerateArray())
                {
                    var text = msg.TryGetProperty("message", out var textProp) ? textProp.GetString() : "";
                    var isSensitive = _sensitiveContentDetector.ContainsSensitiveContent(text ?? "", out var detectedType);
                    var maskedText = isSensitive ? _sensitiveContentDetector.MaskSensitiveContent(text ?? "") : text;

                    var msgDict = new Dictionary<string, object>();
                    
                    // Copy all existing properties
                    foreach (var prop in msg.EnumerateObject())
                    {
                        if (prop.Name == "message") continue;

                        if (prop.Name == "attachments" && prop.Value.ValueKind == JsonValueKind.Object)
                        {
                            var attachmentsObj = JsonSerializer.Deserialize<Dictionary<string, object>>(prop.Value.GetRawText())!;
                            if (prop.Value.TryGetProperty("data", out var attData) && attData.ValueKind == JsonValueKind.Array)
                            {
                                var newData = new List<Dictionary<string, object>>();
                                foreach (var att in attData.EnumerateArray())
                                {
                                    var attDict = JsonSerializer.Deserialize<Dictionary<string, object>>(att.GetRawText())!;
                                    
                                    if (att.TryGetProperty("image_data", out var imgData) && imgData.TryGetProperty("url", out var imgUrlProp))
                                    {
                                        string imgUrl = imgUrlProp.GetString()!;
                                        try 
                                        {
                                            var fetchUrl = imgUrl;
                                            if (!fetchUrl.Contains("access_token")) 
                                            {
                                                fetchUrl += (fetchUrl.Contains("?") ? "&" : "?") + $"access_token={account.AccessToken}";
                                            }

                                            var imgReq = new HttpRequestMessage(HttpMethod.Get, fetchUrl);
                                            var imgRes = await client.SendAsync(imgReq);
                                            
                                            if (imgRes.IsSuccessStatusCode)
                                            {
                                                var imgBytes = await imgRes.Content.ReadAsByteArrayAsync();
                                                string base64 = Convert.ToBase64String(imgBytes);
                                                
                                                string mimeType = "image/jpeg";
                                                if (att.TryGetProperty("mime_type", out var mimeProp) && mimeProp.ValueKind == JsonValueKind.String)
                                                {
                                                    mimeType = mimeProp.GetString() ?? mimeType;
                                                }
                                                
                                                var newImgData = JsonSerializer.Deserialize<Dictionary<string, object>>(imgData.GetRawText())!;
                                                newImgData["url"] = $"data:{mimeType};base64,{base64}";
                                                attDict["image_data"] = newImgData;
                                            }
                                            else
                                            {
                                                attDict["fetch_error"] = $"HTTP {(int)imgRes.StatusCode}: {await imgRes.Content.ReadAsStringAsync()}";
                                            }
                                        }
                                        catch (Exception ex)
                                        {
                                            attDict["fetch_error"] = ex.Message;
                                            Console.WriteLine($"[WARNING] Failed to fetch image for base64 conversion: {ex.Message}");
                                        }
                                    }
                                    newData.Add(attDict);
                                }
                                attachmentsObj["data"] = newData;
                            }
                            msgDict[prop.Name] = attachmentsObj;
                        }
                        else 
                        {
                            msgDict[prop.Name] = JsonSerializer.Deserialize<object>(prop.Value.GetRawText())!;
                        }
                    }

                    // Add modified text and sensitive flags
                    msgDict["message"] = maskedText!;
                    msgDict["originalMessage"] = text!;
                    msgDict["isSensitive"] = isSensitive;
                    msgDict["sensitiveType"] = detectedType!;

                    processedMessages.Add(msgDict);
                }

                var result = new Dictionary<string, object>
                {
                    { "id", root.GetProperty("id").GetString()! },
                    { "messages", new { data = processedMessages } }
                };

                return Ok(result);
            }
            else 
            {
                Console.WriteLine($"[WARNING] GetMessages: Missing 'messages.data' in Graph API response. Content: {content}");
                return Ok(new { error = "No messages found or invalid response format", details = content });
            }
        }
        catch (JsonException jsonEx)
        {
            Console.WriteLine($"[ERROR] GetMessages JSON Parsing Error: {jsonEx.Message}");
            return StatusCode(500, new { error = "Failed to parse JSON response from Graph API", details = jsonEx.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] GetMessages Exception: {ex.Message}\n{ex.StackTrace}");
            return StatusCode(500, new { error = "Internal server error in GetMessages", details = ex.Message });
        }
    }

    public class SendMessageRequest 
    { 
        public string RecipientId { get; set; } = string.Empty; 
        public string? Message { get; set; } 
        public string? MediaUrl { get; set; }
        public string? MediaType { get; set; } // "image" or "video"
    }

    [HttpPost("{accountId}/messages/send")]
    public async Task<IActionResult> SendMessage(Guid accountId, [FromBody] SendMessageRequest request)
    {
        var account = await GetValidAccount(accountId);
        if (account == null) return NotFound();

        var client = _httpClientFactory.CreateClient();
        var url = $"{_graphApiBase}/me/messages?access_token={account.AccessToken}";
        
        object payload;

        if (!string.IsNullOrEmpty(request.MediaUrl))
        {
            string absoluteUrl = request.MediaUrl;
            if (absoluteUrl.StartsWith("/"))
            {
                var apiBaseUrl = _configuration["AppConfig:ApiBaseUrl"]?.TrimEnd('/');
                absoluteUrl = $"{apiBaseUrl}{absoluteUrl}";
            }

            payload = new
            {
                recipient = new { id = request.RecipientId },
                message = new
                {
                    attachment = new
                    {
                        type = request.MediaType ?? "image",
                        payload = new { url = absoluteUrl }
                    }
                }
            };
        }
        else
        {
            payload = new
            {
                recipient = new { id = request.RecipientId },
                message = new { text = request.Message }
            };
        }

        var content = new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");

        var response = await client.PostAsync(url, content);
        var respString = await response.Content.ReadAsStringAsync();
        
        int code = (int)response.StatusCode;
        return StatusCode(code == 401 || code == 403 ? 400 : code, respString);
    }
}
