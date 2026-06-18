using XPost.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace XPost.Application.Interfaces;

public interface IFacebookAdsService
{
    Task<List<FacebookAdAccountDto>> GetAccessibleAdAccountsAsync(string userAccessToken, CancellationToken cancellationToken = default);
    
    Task<FacebookAdAccount> ConnectAdAccountAsync(string adAccountId, string accountName, string userAccessToken, CancellationToken cancellationToken = default);
    
    Task SyncCampaignsAsync(Guid adAccountId, CancellationToken cancellationToken = default);
    
    Task<FacebookCampaign> CreateCampaignAsync(Guid adAccountId, CreateFacebookCampaignDto dto, CancellationToken cancellationToken = default);
    
    Task<bool> ToggleCampaignStatusAsync(Guid campaignId, string status, CancellationToken cancellationToken = default);

    Task<bool> DeleteCampaignAsync(Guid campaignId, CancellationToken cancellationToken = default);

    Task<FacebookCampaign> UpdateCampaignAsync(Guid campaignId, UpdateCampaignDto dto, CancellationToken cancellationToken = default);
    
    Task<bool> DeleteAdSetAsync(Guid adSetId, CancellationToken cancellationToken = default);
    
    Task<bool> DeleteAdAsync(Guid adId, CancellationToken cancellationToken = default);
    
    Task<FacebookAdSet> UpdateAdSetAsync(Guid adSetId, UpdateAdSetDto dto, CancellationToken cancellationToken = default);
    
    Task<FacebookAd> UpdateAdAsync(Guid adId, UpdateFacebookAdDto dto, CancellationToken cancellationToken = default);
    
    Task<FacebookAd> MoveAdAsync(Guid adId, Guid newAdSetId, CancellationToken cancellationToken = default);
    
    Task<bool> CheckPaymentMethodAsync(Guid adAccountId, CancellationToken cancellationToken = default);
    
    Task<FacebookCampaign> SyncOrPublishCampaignAsync(Guid campaignId, string targetStatus, CancellationToken cancellationToken = default);
    
    Task SyncInsightsAsync(Guid adAccountId, CancellationToken cancellationToken = default);
    
    Task<List<FacebookAdInsightDto>> GetCampaignInsightsAsync(Guid campaignId, DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default);
    Task<List<FacebookPagePostDto>> GetFacebookPagePostsAsync(string pageIdentifier, CancellationToken cancellationToken = default);
    Task<List<FacebookCampaign>> DuplicateCampaignAsync(Guid campaignId, int count, CancellationToken cancellationToken = default);
    Task<List<FacebookAdSet>> DuplicateAdSetAsync(Guid adSetId, DuplicateAdSetRequest request, CancellationToken cancellationToken = default);
    Task<List<FacebookAd>> DuplicateAdAsync(Guid adId, DuplicateAdRequest request, CancellationToken cancellationToken = default);
}

public class FacebookAdAccountDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Currency { get; set; } = string.Empty;
    public string TimezoneName { get; set; } = string.Empty;
}

public class CreateFacebookCampaignDto
{
    public string PageId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Objective { get; set; } = "OUTCOME_TRAFFIC"; // e.g. OUTCOME_TRAFFIC, OUTCOME_LEADS, OUTCOME_SALES
    public string Status { get; set; } = "ACTIVE"; // ACTIVE, PAUSED
    public decimal Budget { get; set; } // Daily budget or campaign budget depending on setup
    public DateTime StartTimeUtc { get; set; } = DateTime.UtcNow;
    public DateTime? EndTimeUtc { get; set; }

    // Existing Campaign / Ad Set flow controls
    public Guid? CampaignId { get; set; }
    public Guid? AdSetId { get; set; }
    public string AdSetMode { get; set; } = "create"; // create, existing
    public string AdMode { get; set; } = "create"; // create, skip

    // Ad Set targeting & setup
    public string AdSetName { get; set; } = string.Empty;
    public string BillingEvent { get; set; } = "IMPRESSIONS"; // IMPRESSIONS, LINK_CLICKS
    public int TargetingAgeMin { get; set; } = 18;
    public int TargetingAgeMax { get; set; } = 65;
    public string TargetingGenders { get; set; } = "ALL"; // MALE, FEMALE, ALL
    public string TargetingLocations { get; set; } = "VN";
    public List<string> TargetingInterests { get; set; } = new();
    public string Placements { get; set; } = "AUTOMATIC"; // AUTOMATIC, MANUAL
    
    // Ad Creative
    public string AdName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string BodyText { get; set; } = string.Empty;
    public string MediaUrl { get; set; } = string.Empty;
    public string DestinationUrl { get; set; } = string.Empty;
    public string CallToAction { get; set; } = "LEARN_MORE"; // LEARN_MORE, SHOP_NOW, SIGN_UP, etc.
    public string? FacebookPostId { get; set; }
}

public class FacebookAdInsightDto
{
    public string CampaignId { get; set; } = string.Empty;
    public string CampaignName { get; set; } = string.Empty;
    public int Impressions { get; set; }
    public int Reach { get; set; }
    public int Clicks { get; set; }
    public decimal Spend { get; set; }
    public double Ctr => Impressions > 0 ? (double)Clicks / Impressions * 100 : 0;
    public decimal Cpc => Clicks > 0 ? Spend / Clicks : 0;
    public DateTime Date { get; set; }
}

public class FacebookPagePostDto
{
    public string Id { get; set; } = string.Empty;
    public string FacebookPostId { get; set; } = string.Empty;
    public string FullId { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string CreatedTime { get; set; } = string.Empty;
    public string FullPicture { get; set; } = string.Empty;
    public string PermalinkUrl { get; set; } = string.Empty;
}

public class UpdateAdSetDto
{
    public string Name { get; set; } = string.Empty;
    public decimal DailyBudget { get; set; }
    public int TargetingAgeMin { get; set; }
    public int TargetingAgeMax { get; set; }
    public string TargetingLocations { get; set; } = string.Empty;
    public string? Status { get; set; }
}

public class UpdateCampaignDto
{
    public string Name { get; set; } = string.Empty;
    public string Objective { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal Budget { get; set; }
    public DateTime? StartTimeUtc { get; set; }
    public DateTime? EndTimeUtc { get; set; }
}

public class UpdateFacebookAdDto
{
    public string Name { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string BodyText { get; set; } = string.Empty;
    public string MediaUrl { get; set; } = string.Empty;
    public string DestinationUrl { get; set; } = string.Empty;
    public string CallToAction { get; set; } = string.Empty;
    public string? FacebookPostId { get; set; }
    public string? Status { get; set; }
}

public class DuplicateAdSetRequest
{
    public Guid TargetCampaignId { get; set; }
    public int Count { get; set; } = 1;
}

public class DuplicateAdRequest
{
    public Guid TargetAdSetId { get; set; }
    public int Count { get; set; } = 1;
}
