using XPost.Domain.Common;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

public class FacebookAdInsight : BaseEntity, IMultiTenant
{
    public Guid? TenantId { get; set; }
    public Guid FacebookAdId { get; set; }
    public int Impressions { get; set; }
    public int Reach { get; set; }
    public int Clicks { get; set; }
    public decimal Spend { get; set; }
    public DateTime Date { get; set; }

    // Navigation properties
    public FacebookAd Ad { get; set; } = null!;
}
