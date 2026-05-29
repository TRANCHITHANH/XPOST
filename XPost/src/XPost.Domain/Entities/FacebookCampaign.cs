using XPost.Domain.Common;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

public class FacebookCampaign : BaseEntity, IMultiTenant
{
    public Guid? TenantId { get; set; }
    public Guid FacebookAdAccountId { get; set; }
    public string MetaCampaignId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Objective { get; set; } = string.Empty;
    public string Status { get; set; } = "DRAFT";
    public decimal Budget { get; set; }
    public DateTime StartTimeUtc { get; set; }
    public DateTime? EndTimeUtc { get; set; }

    // Navigation properties
    public FacebookAdAccount AdAccount { get; set; } = null!;
    public ICollection<FacebookAdSet> AdSets { get; set; } = new List<FacebookAdSet>();
}
