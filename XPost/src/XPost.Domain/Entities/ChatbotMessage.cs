using System.ComponentModel.DataAnnotations;
using XPost.Domain.Common;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

public class ChatbotMessage : BaseEntity, IMultiTenant
{
    public Guid? TenantId { get; set; }

    public Guid SessionId { get; set; }

    [MaxLength(100)]
    public string Mid { get; set; } = string.Empty;

    [MaxLength(50)]
    public string SenderId { get; set; } = string.Empty;

    [MaxLength(50)]
    public string RecipientId { get; set; } = string.Empty;

    public string? Text { get; set; }

    public bool IsFromUser { get; set; }

    public DateTime SentAtUtc { get; set; }

    // Navigation properties
    public ChatbotSession Session { get; set; } = null!;
}
