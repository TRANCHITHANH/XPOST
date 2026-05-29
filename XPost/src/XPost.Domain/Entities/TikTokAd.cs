using XPost.Domain.Common;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

public class TikTokAd : BaseEntity, IMultiTenant
{
    public Guid? TenantId { get; set; }
    public Guid TikTokAdGroupId { get; set; }
    public string TikTokAdId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string BodyText { get; set; } = string.Empty;
    public string MediaUrl { get; set; } = string.Empty;
    public string DestinationUrl { get; set; } = string.Empty;
    public string CallToAction { get; set; } = "LEARN_MORE";
    public string Status { get; set; } = "ACTIVE";

    // Navigation properties
    public TikTokAdGroup AdGroup { get; set; } = null!;
    public ICollection<TikTokAdInsight> Insights { get; set; } = new List<TikTokAdInsight>();
}
