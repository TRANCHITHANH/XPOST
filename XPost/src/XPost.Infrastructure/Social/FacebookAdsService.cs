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
                var adsetUrl = $"{GraphApiBase}/{metaId}/adsets?fields=id,name,billing_event,daily_budget,lifetime_budget,targeting,placements&limit=50&access_token={accessToken}";
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
                                    Placements = placementsStr
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

        // 1. Create Campaign on Meta (Using Campaign Budget Optimization - CBO)
        var campUrl = $"{GraphApiBase}/{actId}/campaigns";
        var campPayload = new Dictionary<string, string>
        {
            ["name"] = dto.Name,
            ["objective"] = dto.Objective,
            ["status"] = "PAUSED", // Create in PAUSED state to prevent charging immediately during setup
            ["special_ad_categories"] = "[\"NONE\"]",
            ["daily_budget"] = ((int)dto.Budget).ToString(), // CBO enabled, budget in account currency units (VND)
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
        var metaCampaignId = campResult.GetProperty("id").GetString()!;

        // 2. Local Campaign Save
        var campaign = new FacebookCampaign
        {
            FacebookAdAccountId = account.Id,
            MetaCampaignId = metaCampaignId,
            Name = dto.Name,
            Objective = dto.Objective,
            Status = "PAUSED",
            Budget = dto.Budget,
            StartTimeUtc = dto.StartTimeUtc.ToUniversalTime(),
            EndTimeUtc = dto.EndTimeUtc?.ToUniversalTime()
        };
        _dbContext.FacebookCampaigns.Add(campaign);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // 3. Create Ad Set on Meta
        var adsetUrl = $"{GraphApiBase}/{actId}/adsets";
        
        // Setup targeting options, including the mandatory advantage_audience flag
        var targetingObj = new
        {
            geo_locations = new { countries = new[] { dto.TargetingLocations } },
            age_min = dto.TargetingAgeMin,
            age_max = dto.TargetingAgeMax,
            targeting_automation = new { advantage_audience = 0 }
        };
        var targetingJson = JsonSerializer.Serialize(targetingObj);

        var adsetPayload = new Dictionary<string, string>
        {
            ["name"] = dto.AdSetName,
            ["campaign_id"] = metaCampaignId,
            ["billing_event"] = dto.BillingEvent,
            ["optimization_goal"] = dto.Objective == "OUTCOME_TRAFFIC" ? "LINK_CLICKS" : "IMPRESSIONS",
            ["targeting"] = targetingJson,
            ["status"] = "ACTIVE",
            ["access_token"] = accessToken
        };

        var adsetResponse = await client.PostAsync(adsetUrl, new FormUrlEncodedContent(adsetPayload), cancellationToken);
        var adsetJson = await adsetResponse.Content.ReadAsStringAsync(cancellationToken);
        if (!adsetResponse.IsSuccessStatusCode)
        {
            _logger.LogError("Meta Ad Set creation failed. Status: {Status}. Response: {Json}", adsetResponse.StatusCode, adsetJson);
            throw new Exception($"Meta Ad Set Creation Failed: {ExtractErrorMessage(adsetJson)}");
        }

        var adsetResult = JsonSerializer.Deserialize<JsonElement>(adsetJson);
        var metaAdSetId = adsetResult.GetProperty("id").GetString()!;

        // 4. Local AdSet Save
        var adSet = new FacebookAdSet
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
            TargetingInterests = targetingJson,
            Placements = dto.Placements
        };
        _dbContext.FacebookAdSets.Add(adSet);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // 5. Upload Image to Meta Ad Images
        var imageHash = "";
        if (!string.IsNullOrEmpty(dto.MediaUrl))
        {
            imageHash = await UploadAdImageAsync(client, actId, accessToken, dto.MediaUrl, cancellationToken);
        }

        if (string.IsNullOrEmpty(imageHash))
        {
            throw new Exception("Creative image upload to Meta Ad Library failed. A valid image is required.");
        }

        // 6. Create Ad Creative on Meta
        var creativeUrl = $"{GraphApiBase}/{actId}/adcreatives";
        var creativeObj = new
        {
            name = dto.AdName,
            object_story_spec = new
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
            }
        };

        var creativePayload = new Dictionary<string, string>
        {
            ["object_story_spec"] = JsonSerializer.Serialize(creativeObj.object_story_spec),
            ["name"] = dto.AdName,
            ["access_token"] = accessToken
        };

        var creativeResponse = await client.PostAsync(creativeUrl, new FormUrlEncodedContent(creativePayload), cancellationToken);
        var creativeJson = await creativeResponse.Content.ReadAsStringAsync(cancellationToken);
        if (!creativeResponse.IsSuccessStatusCode)
        {
            throw new Exception($"Meta Ad Creative Creation Failed: {ExtractErrorMessage(creativeJson)}");
        }

        var creativeResult = JsonSerializer.Deserialize<JsonElement>(creativeJson);
        var metaCreativeId = creativeResult.GetProperty("id").GetString()!;

        // 7. Create Ad on Meta
        var adUrl = $"{GraphApiBase}/{actId}/ads";
        var adPayload = new Dictionary<string, string>
        {
            ["name"] = dto.AdName,
            ["adset_id"] = metaAdSetId,
            ["creative"] = JsonSerializer.Serialize(new { creative_id = metaCreativeId }),
            ["status"] = dto.Status, // Set to users desired starting status (e.g. ACTIVE or PAUSED)
            ["access_token"] = accessToken
        };

        var adResponse = await client.PostAsync(adUrl, new FormUrlEncodedContent(adPayload), cancellationToken);
        var adJson = await adResponse.Content.ReadAsStringAsync(cancellationToken);
        if (!adResponse.IsSuccessStatusCode)
        {
            throw new Exception($"Meta Ad Creation Failed: {ExtractErrorMessage(adJson)}");
        }

        var adResult = JsonSerializer.Deserialize<JsonElement>(adJson);
        var metaAdId = adResult.GetProperty("id").GetString()!;

        // 8. Local Ad Save
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
            Status = dto.Status
        };
        _dbContext.FacebookAds.Add(ad);

        // Update campaign status to ACTIVE if the ad should be ACTIVE
        if (dto.Status == "ACTIVE")
        {
            // Turn campaign active on Meta
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

        await _dbContext.SaveChangesAsync(cancellationToken);
        return campaign;
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

    private static string ExtractErrorMessage(string json)
    {
        try
        {
            var doc = JsonSerializer.Deserialize<JsonElement>(json);
            if (doc.TryGetProperty("error", out var errorObj) && errorObj.TryGetProperty("message", out var msg))
                return msg.GetString() ?? "Unknown error";
        }
        catch { }
        return "Unknown Meta API error";
    }
}
