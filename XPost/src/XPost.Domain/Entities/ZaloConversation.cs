using XPost.Domain.Common;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

/// <summary>
/// Represents a Zalo OA conversation with a specific user.
/// Zalo does not provide a "list conversations" API, so we store
/// conversations locally as they arrive via Webhook events.
/// </summary>
public class ZaloConversation : BaseEntity, IMultiTenant
{
    public Guid? TenantId { get; set; }

    /// <summary>FK to the Zalo OA SocialAccount.</summary>
    public Guid SocialAccountId { get; set; }

    /// <summary>Zalo user_id of the person chatting with the OA.</summary>
    public string ZaloUserId { get; set; } = string.Empty;

    /// <summary>Display name fetched from Zalo user profile.</summary>
    public string? UserDisplayName { get; set; }

    /// <summary>Avatar URL fetched from Zalo user profile.</summary>
    public string? UserAvatarUrl { get; set; }

    /// <summary>Preview of the last message in this conversation.</summary>
    public string? LastMessagePreview { get; set; }

    /// <summary>Timestamp of the last message.</summary>
    public DateTime LastMessageAtUtc { get; set; }

    /// <summary>Whether the OA admin has read the latest messages.</summary>
    public bool IsRead { get; set; } = true;

    // Navigation properties
    public SocialAccount SocialAccount { get; set; } = null!;
    public ICollection<ZaloMessage> Messages { get; set; } = new List<ZaloMessage>();
}
