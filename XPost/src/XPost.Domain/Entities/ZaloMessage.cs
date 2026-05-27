using XPost.Domain.Common;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

/// <summary>
/// Represents a single message in a Zalo OA conversation.
/// Messages are captured via Webhook (user_send_* / oa_send_* events)
/// and also synced from the Zalo conversation history API.
/// </summary>
public class ZaloMessage : BaseEntity, IMultiTenant
{
    public Guid? TenantId { get; set; }

    /// <summary>FK to the parent conversation.</summary>
    public Guid ConversationId { get; set; }

    /// <summary>Zalo msg_id — used for deduplication.</summary>
    public string ZaloMessageId { get; set; } = string.Empty;

    /// <summary>Zalo user_id or oa_id of the sender.</summary>
    public string SenderId { get; set; } = string.Empty;

    /// <summary>True if this message was sent by the OA (not the user).</summary>
    public bool IsFromOA { get; set; }

    /// <summary>Text content of the message (null for non-text messages).</summary>
    public string? Text { get; set; }

    /// <summary>URL to an attachment (image, file, etc.).</summary>
    public string? AttachmentUrl { get; set; }

    /// <summary>Type of attachment: text, image, file, sticker, audio, video, link.</summary>
    public string AttachmentType { get; set; } = "text";

    /// <summary>When this message was sent (from Zalo timestamp).</summary>
    public DateTime SentAtUtc { get; set; }

    /// <summary>Whether this message contains sensitive content.</summary>
    public bool IsSensitive { get; set; }

    /// <summary>Type of sensitive content detected, if any.</summary>
    public string? SensitiveType { get; set; }

    // Navigation property
    public ZaloConversation Conversation { get; set; } = null!;
}
