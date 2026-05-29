using XPost.Domain.Common;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

public class TikTokCampaign : BaseEntity, IMultiTenant
{
    public Guid? TenantId { get; set; }
    public Guid TikTokAdAccountId { get; set; }
    public string TikTokCampaignId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string ObjectiveType { get; set; } = string.Empty; // e.g. TRAFFIC, LEAD_GENERATION, CONVERSIONS
    public string Status { get; set; } = "DRAFT"; // ENABLE, DISABLE, DRAFT
    public decimal Budget { get; set; }
    public string BudgetMode { get; set; } = "BUDGET_MODE_DAY"; // BUDGET_MODE_DAY, BUDGET_MODE_TOTAL
    public DateTime StartTimeUtc { get; set; }
    public DateTime? EndTimeUtc { get; set; }

    // Navigation properties
    public TikTokAdAccount AdAccount { get; set; } = null!;
    public ICollection<TikTokAdGroup> AdGroups { get; set; } = new List<TikTokAdGroup>();
}
