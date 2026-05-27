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
/// Receives webhook events from TikTok Business platform.
/// Handles messaging events and comment update events.
/// Stores messages in the database and pushes real-time updates via SignalR.
/// </summary>
[ApiController]
[Route("api/tiktok-webhook")]
public class TikTokWebhookController : ControllerBase
{
    private readonly ILogger<TikTokWebhookController> _logger;
    private readonly IHubContext<TikTokHub> _hubContext;
    private readonly ApplicationDbContext _dbContext;
    private readonly ISensitiveContentDetector _sensitiveContentDetector;
    private readonly IConfiguration _configuration;

    public TikTokWebhookController(
        ILogger<TikTokWebhookController> logger,
        IHubContext<TikTokHub> hubContext,
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
    /// POST — Receives webhook events from TikTok.
    /// TikTok sends JSON payload with event type, sender, recipient, message content.
    /// Must return 200 OK immediately to acknowledge receipt.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> ReceiveEvent()
    {
        try
        {
            using var reader = new StreamReader(Request.Body, Encoding.UTF8);
            var rawBody = await reader.ReadToEndAsync();

            _logger.LogInformation("Received TikTok Webhook: {Payload}", rawBody);

            // Verify HMAC-SHA256 signature
            if (!VerifySignature(rawBody))
            {
                _logger.LogWarning("TikTok webhook signature verification failed.");
                return Unauthorized("Invalid signature");
            }

            var payload = JsonSerializer.Deserialize<JsonElement>(rawBody);

            if (!payload.TryGetProperty("event", out var eventProp))
            {
                _logger.LogWarning("TikTok webhook missing event field.");
                return Ok("NO_EVENT");
            }

            var eventType = eventProp.GetString() ?? "";
            _logger.LogInformation("TikTok event: {EventType}", eventType);

            // Route to appropriate handler
            switch (eventType)
            {
                case "receive_message":
                    await HandleIncomingMessage(payload, isFromBusiness: false);
                    break;

                case "send_message":
                    await HandleIncomingMessage(payload, isFromBusiness: true);
                    break;

                case "comment.create":
                case "comment.update":
                    await HandleCommentEvent(payload, eventType);
                    break;

                default:
                    _logger.LogInformation("Unhandled TikTok event type: {EventType}", eventType);
                    break;
            }

            return Ok("EVENT_RECEIVED");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing TikTok webhook payload.");
            return Ok("ERROR_PROCESSING");
        }
    }

    /// <summary>
    /// Handle incoming/outgoing message events from TikTok Business Messaging.
    /// </summary>
    private async Task HandleIncomingMessage(JsonElement payload, bool isFromBusiness)
    {
        var senderId = GetNestedString(payload, "sender", "open_id");
        var recipientId = GetNestedString(payload, "recipient", "open_id");
        var timestamp = payload.TryGetProperty("create_time", out var tsProp) ? tsProp.GetInt64() : DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        var tikTokUserId = isFromBusiness ? recipientId : senderId;
        var businessId = isFromBusiness ? senderId : recipientId;

        // Extract message content
        string? text = null;
        string? attachmentUrl = null;
        string msgId = "";
        string attachmentType = "text";

        if (payload.TryGetProperty("content", out var contentObj))
        {
            text = contentObj.TryGetProperty("text", out var textProp) ? textProp.GetString() : null;
            msgId = contentObj.TryGetProperty("message_id", out var midProp) ? midProp.GetString() ?? "" : "";

            if (contentObj.TryGetProperty("media_url", out var mediaProp))
            {
                attachmentUrl = mediaProp.GetString();
                attachmentType = contentObj.TryGetProperty("media_type", out var mtProp) ? mtProp.GetString() ?? "image" : "image";
            }
        }

        if (string.IsNullOrEmpty(msgId))
        {
            msgId = $"tiktok_{timestamp}_{tikTokUserId}";
        }

        // Check for sensitive content
        bool isSensitive = false;
        string sensitiveType = "";
        if (!string.IsNullOrEmpty(text))
        {
            isSensitive = _sensitiveContentDetector.ContainsSensitiveContent(text, out sensitiveType);
        }

        // Find the SocialAccount matching this business
        var socialAccount = await _dbContext.SocialAccounts
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(sa => sa.Platform == 5 && sa.AccountIdentifier == businessId);

        if (socialAccount == null)
        {
            _logger.LogWarning("No TikTok SocialAccount found for business ID: {BusinessId}", businessId);
            return;
        }

        // Find or create conversation
        var conversation = await _dbContext.TikTokConversations
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.SocialAccountId == socialAccount.Id && c.TikTokUserId == tikTokUserId);

        if (conversation == null)
        {
            conversation = new TikTokConversation
            {
                TenantId = socialAccount.TenantId,
                SocialAccountId = socialAccount.Id,
                TikTokUserId = tikTokUserId,
                LastMessagePreview = text ?? $"[{attachmentType}]",
                LastMessageAtUtc = DateTimeOffset.FromUnixTimeSeconds(timestamp).UtcDateTime,
                IsRead = isFromBusiness
            };
            _dbContext.TikTokConversations.Add(conversation);
            await _dbContext.SaveChangesAsync();
        }
        else
        {
            conversation.LastMessagePreview = text ?? $"[{attachmentType}]";
            conversation.LastMessageAtUtc = DateTimeOffset.FromUnixTimeSeconds(timestamp).UtcDateTime;
            if (!isFromBusiness) conversation.IsRead = false;
            conversation.UpdatedAt = DateTime.UtcNow;
        }

        // Check for duplicate message
        var exists = await _dbContext.TikTokMessages
            .IgnoreQueryFilters()
            .AnyAsync(m => m.TikTokMessageId == msgId);

        if (!exists)
        {
            var message = new TikTokMessage
            {
                TenantId = socialAccount.TenantId,
                ConversationId = conversation.Id,
                TikTokMessageId = msgId,
                SenderId = senderId,
                IsFromBusiness = isFromBusiness,
                Text = text,
                AttachmentUrl = attachmentUrl,
                AttachmentType = attachmentType,
                SentAtUtc = DateTimeOffset.FromUnixTimeSeconds(timestamp).UtcDateTime,
                IsSensitive = isSensitive,
                SensitiveType = sensitiveType
            };
            _dbContext.TikTokMessages.Add(message);
        }

        await _dbContext.SaveChangesAsync();

        // Push real-time update via SignalR
        var maskedText = isSensitive && !string.IsNullOrEmpty(text)
            ? _sensitiveContentDetector.MaskSensitiveContent(text)
            : text;

        var signalRPayload = new
        {
            conversationId = conversation.Id,
            tikTokUserId,
            messageId = msgId,
            message = maskedText,
            originalMessage = text,
            attachmentUrl,
            attachmentType,
            isFromBusiness,
            isSensitive,
            sensitiveType,
            timestamp = DateTimeOffset.FromUnixTimeSeconds(timestamp).ToString("o"),
            senderDisplayName = conversation.UserDisplayName ?? tikTokUserId,
            socialAccountId = socialAccount.Id
        };

        await _hubContext.Clients.All.SendAsync("ReceiveTikTokEvent", signalRPayload);
    }

    /// <summary>
    /// Handle comment create/update events — push to SignalR for real-time UI updates.
    /// </summary>
    private async Task HandleCommentEvent(JsonElement payload, string eventType)
    {
        var videoId = GetNestedString(payload, "video_id", null) ??
            (payload.TryGetProperty("video_id", out var vidProp) ? vidProp.GetString() ?? "" : "");
        var commentId = GetNestedString(payload, "comment_id", null) ??
            (payload.TryGetProperty("comment_id", out var cidProp) ? cidProp.GetString() ?? "" : "");

        _logger.LogInformation("TikTok comment event: {EventType} for video {VideoId}, comment {CommentId}", eventType, videoId, commentId);

        await _hubContext.Clients.All.SendAsync("TikTokCommentEvent", new
        {
            videoId,
            commentId,
            eventType
        });
    }

    /// <summary>
    /// Verify TikTok webhook signature using HMAC-SHA256.
    /// </summary>
    private bool VerifySignature(string rawBody)
    {
        var clientSecret = _configuration["TikTok:ClientSecret"];
        if (string.IsNullOrEmpty(clientSecret))
        {
            _logger.LogWarning("TikTok ClientSecret not configured — skipping signature verification.");
            return true;
        }

        var signature = Request.Headers["X-Tiktok-Signature"].FirstOrDefault();
        if (string.IsNullOrEmpty(signature))
        {
            _logger.LogWarning("Missing X-Tiktok-Signature header.");
            return false;
        }

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(clientSecret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(rawBody));
        var computed = Convert.ToHexStringLower(hash);

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
