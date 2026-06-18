using System.ComponentModel.DataAnnotations;
using XPost.Domain.Common;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

public class ChatbotSession : BaseEntity, IMultiTenant
{
    public Guid? TenantId { get; set; }

    public Guid ChatbotId { get; set; }
    
    [MaxLength(50)]
    public string Psid { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? CustomerName { get; set; }

    [MaxLength(1000)]
    public string? CustomerAvatarUrl { get; set; }

    public DateTime LastInteractionAtUtc { get; set; }

    public bool IsActive { get; set; } = true;

    // Navigation properties
    public Chatbot Chatbot { get; set; } = null!;
    public ICollection<ChatbotMessage> Messages { get; set; } = new List<ChatbotMessage>();
}
