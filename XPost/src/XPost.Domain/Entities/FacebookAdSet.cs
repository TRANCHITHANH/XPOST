using XPost.Domain.Common;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

public class FacebookAdSet : BaseEntity, IMultiTenant
{
    public Guid? TenantId { get; set; }
    public Guid FacebookCampaignId { get; set; }
    public string MetaAdSetId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string BillingEvent { get; set; } = "IMPRESSIONS";
    public decimal? DailyBudget { get; set; }
    public decimal? LifetimeBudget { get; set; }
    public int TargetingAgeMin { get; set; } = 18;
    public int TargetingAgeMax { get; set; } = 65;
    public string TargetingGenders { get; set; } = "ALL"; // MALE, FEMALE, ALL
    public string TargetingLocations { get; set; } = "VN";
    public string TargetingInterests { get; set; } = string.Empty; // JSON list of interests
    public string Placements { get; set; } = "AUTOMATIC"; // AUTOMATIC, MANUAL

    // Navigation properties
    public FacebookCampaign Campaign { get; set; } = null!;
    public ICollection<FacebookAd> Ads { get; set; } = new List<FacebookAd>();
}
