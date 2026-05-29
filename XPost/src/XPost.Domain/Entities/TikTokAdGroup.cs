using XPost.Domain.Common;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

public class TikTokAdGroup : BaseEntity, IMultiTenant
{
    public Guid? TenantId { get; set; }
    public Guid TikTokCampaignId { get; set; }
    public string TikTokAdGroupId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string PlacementType { get; set; } = "PLACEMENT_MODE_DEFAULT";
    public decimal? DailyBudget { get; set; }
    public int TargetingAgeMin { get; set; } = 18;
    public int TargetingAgeMax { get; set; } = 65;
    public string TargetingGenders { get; set; } = "ALL"; // MALE, FEMALE, ALL
    public string TargetingLocations { get; set; } = "VN";
    public string TargetingInterests { get; set; } = string.Empty; // JSON list of interests

    // Navigation properties
    public TikTokCampaign Campaign { get; set; } = null!;
    public ICollection<TikTokAd> Ads { get; set; } = new List<TikTokAd>();
}
