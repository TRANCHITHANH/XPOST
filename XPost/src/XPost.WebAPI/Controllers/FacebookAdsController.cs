using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Infrastructure.Persistence;

namespace XPost.WebAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class FacebookAdsController : ControllerBase
{
    private readonly IFacebookAdsService _adsService;
    private readonly ApplicationDbContext _dbContext;

    public FacebookAdsController(IFacebookAdsService adsService, ApplicationDbContext dbContext)
    {
        _adsService = adsService;
        _dbContext = dbContext;
    }

    [HttpGet("accounts")]
    public async Task<IActionResult> GetConnectedAccounts(CancellationToken ct)
    {
        var accounts = await _dbContext.FacebookAdAccounts
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);

        return Ok(accounts);
    }

    [HttpPost("accounts/discover")]
    public async Task<IActionResult> DiscoverAccounts([FromBody] DiscoverAccountsRequest request, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(request.UserAccessToken))
            return BadRequest(new { message = "User access token is required." });

        try
        {
            var accounts = await _adsService.GetAccessibleAdAccountsAsync(request.UserAccessToken, ct);
            return Ok(accounts);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpPost("accounts/connect")]
    public async Task<IActionResult> ConnectAccount([FromBody] ConnectAccountRequest request, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(request.AdAccountId) || string.IsNullOrEmpty(request.AccountName) || string.IsNullOrEmpty(request.UserAccessToken))
            return BadRequest(new { message = "All parameters are required." });

        try
        {
            var account = await _adsService.ConnectAdAccountAsync(request.AdAccountId, request.AccountName, request.UserAccessToken, ct);
            
            // Trigger an initial background sync of campaigns
            try
            {
                await _adsService.SyncCampaignsAsync(account.Id, ct);
            }
            catch (Exception syncEx)
            {
                // Non-blocking sync error
                Console.WriteLine($"Initial sync failed for connected account {account.AdAccountId}: {syncEx.Message}");
            }

            return Ok(account);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("campaigns")]
    public async Task<IActionResult> GetCampaigns([FromQuery] Guid? adAccountId, CancellationToken ct)
    {
        var query = _dbContext.FacebookCampaigns.AsQueryable();

        if (adAccountId.HasValue)
        {
            query = query.Where(x => x.FacebookAdAccountId == adAccountId.Value);
        }

        var campaigns = await query
            .Include(x => x.AdAccount)
            .Include(x => x.AdSets)
                .ThenInclude(x => x.Ads)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);

        // Project to DTO to avoid circular reference (AdAccount -> Campaigns -> AdAccount -> ...)
        var result = campaigns.Select(c => new
        {
            c.Id,
            c.MetaCampaignId,
            c.Name,
            c.Objective,
            c.Status,
            c.Budget,
            c.StartTimeUtc,
            c.EndTimeUtc,
            c.PageId,
            c.CreatedAt,
            c.UpdatedAt,
            adAccount = c.AdAccount == null ? null : new
            {
                c.AdAccount.Id,
                c.AdAccount.AdAccountId,
                c.AdAccount.AccountName
            },
            adSets = c.AdSets.Select(s => new
            {
                s.Id,
                s.MetaAdSetId,
                s.Name,
                s.BillingEvent,
                s.DailyBudget,
                s.TargetingAgeMin,
                s.TargetingAgeMax,
                s.TargetingLocations,
                ads = s.Ads.Select(a => new
                {
                    a.Id,
                    a.MetaAdId,
                    a.Name,
                    a.Title,
                    a.BodyText,
                    a.MediaUrl,
                    a.Status,
                    a.CallToAction
                })
            })
        });

        return Ok(result);
    }

    [HttpPost("campaigns")]
    public async Task<IActionResult> CreateCampaign([FromQuery] Guid adAccountId, [FromBody] CreateFacebookCampaignDto dto, CancellationToken ct)
    {
        if (dto == null)
            return BadRequest(new { message = "Campaign data is required." });

        try
        {
            var campaign = await _adsService.CreateCampaignAsync(adAccountId, dto, ct);
            return Ok(new
            {
                campaign.Id,
                campaign.MetaCampaignId,
                campaign.Name,
                campaign.Objective,
                campaign.Status,
                campaign.Budget,
                campaign.StartTimeUtc,
                campaign.EndTimeUtc,
                campaign.CreatedAt,
                campaign.UpdatedAt
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("campaigns/{id}/sync-publish")]
    public async Task<IActionResult> SyncOrPublishCampaign(Guid id, [FromBody] SyncPublishRequest request, CancellationToken ct)
    {
        if (request == null || string.IsNullOrEmpty(request.TargetStatus))
            return BadRequest(new { message = "TargetStatus is required." });

        try
        {
            var campaign = await _adsService.SyncOrPublishCampaignAsync(id, request.TargetStatus, ct);
            return Ok(new
            {
                campaign.Id,
                campaign.MetaCampaignId,
                campaign.Name,
                campaign.Status,
                campaign.Budget,
                campaign.StartTimeUtc,
                campaign.EndTimeUtc
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("accounts/{id}/payment-status")]
    public async Task<IActionResult> GetAccountPaymentStatus(Guid id, CancellationToken ct)
    {
        try
        {
            var hasPayment = await _adsService.CheckPaymentMethodAsync(id, ct);
            var account = await _dbContext.FacebookAdAccounts.FindAsync(new object[] { id }, ct);
            return Ok(new
            {
                AdAccountId = id,
                HasPaymentMethod = hasPayment,
                FundingSource = account?.FundingSource ?? "",
                BusinessManagerName = account?.BusinessManagerName ?? ""
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("campaigns/{id}")]
    public async Task<IActionResult> UpdateCampaign(Guid id, [FromBody] UpdateCampaignDto dto, CancellationToken ct)
    {
        if (dto == null)
            return BadRequest(new { message = "Data is required." });

        try
        {
            var campaign = await _adsService.UpdateCampaignAsync(id, dto, ct);
            return Ok(new
            {
                campaign.Id,
                campaign.MetaCampaignId,
                campaign.Name,
                campaign.Objective,
                campaign.Status,
                campaign.Budget,
                campaign.StartTimeUtc,
                campaign.EndTimeUtc,
                campaign.UpdatedAt
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("campaigns/{id}")]

    public async Task<IActionResult> DeleteCampaign(Guid id, CancellationToken ct)
    {
        var success = await _adsService.DeleteCampaignAsync(id, ct);
        if (!success)
            return NotFound(new { message = $"Campaign {id} not found." });

        return Ok(new { message = "Campaign deleted successfully.", id });
    }

    [HttpDelete("adsets/{id}")]
    public async Task<IActionResult> DeleteAdSet(Guid id, CancellationToken ct)
    {
        var success = await _adsService.DeleteAdSetAsync(id, ct);
        if (!success)
            return NotFound(new { message = $"Ad Set {id} not found." });

        return Ok(new { message = "Ad Set deleted successfully.", id });
    }

    [HttpDelete("ads/{id}")]
    public async Task<IActionResult> DeleteAd(Guid id, CancellationToken ct)
    {
        var success = await _adsService.DeleteAdAsync(id, ct);
        if (!success)
            return NotFound(new { message = $"Ad {id} not found." });

        return Ok(new { message = "Ad deleted successfully.", id });
    }

    [HttpPut("adsets/{id}")]
    public async Task<IActionResult> UpdateAdSet(Guid id, [FromBody] UpdateAdSetDto dto, CancellationToken ct)
    {
        if (dto == null)
            return BadRequest(new { message = "Data is required." });

        try
        {
            var adSet = await _adsService.UpdateAdSetAsync(id, dto, ct);
            return Ok(adSet);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("ads/{id}")]
    public async Task<IActionResult> UpdateAd(Guid id, [FromBody] UpdateFacebookAdDto dto, CancellationToken ct)
    {
        if (dto == null)
            return BadRequest(new { message = "Data is required." });

        try
        {
            var ad = await _adsService.UpdateAdAsync(id, dto, ct);
            return Ok(ad);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("adsets/bulk-delete")]
    public async Task<IActionResult> BulkDeleteAdSets([FromBody] List<Guid> ids, CancellationToken ct)
    {
        if (ids == null || ids.Count == 0)
            return BadRequest(new { message = "Ids must not be empty." });

        var succeededIds = new List<Guid>();
        var failedIds = new List<Guid>();

        foreach (var id in ids)
        {
            try
            {
                var success = await _adsService.DeleteAdSetAsync(id, ct);
                if (success)
                    succeededIds.Add(id);
                else
                    failedIds.Add(id);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to delete ad set {id}: {ex.Message}");
                failedIds.Add(id);
            }
        }

        return Ok(new 
        { 
            message = $"Bulk delete completed: {succeededIds.Count} succeeded, {failedIds.Count} failed.", 
            succeededIds, 
            failedIds 
        });
    }

    [HttpPost("ads/bulk-delete")]
    public async Task<IActionResult> BulkDeleteAds([FromBody] List<Guid> ids, CancellationToken ct)
    {
        if (ids == null || ids.Count == 0)
            return BadRequest(new { message = "Ids must not be empty." });

        var succeededIds = new List<Guid>();
        var failedIds = new List<Guid>();

        foreach (var id in ids)
        {
            try
            {
                var success = await _adsService.DeleteAdAsync(id, ct);
                if (success)
                    succeededIds.Add(id);
                else
                    failedIds.Add(id);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to delete ad {id}: {ex.Message}");
                failedIds.Add(id);
            }
        }

        return Ok(new 
        { 
            message = $"Bulk delete completed: {succeededIds.Count} succeeded, {failedIds.Count} failed.", 
            succeededIds, 
            failedIds 
        });
    }

    [HttpGet("pages/{pageIdentifier}/posts")]
    public async Task<IActionResult> GetFacebookPagePosts(string pageIdentifier, CancellationToken ct)
    {
        try
        {
            var posts = await _adsService.GetFacebookPagePostsAsync(pageIdentifier, ct);
            return Ok(posts);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    public class SyncPublishRequest
    {
        public string TargetStatus { get; set; } = string.Empty;
    }

    [HttpPost("accounts/{id}/sync")]
    public async Task<IActionResult> SyncAccountData(Guid id, CancellationToken ct)
    {
        try
        {
            await _adsService.SyncCampaignsAsync(id, ct);
            await _adsService.SyncInsightsAsync(id, ct);
            return Ok(new { message = "Successfully synced campaigns and statistics from Meta." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpPut("campaigns/{id}/status")]
    public async Task<IActionResult> ToggleCampaignStatus(Guid id, [FromBody] ToggleStatusRequest request, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(request.Status))
            return BadRequest(new { message = "Status (ACTIVE or PAUSED) is required." });

        try
        {
            var success = await _adsService.ToggleCampaignStatusAsync(id, request.Status, ct);
            return Ok(new { success, message = $"Campaign status successfully changed to {request.Status}." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("ads/{id}/move")]
    public async Task<IActionResult> MoveAd(Guid id, [FromBody] MoveAdRequest request, CancellationToken ct)
    {
        if (request == null || request.NewAdSetId == Guid.Empty)
            return BadRequest(new { message = "NewAdSetId is required." });

        try
        {
            var ad = await _adsService.MoveAdAsync(id, request.NewAdSetId, ct);
            return Ok(new
            {
                ad.Id,
                ad.Name,
                ad.Title,
                ad.BodyText,
                ad.MediaUrl,
                ad.DestinationUrl,
                ad.CallToAction,
                ad.FacebookPostId,
                ad.Status,
                ad.CreatedAt,
                ad.UpdatedAt
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    public class MoveAdRequest
    {
        public Guid NewAdSetId { get; set; }
    }

    [HttpGet("campaigns/{id}/insights")]
    public async Task<IActionResult> GetCampaignInsights(Guid id, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, CancellationToken ct)
    {
        var start = startDate ?? DateTime.UtcNow.AddDays(-30);
        var end = endDate ?? DateTime.UtcNow;

        try
        {
            var insights = await _adsService.GetCampaignInsightsAsync(id, start, end, ct);
            
            // Calculate aggregates
            var totalImpressions = insights.Sum(x => x.Impressions);
            var totalReach = insights.Sum(x => x.Reach);
            var totalClicks = insights.Sum(x => x.Clicks);
            var totalSpend = insights.Sum(x => x.Spend);
            var ctr = totalImpressions > 0 ? (double)totalClicks / totalImpressions * 100 : 0;
            var cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

            return Ok(new
            {
                insights,
                summary = new
                {
                    impressions = totalImpressions,
                    reach = totalReach,
                    clicks = totalClicks,
                    spend = totalSpend,
                    ctr,
                    cpc
                }
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpPost("campaigns/{id}/duplicate")]
    public async Task<IActionResult> DuplicateCampaign(Guid id, [FromQuery] int count = 1, CancellationToken ct = default)
    {
        try
        {
            var results = await _adsService.DuplicateCampaignAsync(id, count, ct);
            return Ok(results);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("adsets/{id}/duplicate")]
    public async Task<IActionResult> DuplicateAdSet(Guid id, [FromBody] DuplicateAdSetRequest request, CancellationToken ct = default)
    {
        if (request == null)
            return BadRequest(new { message = "Request body is required." });

        try
        {
            var results = await _adsService.DuplicateAdSetAsync(id, request, ct);
            return Ok(results);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("ads/{id}/duplicate")]
    public async Task<IActionResult> DuplicateAd(Guid id, [FromBody] DuplicateAdRequest request, CancellationToken ct = default)
    {
        if (request == null)
            return BadRequest(new { message = "Request body is required." });

        try
        {
            var results = await _adsService.DuplicateAdAsync(id, request, ct);
            return Ok(results);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}

public class DiscoverAccountsRequest
{
    public string UserAccessToken { get; set; } = string.Empty;
}

public class ConnectAccountRequest
{
    public string AdAccountId { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string UserAccessToken { get; set; } = string.Empty;
}

public class ToggleStatusRequest
{
    public string Status { get; set; } = string.Empty;
}
