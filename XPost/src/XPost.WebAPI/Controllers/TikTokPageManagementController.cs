using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;
using XPost.Infrastructure.Persistence;

namespace XPost.WebAPI.Controllers;

/// <summary>
/// Manages TikTok Business page interactions: video posts, comments, conversations, and messages.
/// Comments are fetched from TikTok API with sensitive content detection.
/// Conversations and messages are stored locally (via webhook) with real-time SignalR updates.
/// </summary>
[Authorize]
[ApiController]
[Route("api/tiktok-pages")]
public class TikTokPageManagementController : ControllerBase
{
    private readonly IRepository<SocialAccount> _accountRepository;
    private readonly ApplicationDbContext _dbContext;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ISensitiveContentDetector _sensitiveContentDetector;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TikTokPageManagementController> _logger;
    private const string OpenApiBase = "https://open.tiktokapis.com/v2";

    public TikTokPageManagementController(
        IRepository<SocialAccount> accountRepository,
        ApplicationDbContext dbContext,
        IHttpClientFactory httpClientFactory,
        ISensitiveContentDetector sensitiveContentDetector,
        IConfiguration configuration,
        ILogger<TikTokPageManagementController> logger)
    {
        _accountRepository = accountRepository;
        _dbContext = dbContext;
        _httpClientFactory = httpClientFactory;
        _sensitiveContentDetector = sensitiveContentDetector;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Validates that the given account is a TikTok (Platform = 5).
    /// </summary>
    private async Task<SocialAccount?> GetValidTikTokAccount(Guid accountId)
    {
        var account = await _accountRepository.GetByIdAsync(accountId);
        if (account == null || account.Platform != 5) return null;
        return account;
    }

    // ═══════════════════════════════════════════════════════
    // VIDEO POSTS (from TikTok API + local PostTarget)
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// GET /api/tiktok-pages/{accountId}/posts
    /// Returns videos from the TikTok account via API.
    /// </summary>
    [HttpGet("{accountId}/posts")]
    public async Task<IActionResult> GetPosts(Guid accountId)
    {
        var account = await GetValidTikTokAccount(accountId);
        if (account == null) return NotFound(new { error = "Account not found or not a TikTok account." });

        if (string.IsNullOrEmpty(account.AccessToken))
            return BadRequest(new { error = "TikTok Access Token is missing." });

        var client = _httpClientFactory.CreateClient();

        // Try TikTok Video List API
        var url = $"{OpenApiBase}/video/list/?fields=id,title,cover_image_url,create_time,like_count,comment_count,view_count,share_count";
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", account.AccessToken);
        request.Content = new StringContent(
            JsonSerializer.Serialize(new { max_count = 20 }),
            Encoding.UTF8, "application/json");

        var response = await client.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();

        _logger.LogInformation("TikTok video list response: {Response}", content);

        if (!response.IsSuccessStatusCode)
        {
            // Fallback to local PostTarget records
            return await GetLocalPosts(accountId);
        }

        try
        {
            var result = JsonSerializer.Deserialize<JsonElement>(content);
            if (result.TryGetProperty("data", out var data) && data.TryGetProperty("videos", out var videos))
            {
                var mappedPosts = new List<object>();
                foreach (var video in videos.EnumerateArray())
                {
                    mappedPosts.Add(new
                    {
                        id = video.TryGetProperty("id", out var idProp) ? idProp.GetString() : "",
                        caption = video.TryGetProperty("title", out var titleProp) ? titleProp.GetString() : "",
                        media_url = video.TryGetProperty("cover_image_url", out var coverProp) ? coverProp.GetString() : "",
                        timestamp = video.TryGetProperty("create_time", out var timeProp) ? timeProp.GetInt64().ToString() : "",
                        comments_count = video.TryGetProperty("comment_count", out var ccProp) ? ccProp.GetInt32() : 0,
                        like_count = video.TryGetProperty("like_count", out var lcProp) ? lcProp.GetInt32() : 0,
                        view_count = video.TryGetProperty("view_count", out var vcProp) ? vcProp.GetInt32() : 0,
                        share_count = video.TryGetProperty("share_count", out var scProp) ? scProp.GetInt32() : 0
                    });
                }

                return Ok(new { data = mappedPosts });
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse TikTok video list response");
        }

        return await GetLocalPosts(accountId);
    }

    /// <summary>
    /// Fallback: Returns posts from local PostTarget records.
    /// </summary>
    private async Task<IActionResult> GetLocalPosts(Guid accountId)
    {
        var posts = await _dbContext.PostTargets
            .Include(pt => pt.Post)
            .Where(pt => pt.SocialAccountId == accountId)
            .OrderByDescending(pt => pt.CreatedAt)
            .Select(pt => new
            {
                id = pt.PublishedPostId ?? pt.Id.ToString(),
                caption = pt.Post.Title ?? pt.Post.Content,
                media_url = pt.Post.FeaturedImageUrl,
                timestamp = pt.CreatedAt.ToString("o"),
                status = pt.Status,
                publishedUrl = pt.PublishedUrl,
                comments_count = 0,
                like_count = 0,
                view_count = 0,
                share_count = 0
            })
            .ToListAsync();

        return Ok(new { data = posts });
    }

    // ═══════════════════════════════════════════════════════
    // COMMENTS (via TikTok API + sensitive content detection)
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// GET /api/tiktok-pages/{accountId}/posts/{videoId}/comments
    /// Fetches comments for a video, applies sensitive content detection and masking.
    /// </summary>
    [HttpGet("{accountId}/posts/{videoId}/comments")]
    public async Task<IActionResult> GetComments(Guid accountId, string videoId)
    {
        var account = await GetValidTikTokAccount(accountId);
        if (account == null) return NotFound();

        if (string.IsNullOrEmpty(account.AccessToken))
            return BadRequest(new { error = "Access token missing." });

        var client = _httpClientFactory.CreateClient();
        var url = $"{OpenApiBase}/comment/list/?fields=id,text,create_time,user,like_count,reply_count";

        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", account.AccessToken);
        request.Content = new StringContent(
            JsonSerializer.Serialize(new { video_id = videoId, max_count = 50 }),
            Encoding.UTF8, "application/json");

        var response = await client.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();

        _logger.LogInformation("TikTok comments response for video {VideoId}: {Response}", videoId, content);

        if (!response.IsSuccessStatusCode)
        {
            return StatusCode((int)response.StatusCode, new { error = "TikTok API error", details = content });
        }

        // Parse and process sensitive content
        var result = JsonSerializer.Deserialize<JsonElement>(content);
        var processedComments = new List<object>();

        if (result.TryGetProperty("data", out var data) && data.TryGetProperty("comments", out var comments))
        {
            foreach (var comment in comments.EnumerateArray())
            {
                var text = comment.TryGetProperty("text", out var textProp) ? textProp.GetString() ?? "" : "";
                var isSensitive = _sensitiveContentDetector.ContainsSensitiveContent(text, out var detectedType);
                var maskedText = isSensitive ? _sensitiveContentDetector.MaskSensitiveContent(text) : text;

                var username = "";
                if (comment.TryGetProperty("user", out var userProp) && userProp.TryGetProperty("display_name", out var nameProp))
                {
                    username = nameProp.GetString() ?? "";
                }

                var commentId = comment.TryGetProperty("id", out var cidProp) ? cidProp.GetString() ?? "" : "";

                // Auto-hide sensitive comments (if API supports it)
                if (isSensitive && !string.IsNullOrEmpty(commentId))
                {
                    _ = Task.Run(() => HideCommentAsync(account.AccessToken, videoId, commentId));
                }

                processedComments.Add(new
                {
                    id = commentId,
                    text = maskedText,
                    originalText = text,
                    username,
                    timestamp = comment.TryGetProperty("create_time", out var ctProp) ? ctProp.GetInt64().ToString() : "",
                    isSensitive,
                    sensitiveType = detectedType,
                    hidden = false,
                    like_count = comment.TryGetProperty("like_count", out var lcProp) ? lcProp.GetInt32() : 0,
                    reply_count = comment.TryGetProperty("reply_count", out var rcProp) ? rcProp.GetInt32() : 0
                });
            }
        }

        return Ok(new { data = processedComments, pageId = account.AccountIdentifier });
    }

    /// <summary>
    /// POST /api/tiktok-pages/{accountId}/comments/{commentId}/reply
    /// Replies to a comment on a TikTok video.
    /// </summary>
    [HttpPost("{accountId}/posts/{videoId}/comments/{commentId}/reply")]
    public async Task<IActionResult> ReplyComment(Guid accountId, string videoId, string commentId, [FromBody] TikTokReplyRequest request)
    {
        var account = await GetValidTikTokAccount(accountId);
        if (account == null) return NotFound();

        var client = _httpClientFactory.CreateClient();
        var url = $"{OpenApiBase}/comment/reply/";

        var payload = new
        {
            video_id = videoId,
            comment_id = commentId,
            text = request.Message
        };

        var httpRequest = new HttpRequestMessage(HttpMethod.Post, url);
        httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", account.AccessToken);
        httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var response = await client.SendAsync(httpRequest);
        var responseBody = await response.Content.ReadAsStringAsync();

        _logger.LogInformation("TikTok reply comment response: {Response}", responseBody);

        if (!response.IsSuccessStatusCode)
        {
            return StatusCode((int)response.StatusCode, new { error = "TikTok API error", details = responseBody });
        }

        return Ok(new { success = true, details = responseBody });
    }

    /// <summary>
    /// Attempt to hide a sensitive comment via TikTok API.
    /// </summary>
    private async Task HideCommentAsync(string accessToken, string videoId, string commentId)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            var url = $"{OpenApiBase}/comment/hide/";

            var payload = new
            {
                video_id = videoId,
                comment_ids = new[] { commentId },
                hidden = true
            };

            var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            var response = await client.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();
            _logger.LogInformation("TikTok hide comment response: {Response}", content);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to hide TikTok comment {CommentId}", commentId);
        }
    }

    // ═══════════════════════════════════════════════════════
    // CONVERSATIONS (from local DB - via webhook)
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// GET /api/tiktok-pages/{accountId}/conversations
    /// Returns conversations stored locally from webhook events.
    /// </summary>
    [HttpGet("{accountId}/conversations")]
    public async Task<IActionResult> GetConversations(Guid accountId)
    {
        var account = await GetValidTikTokAccount(accountId);
        if (account == null) return NotFound(new { error = "Account not found or not a TikTok account." });

        var conversations = await _dbContext.TikTokConversations
            .Where(c => c.SocialAccountId == accountId)
            .OrderByDescending(c => c.LastMessageAtUtc)
            .Select(c => new
            {
                c.Id,
                c.TikTokUserId,
                c.UserDisplayName,
                c.UserAvatarUrl,
                c.LastMessagePreview,
                lastMessageAt = c.LastMessageAtUtc,
                c.IsRead,
                messageCount = c.Messages.Count
            })
            .ToListAsync();

        return Ok(new { data = conversations, pageId = account.AccountIdentifier });
    }

    /// <summary>
    /// GET /api/tiktok-pages/{accountId}/conversations/{convId}/messages
    /// Returns messages from a specific conversation.
    /// </summary>
    [HttpGet("{accountId}/conversations/{convId}/messages")]
    public async Task<IActionResult> GetMessages(Guid accountId, Guid convId)
    {
        var account = await GetValidTikTokAccount(accountId);
        if (account == null) return NotFound();

        // Mark conversation as read
        var conv = await _dbContext.TikTokConversations.FindAsync(convId);
        if (conv != null && !conv.IsRead)
        {
            conv.IsRead = true;
            conv.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();
        }

        var messages = await _dbContext.TikTokMessages
            .Where(m => m.ConversationId == convId)
            .OrderBy(m => m.SentAtUtc)
            .Select(m => new
            {
                m.Id,
                m.TikTokMessageId,
                m.SenderId,
                m.IsFromBusiness,
                message = m.IsSensitive && m.Text != null
                    ? _sensitiveContentDetector.MaskSensitiveContent(m.Text)
                    : m.Text,
                originalMessage = m.Text,
                m.AttachmentUrl,
                m.AttachmentType,
                timestamp = m.SentAtUtc,
                m.IsSensitive,
                m.SensitiveType
            })
            .ToListAsync();

        return Ok(new
        {
            id = convId,
            messages = new { data = messages }
        });
    }

    /// <summary>
    /// POST /api/tiktok-pages/{accountId}/conversations/{convId}/read
    /// Marks a conversation as read.
    /// </summary>
    [HttpPost("{accountId}/conversations/{convId}/read")]
    public async Task<IActionResult> MarkAsRead(Guid accountId, Guid convId)
    {
        var account = await GetValidTikTokAccount(accountId);
        if (account == null) return NotFound();

        var conv = await _dbContext.TikTokConversations.FindAsync(convId);
        if (conv == null) return NotFound();

        conv.IsRead = true;
        conv.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        return Ok(new { success = true });
    }

    // ═══════════════════════════════════════════════════════
    // SEND MESSAGE (via TikTok Business Messaging API)
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// POST /api/tiktok-pages/{accountId}/messages/send
    /// Sends a message to a TikTok user via Business Messaging API.
    /// </summary>
    [HttpPost("{accountId}/messages/send")]
    public async Task<IActionResult> SendMessage(Guid accountId, [FromBody] TikTokSendMessageRequest request)
    {
        var account = await GetValidTikTokAccount(accountId);
        if (account == null) return NotFound();

        if (string.IsNullOrEmpty(account.AccessToken))
            return BadRequest(new { error = "TikTok Access Token is missing." });

        var client = _httpClientFactory.CreateClient();

        // Build payload based on message type
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
                user_id = request.RecipientId,
                msg_type = request.MediaType ?? "image",
                media_url = absoluteUrl
            };
        }
        else
        {
            payload = new
            {
                user_id = request.RecipientId,
                msg_type = "text",
                text = request.Message
            };
        }

        var url = $"{OpenApiBase}/im/message/send/";
        var httpRequest = new HttpRequestMessage(HttpMethod.Post, url);
        httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", account.AccessToken);
        httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var response = await client.SendAsync(httpRequest);
        var responseBody = await response.Content.ReadAsStringAsync();

        _logger.LogInformation("TikTok send message response: {Response}", responseBody);

        if (!response.IsSuccessStatusCode)
        {
            return StatusCode((int)response.StatusCode, new { error = "TikTok API error", details = responseBody });
        }

        // Parse response for error check
        var result = JsonSerializer.Deserialize<JsonElement>(responseBody);
        if (result.TryGetProperty("error", out var errProp) && errProp.TryGetProperty("code", out var codeProp) && codeProp.GetString() != "ok")
        {
            var errMsg = errProp.TryGetProperty("message", out var msgProp) ? msgProp.GetString() : "Unknown error";
            return BadRequest(new { error = errMsg, details = responseBody });
        }

        // Save the sent message locally
        var conversation = await _dbContext.TikTokConversations
            .FirstOrDefaultAsync(c => c.SocialAccountId == accountId && c.TikTokUserId == request.RecipientId);

        if (conversation != null)
        {
            var msgId = result.TryGetProperty("data", out var dataProp) && dataProp.TryGetProperty("message_id", out var midProp)
                ? midProp.GetString() ?? $"biz_sent_{DateTime.UtcNow.Ticks}"
                : $"biz_sent_{DateTime.UtcNow.Ticks}";

            var msg = new TikTokMessage
            {
                TenantId = account.TenantId,
                ConversationId = conversation.Id,
                TikTokMessageId = msgId,
                SenderId = account.AccountIdentifier ?? "",
                IsFromBusiness = true,
                Text = request.Message,
                AttachmentUrl = request.MediaUrl,
                AttachmentType = string.IsNullOrEmpty(request.MediaUrl) ? "text" : (request.MediaType ?? "image"),
                SentAtUtc = DateTime.UtcNow
            };
            _dbContext.TikTokMessages.Add(msg);

            conversation.LastMessagePreview = request.Message ?? $"[{msg.AttachmentType}]";
            conversation.LastMessageAtUtc = DateTime.UtcNow;
            conversation.IsRead = true;
            conversation.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync();
        }

        return Ok(responseBody);
    }

    /// <summary>
    /// DELETE /api/tiktok-pages/{accountId}/conversations/{convId}
    /// Deletes a TikTok conversation and its messages from local DB.
    /// </summary>
    [HttpDelete("{accountId}/conversations/{convId}")]
    public async Task<IActionResult> DeleteConversation(Guid accountId, Guid convId)
    {
        try
        {
            var account = await GetValidTikTokAccount(accountId);
            if (account == null) return NotFound(new { error = "Account not found or not a TikTok account." });

            var conv = await _dbContext.TikTokConversations.FirstOrDefaultAsync(c => c.Id == convId && c.SocialAccountId == accountId);
            if (conv == null) return NotFound(new { error = "Conversation not found." });

            // Delete messages in conversation
            var messages = _dbContext.TikTokMessages.Where(m => m.ConversationId == convId);
            _dbContext.TikTokMessages.RemoveRange(messages);

            // Delete conversation
            _dbContext.TikTokConversations.Remove(conv);

            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true, message = "Conversation deleted successfully." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting TikTok conversation {ConvId}", convId);
            return StatusCode(500, new { error = "Internal server error in DeleteConversation", details = ex.Message });
        }
    }

    [HttpGet("{accountId}/conversations/{psid}/orders")]
    public async Task<IActionResult> GetConversationOrders(Guid accountId, string psid, CancellationToken ct)
    {
        try
        {
            var account = await GetValidTikTokAccount(accountId);
            if (account == null) return NotFound("Account not found");

            var pageId = account.AccountIdentifier;
            if (string.IsNullOrEmpty(pageId)) return BadRequest("PageIdentifier is missing");

            var orders = await _dbContext.Orders
                .IgnoreQueryFilters()
                .Where(o => (account.TenantId == null ? o.TenantId == null : o.TenantId == account.TenantId) 
                            && o.PageId == pageId 
                            && o.Psid == psid)
                .OrderByDescending(o => o.CreatedAtUtc)
                .Select(o => new
                {
                    o.Id,
                    sentAtUtc = o.CreatedAtUtc,
                    fullName = o.FullName,
                    phoneNumber = o.PhoneNumber,
                    address = o.Address,
                    selectedItem = o.SelectedItem
                })
                .ToListAsync(ct);

            return Ok(orders);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting TikTok conversation orders for {Psid}", psid);
            return StatusCode(500, new { error = "Internal server error in GetConversationOrders", details = ex.Message });
        }
    }

    [HttpGet("{accountId}/orders")]
    public async Task<IActionResult> GetPageOrders(Guid accountId, CancellationToken ct)
    {
        try
        {
            var account = await GetValidTikTokAccount(accountId);
            if (account == null) return NotFound("Account not found");

            var pageId = account.AccountIdentifier;
            if (string.IsNullOrEmpty(pageId)) return BadRequest("PageIdentifier is missing");

            var orders = await _dbContext.Orders
                .IgnoreQueryFilters()
                .Where(o => (account.TenantId == null ? o.TenantId == null : o.TenantId == account.TenantId) 
                            && o.PageId == pageId)
                .OrderByDescending(o => o.CreatedAtUtc)
                .Select(o => new
                {
                    o.Id,
                    sentAtUtc = o.CreatedAtUtc,
                    fullName = o.FullName,
                    phoneNumber = o.PhoneNumber,
                    address = o.Address,
                    selectedItem = o.SelectedItem
                })
                .ToListAsync(ct);

            return Ok(orders);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting TikTok page orders");
            return StatusCode(500, new { error = "Internal server error in GetPageOrders", details = ex.Message });
        }
    }

    [HttpDelete("{accountId}/orders/{orderId}")]
    public async Task<IActionResult> DeleteOrder(Guid accountId, Guid orderId, CancellationToken ct)
    {
        try
        {
            var account = await GetValidTikTokAccount(accountId);
            if (account == null) return NotFound("Account not found");

            var order = await _dbContext.Orders
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(o => o.Id == orderId && (account.TenantId == null ? o.TenantId == null : o.TenantId == account.TenantId), ct);

            if (order == null) return NotFound("Order not found");

            _dbContext.Orders.Remove(order);
            await _dbContext.SaveChangesAsync(ct);

            return Ok(new { message = "Order deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting TikTok order {OrderId}", orderId);
            return StatusCode(500, new { error = "Internal server error in DeleteOrder", details = ex.Message });
        }
    }

    // ═══════════════════════════════════════════════════════
    // REQUEST DTOs
    // ═══════════════════════════════════════════════════════

    public class TikTokReplyRequest
    {
        public string Message { get; set; } = string.Empty;
    }

    public class TikTokSendMessageRequest
    {
        public string RecipientId { get; set; } = string.Empty;
        public string? Message { get; set; }
        public string? MediaUrl { get; set; }
        public string? MediaType { get; set; } // "image" or "video"
    }
}
