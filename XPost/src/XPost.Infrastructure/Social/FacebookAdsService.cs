using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Infrastructure.Persistence;

namespace XPost.Infrastructure.Social;

public class FacebookAdsService : IFacebookAdsService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<FacebookAdsService> _logger;
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _env;
    private const string GraphApiBase = "https://graph.facebook.com/v21.0";

    public FacebookAdsService(
        ApplicationDbContext dbContext,
        IHttpClientFactory httpClientFactory,
        ILogger<FacebookAdsService> logger,
        IConfiguration configuration,
        IWebHostEnvironment env)
    {
        _dbContext = dbContext;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _configuration = configuration;
        _env = env;
    }

    public async Task<List<FacebookAdAccountDto>> GetAccessibleAdAccountsAsync(string userAccessToken, CancellationToken cancellationToken = default)
    {
        var client = _httpClientFactory.CreateClient();
        var url = $"{GraphApiBase}/me/adaccounts?fields=id,name,currency,timezone_name&limit=100&access_token={userAccessToken}";

        try
        {
            var response = await client.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogError("Failed to get Facebook Ad Accounts. Status: {Status}, Error: {Error}", response.StatusCode, error);
                throw new Exception($"Facebook Graph API returned error: {ExtractErrorMessage(error)}");
            }

            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            var result = JsonSerializer.Deserialize<JsonElement>(json);
            
            var list = new List<FacebookAdAccountDto>();
            if (result.TryGetProperty("data", out var dataProp) && dataProp.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in dataProp.EnumerateArray())
                {
                    list.Add(new FacebookAdAccountDto
                    {
                        Id = item.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "" : "",
                        Name = item.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? "" : "",
                        Currency = item.TryGetProperty("currency", out var currProp) ? currProp.GetString() ?? "" : "",
                        TimezoneName = item.TryGetProperty("timezone_name", out var tzProp) ? tzProp.GetString() ?? "" : ""
                    });
                }
            }

            return list;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting accessible Facebook Ad Accounts");
            throw;
        }
    }

    public async Task<FacebookAdAccount> ConnectAdAccountAsync(string adAccountId, string accountName, string userAccessToken, CancellationToken cancellationToken = default)
    {
        var existing = await _dbContext.FacebookAdAccounts
            .IgnoreQueryFilters() // check across all tenants if it exists
            .FirstOrDefaultAsync(x => x.AdAccountId == adAccountId, cancellationToken);

        if (existing != null)
        {
            existing.AccountName = accountName;
            existing.AccessToken = userAccessToken;
            existing.IsActive = true;
            existing.UpdatedAt = DateTime.UtcNow;
            
            _dbContext.FacebookAdAccounts.Update(existing);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return existing;
        }

        var newAccount = new FacebookAdAccount
        {
            AdAccountId = adAccountId,
            AccountName = accountName,
            AccessToken = userAccessToken,
            IsActive = true
        };

        _dbContext.FacebookAdAccounts.Add(newAccount);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return newAccount;
    }

    public async Task SyncCampaignsAsync(Guid adAccountId, CancellationToken cancellationToken = default)
    {
        var account = await _dbContext.FacebookAdAccounts.FindAsync(new object[] { adAccountId }, cancellationToken);
        if (account == null)
            throw new ArgumentException("Facebook Ad Account not found in local database.");

        var client = _httpClientFactory.CreateClient();
        var accessToken = account.AccessToken;
        var actId = account.AdAccountId;

        // 1. Sync Campaigns
        var campUrl = $"{GraphApiBase}/{actId}/campaigns?fields=id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time&limit=50&access_token={accessToken}";
        var campResponse = await client.GetAsync(campUrl, cancellationToken);
        if (!campResponse.IsSuccessStatusCode)
        {
            var err = await campResponse.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("Failed to sync campaigns from Meta. Error: {Err}", err);
            return;
        }

        var campJson = await campResponse.Content.ReadAsStringAsync(cancellationToken);
        var campData = JsonSerializer.Deserialize<JsonElement>(campJson);

        if (campData.TryGetProperty("data", out var campsProp) && campsProp.ValueKind == JsonValueKind.Array)
        {
            foreach (var campItem in campsProp.EnumerateArray())
            {
                var metaId = campItem.GetProperty("id").GetString()!;
                var name = campItem.GetProperty("name").GetString()!;
                var objective = campItem.TryGetProperty("objective", out var obj) ? obj.GetString() ?? "" : "";
                var status = campItem.TryGetProperty("status", out var stat) ? stat.GetString() ?? "" : "";
                
                decimal budget = 0;
                if (campItem.TryGetProperty("daily_budget", out var db))
                    budget = decimal.TryParse(db.GetString(), out var d) ? d : 0;
                else if (campItem.TryGetProperty("lifetime_budget", out var lb))
                    budget = decimal.TryParse(lb.GetString(), out var l) ? l : 0;

                DateTime startTime = DateTime.UtcNow;
                if (campItem.TryGetProperty("start_time", out var st) && st.GetString() != null)
                    startTime = DateTime.Parse(st.GetString()!).ToUniversalTime();

                DateTime? endTime = null;
                if (campItem.TryGetProperty("stop_time", out var et) && et.GetString() != null)
                    endTime = DateTime.Parse(et.GetString()!).ToUniversalTime();

                var existingCampaign = await _dbContext.FacebookCampaigns
                    .FirstOrDefaultAsync(x => x.MetaCampaignId == metaId, cancellationToken);

                if (existingCampaign == null)
                {
                    existingCampaign = new FacebookCampaign
                    {
                        FacebookAdAccountId = account.Id,
                        MetaCampaignId = metaId,
                        Name = name,
                        Objective = objective,
                        Status = status,
                        Budget = budget,
                        StartTimeUtc = startTime,
                        EndTimeUtc = endTime
                    };
                    _dbContext.FacebookCampaigns.Add(existingCampaign);
                }
                else
                {
                    existingCampaign.Name = name;
                    existingCampaign.Objective = objective;
                    existingCampaign.Status = status;
                    existingCampaign.Budget = budget;
                    existingCampaign.StartTimeUtc = startTime;
                    existingCampaign.EndTimeUtc = endTime;
                    existingCampaign.UpdatedAt = DateTime.UtcNow;
                    _dbContext.FacebookCampaigns.Update(existingCampaign);
                }

                await _dbContext.SaveChangesAsync(cancellationToken);

                // 2. Sync Ad Sets for this campaign
                var adsetUrl = $"{GraphApiBase}/{metaId}/adsets?fields=id,name,status,billing_event,daily_budget,lifetime_budget,targeting,placements&limit=50&access_token={accessToken}";
                var adsetResponse = await client.GetAsync(adsetUrl, cancellationToken);
                if (adsetResponse.IsSuccessStatusCode)
                {
                    var adsetJson = await adsetResponse.Content.ReadAsStringAsync(cancellationToken);
                    var adsetData = JsonSerializer.Deserialize<JsonElement>(adsetJson);

                    if (adsetData.TryGetProperty("data", out var adsetsProp) && adsetsProp.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var adsetItem in adsetsProp.EnumerateArray())
                        {
                            var metaAdsetId = adsetItem.GetProperty("id").GetString()!;
                            var adsetName = adsetItem.GetProperty("name").GetString()!;
                            var adsetStatus = adsetItem.TryGetProperty("status", out var adsetStat) ? adsetStat.GetString() ?? "ACTIVE" : "ACTIVE";
                            var billingEvent = adsetItem.TryGetProperty("billing_event", out var be) ? be.GetString() ?? "" : "";
                            
                            decimal? dailyBudget = null;
                            if (adsetItem.TryGetProperty("daily_budget", out var adb))
                                dailyBudget = decimal.TryParse(adb.GetString(), out var val) ? val : null;

                            decimal? lifetimeBudget = null;
                            if (adsetItem.TryGetProperty("lifetime_budget", out var alb))
                                lifetimeBudget = decimal.TryParse(alb.GetString(), out var val) ? val : null;

                            var targetingStr = adsetItem.TryGetProperty("targeting", out var targ) ? targ.ToString() : "{}";
                            var placementsStr = adsetItem.TryGetProperty("placements", out var plac) ? plac.ToString() : "AUTOMATIC";

                            var existingAdSet = await _dbContext.FacebookAdSets
                                .FirstOrDefaultAsync(x => x.MetaAdSetId == metaAdsetId, cancellationToken);

                            if (existingAdSet == null)
                            {
                                existingAdSet = new FacebookAdSet
                                {
                                    FacebookCampaignId = existingCampaign.Id,
                                    MetaAdSetId = metaAdsetId,
                                    Name = adsetName,
                                    BillingEvent = billingEvent,
                                    DailyBudget = dailyBudget,
                                    LifetimeBudget = lifetimeBudget,
                                    TargetingInterests = targetingStr,
                                    Placements = placementsStr,
                                    Status = adsetStatus
                                };
                                _dbContext.FacebookAdSets.Add(existingAdSet);
                            }
                            else
                            {
                                existingAdSet.Name = adsetName;
                                existingAdSet.BillingEvent = billingEvent;
                                existingAdSet.DailyBudget = dailyBudget;
                                existingAdSet.LifetimeBudget = lifetimeBudget;
                                existingAdSet.TargetingInterests = targetingStr;
                                existingAdSet.Placements = placementsStr;
                                existingAdSet.Status = adsetStatus;
                                existingAdSet.UpdatedAt = DateTime.UtcNow;
                                _dbContext.FacebookAdSets.Update(existingAdSet);
                            }

                            await _dbContext.SaveChangesAsync(cancellationToken);

                            // 3. Sync Ads for this Ad Set
                            var adUrl = $"{GraphApiBase}/{metaAdsetId}/ads?fields=id,name,creative,status&limit=50&access_token={accessToken}";
                            var adResponse = await client.GetAsync(adUrl, cancellationToken);
                            if (adResponse.IsSuccessStatusCode)
                            {
                                var adJson = await adResponse.Content.ReadAsStringAsync(cancellationToken);
                                var adData = JsonSerializer.Deserialize<JsonElement>(adJson);

                                if (adData.TryGetProperty("data", out var adsProp) && adsProp.ValueKind == JsonValueKind.Array)
                                {
                                    foreach (var adItem in adsProp.EnumerateArray())
                                    {
                                        var metaAdId = adItem.GetProperty("id").GetString()!;
                                        var adName = adItem.GetProperty("name").GetString()!;
                                        var adStatus = adItem.TryGetProperty("status", out var adsStat) ? adsStat.GetString() ?? "" : "";
                                        
                                        var title = "";
                                        var bodyText = "";
                                        var mediaUrl = "";

                                        if (adItem.TryGetProperty("creative", out var creativeObj))
                                        {
                                            var creativeId = creativeObj.TryGetProperty("id", out var cIdProp) ? cIdProp.GetString() : null;
                                            if (!string.IsNullOrEmpty(creativeId))
                                            {
                                                try
                                                {
                                                    // Query creative details separately to avoid crashing the whole ads sync if Page permissions are restricted
                                                    var creativeDetailUrl = $"{GraphApiBase}/{creativeId}?fields=name,title,body,image_url,thumbnail_url&access_token={accessToken}";
                                                    var crResponse = await client.GetAsync(creativeDetailUrl, cancellationToken);
                                                    if (crResponse.IsSuccessStatusCode)
                                                    {
                                                        var crJson = await crResponse.Content.ReadAsStringAsync(cancellationToken);
                                                        var crData = JsonSerializer.Deserialize<JsonElement>(crJson);
                                                        title = crData.TryGetProperty("title", out var tProp) ? tProp.GetString() ?? "" : "";
                                                        bodyText = crData.TryGetProperty("body", out var bProp) ? bProp.GetString() ?? "" : "";
                                                        mediaUrl = crData.TryGetProperty("image_url", out var imgProp) 
                                                            ? imgProp.GetString() ?? "" 
                                                            : crData.TryGetProperty("thumbnail_url", out var thumbProp) ? thumbProp.GetString() ?? "" : "";
                                                    }
                                                }
                                                catch (Exception creativeEx)
                                                {
                                                    _logger.LogWarning(creativeEx, "Failed to fetch Facebook creative {CreativeId} details. Skipping creative detail sync.", creativeId);
                                                }
                                            }
                                        }

                                        var existingAd = await _dbContext.FacebookAds
                                            .FirstOrDefaultAsync(x => x.MetaAdId == metaAdId, cancellationToken);

                                        if (existingAd == null)
                                        {
                                            existingAd = new FacebookAd
                                            {
                                                FacebookAdSetId = existingAdSet.Id,
                                                MetaAdId = metaAdId,
                                                Name = adName,
                                                Title = title,
                                                BodyText = bodyText,
                                                MediaUrl = mediaUrl,
                                                Status = adStatus
                                            };
                                            _dbContext.FacebookAds.Add(existingAd);
                                        }
                                        else
                                        {
                                            existingAd.Name = adName;
                                            existingAd.Title = title;
                                            existingAd.BodyText = bodyText;
                                            existingAd.MediaUrl = mediaUrl;
                                            existingAd.Status = adStatus;
                                            existingAd.UpdatedAt = DateTime.UtcNow;
                                            _dbContext.FacebookAds.Update(existingAd);
                                        }
                                    }
                                    await _dbContext.SaveChangesAsync(cancellationToken);
                                }
                            }
                            else
                            {
                                var err = await adResponse.Content.ReadAsStringAsync(cancellationToken);
                                _logger.LogError("Meta Ads sync failed for adset {AdsetId}. Status: {Status}. Error: {Err}", metaAdsetId, adResponse.StatusCode, err);
                            }
                        }
                    }
                }
            }
        }
    }

    public async Task<FacebookCampaign> CreateCampaignAsync(Guid adAccountId, CreateFacebookCampaignDto dto, CancellationToken cancellationToken = default)
    {
        var account = await _dbContext.FacebookAdAccounts.FindAsync(new object[] { adAccountId }, cancellationToken);
        if (account == null)
            throw new ArgumentException("Ad Account not found");

        var client = _httpClientFactory.CreateClient();
        var accessToken = account.AccessToken;
        var actId = account.AdAccountId;

        // If publishing to ACTIVE, check payment method first (before starting transaction)
        if (dto.Status == "ACTIVE")
        {
            var hasPayment = await CheckPaymentMethodAsync(account.Id, cancellationToken);
            if (!hasPayment)
            {
                throw new Exception("This advertising account does not have a valid payment method. To publish advertisements and start delivery, please add a payment method in Meta Business Manager.");
            }
        }

        // Use a database transaction so that if any Meta API step fails (e.g. invalid image),
        // the campaign/adset/ad are NOT partially saved to XPost database.
        await using var dbTransaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            FacebookCampaign campaign;
            string metaCampaignId;

            var isDraft = dto.Status == "DRAFT";

            string? newlyCreatedMetaCampaignId = null;
            string? newlyCreatedMetaAdSetId = null;

            // ─────────────────────────────────────────────────────────────────────────
            // STEP 1: Resolve or Create Campaign
            // ─────────────────────────────────────────────────────────────────────────
            if (dto.CampaignId.HasValue && dto.CampaignId.Value != Guid.Empty)
            {
                campaign = await _dbContext.FacebookCampaigns.FindAsync(new object[] { dto.CampaignId.Value }, cancellationToken)
                    ?? throw new ArgumentException("Campaign not found");
                metaCampaignId = campaign.MetaCampaignId;
            }
            else
            {
                if (isDraft)
                {
                    metaCampaignId = "draft_camp_" + Guid.NewGuid().ToString("N").Substring(0, 12);
                }
                else
                {
                    var campUrl = $"{GraphApiBase}/{actId}/campaigns";
                    var campPayload = new Dictionary<string, string>
                    {
                        ["name"] = dto.Name,
                        ["objective"] = dto.Objective,
                        ["status"] = "PAUSED",
                        ["special_ad_categories"] = "[\"NONE\"]",
                        ["daily_budget"] = ((int)dto.Budget).ToString(),
                        ["bid_strategy"] = "LOWEST_COST_WITHOUT_CAP",
                        ["access_token"] = accessToken
                    };

                    var campResponse = await client.PostAsync(campUrl, new FormUrlEncodedContent(campPayload), cancellationToken);
                    var campJson = await campResponse.Content.ReadAsStringAsync(cancellationToken);

                    if (!campResponse.IsSuccessStatusCode)
                    {
                        _logger.LogError("Meta Campaign creation failed. Status: {Status}. Response: {Json}", campResponse.StatusCode, campJson);
                        throw new Exception($"Meta Campaign Creation Failed: {ExtractErrorMessage(campJson)}");
                    }

                    var campResult = JsonSerializer.Deserialize<JsonElement>(campJson);
                    metaCampaignId = campResult.GetProperty("id").GetString()!;
                    newlyCreatedMetaCampaignId = metaCampaignId;
                    _logger.LogInformation("Meta Campaign created: {MetaCampaignId}", metaCampaignId);
                }

                campaign = new FacebookCampaign
                {
                    FacebookAdAccountId = account.Id,
                    MetaCampaignId = metaCampaignId,
                    Name = dto.Name,
                    Objective = dto.Objective,
                    Status = dto.Status,
                    PageId = dto.PageId,
                    Budget = dto.Budget,
                    StartTimeUtc = dto.StartTimeUtc.ToUniversalTime(),
                    EndTimeUtc = dto.EndTimeUtc?.ToUniversalTime()
                };
                _dbContext.FacebookCampaigns.Add(campaign);
                await _dbContext.SaveChangesAsync(cancellationToken); 
            }

            FacebookAdSet adSet;
            string metaAdSetId;

            // ─────────────────────────────────────────────────────────────────────────
            // STEP 2: Resolve or Create Ad Set
            // ─────────────────────────────────────────────────────────────────────────
            if (dto.AdSetMode == "existing" && dto.AdSetId.HasValue && dto.AdSetId.Value != Guid.Empty)
            {
                adSet = await _dbContext.FacebookAdSets.FindAsync(new object[] { dto.AdSetId.Value }, cancellationToken)
                    ?? throw new ArgumentException("Ad Set not found");
                metaAdSetId = adSet.MetaAdSetId;
            }
            else
            {
                if (isDraft)
                {
                    metaAdSetId = "draft_adset_" + Guid.NewGuid().ToString("N").Substring(0, 12);
                }
                else
                {
                    var adsetUrl = $"{GraphApiBase}/{actId}/adsets";
                    var targetingJson = BuildTargetingJson(dto.TargetingLocations, dto.TargetingAgeMin, dto.TargetingAgeMax);

                    var adsetPayload = new Dictionary<string, string>
                    {
                        ["name"] = dto.AdSetName,
                        ["campaign_id"] = metaCampaignId,
                        ["billing_event"] = dto.BillingEvent,
                        ["optimization_goal"] = ResolveOptimizationGoal(dto.Objective, dto.FacebookPostId),
                        ["targeting"] = targetingJson,
                        ["status"] = dto.Status == "ACTIVE" ? "ACTIVE" : "PAUSED",
                        ["access_token"] = accessToken
                    };

                    var adsetResponse = await client.PostAsync(adsetUrl, new FormUrlEncodedContent(adsetPayload), cancellationToken);
                    var adsetJson = await adsetResponse.Content.ReadAsStringAsync(cancellationToken);

                    if (!adsetResponse.IsSuccessStatusCode)
                    {
                        _logger.LogError("Meta Ad Set creation failed. Status: {Status}. Response: {Json}", adsetResponse.StatusCode, adsetJson);
                        await TryRollbackMetaResourcesAsync(client, accessToken, null, newlyCreatedMetaCampaignId);
                        throw new Exception($"Meta Ad Set Creation Failed: {ExtractErrorMessage(adsetJson)}");
                    }

                    var adsetResult = JsonSerializer.Deserialize<JsonElement>(adsetJson);
                    metaAdSetId = adsetResult.GetProperty("id").GetString()!;
                    newlyCreatedMetaAdSetId = metaAdSetId;
                    _logger.LogInformation("Meta AdSet created: {MetaAdSetId}", metaAdSetId);
                }

                var targetingJsonLocal = BuildTargetingJson(dto.TargetingLocations, dto.TargetingAgeMin, dto.TargetingAgeMax);

                adSet = new FacebookAdSet
                {
                    FacebookCampaignId = campaign.Id,
                    MetaAdSetId = metaAdSetId,
                    Name = dto.AdSetName,
                    BillingEvent = dto.BillingEvent,
                    DailyBudget = dto.Budget,
                    TargetingAgeMin = dto.TargetingAgeMin,
                    TargetingAgeMax = dto.TargetingAgeMax,
                    TargetingGenders = dto.TargetingGenders,
                    TargetingLocations = dto.TargetingLocations,
                    TargetingInterests = targetingJsonLocal,
                    Placements = dto.Placements,
                    Status = dto.Status
                };
                _dbContext.FacebookAdSets.Add(adSet);
                await _dbContext.SaveChangesAsync(cancellationToken); 
            }

            // ─────────────────────────────────────────────────────────────────────────
            // STEP 3: Create Ad (unless skipped)
            // ─────────────────────────────────────────────────────────────────────────
            if (dto.AdMode != "skip")
            {
                string metaAdId = isDraft
                    ? ("draft_ad_" + Guid.NewGuid().ToString("N").Substring(0, 12))
                    : ("mock_ad_" + Guid.NewGuid().ToString("N").Substring(0, 12));

                if (!isDraft)
                {
                    // ── 3a. Upload image ──────────────────────────────────────────────
                    var imageHash = "";
                    if (string.IsNullOrEmpty(dto.FacebookPostId))
                    {
                        if (!string.IsNullOrEmpty(dto.MediaUrl))
                        {
                            imageHash = await UploadAdImageAsync(client, actId, accessToken, dto.MediaUrl, cancellationToken);
                        }

                        if (string.IsNullOrEmpty(imageHash))
                        {
                            _logger.LogError("Image upload failed for MediaUrl: {MediaUrl}. Rolling back Meta and DB.", dto.MediaUrl);
                            await TryRollbackMetaResourcesAsync(client, accessToken, newlyCreatedMetaAdSetId, newlyCreatedMetaCampaignId);
                            throw new Exception("Creative image upload to Meta Ad Library failed. A valid image is required to create the ad.");
                        }
                    }

                    // ── 3b. Create Ad Creative on Meta ────────────────────────────────
                    var creativeUrl = $"{GraphApiBase}/{actId}/adcreatives";
                    Dictionary<string, string> creativePayload;

                    if (!string.IsNullOrEmpty(dto.FacebookPostId))
                    {
                        creativePayload = new Dictionary<string, string>
                        {
                            ["object_story_id"] = $"{dto.PageId}_{dto.FacebookPostId}",
                            ["name"] = dto.AdName,
                            ["access_token"] = accessToken
                        };
                    }
                    else
                    {
                        var objectStorySpec = new
                        {
                            page_id = dto.PageId,
                            link_data = new
                            {
                                image_hash = imageHash,
                                link = dto.DestinationUrl,
                                message = dto.BodyText,
                                name = dto.Title,
                                call_to_action = new
                                {
                                    type = dto.CallToAction,
                                    value = new { link = dto.DestinationUrl }
                                }
                            }
                        };
                        creativePayload = new Dictionary<string, string>
                        {
                            ["object_story_spec"] = JsonSerializer.Serialize(objectStorySpec),
                            ["name"] = dto.AdName,
                            ["access_token"] = accessToken
                        };
                    }

                    var creativeResponse = await client.PostAsync(creativeUrl, new FormUrlEncodedContent(creativePayload), cancellationToken);
                    var creativeJson = await creativeResponse.Content.ReadAsStringAsync(cancellationToken);

                    if (!creativeResponse.IsSuccessStatusCode)
                    {
                        _logger.LogError("Meta Ad Creative creation failed. Response: {Json}", creativeJson);
                        await TryRollbackMetaResourcesAsync(client, accessToken, newlyCreatedMetaAdSetId, newlyCreatedMetaCampaignId);
                        throw new Exception($"Meta Ad Creative Creation Failed: {ExtractErrorMessage(creativeJson)}");
                    }

                    var creativeResult = JsonSerializer.Deserialize<JsonElement>(creativeJson);
                    var metaCreativeId = creativeResult.GetProperty("id").GetString()!;
                    _logger.LogInformation("Meta Creative created: {MetaCreativeId}", metaCreativeId);

                    // ── 3c. Create Ad on Meta ─────────────────────────────────────────
                    var adUrl = $"{GraphApiBase}/{actId}/ads";
                    var adPayload = new Dictionary<string, string>
                    {
                        ["name"] = dto.AdName,
                        ["adset_id"] = metaAdSetId,
                        ["creative"] = JsonSerializer.Serialize(new { creative_id = metaCreativeId }),
                        ["status"] = dto.Status == "ACTIVE" ? "ACTIVE" : "PAUSED",
                        ["access_token"] = accessToken
                    };

                    var adResponse = await client.PostAsync(adUrl, new FormUrlEncodedContent(adPayload), cancellationToken);
                    var adJson = await adResponse.Content.ReadAsStringAsync(cancellationToken);

                    if (!adResponse.IsSuccessStatusCode)
                    {
                        _logger.LogError("Meta Ad creation failed. Response: {Json}", adJson);
                        await TryRollbackMetaResourcesAsync(client, accessToken, newlyCreatedMetaAdSetId, newlyCreatedMetaCampaignId);
                        throw new Exception($"Meta Ad Creation Failed: {ExtractErrorMessage(adJson)}");
                    }

                    var adResult = JsonSerializer.Deserialize<JsonElement>(adJson);
                    metaAdId = adResult.GetProperty("id").GetString()!;
                    _logger.LogInformation("Meta Ad created: {MetaAdId}", metaAdId);

                    // ── 3d. Activate campaign on Meta if requested ────────────────────
                    if (dto.Status == "ACTIVE")
                    {
                        var activateUrl = $"{GraphApiBase}/{metaCampaignId}";
                        var actPayload = new Dictionary<string, string>
                        {
                            ["status"] = "ACTIVE",
                            ["access_token"] = accessToken
                        };
                        await client.PostAsync(activateUrl, new FormUrlEncodedContent(actPayload), cancellationToken);
                        campaign.Status = "ACTIVE";
                        _dbContext.FacebookCampaigns.Update(campaign);
                    }
                }

                // Stage Ad in DB (inside transaction — not committed yet)
                var ad = new FacebookAd
                {
                    FacebookAdSetId = adSet.Id,
                    MetaAdId = metaAdId,
                    Name = dto.AdName,
                    Title = dto.Title,
                    BodyText = dto.BodyText,
                    MediaUrl = dto.MediaUrl,
                    DestinationUrl = dto.DestinationUrl,
                    CallToAction = dto.CallToAction,
                    Status = dto.Status,
                    FacebookPostId = dto.FacebookPostId
                };
                _dbContext.FacebookAds.Add(ad);
            }
            else
            {
                // Ad skipped — activate campaign on Meta if requested
                if (!isDraft && dto.Status == "ACTIVE" && campaign.Status != "ACTIVE")
                {
                    var activateUrl = $"{GraphApiBase}/{metaCampaignId}";
                    var actPayload = new Dictionary<string, string>
                    {
                        ["status"] = "ACTIVE",
                        ["access_token"] = accessToken
                    };
                    await client.PostAsync(activateUrl, new FormUrlEncodedContent(actPayload), cancellationToken);
                    campaign.Status = "ACTIVE";
                    _dbContext.FacebookCampaigns.Update(campaign);
                }
            }

            // ── All steps succeeded → commit DB atomically ────────────────────────
            await _dbContext.SaveChangesAsync(cancellationToken);
            await dbTransaction.CommitAsync(cancellationToken);
            _logger.LogInformation("Campaign creation committed successfully to XPost DB.");
            return campaign;
        }
        catch (Exception)
        {
            // Final safety net: rollback DB if not already rolled back
            try { await dbTransaction.RollbackAsync(cancellationToken); } catch { /* already rolled back or committed */ }
            throw;
        }
    }

    /// <summary>
    /// Rolls back Meta resources created during a failed campaign creation attempt.
    /// Deletes in reverse creation order: AdSet first, then Campaign.
    /// This is best-effort — failures are logged but not re-thrown.
    /// </summary>
    private async Task TryRollbackMetaResourcesAsync(HttpClient client, string accessToken, string? metaAdSetId, string? metaCampaignId)
    {
        // Delete AdSet first (child before parent)
        if (!string.IsNullOrEmpty(metaAdSetId))
        {
            try
            {
                var url = $"{GraphApiBase}/{metaAdSetId}?access_token={Uri.EscapeDataString(accessToken)}";
                var res = await client.DeleteAsync(url);
                if (res.IsSuccessStatusCode)
                    _logger.LogInformation("Meta AdSet {AdSetId} deleted successfully during rollback.", metaAdSetId);
                else
                    _logger.LogWarning("Could not delete Meta AdSet {AdSetId} during rollback (Status: {Status}). Manual cleanup may be required.", metaAdSetId, res.StatusCode);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Exception while deleting Meta AdSet {AdSetId} during rollback.", metaAdSetId);
            }
        }

        // Then delete Campaign (parent)
        if (!string.IsNullOrEmpty(metaCampaignId))
        {
            try
            {
                var url = $"{GraphApiBase}/{metaCampaignId}?access_token={Uri.EscapeDataString(accessToken)}";
                var res = await client.DeleteAsync(url);
                if (res.IsSuccessStatusCode)
                    _logger.LogInformation("Meta Campaign {CampaignId} deleted successfully during rollback.", metaCampaignId);
                else
                    _logger.LogWarning("Could not delete Meta Campaign {CampaignId} during rollback (Status: {Status}). Manual cleanup may be required.", metaCampaignId, res.StatusCode);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Exception while deleting Meta Campaign {CampaignId} during rollback.", metaCampaignId);
            }
        }
    }

    /// <summary>
    /// Builds the Meta API targeting JSON string from the stored targetingLocations value.
    /// If targetingLocations is a JSON array of city objects (from frontend mapping), sends cities/regions.
    /// If it is a plain country code (e.g. "VN"), sends countries.
    /// </summary>
    private string BuildTargetingJson(string targetingLocations, int ageMin, int ageMax)
    {
        object geoLocations;

        // Detect JSON array format: [{"key":"1581130","name":"Hanoi","type":"city","country_code":"VN","radius":35}]
        var trimmed = targetingLocations?.Trim() ?? "VN";
        if (trimmed.StartsWith("[") && trimmed.EndsWith("]"))
        {
            try
            {
                var cityArray = JsonSerializer.Deserialize<JsonElement>(trimmed);
                var citiesList = new List<object>();
                var regionsList = new List<object>();
                var customLocationsList = new List<object>();

                foreach (var cityEl in cityArray.EnumerateArray())
                {
                    var key = cityEl.TryGetProperty("key", out var kProp) ? kProp.GetString() : null;
                    var name = cityEl.TryGetProperty("name", out var nProp) ? nProp.GetString() : null;
                    var type = cityEl.TryGetProperty("type", out var tProp) ? tProp.GetString() : "city";
                    var cc = cityEl.TryGetProperty("country_code", out var ccProp) ? ccProp.GetString() : "VN";

                    int? radius = null;
                    if (cityEl.TryGetProperty("radius", out var rProp))
                    {
                        if (rProp.ValueKind == JsonValueKind.Number)
                            radius = rProp.GetInt32();
                        else if (rProp.ValueKind == JsonValueKind.String && int.TryParse(rProp.GetString(), out var rVal))
                            radius = rVal;
                    }

                    double? lat = null;
                    if (cityEl.TryGetProperty("lat", out var latProp))
                    {
                        if (latProp.ValueKind == JsonValueKind.Number) lat = latProp.GetDouble();
                        else if (latProp.ValueKind == JsonValueKind.String && double.TryParse(latProp.GetString(), out var latVal)) lat = latVal;
                    }

                    double? lng = null;
                    if (cityEl.TryGetProperty("lng", out var lngProp))
                    {
                        if (lngProp.ValueKind == JsonValueKind.Number) lng = lngProp.GetDouble();
                        else if (lngProp.ValueKind == JsonValueKind.String && double.TryParse(lngProp.GetString(), out var lngVal)) lng = lngVal;
                    }

                    if ((type == "custom" || (radius.HasValue && radius.Value > 0)) && lat.HasValue && lng.HasValue)
                    {
                        customLocationsList.Add(new
                        {
                            latitude = lat.Value,
                            longitude = lng.Value,
                            radius = radius.Value > 0 ? radius.Value : 35,
                            distance_unit = "kilometer",
                            name = name ?? "Custom Location"
                        });
                    }
                    else if (!string.IsNullOrEmpty(key) && key != "VN")
                    {
                        if (type == "region")
                        {
                            regionsList.Add(new { key, name = name ?? key, country_code = cc });
                        }
                        else
                        {
                            citiesList.Add(new { key, name = name ?? key, country_code = cc });
                        }
                    }
                }

                if (citiesList.Count > 0 || regionsList.Count > 0 || customLocationsList.Count > 0)
                {
                    var geoObj = new Dictionary<string, object>();
                    if (citiesList.Count > 0) geoObj["cities"] = citiesList;
                    if (regionsList.Count > 0) geoObj["regions"] = regionsList;
                    if (customLocationsList.Count > 0) geoObj["custom_locations"] = customLocationsList;

                    geoLocations = geoObj;
                    _logger.LogInformation("Targeting by locations: {Cities} cities, {Regions} regions, {Custom} custom locations parsed.", 
                        citiesList.Count, regionsList.Count, customLocationsList.Count);
                }
                else
                {
                    // Fallback to country
                    geoLocations = new { countries = new[] { "VN" } };
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not parse targetingLocations JSON: {Value}. Falling back to VN.", trimmed);
                geoLocations = new { countries = new[] { "VN" } };
            }
        }
        else
        {
            // Plain country code (e.g. "VN")
            var code = string.IsNullOrWhiteSpace(trimmed) ? "VN" : trimmed;
            geoLocations = new { countries = new[] { code } };
        }

        var targetingObj = new
        {
            geo_locations = geoLocations,
            age_min = ageMin,
            age_max = ageMax,
            targeting_automation = new { advantage_audience = 0 }
        };

        return JsonSerializer.Serialize(targetingObj);
    }

    private async Task<string> UploadAdImageAsync(HttpClient client, string actId, string accessToken, string imageUrl, CancellationToken ct)
    {
        var uploadUrl = $"{GraphApiBase}/{actId}/adimages";

        try
        {
            byte[] imageBytes;
            string fileName = "ad_image.jpg";

            _logger.LogInformation("Uploading image to Meta Ad Library. ImageUrl: {ImageUrl}", imageUrl);

            string? localPath = null;

            // Check if the URL points to local server (localhost, 127.0.0.1, configured ngrok base, or relative path)
            var apiBaseUrl = _configuration["AppConfig:ApiBaseUrl"]?.TrimEnd('/') ?? "";
            var isConfiguredBase = !string.IsNullOrEmpty(apiBaseUrl) && imageUrl.StartsWith(apiBaseUrl, StringComparison.OrdinalIgnoreCase);
            var isLocalhost = imageUrl.Contains("localhost", StringComparison.OrdinalIgnoreCase) ||
                              imageUrl.Contains("127.0.0.1", StringComparison.OrdinalIgnoreCase) ||
                              imageUrl.Contains("::1", StringComparison.OrdinalIgnoreCase);
            var isRelativePath = imageUrl.StartsWith("/");

            if (isRelativePath)
            {
                // Relative path like /uploads/images/... - map directly to wwwroot
                var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
                var relativePath = imageUrl.TrimStart('/').Replace("/", "\\");
                localPath = Path.Combine(webRoot, relativePath);
                _logger.LogInformation("Resolved relative path to local disk: {LocalPath}", localPath);
            }
            else if (isConfiguredBase || isLocalhost)
            {
                // Try to extract relative path after /uploads/ and map to local file system
                string relativePath;
                if (isConfiguredBase)
                {
                    relativePath = imageUrl.Substring(apiBaseUrl.Length).TrimStart('/');
                }
                else
                {
                    // Strip "http://localhost:PORT" prefix
                    var uri = new Uri(imageUrl);
                    relativePath = uri.AbsolutePath.TrimStart('/');
                }

                relativePath = relativePath.Replace("/", "\\");
                var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
                localPath = Path.Combine(webRoot, relativePath);
                _logger.LogInformation("Resolved local image path: {LocalPath}", localPath);
            }

            if (localPath != null && File.Exists(localPath))
            {
                imageBytes = await File.ReadAllBytesAsync(localPath, ct);
                fileName = Path.GetFileName(localPath);
                _logger.LogInformation("Read image from local disk: {FileName} ({Bytes} bytes)", fileName, imageBytes.Length);
            }
            else if (localPath != null)
            {
                // Local path detected but file doesn't exist on disk
                _logger.LogError("Image file not found on disk at path: {LocalPath} (from URL: {Url})", localPath, imageUrl);
                return "";
            }
            else
            {
                // Download URL over HTTP (for externally hosted images)
                _logger.LogInformation("Downloading image from external URL: {Url}", imageUrl);
                var downloadClient = _httpClientFactory.CreateClient();
                imageBytes = await downloadClient.GetByteArrayAsync(imageUrl, ct);
                if (imageUrl.Contains("/"))
                {
                    fileName = imageUrl.Split('/').Last().Split('?').First();
                }
            }

            using var form = new MultipartFormDataContent();
            form.Add(new StringContent(accessToken), "access_token");

            var fileContent = new ByteArrayContent(imageBytes);
            var ext = Path.GetExtension(fileName).ToLower();
            var mimeType = ext == ".png" ? "image/png" : ext == ".gif" ? "image/gif" : "image/jpeg";
            fileContent.Headers.ContentType = new MediaTypeHeaderValue(mimeType);
            form.Add(fileContent, "filename", fileName);

            var res = await client.PostAsync(uploadUrl, form, ct);
            var json = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode)
            {
                _logger.LogError("Ad Image upload to Meta failed: {Json}", json);
                return "";
            }

            _logger.LogInformation("Ad Image uploaded to Meta successfully. Response: {Json}", json);

            var doc = JsonSerializer.Deserialize<JsonElement>(json);
            if (doc.TryGetProperty("images", out var imagesObj) && imagesObj.ValueKind == JsonValueKind.Object)
            {
                var firstImage = imagesObj.EnumerateObject().FirstOrDefault();
                if (firstImage.Value.TryGetProperty("hash", out var hashProp))
                {
                    return hashProp.GetString() ?? "";
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload image from {Url} to Meta", imageUrl);
        }

        return "";
    }

    public async Task<bool> ToggleCampaignStatusAsync(Guid campaignId, string status, CancellationToken cancellationToken = default)
    {
        var campaign = await _dbContext.FacebookCampaigns
            .Include(x => x.AdAccount)
            .FirstOrDefaultAsync(x => x.Id == campaignId, cancellationToken);

        if (campaign == null)
            throw new ArgumentException("Campaign not found");

        var client = _httpClientFactory.CreateClient();
        var url = $"{GraphApiBase}/{campaign.MetaCampaignId}";
        var payload = new Dictionary<string, string>
        {
            ["status"] = status,
            ["access_token"] = campaign.AdAccount.AccessToken
        };

        var response = await client.PostAsync(url, new FormUrlEncodedContent(payload), cancellationToken);
        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Failed to toggle campaign status on Meta. Error: {Json}", json);
            throw new Exception($"Failed to toggle campaign status on Meta: {ExtractErrorMessage(json)}");
        }

        campaign.Status = status;
        campaign.UpdatedAt = DateTime.UtcNow;
        _dbContext.FacebookCampaigns.Update(campaign);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> DeleteCampaignAsync(Guid campaignId, CancellationToken cancellationToken = default)
    {
        // Use IgnoreQueryFilters to bypass global tenant filters if any
        var campaign = await _dbContext.FacebookCampaigns
            .IgnoreQueryFilters()
            .Include(x => x.AdAccount)
            .Include(x => x.AdSets)
                .ThenInclude(x => x.Ads)
            .FirstOrDefaultAsync(x => x.Id == campaignId, cancellationToken);

        if (campaign == null)
            return false;

        // Try to delete from Meta if we have the Meta Campaign ID and AdAccount access token
        if (!string.IsNullOrEmpty(campaign.MetaCampaignId) && campaign.AdAccount != null && !string.IsNullOrEmpty(campaign.AdAccount.AccessToken))
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                var deleteUrl = $"{GraphApiBase}/{campaign.MetaCampaignId}?access_token={campaign.AdAccount.AccessToken}";
                var response = await client.DeleteAsync(deleteUrl, cancellationToken);
                var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
                
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Failed to delete campaign {MetaId} from Meta. Status: {Status}. Response: {Response}", 
                        campaign.MetaCampaignId, response.StatusCode, responseJson);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting campaign {MetaId} from Meta", campaign.MetaCampaignId);
            }
        }

        // Always delete locally even if Meta call fails
        foreach (var adSet in campaign.AdSets)
        {
            _dbContext.FacebookAds.RemoveRange(adSet.Ads);
        }
        _dbContext.FacebookAdSets.RemoveRange(campaign.AdSets);
        _dbContext.FacebookCampaigns.Remove(campaign);
        await _dbContext.SaveChangesAsync(cancellationToken);
        
        return true;
    }

    public async Task<FacebookCampaign> UpdateCampaignAsync(Guid campaignId, UpdateCampaignDto dto, CancellationToken cancellationToken = default)
    {
        var campaign = await _dbContext.FacebookCampaigns
            .Include(x => x.AdAccount)
            .FirstOrDefaultAsync(x => x.Id == campaignId, cancellationToken);

        if (campaign == null)
            throw new ArgumentException("Campaign not found");

        // Update local DB fields
        if (!string.IsNullOrEmpty(dto.Name)) campaign.Name = dto.Name;
        if (!string.IsNullOrEmpty(dto.Objective)) campaign.Objective = dto.Objective;
        if (!string.IsNullOrEmpty(dto.Status)) campaign.Status = dto.Status;
        if (dto.Budget > 0) campaign.Budget = dto.Budget;
        if (dto.StartTimeUtc.HasValue) campaign.StartTimeUtc = dto.StartTimeUtc.Value;
        campaign.EndTimeUtc = dto.EndTimeUtc;
        campaign.UpdatedAt = DateTime.UtcNow;

        // Sync updates to Meta Graph API
        if (!string.IsNullOrEmpty(campaign.MetaCampaignId) && 
            !campaign.MetaCampaignId.StartsWith("draft_camp_") && 
            !campaign.MetaCampaignId.StartsWith("mock_camp_") &&
            !campaign.MetaCampaignId.StartsWith("draft_campaign_") && 
            !campaign.MetaCampaignId.StartsWith("mock_campaign_") &&
            campaign.AdAccount != null &&
            !string.IsNullOrEmpty(campaign.AdAccount.AccessToken))
        {
            var client = _httpClientFactory.CreateClient();
            var updateUrl = $"{GraphApiBase}/{campaign.MetaCampaignId}";
            var payload = new Dictionary<string, string>
            {
                ["name"] = campaign.Name,
                ["status"] = campaign.Status,
                ["access_token"] = campaign.AdAccount.AccessToken
            };

            if (campaign.Budget > 0)
            {
                payload["daily_budget"] = ((int)campaign.Budget).ToString();
            }

            var response = await client.PostAsync(updateUrl, new FormUrlEncodedContent(payload), cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogError("Failed to update campaign {MetaId} on Meta. {Err}", campaign.MetaCampaignId, err);
                throw new Exception($"Meta Campaign Update Failed: {ExtractErrorMessage(err)}");
            }
        }

        _dbContext.FacebookCampaigns.Update(campaign);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return campaign;
    }

    public async Task<bool> DeleteAdSetAsync(Guid adSetId, CancellationToken cancellationToken = default)
    {
        var adSet = await _dbContext.FacebookAdSets
            .IgnoreQueryFilters()
            .Include(x => x.Ads)
            .Include(x => x.Campaign)
                .ThenInclude(c => c.AdAccount)
            .FirstOrDefaultAsync(x => x.Id == adSetId, cancellationToken);

        if (adSet == null)
            return false;

        if (!string.IsNullOrEmpty(adSet.MetaAdSetId) && 
            !adSet.MetaAdSetId.StartsWith("draft_adset_") && 
            !adSet.MetaAdSetId.StartsWith("mock_adset_") &&
            adSet.Campaign?.AdAccount != null && 
            !string.IsNullOrEmpty(adSet.Campaign.AdAccount.AccessToken))
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                var deleteUrl = $"{GraphApiBase}/{adSet.MetaAdSetId}?access_token={adSet.Campaign.AdAccount.AccessToken}";
                var response = await client.DeleteAsync(deleteUrl, cancellationToken);
                var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
                
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Failed to delete ad set {MetaId} from Meta. Status: {Status}. Response: {Response}", 
                        adSet.MetaAdSetId, response.StatusCode, responseJson);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting ad set {MetaId} from Meta", adSet.MetaAdSetId);
            }
        }

        _dbContext.FacebookAds.RemoveRange(adSet.Ads);
        _dbContext.FacebookAdSets.Remove(adSet);
        await _dbContext.SaveChangesAsync(cancellationToken);
        
        return true;
    }

    public async Task<bool> DeleteAdAsync(Guid adId, CancellationToken cancellationToken = default)
    {
        var ad = await _dbContext.FacebookAds
            .IgnoreQueryFilters()
            .Include(x => x.AdSet)
                .ThenInclude(s => s.Campaign)
                    .ThenInclude(c => c.AdAccount)
            .FirstOrDefaultAsync(x => x.Id == adId, cancellationToken);

        if (ad == null)
            return false;

        if (!string.IsNullOrEmpty(ad.MetaAdId) && 
            !ad.MetaAdId.StartsWith("draft_ad_") && 
            !ad.MetaAdId.StartsWith("mock_ad_") &&
            ad.AdSet?.Campaign?.AdAccount != null && 
            !string.IsNullOrEmpty(ad.AdSet.Campaign.AdAccount.AccessToken))
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                var deleteUrl = $"{GraphApiBase}/{ad.MetaAdId}?access_token={ad.AdSet.Campaign.AdAccount.AccessToken}";
                var response = await client.DeleteAsync(deleteUrl, cancellationToken);
                var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
                
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Failed to delete ad {MetaId} from Meta. Status: {Status}. Response: {Response}", 
                        ad.MetaAdId, response.StatusCode, responseJson);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting ad {MetaId} from Meta", ad.MetaAdId);
            }
        }

        _dbContext.FacebookAds.Remove(ad);
        await _dbContext.SaveChangesAsync(cancellationToken);
        
        return true;
    }

    public async Task<FacebookAdSet> UpdateAdSetAsync(Guid adSetId, UpdateAdSetDto dto, CancellationToken cancellationToken = default)
    {
        var adSet = await _dbContext.FacebookAdSets
            .Include(x => x.Campaign)
                .ThenInclude(c => c.AdAccount)
            .FirstOrDefaultAsync(x => x.Id == adSetId, cancellationToken);

        if (adSet == null)
            throw new ArgumentException("AdSet not found");

        adSet.Name = dto.Name;
        adSet.DailyBudget = dto.DailyBudget;
        adSet.TargetingAgeMin = dto.TargetingAgeMin;
        adSet.TargetingAgeMax = dto.TargetingAgeMax;
        adSet.TargetingLocations = dto.TargetingLocations;
        if (!string.IsNullOrEmpty(dto.Status)) adSet.Status = dto.Status;
        adSet.UpdatedAt = DateTime.UtcNow;

        if (!string.IsNullOrEmpty(adSet.MetaAdSetId) && 
            !adSet.MetaAdSetId.StartsWith("draft_adset_") && 
            !adSet.MetaAdSetId.StartsWith("mock_adset_") &&
            adSet.Campaign?.AdAccount != null)
        {
            var client = _httpClientFactory.CreateClient();
            var updateUrl = $"{GraphApiBase}/{adSet.MetaAdSetId}";
            var targetingJson = BuildTargetingJson(adSet.TargetingLocations, adSet.TargetingAgeMin, adSet.TargetingAgeMax);
            
            var payload = new Dictionary<string, string>
            {
                ["name"] = adSet.Name,
                ["targeting"] = targetingJson,
                ["status"] = adSet.Status,
                ["access_token"] = adSet.Campaign.AdAccount.AccessToken
            };

            if (adSet.DailyBudget > 0 && (adSet.Campaign == null || adSet.Campaign.Budget <= 0))
            {
                payload["daily_budget"] = ((int)adSet.DailyBudget).ToString();
            }

            var response = await client.PostAsync(updateUrl, new FormUrlEncodedContent(payload), cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogError("Failed to update ad set {MetaId}. {Err}", adSet.MetaAdSetId, err);
                throw new Exception($"Meta AdSet Update Failed: {ExtractErrorMessage(err)}");
            }
        }

        _dbContext.FacebookAdSets.Update(adSet);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return adSet;
    }

    public async Task<FacebookAd> UpdateAdAsync(Guid adId, UpdateFacebookAdDto dto, CancellationToken cancellationToken = default)
    {
        var ad = await _dbContext.FacebookAds
            .Include(x => x.AdSet)
                .ThenInclude(s => s.Campaign)
                    .ThenInclude(c => c.AdAccount)
            .FirstOrDefaultAsync(x => x.Id == adId, cancellationToken);

        if (ad == null)
            throw new ArgumentException("Ad not found");

        ad.Name = dto.Name;
        ad.Title = dto.Title;
        ad.BodyText = dto.BodyText;
        ad.MediaUrl = dto.MediaUrl;
        ad.DestinationUrl = dto.DestinationUrl;
        ad.CallToAction = dto.CallToAction;
        ad.FacebookPostId = dto.FacebookPostId;
        if (!string.IsNullOrEmpty(dto.Status)) ad.Status = dto.Status;
        ad.UpdatedAt = DateTime.UtcNow;

        var account = ad.AdSet?.Campaign?.AdAccount;

        if (!string.IsNullOrEmpty(ad.MetaAdId) && 
            !ad.MetaAdId.StartsWith("draft_ad_") && 
            !ad.MetaAdId.StartsWith("mock_ad_") &&
            account != null)
        {
            var client = _httpClientFactory.CreateClient();
            var actId = account.AdAccountId;
            var accessToken = account.AccessToken;

            var imageHash = "";
            if (string.IsNullOrEmpty(ad.FacebookPostId))
            {
                if (!string.IsNullOrEmpty(ad.MediaUrl))
                {
                    imageHash = await UploadAdImageAsync(client, actId, accessToken, ad.MediaUrl, cancellationToken);
                }

                if (string.IsNullOrEmpty(imageHash))
                {
                    throw new Exception("Creative image upload to Meta Ad Library failed. A valid image is required.");
                }
            }

            var creativeUrl = $"{GraphApiBase}/{actId}/adcreatives";
            Dictionary<string, string> creativePayload;

            if (!string.IsNullOrEmpty(ad.FacebookPostId))
            {
                creativePayload = new Dictionary<string, string>
                {
                    ["object_story_id"] = $"{ad.AdSet!.Campaign!.PageId}_{ad.FacebookPostId}",
                    ["name"] = ad.Name,
                    ["access_token"] = accessToken
                };
            }
            else
            {
                var creativeObj = new
                {
                    name = ad.Name,
                    object_story_spec = new
                    {
                        page_id = ad.AdSet!.Campaign!.PageId ?? "102049281",
                        link_data = new
                        {
                            image_hash = imageHash,
                            link = ad.DestinationUrl,
                            message = ad.BodyText,
                            name = ad.Title,
                            call_to_action = new
                            {
                                type = ad.CallToAction,
                                value = new { link = ad.DestinationUrl }
                            }
                        }
                    }
                };

                creativePayload = new Dictionary<string, string>
                {
                    ["object_story_spec"] = JsonSerializer.Serialize(creativeObj.object_story_spec),
                    ["name"] = ad.Name,
                    ["access_token"] = accessToken
                };
            }

            var creativeResponse = await client.PostAsync(creativeUrl, new FormUrlEncodedContent(creativePayload), cancellationToken);
            var creativeJson = await creativeResponse.Content.ReadAsStringAsync(cancellationToken);
            if (!creativeResponse.IsSuccessStatusCode)
            {
                throw new Exception($"Meta Ad Creative Creation Failed: {ExtractErrorMessage(creativeJson)}");
            }

            var creativeResult = JsonSerializer.Deserialize<JsonElement>(creativeJson);
            var newCreativeId = creativeResult.GetProperty("id").GetString()!;

            var updateAdUrl = $"{GraphApiBase}/{ad.MetaAdId}";
            var adPayload = new Dictionary<string, string>
            {
                ["name"] = ad.Name,
                ["creative"] = JsonSerializer.Serialize(new { creative_id = newCreativeId }),
                ["status"] = ad.Status,
                ["access_token"] = accessToken
            };

            var adResponse = await client.PostAsync(updateAdUrl, new FormUrlEncodedContent(adPayload), cancellationToken);
            var adJson = await adResponse.Content.ReadAsStringAsync(cancellationToken);
            if (!adResponse.IsSuccessStatusCode)
            {
                throw new Exception($"Meta Ad Update Failed: {ExtractErrorMessage(adJson)}");
            }
        }

        _dbContext.FacebookAds.Update(ad);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return ad;
    }

    public async Task<FacebookAd> MoveAdAsync(Guid adId, Guid newAdSetId, CancellationToken cancellationToken = default)
    {
        var ad = await _dbContext.FacebookAds
            .Include(x => x.AdSet)
                .ThenInclude(s => s.Campaign)
                    .ThenInclude(c => c.AdAccount)
            .FirstOrDefaultAsync(x => x.Id == adId, cancellationToken);

        if (ad == null)
            throw new ArgumentException("Ad not found");

        if (ad.FacebookAdSetId == newAdSetId)
            return ad; // Nothing to do

        var newAdSet = await _dbContext.FacebookAdSets
            .Include(s => s.Campaign)
            .FirstOrDefaultAsync(x => x.Id == newAdSetId, cancellationToken);

        if (newAdSet == null)
            throw new ArgumentException("Destination Ad Set not found");

        var account = ad.AdSet?.Campaign?.AdAccount;

        // If the ad is already published to Meta, we must delete it and recreate it
        if (!string.IsNullOrEmpty(ad.MetaAdId) && 
            !ad.MetaAdId.StartsWith("draft_ad_") && 
            !ad.MetaAdId.StartsWith("mock_ad_") &&
            account != null)
        {
            var client = _httpClientFactory.CreateClient();
            var actId = account.AdAccountId;
            var accessToken = account.AccessToken;

            // 1. Recreate Ad Creative & Ad in new Ad Set
            var imageHash = "";
            if (string.IsNullOrEmpty(ad.FacebookPostId))
            {
                if (!string.IsNullOrEmpty(ad.MediaUrl))
                {
                    imageHash = await UploadAdImageAsync(client, actId, accessToken, ad.MediaUrl, cancellationToken);
                }

                if (string.IsNullOrEmpty(imageHash))
                {
                    throw new Exception("Creative image upload to Meta failed during move.");
                }
            }

            var creativeUrl = $"{GraphApiBase}/{actId}/adcreatives";
            Dictionary<string, string> creativePayload;

            if (!string.IsNullOrEmpty(ad.FacebookPostId))
            {
                creativePayload = new Dictionary<string, string>
                {
                    ["object_story_id"] = $"{ad.AdSet!.Campaign!.PageId}_{ad.FacebookPostId}",
                    ["name"] = ad.Name,
                    ["access_token"] = accessToken
                };
            }
            else
            {
                var creativeObj = new
                {
                    name = ad.Name,
                    object_story_spec = new
                    {
                        page_id = ad.AdSet!.Campaign!.PageId ?? "102049281",
                        link_data = new
                        {
                            image_hash = imageHash,
                            link = ad.DestinationUrl,
                            message = ad.BodyText,
                            name = ad.Title,
                            call_to_action = new
                            {
                                type = ad.CallToAction,
                                value = new { link = ad.DestinationUrl }
                            }
                        }
                    }
                };

                creativePayload = new Dictionary<string, string>
                {
                    ["object_story_spec"] = JsonSerializer.Serialize(creativeObj.object_story_spec),
                    ["name"] = ad.Name,
                    ["access_token"] = accessToken
                };
            }

            var creativeResponse = await client.PostAsync(creativeUrl, new FormUrlEncodedContent(creativePayload), cancellationToken);
            var creativeJson = await creativeResponse.Content.ReadAsStringAsync(cancellationToken);
            if (!creativeResponse.IsSuccessStatusCode)
            {
                throw new Exception($"Meta Ad Creative Creation Failed during move: {ExtractErrorMessage(creativeJson)}");
            }

            var creativeResult = JsonSerializer.Deserialize<JsonElement>(creativeJson);
            var newCreativeId = creativeResult.GetProperty("id").GetString()!;

            // 2. Create new Ad in Meta
            var adUrl = $"{GraphApiBase}/{actId}/ads";
            var adPayload = new Dictionary<string, string>
            {
                ["name"] = ad.Name,
                ["adset_id"] = newAdSet.MetaAdSetId,
                ["creative"] = JsonSerializer.Serialize(new { creative_id = newCreativeId }),
                ["status"] = ad.Status == "ACTIVE" ? "ACTIVE" : "PAUSED",
                ["access_token"] = accessToken
            };

            var adResponse = await client.PostAsync(adUrl, new FormUrlEncodedContent(adPayload), cancellationToken);
            var adJson = await adResponse.Content.ReadAsStringAsync(cancellationToken);
            if (!adResponse.IsSuccessStatusCode)
            {
                throw new Exception($"Meta Ad Creation Failed during move: {ExtractErrorMessage(adJson)}");
            }

            var adResult = JsonSerializer.Deserialize<JsonElement>(adJson);
            var newMetaAdId = adResult.GetProperty("id").GetString()!;

            // 3. Delete old Ad from Meta
            var deleteUrl = $"{GraphApiBase}/{ad.MetaAdId}?access_token={accessToken}";
            var deleteResponse = await client.DeleteAsync(deleteUrl, cancellationToken);
            if (!deleteResponse.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to delete old Meta Ad {OldAdId} during move. Status code: {StatusCode}", ad.MetaAdId, deleteResponse.StatusCode);
            }

            ad.MetaAdId = newMetaAdId;
        }

        // Update local DB
        ad.FacebookAdSetId = newAdSet.Id;
        ad.UpdatedAt = DateTime.UtcNow;
        _dbContext.FacebookAds.Update(ad);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return ad;
    }

    public async Task SyncInsightsAsync(Guid adAccountId, CancellationToken cancellationToken = default)
    {
        var account = await _dbContext.FacebookAdAccounts.FindAsync(new object[] { adAccountId }, cancellationToken);
        if (account == null) return;

        var client = _httpClientFactory.CreateClient();
        var accessToken = account.AccessToken;
        var actId = account.AdAccountId;

        // Fetch ad level insights to log against local ads
        var url = $"{GraphApiBase}/{actId}/insights?fields=ad_id,ad_name,impressions,reach,clicks,spend&level=ad&date_preset=last_30d&time_increment=1&limit=500&access_token={accessToken}";
        
        var response = await client.GetAsync(url, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("Failed to sync insights from Meta. Error: {Err}", err);
            return;
        }

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        var data = JsonSerializer.Deserialize<JsonElement>(json);

        if (data.TryGetProperty("data", out var listProp) && listProp.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in listProp.EnumerateArray())
            {
                var adMetaId = item.GetProperty("ad_id").GetString()!;
                var impressions = int.Parse(item.GetProperty("impressions").GetString()!);
                var reach = int.Parse(item.GetProperty("reach").GetString()!);
                var clicks = int.Parse(item.GetProperty("clicks").GetString()!);
                var spend = decimal.Parse(item.GetProperty("spend").GetString()!);
                
                var dateStr = item.GetProperty("date_start").GetString()!;
                var date = DateTime.Parse(dateStr).Date;

                var localAd = await _dbContext.FacebookAds
                    .FirstOrDefaultAsync(x => x.MetaAdId == adMetaId, cancellationToken);

                if (localAd != null)
                {
                    // Check if insight entry exists for this ad on this date
                    var existingInsight = await _dbContext.FacebookAdInsights
                        .FirstOrDefaultAsync(x => x.FacebookAdId == localAd.Id && x.Date == date, cancellationToken);

                    if (existingInsight == null)
                    {
                        var newInsight = new FacebookAdInsight
                        {
                            FacebookAdId = localAd.Id,
                            Impressions = impressions,
                            Reach = reach,
                            Clicks = clicks,
                            Spend = spend,
                            Date = date
                        };
                        _dbContext.FacebookAdInsights.Add(newInsight);
                    }
                    else
                    {
                        existingInsight.Impressions = impressions;
                        existingInsight.Reach = reach;
                        existingInsight.Clicks = clicks;
                        existingInsight.Spend = spend;
                        existingInsight.UpdatedAt = DateTime.UtcNow;
                        _dbContext.FacebookAdInsights.Update(existingInsight);
                    }
                }
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<List<FacebookAdInsightDto>> GetCampaignInsightsAsync(Guid campaignId, DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default)
    {
        // Query historical statistics saved locally
        var ads = await _dbContext.FacebookAds
            .Where(x => x.AdSet.FacebookCampaignId == campaignId)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        var insights = await _dbContext.FacebookAdInsights
            .Include(x => x.Ad)
            .ThenInclude(x => x.AdSet)
            .ThenInclude(x => x.Campaign)
            .Where(x => ads.Contains(x.FacebookAdId) && x.Date >= startDate && x.Date <= endDate)
            .OrderBy(x => x.Date)
            .ToListAsync(cancellationToken);

        // Group by Date for chart representation
        var list = insights.Select(x => new FacebookAdInsightDto
        {
            CampaignId = x.Ad.AdSet.Campaign.MetaCampaignId,
            CampaignName = x.Ad.AdSet.Campaign.Name,
            Impressions = x.Impressions,
            Reach = x.Reach,
            Clicks = x.Clicks,
            Spend = x.Spend,
            Date = x.Date
        }).ToList();

        return list;
    }

    public async Task<bool> CheckPaymentMethodAsync(Guid adAccountId, CancellationToken cancellationToken = default)
    {
        var account = await _dbContext.FacebookAdAccounts.FindAsync(new object[] { adAccountId }, cancellationToken);
        if (account == null)
            throw new ArgumentException("Ad Account not found");

        var client = _httpClientFactory.CreateClient();
        var url = $"{GraphApiBase}/{account.AdAccountId}?fields=id,name,funding_source&access_token={account.AccessToken}";

        try
        {
            var response = await client.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogWarning("Failed to check payment status for Meta Ad Account {AccountId}. Status: {Status}, Error: {Error}. Falling back to DB value.", account.AdAccountId, response.StatusCode, error);
                
                // Return the DB saved status (HasPaymentMethod defaults to true, but user can override it)
                return account.HasPaymentMethod; 
            }

            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            var result = JsonSerializer.Deserialize<JsonElement>(json);
            
            bool hasPayment = false;
            string fundingSource = "";
            if (result.TryGetProperty("funding_source", out var fundingProp) && !string.IsNullOrEmpty(fundingProp.GetString()))
            {
                fundingSource = fundingProp.GetString()!;
                hasPayment = true;
            }

            // Sync the payment status to local DB
            account.HasPaymentMethod = hasPayment;
            account.FundingSource = fundingSource;
            account.UpdatedAt = DateTime.UtcNow;
            _dbContext.FacebookAdAccounts.Update(account);
            await _dbContext.SaveChangesAsync(cancellationToken);

            return hasPayment;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking payment method status, returning local DB value.");
            return account.HasPaymentMethod;
        }
    }

    public async Task<FacebookCampaign> SyncOrPublishCampaignAsync(Guid campaignId, string targetStatus, CancellationToken cancellationToken = default)
    {
        var campaign = await _dbContext.FacebookCampaigns
            .Include(c => c.AdSets)
                .ThenInclude(s => s.Ads)
            .FirstOrDefaultAsync(c => c.Id == campaignId, cancellationToken);

        if (campaign == null)
            throw new ArgumentException("Campaign not found");

        var account = await _dbContext.FacebookAdAccounts.FindAsync(new object[] { campaign.FacebookAdAccountId }, cancellationToken);
        if (account == null)
            throw new ArgumentException("Ad Account not found");

        // If publishing to ACTIVE, check payment method first!
        if (targetStatus == "ACTIVE")
        {
            var hasPayment = await CheckPaymentMethodAsync(account.Id, cancellationToken);
            if (!hasPayment)
            {
                throw new Exception("This advertising account does not have a valid payment method. To publish advertisements and start delivery, please add a payment method in Meta Business Manager.");
            }
        }

        var client = _httpClientFactory.CreateClient();
        var accessToken = account.AccessToken;
        var actId = account.AdAccountId;

        try
        {
            // If currently in DRAFT (i.e. MetaCampaignId is draft_camp_*), we must create EVERYTHING on Meta!
            if (campaign.MetaCampaignId.StartsWith("draft_camp_"))
            {
                // 1. Create Campaign on Meta
                var campUrl = $"{GraphApiBase}/{actId}/campaigns";
                var campPayload = new Dictionary<string, string>
                {
                    ["name"] = campaign.Name,
                    ["objective"] = campaign.Objective,
                    ["status"] = "PAUSED", // Create in PAUSED state first
                    ["special_ad_categories"] = "[\"NONE\"]",
                    ["daily_budget"] = ((int)campaign.Budget).ToString(),
                    ["bid_strategy"] = "LOWEST_COST_WITHOUT_CAP",
                    ["access_token"] = accessToken
                };

                string realMetaCampId;
                try
                {
                    var campResponse = await client.PostAsync(campUrl, new FormUrlEncodedContent(campPayload), cancellationToken);
                    var campJson = await campResponse.Content.ReadAsStringAsync(cancellationToken);
                    if (!campResponse.IsSuccessStatusCode)
                    {
                        throw new Exception($"Meta Campaign Creation Failed: {ExtractErrorMessage(campJson)}");
                    }
                    var campResult = JsonSerializer.Deserialize<JsonElement>(campJson);
                    realMetaCampId = campResult.GetProperty("id").GetString()!;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to create campaign on Meta.");
                    throw;
                }

                campaign.MetaCampaignId = realMetaCampId;
                campaign.Status = targetStatus;
                _dbContext.FacebookCampaigns.Update(campaign);
                await _dbContext.SaveChangesAsync(cancellationToken);

                // 2. Process AdSets and Ads
                foreach (var adSet in campaign.AdSets)
                {
                    string realMetaAdSetId = "";
                    if (adSet.MetaAdSetId.StartsWith("draft_adset_"))
                    {
                        // Create Ad Set on Meta
                        var adsetUrl = $"{GraphApiBase}/{actId}/adsets";
                        
                        // Parse or fallback targeting options
                        var targetingJson = BuildTargetingJson(adSet.TargetingLocations, adSet.TargetingAgeMin, adSet.TargetingAgeMax);

                        var adSetPostId = adSet.Ads.FirstOrDefault(a => !string.IsNullOrEmpty(a.FacebookPostId))?.FacebookPostId;
                        var adsetPayload = new Dictionary<string, string>
                        {
                            ["name"] = adSet.Name,
                            ["campaign_id"] = realMetaCampId,
                            ["billing_event"] = adSet.BillingEvent,
                            ["optimization_goal"] = ResolveOptimizationGoal(campaign.Objective, adSetPostId),
                            ["targeting"] = targetingJson,
                            ["status"] = targetStatus == "ACTIVE" ? "ACTIVE" : "PAUSED",
                            ["access_token"] = accessToken
                        };

                        try
                        {
                            var adsetResponse = await client.PostAsync(adsetUrl, new FormUrlEncodedContent(adsetPayload), cancellationToken);
                            var adsetJson = await adsetResponse.Content.ReadAsStringAsync(cancellationToken);
                            if (!adsetResponse.IsSuccessStatusCode)
                            {
                                throw new Exception($"Meta Ad Set Creation Failed: {ExtractErrorMessage(adsetJson)}");
                            }
                            var adsetResult = JsonSerializer.Deserialize<JsonElement>(adsetJson);
                            realMetaAdSetId = adsetResult.GetProperty("id").GetString()!;
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Failed to create adset on Meta.");
                            throw;
                        }

                        adSet.MetaAdSetId = realMetaAdSetId;
                        adSet.Status = targetStatus;
                        _dbContext.FacebookAdSets.Update(adSet);
                        await _dbContext.SaveChangesAsync(cancellationToken);
                    }
                    else
                    {
                        realMetaAdSetId = adSet.MetaAdSetId;
                        adSet.Status = targetStatus;
                        
                        // If transitioning from PAUSED to ACTIVE, toggle on Meta
                        if (targetStatus == "ACTIVE" && !realMetaAdSetId.StartsWith("mock_adset_"))
                        {
                            var toggleUrl = $"{GraphApiBase}/{realMetaAdSetId}";
                            var togglePayload = new Dictionary<string, string>
                            {
                                ["status"] = "ACTIVE",
                                ["access_token"] = accessToken
                            };
                            await client.PostAsync(toggleUrl, new FormUrlEncodedContent(togglePayload), cancellationToken);
                        }
                        _dbContext.FacebookAdSets.Update(adSet);
                        await _dbContext.SaveChangesAsync(cancellationToken);
                    }

                    // Process Ads
                    foreach (var ad in adSet.Ads)
                    {
                        if (ad.MetaAdId.StartsWith("draft_ad_"))
                        {
                            string realMetaAdId;
                            try
                            {
                                // Upload Image to Meta Ad Images (Only if not using existing Facebook Post)
                                var imageHash = "";
                                if (string.IsNullOrEmpty(ad.FacebookPostId))
                                {
                                    if (!string.IsNullOrEmpty(ad.MediaUrl))
                                    {
                                        imageHash = await UploadAdImageAsync(client, actId, accessToken, ad.MediaUrl, cancellationToken);
                                    }

                                    if (string.IsNullOrEmpty(imageHash))
                                    {
                                        throw new Exception("Creative image upload to Meta Ad Library failed. A valid image is required.");
                                    }
                                }

                                // Create Creative
                                var creativeUrl = $"{GraphApiBase}/{actId}/adcreatives";
                                Dictionary<string, string> creativePayload;

                                if (!string.IsNullOrEmpty(ad.FacebookPostId))
                                {
                                    creativePayload = new Dictionary<string, string>
                                    {
                                        ["object_story_id"] = $"{campaign.PageId}_{ad.FacebookPostId}",
                                        ["name"] = ad.Name,
                                        ["access_token"] = accessToken
                                    };
                                }
                                else
                                {
                                    var creativeObj = new
                                    {
                                        name = ad.Name,
                                        object_story_spec = new
                                        {
                                            page_id = campaign.PageId ?? "102049281",
                                            link_data = new
                                            {
                                                image_hash = imageHash,
                                                link = ad.DestinationUrl,
                                                message = ad.BodyText,
                                                name = ad.Title,
                                                call_to_action = new
                                                {
                                                    type = ad.CallToAction,
                                                    value = new { link = ad.DestinationUrl }
                                                }
                                            }
                                        }
                                    };

                                    creativePayload = new Dictionary<string, string>
                                    {
                                        ["object_story_spec"] = JsonSerializer.Serialize(creativeObj.object_story_spec),
                                        ["name"] = ad.Name,
                                        ["access_token"] = accessToken
                                    };
                                }

                                var creativeResponse = await client.PostAsync(creativeUrl, new FormUrlEncodedContent(creativePayload), cancellationToken);
                                var creativeJson = await creativeResponse.Content.ReadAsStringAsync(cancellationToken);
                                if (!creativeResponse.IsSuccessStatusCode)
                                {
                                    throw new Exception($"Meta Ad Creative Creation Failed: {ExtractErrorMessage(creativeJson)}");
                                }

                                var creativeResult = JsonSerializer.Deserialize<JsonElement>(creativeJson);
                                var metaCreativeId = creativeResult.GetProperty("id").GetString()!;

                                // Create Ad
                                var adUrl = $"{GraphApiBase}/{actId}/ads";
                                var adPayload = new Dictionary<string, string>
                                {
                                    ["name"] = ad.Name,
                                    ["adset_id"] = realMetaAdSetId,
                                    ["creative"] = JsonSerializer.Serialize(new { creative_id = metaCreativeId }),
                                    ["status"] = targetStatus == "ACTIVE" ? "ACTIVE" : "PAUSED",
                                    ["access_token"] = accessToken
                                };

                                var adResponse = await client.PostAsync(adUrl, new FormUrlEncodedContent(adPayload), cancellationToken);
                                var adJson = await adResponse.Content.ReadAsStringAsync(cancellationToken);
                                if (!adResponse.IsSuccessStatusCode)
                                {
                                    throw new Exception($"Meta Ad Creation Failed: {ExtractErrorMessage(adJson)}");
                                }

                                var adResult = JsonSerializer.Deserialize<JsonElement>(adJson);
                                realMetaAdId = adResult.GetProperty("id").GetString()!;
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, "Failed to create ad creative/ad on Meta during sync.");
                                throw;
                            }

                            ad.MetaAdId = realMetaAdId;
                            ad.Status = targetStatus;
                            _dbContext.FacebookAds.Update(ad);
                            await _dbContext.SaveChangesAsync(cancellationToken);
                        }
                        else
                        {
                            ad.Status = targetStatus;
                            // If transitioning from PAUSED to ACTIVE, toggle on Meta
                            if (targetStatus == "ACTIVE" && !ad.MetaAdId.StartsWith("mock_ad_"))
                            {
                                var toggleUrl = $"{GraphApiBase}/{ad.MetaAdId}";
                                var togglePayload = new Dictionary<string, string>
                                {
                                    ["status"] = "ACTIVE",
                                    ["access_token"] = accessToken
                                };
                                await client.PostAsync(toggleUrl, new FormUrlEncodedContent(togglePayload), cancellationToken);
                            }
                            _dbContext.FacebookAds.Update(ad);
                            await _dbContext.SaveChangesAsync(cancellationToken);
                        }
                    }
                }

                // Finally toggle campaign status on Meta to target status if target is ACTIVE
                if (targetStatus == "ACTIVE" && !realMetaCampId.StartsWith("mock_camp_"))
                {
                    var toggleUrl = $"{GraphApiBase}/{realMetaCampId}";
                    var togglePayload = new Dictionary<string, string>
                    {
                        ["status"] = "ACTIVE",
                        ["access_token"] = accessToken
                    };
                    await client.PostAsync(toggleUrl, new FormUrlEncodedContent(togglePayload), cancellationToken);
                }
            }
            else
            {
                // Already synced on Facebook. Just toggle campaign status, and process all adsets/ads.
                if (!campaign.MetaCampaignId.StartsWith("mock_camp_"))
                {
                    var toggleUrl = $"{GraphApiBase}/{campaign.MetaCampaignId}";
                    var togglePayload = new Dictionary<string, string>
                    {
                        ["status"] = targetStatus == "ACTIVE" ? "ACTIVE" : "PAUSED",
                        ["access_token"] = accessToken
                    };
                    await client.PostAsync(toggleUrl, new FormUrlEncodedContent(togglePayload), cancellationToken);
                }

                campaign.Status = targetStatus;
                _dbContext.FacebookCampaigns.Update(campaign);

                foreach (var adSet in campaign.AdSets)
                {
                    string realMetaAdSetId = "";
                    if (adSet.MetaAdSetId.StartsWith("draft_adset_"))
                    {
                        // Create Ad Set on Meta
                        var adsetUrl = $"{GraphApiBase}/{actId}/adsets";
                        var targetingJson = BuildTargetingJson(adSet.TargetingLocations, adSet.TargetingAgeMin, adSet.TargetingAgeMax);
                        var adSetPostId = adSet.Ads.FirstOrDefault(a => !string.IsNullOrEmpty(a.FacebookPostId))?.FacebookPostId;
                        
                        var adsetPayload = new Dictionary<string, string>
                        {
                            ["name"] = adSet.Name,
                            ["campaign_id"] = campaign.MetaCampaignId,
                            ["billing_event"] = adSet.BillingEvent,
                            ["optimization_goal"] = ResolveOptimizationGoal(campaign.Objective, adSetPostId),
                            ["targeting"] = targetingJson,
                            ["status"] = targetStatus == "ACTIVE" ? "ACTIVE" : "PAUSED",
                            ["access_token"] = accessToken
                        };

                        try
                        {
                            var adsetResponse = await client.PostAsync(adsetUrl, new FormUrlEncodedContent(adsetPayload), cancellationToken);
                            var adsetJson = await adsetResponse.Content.ReadAsStringAsync(cancellationToken);
                            if (!adsetResponse.IsSuccessStatusCode)
                            {
                                throw new Exception($"Meta Ad Set Creation Failed: {ExtractErrorMessage(adsetJson)}");
                            }
                            var adsetResult = JsonSerializer.Deserialize<JsonElement>(adsetJson);
                            realMetaAdSetId = adsetResult.GetProperty("id").GetString()!;
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Failed to create adset on Meta.");
                            throw;
                        }

                        adSet.MetaAdSetId = realMetaAdSetId;
                        adSet.Status = targetStatus;
                        _dbContext.FacebookAdSets.Update(adSet);
                        await _dbContext.SaveChangesAsync(cancellationToken);
                    }
                    else
                    {
                        realMetaAdSetId = adSet.MetaAdSetId;
                        adSet.Status = targetStatus;
                        
                        if (targetStatus == "ACTIVE" && !realMetaAdSetId.StartsWith("mock_adset_"))
                        {
                            var toggleUrl = $"{GraphApiBase}/{realMetaAdSetId}";
                            var togglePayload = new Dictionary<string, string>
                            {
                                ["status"] = "ACTIVE",
                                ["access_token"] = accessToken
                            };
                            await client.PostAsync(toggleUrl, new FormUrlEncodedContent(togglePayload), cancellationToken);
                        }
                        _dbContext.FacebookAdSets.Update(adSet);
                        await _dbContext.SaveChangesAsync(cancellationToken);
                    }

                    foreach (var ad in adSet.Ads)
                    {
                        if (ad.MetaAdId.StartsWith("draft_ad_"))
                        {
                            string realMetaAdId;
                            try
                            {
                                var imageHash = "";
                                if (string.IsNullOrEmpty(ad.FacebookPostId))
                                {
                                    if (!string.IsNullOrEmpty(ad.MediaUrl))
                                    {
                                        imageHash = await UploadAdImageAsync(client, actId, accessToken, ad.MediaUrl, cancellationToken);
                                    }

                                    if (string.IsNullOrEmpty(imageHash))
                                    {
                                        throw new Exception("Creative image upload to Meta Ad Library failed. A valid image is required.");
                                    }
                                }

                                var creativeUrl = $"{GraphApiBase}/{actId}/adcreatives";
                                Dictionary<string, string> creativePayload;

                                if (!string.IsNullOrEmpty(ad.FacebookPostId))
                                {
                                    creativePayload = new Dictionary<string, string>
                                    {
                                        ["object_story_id"] = $"{campaign.PageId}_{ad.FacebookPostId}",
                                        ["name"] = ad.Name,
                                        ["access_token"] = accessToken
                                    };
                                }
                                else
                                {
                                    var creativeObj = new
                                    {
                                        name = ad.Name,
                                        object_story_spec = new
                                        {
                                            page_id = campaign.PageId ?? "102049281",
                                            link_data = new
                                            {
                                                image_hash = imageHash,
                                                link = ad.DestinationUrl,
                                                message = ad.BodyText,
                                                name = ad.Title,
                                                call_to_action = new
                                                {
                                                    type = ad.CallToAction,
                                                    value = new { link = ad.DestinationUrl }
                                                }
                                            }
                                        }
                                    };

                                    creativePayload = new Dictionary<string, string>
                                    {
                                        ["object_story_spec"] = JsonSerializer.Serialize(creativeObj.object_story_spec),
                                        ["name"] = ad.Name,
                                        ["access_token"] = accessToken
                                    };
                                }

                                var creativeResponse = await client.PostAsync(creativeUrl, new FormUrlEncodedContent(creativePayload), cancellationToken);
                                var creativeJson = await creativeResponse.Content.ReadAsStringAsync(cancellationToken);
                                if (!creativeResponse.IsSuccessStatusCode)
                                {
                                    throw new Exception($"Meta Ad Creative Creation Failed: {ExtractErrorMessage(creativeJson)}");
                                }

                                var creativeResult = JsonSerializer.Deserialize<JsonElement>(creativeJson);
                                var metaCreativeId = creativeResult.GetProperty("id").GetString()!;

                                var adUrl = $"{GraphApiBase}/{actId}/ads";
                                var adPayload = new Dictionary<string, string>
                                {
                                    ["name"] = ad.Name,
                                    ["adset_id"] = realMetaAdSetId,
                                    ["creative"] = JsonSerializer.Serialize(new { creative_id = metaCreativeId }),
                                    ["status"] = targetStatus == "ACTIVE" ? "ACTIVE" : "PAUSED",
                                    ["access_token"] = accessToken
                                };

                                var adResponse = await client.PostAsync(adUrl, new FormUrlEncodedContent(adPayload), cancellationToken);
                                var adJson = await adResponse.Content.ReadAsStringAsync(cancellationToken);
                                if (!adResponse.IsSuccessStatusCode)
                                {
                                    throw new Exception($"Meta Ad Creation Failed: {ExtractErrorMessage(adJson)}");
                                }

                                var adResult = JsonSerializer.Deserialize<JsonElement>(adJson);
                                realMetaAdId = adResult.GetProperty("id").GetString()!;
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, "Failed to create ad creative/ad on Meta during sync.");
                                throw;
                            }

                            ad.MetaAdId = realMetaAdId;
                            ad.Status = targetStatus;
                            _dbContext.FacebookAds.Update(ad);
                            await _dbContext.SaveChangesAsync(cancellationToken);
                        }
                        else
                        {
                            ad.Status = targetStatus;
                            if (targetStatus == "ACTIVE" && !ad.MetaAdId.StartsWith("mock_ad_"))
                            {
                                var toggleUrl = $"{GraphApiBase}/{ad.MetaAdId}";
                                var togglePayload = new Dictionary<string, string>
                                {
                                    ["status"] = "ACTIVE",
                                    ["access_token"] = accessToken
                                };
                                await client.PostAsync(toggleUrl, new FormUrlEncodedContent(togglePayload), cancellationToken);
                            }
                            _dbContext.FacebookAds.Update(ad);
                            await _dbContext.SaveChangesAsync(cancellationToken);
                        }
                    }
                }
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
            return campaign;
        }
        catch (Exception)
        {
            throw;
        }
    }

    private string ResolveOptimizationGoal(string objective, string? facebookPostId)
    {
        var hasExistingPost = !string.IsNullOrEmpty(facebookPostId);

        return objective switch
        {
            "OUTCOME_TRAFFIC" => hasExistingPost ? "IMPRESSIONS" : "LINK_CLICKS",
            "OUTCOME_ENGAGEMENT" => "POST_ENGAGEMENT",
            "OUTCOME_AWARENESS" => "IMPRESSIONS",
            "OUTCOME_SALES" => hasExistingPost ? "IMPRESSIONS" : "OFFSITE_CONVERSIONS",
            "OUTCOME_LEADS" => hasExistingPost ? "IMPRESSIONS" : "LEADS",
            _ => "IMPRESSIONS"
        };
    }

    private static string ExtractErrorMessage(string json)
    {
        try
        {
            var doc = JsonSerializer.Deserialize<JsonElement>(json);
            if (doc.TryGetProperty("error", out var errorObj))
            {
                var sb = new System.Text.StringBuilder();
                if (errorObj.TryGetProperty("message", out var msg))
                {
                    sb.Append(msg.GetString());
                }
                if (errorObj.TryGetProperty("error_user_title", out var title))
                {
                    sb.Append($" | Title: {title.GetString()}");
                }
                if (errorObj.TryGetProperty("error_user_msg", out var userMsg))
                {
                    sb.Append($" | Details: {userMsg.GetString()}");
                }

                if (sb.Length > 0)
                    return sb.ToString();
            }
        }
        catch { }
        return $"Unknown Meta API error: {json}";
    }

    public async Task<List<FacebookPagePostDto>> GetFacebookPagePostsAsync(string pageIdentifier, CancellationToken cancellationToken = default)
    {
        var socialAccount = await _dbContext.SocialAccounts
            .FirstOrDefaultAsync(x => x.AccountIdentifier == pageIdentifier && x.Platform == 1, cancellationToken);

        if (socialAccount == null)
        {
            return GetMockFacebookPagePosts(pageIdentifier);
        }

        var client = _httpClientFactory.CreateClient();
        var pageToken = socialAccount.AccessToken;
        
        var postsUrl = $"{GraphApiBase}/{pageIdentifier}/posts?fields=id,message,created_time,full_picture,permalink_url&access_token={pageToken}&limit=50";

        try
        {
            var response = await client.GetAsync(postsUrl, cancellationToken);
            var json = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                return GetMockFacebookPagePosts(pageIdentifier);
            }

            var result = JsonSerializer.Deserialize<JsonElement>(json);
            if (result.TryGetProperty("data", out var dataElement))
            {
                var postsList = new List<FacebookPagePostDto>();
                foreach (var item in dataElement.EnumerateArray())
                {
                    var id = item.TryGetProperty("id", out var idProp) ? idProp.GetString() : "";
                    var shortPostId = id;
                    if (id != null && id.Contains("_"))
                    {
                        shortPostId = id.Split('_')[1];
                    }
                    
                    postsList.Add(new FacebookPagePostDto
                    {
                        Id = shortPostId ?? "",
                        FacebookPostId = shortPostId ?? "",
                        FullId = id ?? "",
                        Message = item.TryGetProperty("message", out var msgProp) ? msgProp.GetString() ?? "" : "",
                        CreatedTime = item.TryGetProperty("created_time", out var timeProp) ? timeProp.GetString() ?? "" : "",
                        FullPicture = item.TryGetProperty("full_picture", out var picProp) ? picProp.GetString() ?? "" : "",
                        PermalinkUrl = item.TryGetProperty("permalink_url", out var linkProp) ? linkProp.GetString() ?? "" : ""
                    });
                }
                return postsList;
            }
            
            return GetMockFacebookPagePosts(pageIdentifier);
        }
        catch
        {
            return GetMockFacebookPagePosts(pageIdentifier);
        }
    }

    private List<FacebookPagePostDto> GetMockFacebookPagePosts(string pageIdentifier)
    {
        return new List<FacebookPagePostDto>
        {
            new FacebookPagePostDto {
                Id = "109283019283111",
                FacebookPostId = "109283019283111",
                FullId = $"{pageIdentifier}_109283019283111",
                Message = "🔥 Đợt hàng Sen Đá Mini mới về đẹp xuất sắc! Inbox shop ngay để nhận ưu đãi đồng giá 15k/chậu. Số lượng có hạn!",
                CreatedTime = DateTime.UtcNow.AddDays(-2).ToString("yyyy-MM-ddTHH:mm:ssZ"),
                FullPicture = "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=60",
                PermalinkUrl = "https://facebook.com/109283019283_109283019283111"
            },
            new FacebookPagePostDto {
                Id = "109283019283222",
                FacebookPostId = "109283019283222",
                FullId = $"{pageIdentifier}_109283019283222",
                Message = "🌿 Hướng dẫn chăm sóc Sen Đá đúng cách cho người mới bắt đầu. Đất trồng, lượng nước và ánh sáng quyết định 90% sự sống của cây...",
                CreatedTime = DateTime.UtcNow.AddDays(-5).ToString("yyyy-MM-ddTHH:mm:ssZ"),
                FullPicture = "https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&auto=format&fit=crop&q=60",
                PermalinkUrl = "https://facebook.com/109283019283_109283019283222"
            },
            new FacebookPagePostDto {
                Id = "109283019283333",
                FacebookPostId = "109283019283333",
                FullId = $"{pageIdentifier}_109283019283333",
                Message = "✨ Mừng khai trương chi nhánh mới - Giảm ngay 20% cho tất cả các loại cây cảnh để bàn và quà tặng lưu niệm tại shop từ ngày 1/6 đến 7/6.",
                CreatedTime = DateTime.UtcNow.AddDays(-10).ToString("yyyy-MM-ddTHH:mm:ssZ"),
                FullPicture = "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&auto=format&fit=crop&q=60",
                PermalinkUrl = "https://facebook.com/109283019283_109283019283333"
            }
        };
    }

    public async Task<List<FacebookCampaign>> DuplicateCampaignAsync(Guid campaignId, int count, CancellationToken cancellationToken = default)
    {
        var campaign = await _dbContext.FacebookCampaigns
            .Include(c => c.AdSets)
                .ThenInclude(s => s.Ads)
            .FirstOrDefaultAsync(c => c.Id == campaignId, cancellationToken);

        if (campaign == null)
            throw new ArgumentException("Campaign not found");

        var duplicatedCampaigns = new List<FacebookCampaign>();

        for (int i = 1; i <= count; i++)
        {
            var suffix = count > 1 ? $" - Bản sao ({i})" : " - Bản sao";
            var newCampaign = new FacebookCampaign
            {
                FacebookAdAccountId = campaign.FacebookAdAccountId,
                MetaCampaignId = "draft_camp_" + Guid.NewGuid().ToString("N").Substring(0, 12),
                Name = campaign.Name + suffix,
                Objective = campaign.Objective,
                Status = "DRAFT",
                PageId = campaign.PageId,
                Budget = campaign.Budget,
                StartTimeUtc = DateTime.UtcNow,
                EndTimeUtc = campaign.EndTimeUtc,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            foreach (var adSet in campaign.AdSets)
            {
                var newAdSet = new FacebookAdSet
                {
                    MetaAdSetId = "draft_adset_" + Guid.NewGuid().ToString("N").Substring(0, 12),
                    Name = adSet.Name + suffix,
                    BillingEvent = adSet.BillingEvent,
                    DailyBudget = adSet.DailyBudget,
                    LifetimeBudget = adSet.LifetimeBudget,
                    TargetingAgeMin = adSet.TargetingAgeMin,
                    TargetingAgeMax = adSet.TargetingAgeMax,
                    TargetingGenders = adSet.TargetingGenders,
                    TargetingLocations = adSet.TargetingLocations,
                    TargetingInterests = adSet.TargetingInterests,
                    Placements = adSet.Placements,
                    Status = "DRAFT",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                foreach (var ad in adSet.Ads)
                {
                    var newAd = new FacebookAd
                    {
                        MetaAdId = "draft_ad_" + Guid.NewGuid().ToString("N").Substring(0, 12),
                        Name = ad.Name + suffix,
                        Title = ad.Title,
                        BodyText = ad.BodyText,
                        MediaUrl = ad.MediaUrl,
                        DestinationUrl = ad.DestinationUrl,
                        CallToAction = ad.CallToAction,
                        Status = "DRAFT",
                        FacebookPostId = ad.FacebookPostId,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    newAdSet.Ads.Add(newAd);
                }

                newCampaign.AdSets.Add(newAdSet);
            }

            _dbContext.FacebookCampaigns.Add(newCampaign);
            duplicatedCampaigns.Add(newCampaign);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        if (!campaign.MetaCampaignId.StartsWith("draft_camp_") && !campaign.MetaCampaignId.StartsWith("mock_camp_"))
        {
            foreach (var newCamp in duplicatedCampaigns)
            {
                try
                {
                    await SyncOrPublishCampaignAsync(newCamp.Id, "PAUSED", cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to auto-publish duplicated campaign {CampaignId} to Meta.", newCamp.Id);
                }
            }
        }

        return duplicatedCampaigns;
    }

    public async Task<List<FacebookAdSet>> DuplicateAdSetAsync(Guid adSetId, DuplicateAdSetRequest request, CancellationToken cancellationToken = default)
    {
        var adSet = await _dbContext.FacebookAdSets
            .Include(s => s.Ads)
            .FirstOrDefaultAsync(s => s.Id == adSetId, cancellationToken);

        if (adSet == null)
            throw new ArgumentException("Ad Set not found");

        var duplicatedAdSets = new List<FacebookAdSet>();

        for (int i = 1; i <= request.Count; i++)
        {
            var suffix = request.Count > 1 ? $" - Bản sao ({i})" : " - Bản sao";
            var newAdSet = new FacebookAdSet
            {
                FacebookCampaignId = request.TargetCampaignId,
                MetaAdSetId = "draft_adset_" + Guid.NewGuid().ToString("N").Substring(0, 12),
                Name = adSet.Name + suffix,
                BillingEvent = adSet.BillingEvent,
                DailyBudget = adSet.DailyBudget,
                LifetimeBudget = adSet.LifetimeBudget,
                TargetingAgeMin = adSet.TargetingAgeMin,
                TargetingAgeMax = adSet.TargetingAgeMax,
                TargetingGenders = adSet.TargetingGenders,
                TargetingLocations = adSet.TargetingLocations,
                TargetingInterests = adSet.TargetingInterests,
                Placements = adSet.Placements,
                Status = "DRAFT",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            foreach (var ad in adSet.Ads)
            {
                var newAd = new FacebookAd
                {
                    MetaAdId = "draft_ad_" + Guid.NewGuid().ToString("N").Substring(0, 12),
                    Name = ad.Name + suffix,
                    Title = ad.Title,
                    BodyText = ad.BodyText,
                    MediaUrl = ad.MediaUrl,
                    DestinationUrl = ad.DestinationUrl,
                    CallToAction = ad.CallToAction,
                    Status = "DRAFT",
                    FacebookPostId = ad.FacebookPostId,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                newAdSet.Ads.Add(newAd);
            }

            _dbContext.FacebookAdSets.Add(newAdSet);
            duplicatedAdSets.Add(newAdSet);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        var targetCampaign = await _dbContext.FacebookCampaigns.FindAsync(new object[] { request.TargetCampaignId }, cancellationToken);
        if (targetCampaign != null && !targetCampaign.MetaCampaignId.StartsWith("draft_camp_") && !targetCampaign.MetaCampaignId.StartsWith("mock_camp_"))
        {
            try
            {
                await SyncOrPublishCampaignAsync(targetCampaign.Id, targetCampaign.Status, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to auto-publish duplicated adset to Meta for Campaign {CampaignId}.", targetCampaign.Id);
            }
        }

        return duplicatedAdSets;
    }

    public async Task<List<FacebookAd>> DuplicateAdAsync(Guid adId, DuplicateAdRequest request, CancellationToken cancellationToken = default)
    {
        var ad = await _dbContext.FacebookAds
            .FirstOrDefaultAsync(a => a.Id == adId, cancellationToken);

        if (ad == null)
            throw new ArgumentException("Ad not found");

        var duplicatedAds = new List<FacebookAd>();

        for (int i = 1; i <= request.Count; i++)
        {
            var suffix = request.Count > 1 ? $" - Bản sao ({i})" : " - Bản sao";
            var newAd = new FacebookAd
            {
                FacebookAdSetId = request.TargetAdSetId,
                MetaAdId = "draft_ad_" + Guid.NewGuid().ToString("N").Substring(0, 12),
                Name = ad.Name + suffix,
                Title = ad.Title,
                BodyText = ad.BodyText,
                MediaUrl = ad.MediaUrl,
                DestinationUrl = ad.DestinationUrl,
                CallToAction = ad.CallToAction,
                Status = "DRAFT",
                FacebookPostId = ad.FacebookPostId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _dbContext.FacebookAds.Add(newAd);
            duplicatedAds.Add(newAd);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        var targetAdSet = await _dbContext.FacebookAdSets
            .Include(s => s.Campaign)
            .FirstOrDefaultAsync(s => s.Id == request.TargetAdSetId, cancellationToken);

        if (targetAdSet?.Campaign != null && !targetAdSet.Campaign.MetaCampaignId.StartsWith("draft_camp_") && !targetAdSet.Campaign.MetaCampaignId.StartsWith("mock_camp_"))
        {
            try
            {
                await SyncOrPublishCampaignAsync(targetAdSet.Campaign.Id, targetAdSet.Campaign.Status, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to auto-publish duplicated ad to Meta for Campaign {CampaignId}.", targetAdSet.Campaign.Id);
            }
        }

        return duplicatedAds;
    }
}
