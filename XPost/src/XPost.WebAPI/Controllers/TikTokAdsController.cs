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
public class TikTokAdsController : ControllerBase
{
    private readonly ITikTokAdsService _adsService;
    private readonly ApplicationDbContext _dbContext;

    public TikTokAdsController(ITikTokAdsService adsService, ApplicationDbContext dbContext)
    {
        _adsService = adsService;
        _dbContext = dbContext;
    }

    [HttpGet("accounts")]
    public async Task<IActionResult> GetConnectedAccounts(CancellationToken ct)
    {
        var accounts = await _dbContext.TikTokAdAccounts
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);

        return Ok(accounts);
    }

    [HttpPost("accounts/discover")]
    public async Task<IActionResult> DiscoverAccounts([FromBody] DiscoverTikTokAccountsRequest request, CancellationToken ct)
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
    public async Task<IActionResult> ConnectAccount([FromBody] ConnectTikTokAccountRequest request, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(request.AdvertiserId) || string.IsNullOrEmpty(request.AccountName) || string.IsNullOrEmpty(request.UserAccessToken))
            return BadRequest(new { message = "All parameters are required." });

        try
        {
            var account = await _adsService.ConnectAdAccountAsync(request.AdvertiserId, request.AccountName, request.UserAccessToken, ct);
            
            // Trigger an initial background sync of campaigns
            try
            {
                await _adsService.SyncCampaignsAsync(account.Id, ct);
                await _adsService.SyncInsightsAsync(account.Id, ct);
            }
            catch (Exception syncEx)
            {
                Console.WriteLine($"Initial TikTok sync failed for connected account {account.AdvertiserId}: {syncEx.Message}");
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
        var query = _dbContext.TikTokCampaigns.AsQueryable();

        if (adAccountId.HasValue)
        {
            query = query.Where(x => x.TikTokAdAccountId == adAccountId.Value);
        }

        var campaigns = await query
            .Include(x => x.AdAccount)
            .Include(x => x.AdGroups)
                .ThenInclude(x => x.Ads)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);

        // Project to DTO to avoid circular reference (AdAccount -> Campaigns -> ...)
        var result = campaigns.Select(c => new
        {
            c.Id,
            c.TikTokCampaignId,
            c.Name,
            c.ObjectiveType,
            c.Status,
            c.Budget,
            c.BudgetMode,
            c.StartTimeUtc,
            c.EndTimeUtc,
            c.CreatedAt,
            c.UpdatedAt,
            adAccount = c.AdAccount == null ? null : new
            {
                c.AdAccount.Id,
                c.AdAccount.AdvertiserId,
                c.AdAccount.AccountName
            },
            adGroups = c.AdGroups.Select(s => new
            {
                s.Id,
                s.TikTokAdGroupId,
                s.Name,
                s.PlacementType,
                s.DailyBudget,
                s.TargetingAgeMin,
                s.TargetingAgeMax,
                s.TargetingLocations,
                ads = s.Ads.Select(a => new
                {
                    a.Id,
                    a.TikTokAdId,
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
    public async Task<IActionResult> CreateCampaign([FromQuery] Guid adAccountId, [FromBody] CreateTikTokCampaignDto dto, CancellationToken ct)
    {
        if (dto == null)
            return BadRequest(new { message = "Campaign data is required." });

        try
        {
            var campaign = await _adsService.CreateCampaignAsync(adAccountId, dto, ct);
            return Ok(new
            {
                campaign.Id,
                campaign.TikTokCampaignId,
                campaign.Name,
                campaign.ObjectiveType,
                campaign.Status,
                campaign.Budget,
                campaign.BudgetMode,
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

    [HttpDelete("campaigns/{id}")]
    public async Task<IActionResult> DeleteCampaign(Guid id, CancellationToken ct)
    {
        var campaign = await _dbContext.TikTokCampaigns
            .IgnoreQueryFilters()
            .Include(x => x.AdGroups)
                .ThenInclude(x => x.Ads)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (campaign == null)
            return NotFound(new { message = $"Campaign {id} not found." });

        foreach (var adGroup in campaign.AdGroups)
        {
            _dbContext.TikTokAds.RemoveRange(adGroup.Ads);
        }
        _dbContext.TikTokAdGroups.RemoveRange(campaign.AdGroups);
        _dbContext.TikTokCampaigns.Remove(campaign);
        await _dbContext.SaveChangesAsync(ct);

        return Ok(new { message = "Campaign deleted successfully.", id });
    }

    [HttpPost("accounts/{id}/sync")]
    public async Task<IActionResult> SyncAccountData(Guid id, CancellationToken ct)
    {
        try
        {
            await _adsService.SyncCampaignsAsync(id, ct);
            await _adsService.SyncInsightsAsync(id, ct);
            return Ok(new { message = "Successfully synced campaigns and reports from TikTok Business." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpPut("campaigns/{id}/status")]
    public async Task<IActionResult> ToggleCampaignStatus(Guid id, [FromBody] ToggleTikTokStatusRequest request, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(request.Status))
            return BadRequest(new { message = "Status (ACTIVE or PAUSED) is required." });

        try
        {
            var success = await _adsService.ToggleCampaignStatusAsync(id, request.Status, ct);
            return Ok(new { success, message = $"Campaign status successfully updated to {request.Status}." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("campaigns/{id}/insights")]
    public async Task<IActionResult> GetCampaignInsights(Guid id, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, CancellationToken ct)
    {
        var start = startDate ?? DateTime.UtcNow.AddDays(-30);
        var end = endDate ?? DateTime.UtcNow;

        try
        {
            var insights = await _adsService.GetCampaignInsightsAsync(id, start, end, ct);
            
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
}

public class DiscoverTikTokAccountsRequest
{
    public string UserAccessToken { get; set; } = string.Empty;
}

public class ConnectTikTokAccountRequest
{
    public string AdvertiserId { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string UserAccessToken { get; set; } = string.Empty;
}

public class ToggleTikTokStatusRequest
{
    public string Status { get; set; } = string.Empty;
}
