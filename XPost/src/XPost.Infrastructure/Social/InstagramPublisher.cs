using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Enums;

namespace XPost.Infrastructure.Social;

public class InstagramPublisher : ISocialPublisher
{
    private readonly ILogger<InstagramPublisher> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;

    public int Platform => (int)SocialPlatform.Instagram;

    public InstagramPublisher(ILogger<InstagramPublisher> logger, IHttpClientFactory httpClientFactory, IConfiguration configuration)
    {
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    public async Task<PublishResult> PublishAsync(SocialAccount account, Post post, CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrEmpty(account.AccessToken))
                return PublishResult.Fail("Instagram Access Token is missing.");

            if (string.IsNullOrEmpty(account.AccountIdentifier))
                return PublishResult.Fail("Instagram Business Account ID is missing.");

            if (string.IsNullOrEmpty(post.FeaturedImageUrl))
                return PublishResult.Fail("Instagram requires an image. Please provide a Featured Image URL.");

            var client = _httpClientFactory.CreateClient();
            var instagramId = account.AccountIdentifier;
            var accessToken = account.AccessToken;

            // Step 1: Create Media Container
            // Instagram needs a public URL to fetch the image.
            var createMediaUrl = $"https://graph.facebook.com/v21.0/{instagramId}/media?access_token={Uri.EscapeDataString(accessToken)}";
            var createMediaParams = new Dictionary<string, string>
            {
                ["image_url"] = ResolvePublicImageUrl(post.FeaturedImageUrl),
                ["caption"] = post.Title + "\n\n" + (post.Content != null ? HtmlContentHelper.ConvertToPlainText(post.Content) : "")
            };

            var response = await client.PostAsync(createMediaUrl, new FormUrlEncodedContent(createMediaParams), cancellationToken);
            var resultJson = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Instagram Step 1 (Create Media) failed: {Response}", resultJson);
                return PublishResult.Fail($"Instagram Error (Step 1): {resultJson}");
            }

            var mediaData = JsonSerializer.Deserialize<JsonElement>(resultJson);
            var creationId = mediaData.GetProperty("id").GetString();

            // Step 2: Publish Media Container
            // Usually we should wait a few seconds for IG to process the image.
            await Task.Delay(5000, cancellationToken); // Wait 5 seconds

            var publishUrl = $"https://graph.facebook.com/v21.0/{instagramId}/media_publish?access_token={Uri.EscapeDataString(accessToken)}";
            var publishParams = new Dictionary<string, string>
            {
                ["creation_id"] = creationId!
            };

            var publishResponse = await client.PostAsync(publishUrl, new FormUrlEncodedContent(publishParams), cancellationToken);
            var publishResultJson = await publishResponse.Content.ReadAsStringAsync(cancellationToken);

            if (!publishResponse.IsSuccessStatusCode)
            {
                _logger.LogError("Instagram Step 2 (Publish) failed: {Response}", publishResultJson);
                return PublishResult.Fail($"Instagram Error (Step 2): {publishResultJson}");
            }

            var finalData = JsonSerializer.Deserialize<JsonElement>(publishResultJson);
            var igPostId = finalData.GetProperty("id").GetString();

            return PublishResult.Ok($"https://www.instagram.com/reels/{igPostId}/", igPostId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error publishing to Instagram");
            return PublishResult.Fail($"Instagram system error: {ex.Message}");
        }
    }

    private string ResolvePublicImageUrl(string imageUrl)
    {
        var appBaseUrl = _configuration["AppConfig:ApiBaseUrl"]?.TrimEnd('/');

        if (string.IsNullOrEmpty(appBaseUrl))
            return imageUrl;

        // Convert local URLs to public Ngrok URLs
        if (imageUrl.StartsWith("http://localhost") || 
            imageUrl.StartsWith("https://localhost") || 
            imageUrl.StartsWith("http://local-api.xpost.com") ||
            imageUrl.StartsWith("https://local-api.xpost.com") ||
            imageUrl.StartsWith("http://127.0.0.1"))
        {
            try
            {
                var uri = new Uri(imageUrl);
                return $"{appBaseUrl}{uri.PathAndQuery}";
            }
            catch { }
        }

        // If it's already a full public URL (not local), return it
        if (imageUrl.StartsWith("http"))
        {
            return imageUrl;
        }

        // If it's a relative path, prepend the ApiBaseUrl (Ngrok)
        return $"{appBaseUrl}/{imageUrl.TrimStart('/')}";
    }

    public Task<bool> ValidateCredentialsAsync(SocialAccount account, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(!string.IsNullOrEmpty(account.AccessToken));
    }
}
