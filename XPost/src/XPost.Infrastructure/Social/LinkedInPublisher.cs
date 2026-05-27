using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Enums;

namespace XPost.Infrastructure.Social;

/// <summary>
/// Publishes content to LinkedIn via the Posts API (v2).
/// Uses OAuth2 access token stored in SocialAccount.AccessToken.
/// AccountIdentifier stores the LinkedIn person URN sub (e.g. "abc123def").
/// </summary>
public class LinkedInPublisher : ISocialPublisher
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<LinkedInPublisher> _logger;
    private readonly Microsoft.Extensions.Configuration.IConfiguration _configuration;
    private const string LinkedInApiBase = "https://api.linkedin.com";
    private const string LinkedInVersion = "202504"; // YYYYMM format

    public int Platform => (int)SocialPlatform.LinkedIn;

    public LinkedInPublisher(IHttpClientFactory httpClientFactory, ILogger<LinkedInPublisher> logger, Microsoft.Extensions.Configuration.IConfiguration configuration)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _configuration = configuration;
    }

    public async Task<PublishResult> PublishAsync(SocialAccount account, Post post, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(account.AccessToken))
            return PublishResult.Fail("LinkedIn Access Token is missing.");

        if (string.IsNullOrEmpty(account.AccountIdentifier))
            return PublishResult.Fail("LinkedIn Person ID is missing.");

        var client = _httpClientFactory.CreateClient();
        SetLinkedInHeaders(client, account.AccessToken);

        try
        {
            // Build post commentary (plain text — LinkedIn does not support HTML in posts)
            var textBuilder = new StringBuilder();

            if (!string.IsNullOrEmpty(post.Title))
                textBuilder.AppendLine(post.Title);

            if (!string.IsNullOrEmpty(post.Content))
            {
                if (textBuilder.Length > 0)
                    textBuilder.AppendLine();
                textBuilder.Append(HtmlContentHelper.ConvertToPlainText(post.Content));
            }

            var commentary = textBuilder.ToString().Trim();

            // LinkedIn limits commentary to 3000 characters
            if (commentary.Length > 3000)
                commentary = commentary[..2997] + "...";

            // Build the post payload
            var authorUrn = $"urn:li:person:{account.AccountIdentifier}";

            var payload = new Dictionary<string, object>
            {
                ["author"] = authorUrn,
                ["commentary"] = commentary,
                ["visibility"] = "PUBLIC",
                ["distribution"] = new
                {
                    feedDistribution = "MAIN_FEED",
                    targetEntities = Array.Empty<object>(),
                    thirdPartyDistributionChannels = Array.Empty<object>()
                },
                ["lifecycleState"] = "PUBLISHED",
                ["isReshareDisabledByAuthor"] = false
            };

            // If there's a featured image URL, create an article post
            if (!string.IsNullOrEmpty(post.FeaturedImageUrl))
            {
                var photoUrl = post.FeaturedImageUrl;
                if (!photoUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase))
                {
                    var baseUrl = _configuration["AppConfig:ApiBaseUrl"]?.TrimEnd('/');
                    if (!string.IsNullOrEmpty(baseUrl))
                    {
                        photoUrl = $"{baseUrl}{photoUrl}";
                    }
                }

                var articleContent = new Dictionary<string, object>
                {
                    ["source"] = photoUrl,
                    ["title"] = !string.IsNullOrEmpty(post.Title) ? post.Title : "Bài viết mới"
                };

                if (!string.IsNullOrEmpty(post.Description))
                {
                    articleContent["description"] = post.Description.Length > 256
                        ? post.Description[..253] + "..."
                        : post.Description;
                }

                payload["content"] = new { article = articleContent };
            }

            // Send post
            var url = $"{LinkedInApiBase}/rest/posts";
            var jsonContent = new StringContent(
                JsonSerializer.Serialize(payload),
                Encoding.UTF8,
                "application/json");

            var response = await client.PostAsync(url, jsonContent, cancellationToken);
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("LinkedIn API error: {StatusCode} — {Body}", response.StatusCode, responseBody);
                return PublishResult.Fail($"LinkedIn: {ExtractErrorMessage(responseBody, response.StatusCode)}");
            }

            // LinkedIn returns 201 Created with post ID in x-restli-id header
            string? postId = null;
            if (response.Headers.TryGetValues("x-restli-id", out var headerValues))
            {
                postId = headerValues.FirstOrDefault();
            }

            // Construct the post URL
            var postUrl = !string.IsNullOrEmpty(postId)
                ? $"https://www.linkedin.com/feed/update/{postId}/"
                : "https://www.linkedin.com/feed/";

            _logger.LogInformation("Published post to LinkedIn, ID: {PostId}", postId);
            return PublishResult.Ok(postUrl, postId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to publish post {PostId} to LinkedIn", post.Id);
            return PublishResult.Fail($"LinkedIn API error: {ex.Message}");
        }
    }

    public async Task<bool> ValidateCredentialsAsync(SocialAccount account, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(account.AccessToken)) return false;

        var client = _httpClientFactory.CreateClient();
        SetLinkedInHeaders(client, account.AccessToken);

        try
        {
            var response = await client.GetAsync($"{LinkedInApiBase}/v2/userinfo", cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private static void SetLinkedInHeaders(HttpClient client, string accessToken)
    {
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        client.DefaultRequestHeaders.Add("X-Restli-Protocol-Version", "2.0.0");
        client.DefaultRequestHeaders.Add("LinkedIn-Version", LinkedInVersion);
    }

    private static string ExtractErrorMessage(string json, System.Net.HttpStatusCode statusCode)
    {
        try
        {
            var doc = JsonSerializer.Deserialize<JsonElement>(json);
            if (doc.TryGetProperty("message", out var msgProp))
                return msgProp.GetString() ?? $"HTTP {(int)statusCode}";
        }
        catch { }
        return $"HTTP {(int)statusCode}";
    }
}
