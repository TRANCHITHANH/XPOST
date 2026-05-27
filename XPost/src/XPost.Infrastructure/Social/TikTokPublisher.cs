using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Enums;

namespace XPost.Infrastructure.Social;

/// <summary>
/// Publishes content to TikTok via Content Posting API v2.
/// Supports video (PULL_FROM_URL) and photo slideshow posts.
/// Flow: Query Creator Info → Init Post → Poll Status.
/// </summary>
public class TikTokPublisher : ISocialPublisher
{
    private class MediaItem
    {
        [System.Text.Json.Serialization.JsonPropertyName("url")]
        public string Url { get; set; } = string.Empty;

        [System.Text.Json.Serialization.JsonPropertyName("mediaType")]
        public string MediaType { get; set; } = string.Empty;
    }

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<TikTokPublisher> _logger;
    private readonly IConfiguration _configuration;
    private const string OpenApiBase = "https://open.tiktokapis.com/v2";

    public int Platform => (int)SocialPlatform.TikTok; // = 5

    public TikTokPublisher(IHttpClientFactory httpClientFactory, ILogger<TikTokPublisher> logger, IConfiguration configuration)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _configuration = configuration;
    }

    public async Task<PublishResult> PublishAsync(SocialAccount account, Post post, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(account.AccessToken))
            return PublishResult.Fail("TikTok Access Token is missing.");

        var client = _httpClientFactory.CreateClient();

        try
        {
            // 1. Parse media from post
            var videoUrls = new List<string>();
            var imageUrls = new List<string>();

            if (!string.IsNullOrEmpty(post.MediaJson))
            {
                try
                {
                    var items = JsonSerializer.Deserialize<List<MediaItem>>(post.MediaJson);
                    if (items != null)
                    {
                        foreach (var item in items.Where(x => !string.IsNullOrEmpty(x.Url)))
                        {
                            var absUrl = MakeAbsoluteUrl(item.Url);
                            if (item.MediaType == "video")
                                videoUrls.Add(absUrl);
                            else if (item.MediaType == "image")
                                imageUrls.Add(absUrl);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to parse MediaJson for post {PostId}", post.Id);
                }
            }

            // Add featured image if no other images
            if (imageUrls.Count == 0 && !string.IsNullOrEmpty(post.FeaturedImageUrl))
            {
                imageUrls.Add(MakeAbsoluteUrl(post.FeaturedImageUrl));
            }

            // TikTok requires video or photos — no text-only posts
            if (videoUrls.Count == 0 && imageUrls.Count == 0)
            {
                return PublishResult.Fail("TikTok yêu cầu ít nhất 1 video hoặc ảnh. Không hỗ trợ bài viết chỉ có văn bản.");
            }

            // 2. Build description (max 2200 chars)
            var description = BuildDescription(post);

            // 3. Query Creator Info first
            var creatorInfo = await QueryCreatorInfoAsync(client, account.AccessToken, cancellationToken);

            // 4. Publish based on content type
            string publishId;
            if (videoUrls.Count > 0)
            {
                publishId = await InitVideoPostAsync(client, account.AccessToken, videoUrls[0], description, creatorInfo, cancellationToken);
            }
            else
            {
                publishId = await InitPhotoPostAsync(client, account.AccessToken, imageUrls, description, creatorInfo, cancellationToken);
            }

            if (string.IsNullOrEmpty(publishId))
            {
                return PublishResult.Fail("TikTok: Không thể khởi tạo bài đăng.");
            }

            // 5. Poll publish status
            var (success, postId) = await PollPublishStatusAsync(client, account.AccessToken, publishId, cancellationToken);

            if (success)
            {
                _logger.LogInformation("Published to TikTok successfully. PublishId: {PublishId}", publishId);
                return PublishResult.Ok($"https://www.tiktok.com/@user/video/{postId ?? publishId}", postId ?? publishId);
            }
            else
            {
                return PublishResult.Fail($"TikTok: Bài đăng đang được xử lý (publish_id: {publishId}). Vui lòng kiểm tra lại sau.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to publish post {PostId} to TikTok", post.Id);
            return PublishResult.Fail($"TikTok API error: {ex.Message}");
        }
    }

    /// <summary>
    /// Query creator info to get available privacy levels and feature permissions.
    /// </summary>
    private async Task<JsonElement?> QueryCreatorInfoAsync(HttpClient client, string accessToken, CancellationToken ct)
    {
        try
        {
            var url = $"{OpenApiBase}/post/publish/creator_info/query/";
            var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Content = new StringContent("{}", Encoding.UTF8, "application/json");

            var response = await client.SendAsync(request, ct);
            var json = await response.Content.ReadAsStringAsync(ct);

            _logger.LogInformation("TikTok creator info response: {Response}", json);

            if (response.IsSuccessStatusCode)
            {
                var result = JsonSerializer.Deserialize<JsonElement>(json);
                if (result.TryGetProperty("data", out var data))
                    return data;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query TikTok creator info");
        }

        return null;
    }

    /// <summary>
    /// Initialize a video post using PULL_FROM_URL source.
    /// </summary>
    private async Task<string> InitVideoPostAsync(HttpClient client, string accessToken, string videoUrl, string description, JsonElement? creatorInfo, CancellationToken ct)
    {
        var url = $"{OpenApiBase}/post/publish/video/init/";

        // Determine best available privacy level
        var privacyLevel = GetBestPrivacyLevel(creatorInfo);

        var payload = new
        {
            post_info = new
            {
                title = description.Length > 150 ? description[..150] : description,
                description = description,
                privacy_level = privacyLevel,
                disable_comment = false,
                auto_add_music = true
            },
            source_info = new
            {
                source = "PULL_FROM_URL",
                video_url = videoUrl
            }
        };

        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var response = await client.SendAsync(request, ct);
        var json = await response.Content.ReadAsStringAsync(ct);

        _logger.LogInformation("TikTok init video response: {Response}", json);

        var result = JsonSerializer.Deserialize<JsonElement>(json);
        if (result.TryGetProperty("data", out var data) && data.TryGetProperty("publish_id", out var pidProp))
        {
            return pidProp.GetString() ?? "";
        }

        var errorMsg = result.TryGetProperty("error", out var err) && err.TryGetProperty("message", out var msgProp)
            ? msgProp.GetString() : json;
        _logger.LogWarning("TikTok init video failed: {Error}", errorMsg);
        return "";
    }

    /// <summary>
    /// Initialize a photo slideshow post.
    /// </summary>
    private async Task<string> InitPhotoPostAsync(HttpClient client, string accessToken, List<string> imageUrls, string description, JsonElement? creatorInfo, CancellationToken ct)
    {
        var url = $"{OpenApiBase}/post/publish/content/init/";

        var privacyLevel = GetBestPrivacyLevel(creatorInfo);

        var payload = new
        {
            post_info = new
            {
                title = description.Length > 150 ? description[..150] : description,
                description = description,
                privacy_level = privacyLevel,
                disable_comment = false
            },
            source_info = new
            {
                source = "PULL_FROM_URL",
                photo_cover_index = 0,
                photo_images = imageUrls.Select(u => u).ToArray()
            },
            post_mode = "DIRECT_POST",
            media_type = "PHOTO"
        };

        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var response = await client.SendAsync(request, ct);
        var json = await response.Content.ReadAsStringAsync(ct);

        _logger.LogInformation("TikTok init photo response: {Response}", json);

        var result = JsonSerializer.Deserialize<JsonElement>(json);
        if (result.TryGetProperty("data", out var data) && data.TryGetProperty("publish_id", out var pidProp))
        {
            return pidProp.GetString() ?? "";
        }

        var errorMsg = result.TryGetProperty("error", out var err) && err.TryGetProperty("message", out var msgProp)
            ? msgProp.GetString() : json;
        _logger.LogWarning("TikTok init photo failed: {Error}", errorMsg);
        return "";
    }

    /// <summary>
    /// Poll publish status until complete or timeout (5 retries, 3s apart).
    /// </summary>
    private async Task<(bool Success, string? PostId)> PollPublishStatusAsync(HttpClient client, string accessToken, string publishId, CancellationToken ct)
    {
        var url = $"{OpenApiBase}/post/publish/status/fetch/";

        for (int attempt = 0; attempt < 5; attempt++)
        {
            if (attempt > 0)
                await Task.Delay(3000, ct);

            try
            {
                var request = new HttpRequestMessage(HttpMethod.Post, url);
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                request.Content = new StringContent(
                    JsonSerializer.Serialize(new { publish_id = publishId }),
                    Encoding.UTF8, "application/json");

                var response = await client.SendAsync(request, ct);
                var json = await response.Content.ReadAsStringAsync(ct);

                _logger.LogInformation("TikTok publish status attempt {Attempt}: {Response}", attempt + 1, json);

                var result = JsonSerializer.Deserialize<JsonElement>(json);
                if (result.TryGetProperty("data", out var data) && data.TryGetProperty("status", out var statusProp))
                {
                    var status = statusProp.GetString();
                    if (status == "PUBLISH_COMPLETE")
                    {
                        var postId = data.TryGetProperty("publicaly_available_post_id", out var postIdArr)
                            ? postIdArr.EnumerateArray().FirstOrDefault().GetString()
                            : null;
                        return (true, postId);
                    }
                    else if (status == "FAILED")
                    {
                        var failReason = data.TryGetProperty("fail_reason", out var frProp) ? frProp.GetString() : "Unknown";
                        _logger.LogWarning("TikTok publish failed: {Reason}", failReason);
                        return (false, null);
                    }
                    // PROCESSING_UPLOAD, PROCESSING_DOWNLOAD — continue polling
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "TikTok publish status poll attempt {Attempt} failed", attempt + 1);
            }
        }

        // Still processing after 5 attempts — return partial success
        return (false, null);
    }

    /// <summary>
    /// Determine best privacy level from creator info.
    /// Unaudited apps can only post as SELF_ONLY (private).
    /// </summary>
    private static string GetBestPrivacyLevel(JsonElement? creatorInfo)
    {
        if (creatorInfo.HasValue && creatorInfo.Value.TryGetProperty("privacy_level_options", out var options))
        {
            foreach (var opt in options.EnumerateArray())
            {
                var val = opt.GetString();
                if (val == "PUBLIC_TO_EVERYONE") return "PUBLIC_TO_EVERYONE";
            }
            foreach (var opt in options.EnumerateArray())
            {
                var val = opt.GetString();
                if (val == "MUTUAL_FOLLOW_FRIENDS") return "MUTUAL_FOLLOW_FRIENDS";
            }
            foreach (var opt in options.EnumerateArray())
            {
                var val = opt.GetString();
                if (val == "FOLLOWER_OF_CREATOR") return "FOLLOWER_OF_CREATOR";
            }
        }

        // Default: SELF_ONLY for unaudited apps
        return "SELF_ONLY";
    }

    public async Task<bool> ValidateCredentialsAsync(SocialAccount account, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(account.AccessToken)) return false;

        var client = _httpClientFactory.CreateClient();
        var url = $"{OpenApiBase}/user/info/?fields=open_id,display_name";

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", account.AccessToken);

            var response = await client.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode) return false;

            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            var result = JsonSerializer.Deserialize<JsonElement>(json);

            return result.TryGetProperty("data", out var data)
                && data.TryGetProperty("user", out _);
        }
        catch
        {
            return false;
        }
    }

    private string BuildDescription(Post post)
    {
        var description = !string.IsNullOrEmpty(post.Title) ? post.Title : "";

        if (!string.IsNullOrEmpty(post.Content))
        {
            var cleanContent = HtmlContentHelper.ConvertToPlainText(post.Content);
            if (!string.IsNullOrEmpty(description))
                description += "\n\n" + cleanContent;
            else
                description = cleanContent;
        }

        // TikTok limit: 2200 chars
        if (description.Length > 2200)
            description = description[..2197] + "...";

        return description;
    }

    private string MakeAbsoluteUrl(string url)
    {
        if (url.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            return url;

        var baseUrl = _configuration["AppConfig:ApiBaseUrl"]?.TrimEnd('/');
        return !string.IsNullOrEmpty(baseUrl) ? $"{baseUrl}{url}" : url;
    }
}
