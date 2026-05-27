using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Text.Json;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;
using XPost.Infrastructure.Persistence;

namespace XPost.WebAPI.Controllers;

/// <summary>
/// Manages Zalo OA page interactions: conversations, messages, followers, and posts.
/// Conversations and messages are stored locally (via webhook) since Zalo has no
/// "list conversations" API. Messages can also be synced from Zalo's conversation history API.
/// </summary>
[Authorize]
[ApiController]
[Route("api/zalo-pages")]
public class ZaloPageManagementController : ControllerBase
{
    private readonly IRepository<SocialAccount> _accountRepository;
    private readonly ApplicationDbContext _dbContext;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ISensitiveContentDetector _sensitiveContentDetector;
    private readonly IConfiguration _configuration;
    private readonly ILogger<ZaloPageManagementController> _logger;
    private const string OpenApiBase = "https://openapi.zalo.me";

    public ZaloPageManagementController(
        IRepository<SocialAccount> accountRepository,
        ApplicationDbContext dbContext,
        IHttpClientFactory httpClientFactory,
        ISensitiveContentDetector sensitiveContentDetector,
        IConfiguration configuration,
        ILogger<ZaloPageManagementController> logger)
    {
        _accountRepository = accountRepository;
        _dbContext = dbContext;
        _httpClientFactory = httpClientFactory;
        _sensitiveContentDetector = sensitiveContentDetector;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Validates that the given account is a Zalo OA (Platform = 9).
    /// </summary>
    private async Task<SocialAccount?> GetValidZaloAccount(Guid accountId)
    {
        var account = await _accountRepository.GetByIdAsync(accountId);
        if (account == null || account.Platform != 9) return null;
        return account;
    }

    // ═══════════════════════════════════════════════════════
    // CONVERSATIONS (from local DB)
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// GET /api/zalo-pages/{accountId}/conversations
    /// Returns conversations stored locally from webhook events, ordered by last message time.
    /// </summary>
    [HttpGet("{accountId}/conversations")]
    public async Task<IActionResult> GetConversations(Guid accountId)
    {
        var account = await GetValidZaloAccount(accountId);
        if (account == null) return NotFound(new { error = "Account not found or not a Zalo OA account." });

        var conversations = await _dbContext.ZaloConversations
            .Where(c => c.SocialAccountId == accountId)
            .OrderByDescending(c => c.LastMessageAtUtc)
            .Select(c => new
            {
                c.Id,
                c.ZaloUserId,
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
    /// GET /api/zalo-pages/{accountId}/conversations/{convId}/messages
    /// Returns messages from a specific conversation stored in the local DB.
    /// </summary>
    [HttpGet("{accountId}/conversations/{convId}/messages")]
    public async Task<IActionResult> GetMessages(Guid accountId, Guid convId)
    {
        var account = await GetValidZaloAccount(accountId);
        if (account == null) return NotFound();

        // Mark conversation as read
        var conv = await _dbContext.ZaloConversations.FindAsync(convId);
        if (conv != null && !conv.IsRead)
        {
            conv.IsRead = true;
            conv.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();
        }

        var messages = await _dbContext.ZaloMessages
            .Where(m => m.ConversationId == convId)
            .OrderBy(m => m.SentAtUtc)
            .Select(m => new
            {
                m.Id,
                m.ZaloMessageId,
                m.SenderId,
                m.IsFromOA,
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
    /// POST /api/zalo-pages/{accountId}/conversations/{convId}/read
    /// Marks a conversation as read.
    /// </summary>
    [HttpPost("{accountId}/conversations/{convId}/read")]
    public async Task<IActionResult> MarkAsRead(Guid accountId, Guid convId)
    {
        var account = await GetValidZaloAccount(accountId);
        if (account == null) return NotFound();

        var conv = await _dbContext.ZaloConversations.FindAsync(convId);
        if (conv == null) return NotFound();

        conv.IsRead = true;
        conv.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        return Ok(new { success = true });
    }

    // ═══════════════════════════════════════════════════════
    // SEND MESSAGE (via Zalo Consulting API)
    // ═══════════════════════════════════════════════════════

    public class ZaloSendMessageRequest
    {
        public string RecipientId { get; set; } = string.Empty;
        public string? Message { get; set; }
        public string? MediaUrl { get; set; }
        public string? MediaType { get; set; } // "image" or "file"
    }

    /// <summary>
    /// POST /api/zalo-pages/{accountId}/messages/send
    /// Sends a consulting message to a Zalo user via v3.0/oa/message/cs.
    /// Note: Only works within 7 days of last user interaction.
    /// </summary>
    [HttpPost("{accountId}/messages/send")]
    public async Task<IActionResult> SendMessage(Guid accountId, [FromBody] ZaloSendMessageRequest request)
    {
        var account = await GetValidZaloAccount(accountId);
        if (account == null) return NotFound();

        if (string.IsNullOrEmpty(account.AccessToken))
            return BadRequest(new { error = "Zalo OA Access Token is missing." });

        var client = _httpClientFactory.CreateClient();

        // Build payload based on message type
        object payload;

        if (!string.IsNullOrEmpty(request.MediaUrl))
        {
            // Send image/file attachment
            string absoluteUrl = request.MediaUrl;
            if (absoluteUrl.StartsWith("/"))
            {
                var apiBaseUrl = _configuration["AppConfig:ApiBaseUrl"]?.TrimEnd('/');
                absoluteUrl = $"{apiBaseUrl}{absoluteUrl}";
            }

            payload = new
            {
                recipient = new { user_id = request.RecipientId },
                message = new
                {
                    attachment = new
                    {
                        type = "template",
                        payload = new
                        {
                            template_type = "media",
                            elements = new[]
                            {
                                new { media_type = request.MediaType ?? "image", url = absoluteUrl }
                            }
                        }
                    }
                }
            };
        }
        else
        {
            // Send text message
            payload = new
            {
                recipient = new { user_id = request.RecipientId },
                message = new { text = request.Message }
            };
        }

        var url = $"{OpenApiBase}/v3.0/oa/message/cs";
        var httpRequest = new HttpRequestMessage(HttpMethod.Post, url);
        httpRequest.Headers.Add("access_token", account.AccessToken);
        httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var response = await client.SendAsync(httpRequest);
        var responseBody = await response.Content.ReadAsStringAsync();

        _logger.LogInformation("Zalo send message response: {Response}", responseBody);

        if (!response.IsSuccessStatusCode)
        {
            return StatusCode((int)response.StatusCode, new { error = "Zalo API error", details = responseBody });
        }

        // Parse response to check for Zalo error
        var result = JsonSerializer.Deserialize<JsonElement>(responseBody);
        if (result.TryGetProperty("error", out var errProp) && errProp.GetInt32() != 0)
        {
            var errMsg = result.TryGetProperty("message", out var msgProp) ? msgProp.GetString() : "Unknown error";
            return BadRequest(new { error = errMsg, details = responseBody });
        }

        // Also save the sent message locally
        var conversation = await _dbContext.ZaloConversations
            .FirstOrDefaultAsync(c => c.SocialAccountId == accountId && c.ZaloUserId == request.RecipientId);

        if (conversation != null)
        {
            var msgId = result.TryGetProperty("data", out var dataProp) &&
                        dataProp.TryGetProperty("message_id", out var midProp)
                ? midProp.GetString() ?? $"oa_sent_{DateTime.UtcNow.Ticks}"
                : $"oa_sent_{DateTime.UtcNow.Ticks}";

            var msg = new ZaloMessage
            {
                TenantId = account.TenantId,
                ConversationId = conversation.Id,
                ZaloMessageId = msgId,
                SenderId = account.AccountIdentifier ?? "",
                IsFromOA = true,
                Text = request.Message,
                AttachmentUrl = request.MediaUrl,
                AttachmentType = string.IsNullOrEmpty(request.MediaUrl) ? "text" : (request.MediaType ?? "image"),
                SentAtUtc = DateTime.UtcNow
            };
            _dbContext.ZaloMessages.Add(msg);

            conversation.LastMessagePreview = request.Message ?? $"[{msg.AttachmentType}]";
            conversation.LastMessageAtUtc = DateTime.UtcNow;
            conversation.IsRead = true;
            conversation.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync();
        }

        return Ok(responseBody);
    }

    // ═══════════════════════════════════════════════════════
    // FOLLOWERS (via Zalo API)
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// GET /api/zalo-pages/{accountId}/followers?offset=0&count=50
    /// Gets the list of OA followers from Zalo API.
    /// </summary>
    [HttpGet("{accountId}/followers")]
    public async Task<IActionResult> GetFollowers(Guid accountId, [FromQuery] int offset = 0, [FromQuery] int count = 50)
    {
        var account = await GetValidZaloAccount(accountId);
        if (account == null) return NotFound();

        if (string.IsNullOrEmpty(account.AccessToken))
            return BadRequest(new { error = "Access token missing." });

        var client = _httpClientFactory.CreateClient();
        var data = JsonSerializer.Serialize(new { offset, count });
        var url = $"{OpenApiBase}/v2.0/oa/getfollowers?data={Uri.EscapeDataString(data)}";

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("access_token", account.AccessToken);

        var response = await client.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            return StatusCode((int)response.StatusCode, content);
        }

        return Content(content, "application/json");
    }

    /// <summary>
    /// GET /api/zalo-pages/{accountId}/profile/{userId}
    /// Gets detailed profile info of a specific follower.
    /// </summary>
    [HttpGet("{accountId}/profile/{userId}")]
    public async Task<IActionResult> GetUserProfile(Guid accountId, string userId)
    {
        var account = await GetValidZaloAccount(accountId);
        if (account == null) return NotFound();

        if (string.IsNullOrEmpty(account.AccessToken))
            return BadRequest(new { error = "Access token missing." });

        var client = _httpClientFactory.CreateClient();
        var data = JsonSerializer.Serialize(new { user_id = userId });
        var url = $"{OpenApiBase}/v3.0/oa/user/detail?data={Uri.EscapeDataString(data)}";

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("access_token", account.AccessToken);

        var response = await client.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();

        _logger.LogInformation("Zalo user profile response for {UserId}: {Response}", userId, content);

        if (!response.IsSuccessStatusCode)
        {
            return StatusCode((int)response.StatusCode, content);
        }

        // Also update the conversation display name/avatar if available
        try
        {
            var profileResult = JsonSerializer.Deserialize<JsonElement>(content);
            if (profileResult.TryGetProperty("data", out var profileData))
            {
                var displayName = profileData.TryGetProperty("display_name", out var nameProp) ? nameProp.GetString() : null;
                var avatar = profileData.TryGetProperty("avatar", out var avatarProp) ? avatarProp.GetString() : null;

                if (!string.IsNullOrEmpty(displayName))
                {
                    var conv = await _dbContext.ZaloConversations
                        .FirstOrDefaultAsync(c => c.SocialAccountId == accountId && c.ZaloUserId == userId);
                    if (conv != null)
                    {
                        conv.UserDisplayName = displayName;
                        if (!string.IsNullOrEmpty(avatar)) conv.UserAvatarUrl = avatar;
                        conv.UpdatedAt = DateTime.UtcNow;
                        await _dbContext.SaveChangesAsync();
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to update conversation profile for user {UserId}", userId);
        }

        return Content(content, "application/json");
    }

    // ═══════════════════════════════════════════════════════
    // POSTS (from local DB - PostTarget)
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// GET /api/zalo-pages/{accountId}/posts
    /// Returns posts published to this Zalo OA account (from local PostTarget records).
    /// </summary>
    [HttpGet("{accountId}/posts")]
    public async Task<IActionResult> GetPosts(Guid accountId)
    {
        var account = await GetValidZaloAccount(accountId);
        if (account == null) return NotFound();

        var posts = await _dbContext.PostTargets
            .Include(pt => pt.Post)
            .Where(pt => pt.SocialAccountId == accountId)
            .OrderByDescending(pt => pt.CreatedAt)
            .Select(pt => new
            {
                id = pt.Id,
                postId = pt.PostId,
                caption = pt.Post.Title ?? pt.Post.Content,
                media_url = pt.Post.FeaturedImageUrl,
                timestamp = pt.CreatedAt,
                status = pt.Status,
                publishedUrl = pt.PublishedUrl,
                publishedPostId = pt.PublishedPostId,
                comments_count = 0, // Zalo has no comment API
                like_count = 0
            })
            .ToListAsync();

        return Ok(new { data = posts });
    }

    // ═══════════════════════════════════════════════════════
    // SYNC CONVERSATION HISTORY (from Zalo API)
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// POST /api/zalo-pages/{accountId}/conversations/{convId}/sync
    /// Syncs conversation history from Zalo API (v2.0/oa/conversation) into local DB.
    /// Useful for importing old messages before webhook was configured.
    /// </summary>
    [HttpPost("{accountId}/conversations/{convId}/sync")]
    public async Task<IActionResult> SyncConversation(Guid accountId, Guid convId)
    {
        var account = await GetValidZaloAccount(accountId);
        if (account == null) return NotFound();

        var conversation = await _dbContext.ZaloConversations.FindAsync(convId);
        if (conversation == null) return NotFound(new { error = "Conversation not found." });

        if (string.IsNullOrEmpty(account.AccessToken))
            return BadRequest(new { error = "Access token missing." });

        var client = _httpClientFactory.CreateClient();
        var data = JsonSerializer.Serialize(new { user_id = conversation.ZaloUserId, offset = 0, count = 10 });
        var url = $"{OpenApiBase}/v2.0/oa/conversation?data={Uri.EscapeDataString(data)}";

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("access_token", account.AccessToken);

        var response = await client.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();

        _logger.LogInformation("Zalo conversation sync response: {Response}", content);

        if (!response.IsSuccessStatusCode)
        {
            return StatusCode((int)response.StatusCode, new { error = "Failed to fetch from Zalo", details = content });
        }

        var result = JsonSerializer.Deserialize<JsonElement>(content);
        if (!result.TryGetProperty("data", out var dataArr) || dataArr.ValueKind != JsonValueKind.Array)
        {
            return Ok(new { synced = 0, message = "No messages returned from Zalo API." });
        }

        int synced = 0;
        foreach (var msgElement in dataArr.EnumerateArray())
        {
            var msgId = msgElement.TryGetProperty("msg_id", out var midProp) ? midProp.GetString() ?? "" : "";
            if (string.IsNullOrEmpty(msgId)) continue;

            // Skip if already exists
            var exists = await _dbContext.ZaloMessages.AnyAsync(m => m.ZaloMessageId == msgId);
            if (exists) continue;

            var senderId = msgElement.TryGetProperty("src", out var srcProp) ? srcProp.GetString() ?? "" : "";
            var text = msgElement.TryGetProperty("message", out var textProp) ? textProp.GetString() : null;
            var ts = msgElement.TryGetProperty("time", out var timeProp) ? timeProp.GetInt64() : 0;
            var type = msgElement.TryGetProperty("type", out var typeProp) ? typeProp.GetString() ?? "text" : "text";

            bool isFromOA = senderId == account.AccountIdentifier;
            bool isSensitive = false;
            string sensitiveType = "";
            if (!string.IsNullOrEmpty(text))
            {
                isSensitive = _sensitiveContentDetector.ContainsSensitiveContent(text, out sensitiveType);
            }

            _dbContext.ZaloMessages.Add(new ZaloMessage
            {
                TenantId = account.TenantId,
                ConversationId = convId,
                ZaloMessageId = msgId,
                SenderId = senderId,
                IsFromOA = isFromOA,
                Text = text,
                AttachmentType = type,
                SentAtUtc = DateTimeOffset.FromUnixTimeMilliseconds(ts).UtcDateTime,
                IsSensitive = isSensitive,
                SensitiveType = sensitiveType
            });
            synced++;
        }

        if (synced > 0) await _dbContext.SaveChangesAsync();

        return Ok(new { synced, message = $"Synced {synced} messages from Zalo." });
    }
}
