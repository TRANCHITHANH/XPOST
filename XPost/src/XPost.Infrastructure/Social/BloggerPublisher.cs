using Google.Apis.Auth.OAuth2;
using Google.Apis.Blogger.v3;
using Google.Apis.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Enums;
// Alias to avoid ambiguity
using BloggerData = Google.Apis.Blogger.v3.Data;
using System.Text;
using System.Text.Json;

namespace XPost.Infrastructure.Social;

public class BloggerPublisher : ISocialPublisher
{
    private readonly ILogger<BloggerPublisher> _logger;
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IWebHostEnvironment _env;
    private readonly IServiceProvider _serviceProvider;

    public int Platform => (int)SocialPlatform.Blogger;

    public BloggerPublisher(
        ILogger<BloggerPublisher> logger, 
        IConfiguration configuration, 
        IHttpClientFactory httpClientFactory,
        IWebHostEnvironment env,
        IServiceProvider serviceProvider)
    {
        _logger = logger;
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
        _env = env;
        _serviceProvider = serviceProvider;
    }


    public async Task<PublishResult> PublishAsync(SocialAccount account, Post post, CancellationToken cancellationToken = default)
    {
        try
        {
            // Auto Refresh Token if needed (Rule 101)
            if (account.TokenExpiredAtUtc <= DateTime.UtcNow && !string.IsNullOrEmpty(account.RefreshToken))
            {
                _logger.LogInformation("Blogger token expired for account {AccountId}, attempting to refresh...", account.Id);
                var refreshed = await RefreshAccessTokenAsync(account, cancellationToken);
                if (!refreshed)
                {
                    return PublishResult.Fail("Blogger Access Token expired and could not be refreshed.");
                }
            }

            if (string.IsNullOrEmpty(account.AccessToken))
            {
                return PublishResult.Fail("Blogger Access Token is missing.");
            }

            if (string.IsNullOrEmpty(account.AccountIdentifier))
            {
                return PublishResult.Fail("Blogger Blog ID is missing. Please reconnect your account.");
            }

            var credential = GoogleCredential.FromAccessToken(account.AccessToken);
            var bloggerService = new BloggerService(new BaseClientService.Initializer
            {
                HttpClientInitializer = credential,
                ApplicationName = "XPost SaaS"
            });

            // STEP 1: Create a DRAFT post first to get a postId
            // This is required for the image upload endpoint
            var initialPost = new BloggerData.Post
            {
                Title = post.Title,
                Content = "Processing...", // Placeholder
                Labels = string.IsNullOrEmpty(post.Tags) 
                    ? new List<string> { "XPost" } 
                    : post.Tags.Split(',').Select(t => t.Trim()).ToList()
            };

            var insertRequest = bloggerService.Posts.Insert(initialPost, account.AccountIdentifier);
            insertRequest.IsDraft = true;
            var insertedPost = await insertRequest.ExecuteAsync(cancellationToken);
            var postId = insertedPost.Id;

            // STEP 2: Upload images and get official URLs
            string finalContent = post.Content ?? "";
            string? uploadedFeaturedImageUrl = null;

            if (!string.IsNullOrEmpty(post.FeaturedImageUrl))
            {
                uploadedFeaturedImageUrl = await UploadImageToPostAsync(account, postId, post.FeaturedImageUrl, cancellationToken);
                
                if (!string.IsNullOrEmpty(uploadedFeaturedImageUrl))
                {
                    finalContent = $"<div style='text-align: center; margin-bottom: 20px;'><img src='{uploadedFeaturedImageUrl}' style='max-width: 100%; height: auto;' /></div>" + finalContent;
                }
                else
                {
                    // Fallback to Ngrok if upload fails (though we want to avoid this)
                    var baseUrl = _configuration["AppConfig:ApiBaseUrl"]?.TrimEnd('/');
                    var imageUrl = post.FeaturedImageUrl;
                    if (!imageUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(baseUrl))
                    {
                        imageUrl = $"{baseUrl}/{imageUrl.TrimStart('/')}";
                    }
                    finalContent = $"<div style='text-align: center; margin-bottom: 20px;'><img src='{imageUrl}' style='max-width: 100%; height: auto;' /></div>" + finalContent;
                }
            }

            // STEP 3: Update the post with final content and PUBLISH it
            insertedPost.Content = finalContent;
            var updateRequest = bloggerService.Posts.Update(insertedPost, account.AccountIdentifier, postId);
            updateRequest.Publish = true;
            var publishedPost = await updateRequest.ExecuteAsync(cancellationToken);

            _logger.LogInformation("Successfully published to Blogger: {Url}", publishedPost.Url);
            return PublishResult.Ok(publishedPost.Url, publishedPost.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error publishing to Blogger for Account {AccountId}", account.Id);
            return PublishResult.Fail($"Blogger error: {ex.Message}");
        }
    }

    private async Task<string?> UploadImageToPostAsync(SocialAccount account, string postId, string imageUrl, CancellationToken ct)
    {
        try
        {
            _logger.LogInformation("Blogger Relay: Preparing image for hosting: {Url}", imageUrl);

            var apiBaseUrl = _configuration["AppConfig:ApiBaseUrl"]?.TrimEnd('/');
            var isLocal = !string.IsNullOrEmpty(apiBaseUrl) && imageUrl.StartsWith(apiBaseUrl, StringComparison.OrdinalIgnoreCase);
            
            string? localPath = null;
            if (isLocal)
            {
                var relativePath = imageUrl.Substring(apiBaseUrl!.Length).TrimStart('/').Replace("/", "\\");
                localPath = Path.Combine(_env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"), relativePath);
            }
            else if (!imageUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            {
                localPath = Path.Combine(_env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"), imageUrl.TrimStart('/').Replace("/", "\\"));
            }

            if (localPath == null || !File.Exists(localPath))
            {
                // If not local and not absolute, return as is (last resort)
                return imageUrl.StartsWith("http") ? imageUrl : $"{apiBaseUrl}/{imageUrl.TrimStart('/')}";
            }

            // [CROSS-PLATFORM MEDIA RELAY]
            // Blogger doesn't have a direct upload API for many accounts.
            // We search for OTHER platforms owned by the SAME USER that DO have robust hosting (DEV.to or WordPress).
            using var scope = _serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<XPost.Domain.Interfaces.IUnitOfWork>();
            var accountRepo = unitOfWork.Repository<SocialAccount>();
            
            // Find DEV.to or WordPress accounts for this user
            var relayAccounts = await accountRepo.GetAsync(a => a.UserId == account.UserId && a.IsActive && 
                (a.Platform == (int)SocialPlatform.DevTo || a.Platform == (int)SocialPlatform.WordPress));

            foreach (var relayAccount in relayAccounts.OrderBy(a => a.Platform)) // Prioritize DevTo (S3) then WordPress
            {
                _logger.LogInformation("Blogger Relay: Attempting to use {Platform} account {AccountName} as host.", 
                    (SocialPlatform)relayAccount.Platform, relayAccount.AccountName);

                var publishers = scope.ServiceProvider.GetRequiredService<IEnumerable<ISocialPublisher>>();
                var relayPublisher = publishers.FirstOrDefault(p => p.Platform == relayAccount.Platform);

                if (relayPublisher != null)
                {
                    // Call the relay publisher's upload logic
                    if (relayAccount.Platform == (int)SocialPlatform.DevTo && relayPublisher is DevToPublisher devToPub)
                    {
                        var officialUrl = await devToPub.UploadImageToDevToAsync(relayAccount, imageUrl, ct);
                        if (!string.IsNullOrEmpty(officialUrl) && !officialUrl.Contains("ERROR"))
                        {
                            _logger.LogInformation("Blogger Relay SUCCESS: Hosted on DEV.to S3: {Url}", officialUrl);
                            return officialUrl;
                        }
                    }
                    else if (relayAccount.Platform == (int)SocialPlatform.WordPress && relayPublisher is WordPressPublisher wpPub)
                    {
                        var officialUrl = await wpPub.UploadMediaAsync(relayAccount, localPath, ct);
                        if (!string.IsNullOrEmpty(officialUrl))
                        {
                            _logger.LogInformation("Blogger Relay SUCCESS: Hosted on WordPress Media: {Url}", officialUrl);
                            return officialUrl;
                        }
                    }
                }
            }

            // FALLBACK 1: Try Base64 (may be stripped, but better than Ngrok)
            _logger.LogWarning("Blogger Relay: No other hosting platforms found. Falling back to Base64.");
            var imageBytes = await File.ReadAllBytesAsync(localPath, ct);
            var ext = Path.GetExtension(localPath).ToLower();
            var mimeType = ext == ".png" ? "image/png" : ext == ".gif" ? "image/gif" : ext == ".webp" ? "image/webp" : "image/jpeg";
            var base64 = Convert.ToBase64String(imageBytes);
            return $"data:{mimeType};base64,{base64}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed Blogger Relay hosting.");
        }
        return null;
    }











    public Task<bool> ValidateCredentialsAsync(SocialAccount account, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(!string.IsNullOrEmpty(account.AccessToken));
    }

    private async Task<bool> RefreshAccessTokenAsync(SocialAccount account, CancellationToken ct)
    {
        try
        {
            var settings = _configuration.GetSection("Blogger").Get<BloggerSettings>();
            if (settings == null) return false;

            var client = _httpClientFactory.CreateClient();
            var tokenUrl = "https://oauth2.googleapis.com/token";
            
            var body = new Dictionary<string, string>
            {
                ["client_id"] = settings.ClientId,
                ["client_secret"] = settings.ClientSecret,
                ["refresh_token"] = account.RefreshToken!,
                ["grant_type"] = "refresh_token"
            };

            var response = await client.PostAsync(tokenUrl, new FormUrlEncodedContent(body), ct);
            var json = await response.Content.ReadAsStringAsync(ct);

            if (response.IsSuccessStatusCode)
            {
                var data = JsonSerializer.Deserialize<JsonElement>(json);
                account.AccessToken = data.GetProperty("access_token").GetString()!;
                var expiresIn = data.GetProperty("expires_in").GetInt32();
                account.TokenExpiredAtUtc = DateTime.UtcNow.AddSeconds(expiresIn);
                
                // Note: We don't save to DB here because the caller (PostPublisherService) 
                // will save the SocialAccount state after publishing if needed, 
                // or we should ideally have a way to persist this change.
                return true;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to refresh Blogger token");
        }
        return false;
    }
}
