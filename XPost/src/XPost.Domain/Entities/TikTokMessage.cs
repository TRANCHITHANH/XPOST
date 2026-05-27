using XPost.Domain.Common;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

/// <summary>
/// Represents a single message in a TikTok Business conversation.
/// Messages are captured via Webhook (Business Messaging API events)
/// and stored locally for display and sensitive content detection.
/// </summary>
public class TikTokMessage : BaseEntity, IMultiTenant
{
    public Guid? TenantId { get; set; }

    /// <summary>FK to the parent conversation.</summary>
    public Guid ConversationId { get; set; }

    /// <summary>TikTok message ID — used for deduplication.</summary>
    public string TikTokMessageId { get; set; } = string.Empty;

    /// <summary>TikTok open_id of the sender.</summary>
    public string SenderId { get; set; } = string.Empty;

    /// <summary>True if this message was sent by the Business account (not the user).</summary>
    public bool IsFromBusiness { get; set; }

    /// <summary>Text content of the message (null for non-text messages).</summary>
    public string? Text { get; set; }

    /// <summary>URL to an attachment (image, file, etc.).</summary>
    public string? AttachmentUrl { get; set; }

    /// <summary>Type of attachment: text, image, video, file.</summary>
    public string AttachmentType { get; set; } = "text";

    /// <summary>When this message was sent (from TikTok timestamp).</summary>
    public DateTime SentAtUtc { get; set; }

    /// <summary>Whether this message contains sensitive content.</summary>
    public bool IsSensitive { get; set; }

    /// <summary>Type of sensitive content detected, if any.</summary>
    public string? SensitiveType { get; set; }

    // Navigation property
    public TikTokConversation Conversation { get; set; } = null!;
}
