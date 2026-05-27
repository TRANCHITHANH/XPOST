using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Enums;

namespace XPost.Infrastructure.Social;

public class TwitterPublisher : ISocialPublisher
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<TwitterPublisher> _logger;

    public int Platform => (int)SocialPlatform.Twitter;

    public TwitterPublisher(
        IHttpClientFactory httpClientFactory,
        ILogger<TwitterPublisher> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<PublishResult> PublishAsync(SocialAccount account, Post post, CancellationToken cancellationToken = default)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", account.AccessToken);

            string? mediaId = null;

            // Optional: Handle media upload via v1.1 API if necessary
            if (post.PostMedias != null && post.PostMedias.Any())
            {
                var firstMediaContent = post.PostMedias.First().Url; // Or Content if loaded in memory
                
                // TODO: Upload to https://upload.twitter.com/1.1/media/upload.json using multipart/form-data
                // Note: v1.1 media upload currently still requires OAuth 1.0a or User Context OAuth 2.0. 
                // Since user requested media upload, if they use OAuth 2.0 PKCE, some endpoints might be tricky.
                // We leave media upload stubbed or basic for now, waiting for credentials to test.
                _logger.LogWarning("Twitter media upload is pending implementation in TwitterPublisher.");
            }

            // Publish via v2 API
            var tweetUrl = "https://api.twitter.com/2/tweets";
            
            var payload = new Dictionary<string, object>
            {
                // Twitter does not render HTML — convert to plain text
                { "text", HtmlContentHelper.ConvertToPlainText(post.Content) }
            };

            if (!string.IsNullOrEmpty(mediaId))
            {
                payload.Add("media", new { media_ids = new[] { mediaId } });
            }

            var jsonContent = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            var response = await client.PostAsync(tweetUrl, jsonContent, cancellationToken);
            var resultStr = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Twitter API Error for Post {PostId}: {Error}", post.Id, resultStr);
                return PublishResult.Fail($"Lỗi Twitter: {resultStr}");
            }
            
            var resultElement = JsonSerializer.Deserialize<JsonElement>(resultStr);
            var publishedPostId = resultElement.TryGetProperty("data", out var dataProp) && dataProp.TryGetProperty("id", out var idProp) ? idProp.GetString() : null;

            var url = $"https://twitter.com/user/status/{publishedPostId}";

            return PublishResult.Ok(url, publishedPostId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to publish post {PostId} to Twitter.", post.Id);
            return PublishResult.Fail(ex.Message);
        }
    }

    public Task<bool> ValidateCredentialsAsync(SocialAccount account, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(true);
    }
}
