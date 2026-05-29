using XPost.Domain.Common;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

public class TikTokAdInsight : BaseEntity, IMultiTenant
{
    public Guid? TenantId { get; set; }
    public Guid TikTokAdId { get; set; }
    public int Impressions { get; set; }
    public int Reach { get; set; }
    public int Clicks { get; set; }
    public decimal Spend { get; set; }
    public DateTime Date { get; set; }

    // Navigation properties
    public TikTokAd Ad { get; set; } = null!;
}
