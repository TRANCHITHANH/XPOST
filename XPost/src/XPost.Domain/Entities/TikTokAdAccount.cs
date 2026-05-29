using XPost.Domain.Common;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

public class TikTokAdAccount : BaseEntity, IMultiTenant
{
    public Guid? TenantId { get; set; }
    public string AdvertiserId { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string AccessToken { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;

    // Navigation properties
    public ICollection<TikTokCampaign> Campaigns { get; set; } = new List<TikTokCampaign>();
}
