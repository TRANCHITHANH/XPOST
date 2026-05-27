using XPost.Domain.Common;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

/// <summary>
/// Represents a TikTok Business conversation with a specific user.
/// Conversations are stored locally as they arrive via Webhook events
/// from the TikTok Business Messaging API.
/// </summary>
public class TikTokConversation : BaseEntity, IMultiTenant
{
    public Guid? TenantId { get; set; }

    /// <summary>FK to the TikTok Business SocialAccount.</summary>
    public Guid SocialAccountId { get; set; }

    /// <summary>TikTok open_id of the user chatting with the business account.</summary>
    public string TikTokUserId { get; set; } = string.Empty;

    /// <summary>Display name fetched from TikTok user profile.</summary>
    public string? UserDisplayName { get; set; }

    /// <summary>Avatar URL fetched from TikTok user profile.</summary>
    public string? UserAvatarUrl { get; set; }

    /// <summary>Preview of the last message in this conversation.</summary>
    public string? LastMessagePreview { get; set; }

    /// <summary>Timestamp of the last message.</summary>
    public DateTime LastMessageAtUtc { get; set; }

    /// <summary>Whether the business admin has read the latest messages.</summary>
    public bool IsRead { get; set; } = true;

    // Navigation properties
    public SocialAccount SocialAccount { get; set; } = null!;
    public ICollection<TikTokMessage> Messages { get; set; } = new List<TikTokMessage>();
}
