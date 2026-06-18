using System.ComponentModel.DataAnnotations;
using XPost.Domain.Common;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

public class Chatbot : BaseEntity, IMultiTenant
{
    public Guid? TenantId { get; set; }

    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? MessengerPageId { get; set; }

    [MaxLength(500)]
    public string? MessengerPageToken { get; set; }

    public string? KnowledgeBase { get; set; }

    public string? ClaudeConfigJson { get; set; }

    public string? IceBreakersJson { get; set; }

    [MaxLength(1000)]
    public string? PriceListUrl { get; set; }

    [MaxLength(1000)]
    public string? MaintenanceUrl { get; set; }

    public bool IsActive { get; set; } = true;

    public int MaxTokens { get; set; } = 100000;

    public int UsedTokens { get; set; } = 0;

    // Navigation properties
    public ICollection<ChatbotSession> Sessions { get; set; } = new List<ChatbotSession>();
}
