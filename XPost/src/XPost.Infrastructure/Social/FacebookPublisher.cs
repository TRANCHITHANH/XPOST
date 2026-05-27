using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Enums;

namespace XPost.Infrastructure.Social;

/// <summary>
/// Publishes content to Facebook Pages via Graph API.
/// Supports text posts, single photo, multi-photo (albums), and videos.
/// </summary>
public class FacebookPublisher : ISocialPublisher
{
    private class MediaItem
    {
        [System.Text.Json.Serialization.JsonPropertyName("url")]
        public string Url { get; set; } = string.Empty;

        [System.Text.Json.Serialization.JsonPropertyName("mediaType")]
        public string MediaType { get; set; } = string.Empty;
    }

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<FacebookPublisher> _logger;
    private readonly IConfiguration _configuration;
    private readonly Microsoft.AspNetCore.Hosting.IWebHostEnvironment _env;
    private const string GraphApiBase = "https://graph.facebook.com/v21.0";

    public int Platform => (int)SocialPlatform.Facebook;

    public FacebookPublisher(IHttpClientFactory httpClientFactory, ILogger<FacebookPublisher> logger, IConfiguration configuration, Microsoft.AspNetCore.Hosting.IWebHostEnvironment env)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _configuration = configuration;
        _env = env;
    }

    public async Task<PublishResult> PublishAsync(SocialAccount account, Post post, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(account.AccessToken))
            return PublishResult.Fail("Facebook Access Token is missing.");

        if (string.IsNullOrEmpty(account.AccountIdentifier))
            return PublishResult.Fail("Facebook Page ID is missing.");

        var client = _httpClientFactory.CreateClient();
        var pageId = account.AccountIdentifier;
        var accessToken = account.AccessToken;

        try
        {
            // Build the message content
            // Facebook does not render HTML — convert to plain text
            var rawContent = !string.IsNullOrEmpty(post.Content)
                ? post.Content
                : post.Title;
            var message = HtmlContentHelper.ConvertToPlainText(rawContent);

            var allMedia = new List<MediaItem>();

            // Add Featured Image first
            if (!string.IsNullOrEmpty(post.FeaturedImageUrl))
            {
                allMedia.Add(new MediaItem { Url = post.FeaturedImageUrl, MediaType = "image" });
            }

            // Parse MediaJson
            if (!string.IsNullOrEmpty(post.MediaJson))
            {
                try
                {
                    var items = JsonSerializer.Deserialize<List<MediaItem>>(post.MediaJson);
                    if (items != null)
                    {
                        allMedia.AddRange(items.Where(x => !string.IsNullOrEmpty(x.Url)));
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to parse MediaJson for post {PostId}. Ignoring gallery media.", post.Id);
                }
            }

            // Clean up URLs to be absolute
            var baseUrl = _configuration["AppConfig:ApiBaseUrl"]?.TrimEnd('/');
            foreach (var item in allMedia)
            {
                if (!item.Url.StartsWith("http", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(baseUrl))
                {
                    item.Url = $"{baseUrl}{item.Url}";
                }
            }

            // Make distinct by URL
            var distinctMedia = allMedia.GroupBy(x => x.Url).Select(g => g.First()).ToList();

            var videos = distinctMedia.Where(x => x.MediaType == "video").ToList();
            var images = distinctMedia.Where(x => x.MediaType == "image").ToList();

            // Priority 1: If there is at least 1 video, upload the first video.
            // (Facebook Graph API does not natively support mixing photos and videos in standard feed posts easily)
            if (videos.Count > 0)
            {
                return await PublishVideoPostAsync(client, pageId, accessToken, message, videos.First().Url, cancellationToken);
            }

            // Priority 2: Multiple images (Max 10)
            if (images.Count > 1)
            {
                var topImages = images.Take(10).Select(x => x.Url).ToList();
                return await PublishMultiPhotoPostAsync(client, pageId, accessToken, message, topImages, cancellationToken);
            }

            // Priority 3: Single image
            if (images.Count == 1)
            {
                return await PublishPhotoPostAsync(client, pageId, accessToken, message, images.First().Url, cancellationToken);
            }

            // Priority 4: Text only
            return await PublishTextPostAsync(client, pageId, accessToken, message, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to publish post {PostId} to Facebook page {PageId}", post.Id, pageId);
            return PublishResult.Fail($"Facebook API error: {ex.Message}");
        }
    }

    private async Task<PublishResult> PublishTextPostAsync(
        HttpClient client, string pageId, string accessToken, string message, CancellationToken ct)
    {
        var url = $"{GraphApiBase}/{pageId}/feed";
        var payload = new Dictionary<string, string>
        {
            ["message"] = message,
            ["access_token"] = accessToken
        };

        var response = await client.PostAsync(url, new FormUrlEncodedContent(payload), ct);
        var json = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Facebook API error: {StatusCode} — {Body}", response.StatusCode, json);
            var errorMsg = ExtractErrorMessage(json);
            return PublishResult.Fail($"Facebook: {errorMsg}");
        }

        var result = JsonSerializer.Deserialize<JsonElement>(json);
        var postId = result.TryGetProperty("id", out var idProp) ? idProp.GetString() : null;
        var publishedUrl = $"https://www.facebook.com/{postId}";

        _logger.LogInformation("Published text post to Facebook page {PageId}, post ID: {PostId}", pageId, postId);
        return PublishResult.Ok(publishedUrl, postId);
    }

    private async Task<PublishResult> PublishPhotoPostAsync(
        HttpClient client, string pageId, string accessToken, string message, string imageUrl, CancellationToken ct)
    {
        var url = $"{GraphApiBase}/{pageId}/photos";
        HttpResponseMessage response;

        var apiBaseUrl = _configuration["AppConfig:ApiBaseUrl"]?.TrimEnd('/');
        var isLocal = !string.IsNullOrEmpty(apiBaseUrl) && imageUrl.StartsWith(apiBaseUrl, StringComparison.OrdinalIgnoreCase);
        
        string? localPath = null;
        if (isLocal)
        {
            var relativePath = imageUrl.Substring(apiBaseUrl!.Length).TrimStart('/').Replace("/", "\\");
            localPath = Path.Combine(_env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"), relativePath);
        }

        if (localPath != null && File.Exists(localPath))
        {
            using var form = new MultipartFormDataContent();
            form.Add(new StringContent(message), "message");
            form.Add(new StringContent(accessToken), "access_token");

            var fileContent = new StreamContent(File.OpenRead(localPath));
            var ext = Path.GetExtension(localPath).ToLower();
            var mimeType = ext == ".png" ? "image/png" : ext == ".gif" ? "image/gif" : "image/jpeg";
            fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(mimeType);
            
            form.Add(fileContent, "source", Path.GetFileName(localPath));

            response = await client.PostAsync(url, form, ct);
        }
        else
        {
            var payload = new Dictionary<string, string>
            {
                ["message"] = message,
                ["url"] = imageUrl,
                ["access_token"] = accessToken
            };
            response = await client.PostAsync(url, new FormUrlEncodedContent(payload), ct);
        }

        var json = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Facebook photo API error: {StatusCode} — {Body}", response.StatusCode, json);
            var errorMsg = ExtractErrorMessage(json);
            return PublishResult.Fail($"Facebook: {errorMsg}");
        }

        var result = JsonSerializer.Deserialize<JsonElement>(json);
        var postId = result.TryGetProperty("post_id", out var pidProp)
            ? pidProp.GetString()
            : result.TryGetProperty("id", out var idProp) ? idProp.GetString() : null;

        var publishedUrl = $"https://www.facebook.com/{postId}";

        _logger.LogInformation("Published photo post to Facebook page {PageId}, post ID: {PostId}", pageId, postId);
        return PublishResult.Ok(publishedUrl, postId);
    }

    private async Task<PublishResult> PublishMultiPhotoPostAsync(
        HttpClient client, string pageId, string accessToken, string message, List<string> imageUrls, CancellationToken ct)
    {
        var uploadedPhotoIds = new List<string>();

        // Step 1: Upload photos as unpublished
        foreach (var imageUrl in imageUrls)
        {
            var uploadUrl = $"{GraphApiBase}/{pageId}/photos";
            HttpResponseMessage res;

            var apiBaseUrl = _configuration["AppConfig:ApiBaseUrl"]?.TrimEnd('/');
            var isLocal = !string.IsNullOrEmpty(apiBaseUrl) && imageUrl.StartsWith(apiBaseUrl, StringComparison.OrdinalIgnoreCase);
            
            string? localPath = null;
            if (isLocal)
            {
                var relativePath = imageUrl.Substring(apiBaseUrl!.Length).TrimStart('/').Replace("/", "\\");
                localPath = Path.Combine(_env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"), relativePath);
            }

            if (localPath != null && File.Exists(localPath))
            {
                using var form = new MultipartFormDataContent();
                form.Add(new StringContent("false"), "published");
                form.Add(new StringContent(accessToken), "access_token");

                var fileContent = new StreamContent(File.OpenRead(localPath));
                var ext = Path.GetExtension(localPath).ToLower();
                var mimeType = ext == ".png" ? "image/png" : ext == ".gif" ? "image/gif" : "image/jpeg";
                fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(mimeType);
                form.Add(fileContent, "source", Path.GetFileName(localPath));

                res = await client.PostAsync(uploadUrl, form, ct);
            }
            else
            {
                var payload = new Dictionary<string, string>
                {
                    ["url"] = imageUrl,
                    ["published"] = "false",
                    ["access_token"] = accessToken
                };
                res = await client.PostAsync(uploadUrl, new FormUrlEncodedContent(payload), ct);
            }

            var json = await res.Content.ReadAsStringAsync(ct);
            if (res.IsSuccessStatusCode)
            {
                var result = JsonSerializer.Deserialize<JsonElement>(json);
                if (result.TryGetProperty("id", out var idProp))
                {
                    uploadedPhotoIds.Add(idProp.GetString()!);
                }
            }
            else
            {
                _logger.LogWarning("Failed to upload unpublished photo {Url}: {Json}", imageUrl, json);
            }
        }


        if (uploadedPhotoIds.Count == 0)
        {
            return PublishResult.Fail("Failed to upload any photos for the multi-photo post.");
        }

        // Step 2: Publish feed post attaching all photo IDs
        var feedUrl = $"{GraphApiBase}/{pageId}/feed";
        var dict = new Dictionary<string, string>
        {
            ["message"] = message,
            ["access_token"] = accessToken
        };

        // Graph API requires an array of JSON objects for attached_media
        // E.g. attached_media=[{"media_fbid":"123"}, {"media_fbid":"456"}]
        var attachedMediaList = uploadedPhotoIds.Select(id => new { media_fbid = id }).ToList();
        dict["attached_media"] = JsonSerializer.Serialize(attachedMediaList);

        var finalRes = await client.PostAsync(feedUrl, new FormUrlEncodedContent(dict), ct);
        var finalJson = await finalRes.Content.ReadAsStringAsync(ct);

        if (!finalRes.IsSuccessStatusCode)
        {
            _logger.LogWarning("Facebook multi-photo API error: {StatusCode} — {Body}", finalRes.StatusCode, finalJson);
            var errorMsg = ExtractErrorMessage(finalJson);
            return PublishResult.Fail($"Facebook: {errorMsg}");
        }

        var feedResult = JsonSerializer.Deserialize<JsonElement>(finalJson);
        var postId = feedResult.TryGetProperty("id", out var fIdProp) ? fIdProp.GetString() : null;
        var publishedUrl = $"https://www.facebook.com/{postId}";

        _logger.LogInformation("Published multi-photo post to Facebook page {PageId}, post ID: {PostId}", pageId, postId);
        return PublishResult.Ok(publishedUrl, postId);
    }

    private async Task<PublishResult> PublishVideoPostAsync(
        HttpClient client, string pageId, string accessToken, string message, string videoUrl, CancellationToken ct)
    {
        var url = $"{GraphApiBase}/{pageId}/videos";
        var payload = new Dictionary<string, string>
        {
            ["description"] = message,
            ["file_url"] = videoUrl,
            ["access_token"] = accessToken
        };

        var response = await client.PostAsync(url, new FormUrlEncodedContent(payload), ct);
        var json = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Facebook video API error: {StatusCode} — {Body}", response.StatusCode, json);
            var errorMsg = ExtractErrorMessage(json);
            return PublishResult.Fail($"Facebook: {errorMsg}");
        }

        var result = JsonSerializer.Deserialize<JsonElement>(json);
        var videoId = result.TryGetProperty("id", out var idProp) ? idProp.GetString() : null;

        var publishedUrl = $"https://www.facebook.com/{pageId}/videos/{videoId}";

        _logger.LogInformation("Published video post to Facebook page {PageId}, video ID: {VideoId}", pageId, videoId);
        return PublishResult.Ok(publishedUrl, videoId);
    }

    public async Task<bool> ValidateCredentialsAsync(SocialAccount account, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(account.AccessToken)) return false;

        var client = _httpClientFactory.CreateClient();
        var url = $"{GraphApiBase}/me?access_token={account.AccessToken}";

        try
        {
            var response = await client.GetAsync(url, cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
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
        return "Unknown Facebook API error";
    }
}
