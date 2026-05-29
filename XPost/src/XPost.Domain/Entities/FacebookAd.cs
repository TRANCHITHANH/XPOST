using XPost.Domain.Common;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

public class FacebookAd : BaseEntity, IMultiTenant
{
    public Guid? TenantId { get; set; }
    public Guid FacebookAdSetId { get; set; }
    public string MetaAdId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string BodyText { get; set; } = string.Empty;
    public string MediaUrl { get; set; } = string.Empty;
    public string DestinationUrl { get; set; } = string.Empty;
    public string CallToAction { get; set; } = "LEARN_MORE";
    public string Status { get; set; } = "ACTIVE";

    // Navigation properties
    public FacebookAdSet AdSet { get; set; } = null!;
    public ICollection<FacebookAdInsight> Insights { get; set; } = new List<FacebookAdInsight>();
}
