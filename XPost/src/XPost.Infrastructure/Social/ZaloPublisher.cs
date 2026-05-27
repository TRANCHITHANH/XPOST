using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Enums;

namespace XPost.Infrastructure.Social;

/// <summary>
/// Publishes articles to Zalo Official Account via Zalo OA Article API.
/// Flow: Upload image → Create article → Verify article (get ID).
/// Access token stored in SocialAccount.AccessToken.
/// </summary>
public class ZaloPublisher : ISocialPublisher
{
    private class MediaItem
    {
        [System.Text.Json.Serialization.JsonPropertyName("url")]
        public string Url { get; set; } = string.Empty;

        [System.Text.Json.Serialization.JsonPropertyName("mediaType")]
        public string MediaType { get; set; } = string.Empty;
    }

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<ZaloPublisher> _logger;
    private readonly IConfiguration _configuration;
    private const string OpenApiBase = "https://openapi.zalo.me";

    public int Platform => (int)SocialPlatform.Zalo;

    public ZaloPublisher(IHttpClientFactory httpClientFactory, ILogger<ZaloPublisher> logger, IConfiguration configuration)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _configuration = configuration;
    }

    public async Task<PublishResult> PublishAsync(SocialAccount account, Post post, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(account.AccessToken))
            return PublishResult.Fail("Zalo OA Access Token is missing.");

        var client = _httpClientFactory.CreateClient();
        var accessToken = account.AccessToken;

        try
        {
            // 1. Build article content
            var title = !string.IsNullOrEmpty(post.Title) ? post.Title : "Bài viết mới";
            var description = !string.IsNullOrEmpty(post.Content)
                ? HtmlContentHelper.ConvertToPlainText(post.Content)
                : title;

            // Truncate description to 500 chars (Zalo limit)
            if (description.Length > 500)
                description = description[..497] + "...";

            // 2. Determine cover image
            string? coverUrl = null;

            // Use featured image as cover
            if (!string.IsNullOrEmpty(post.FeaturedImageUrl))
            {
                coverUrl = MakeAbsoluteUrl(post.FeaturedImageUrl);
            }

            // Parse MediaJson for additional images
            var bodyElements = new List<object>();
            var additionalImages = new List<string>();

            // Add main content as text body element
            if (!string.IsNullOrEmpty(post.Content))
            {
                var cleanContent = HtmlContentHelper.ConvertToPlainText(post.Content);
                bodyElements.Add(new { type = "text", content = cleanContent });
            }

            if (!string.IsNullOrEmpty(post.MediaJson))
            {
                try
                {
                    var items = JsonSerializer.Deserialize<List<MediaItem>>(post.MediaJson);
                    if (items != null)
                    {
                        foreach (var item in items.Where(x => !string.IsNullOrEmpty(x.Url) && x.MediaType == "image"))
                        {
                            var absUrl = MakeAbsoluteUrl(item.Url);

                            // Use first image as cover if no featured image
                            if (coverUrl == null)
                            {
                                coverUrl = absUrl;
                                continue;
                            }

                            additionalImages.Add(absUrl);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to parse MediaJson for post {PostId}", post.Id);
                }
            }

            // Add additional images to body
            foreach (var imgUrl in additionalImages.Take(10))
            {
                bodyElements.Add(new { type = "image", url = imgUrl });
            }

            // If still no cover, we need at least a placeholder - Zalo requires cover
            if (string.IsNullOrEmpty(coverUrl))
            {
                // Use a text-only article without cover - will try without it
                _logger.LogWarning("No cover image for Zalo article, post {PostId}. Article may fail.", post.Id);
            }

            // 3. Build the article create request
            var articleBody = new Dictionary<string, object>
            {
                ["type"] = "normal",
                ["title"] = title,
                ["author"] = "XPost",
                ["description"] = description,
                ["status"] = "show",
                ["comment"] = "show",
                ["body"] = bodyElements.Count > 0 ? bodyElements : new List<object> { new { type = "text", content = description } }
            };

            if (!string.IsNullOrEmpty(coverUrl))
            {
                var coverToken = await UploadImageToZaloAsync(client, accessToken, coverUrl, cancellationToken);

                articleBody["cover"] = new
                {
                    cover_type = "photo",
                    photo_url = !string.IsNullOrEmpty(coverToken) ? coverToken : coverUrl,
                    status = "show"
                };
            }

            // 4. Create article
            var createUrl = $"{OpenApiBase}/v2.0/article/create?access_token={accessToken}";
            var jsonContent = JsonSerializer.Serialize(articleBody);
            var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            var createResponse = await client.PostAsync(createUrl, content, cancellationToken);
            var createJson = await createResponse.Content.ReadAsStringAsync(cancellationToken);

            _logger.LogInformation("Zalo article create response: {Response}", createJson);

            var createResult = JsonSerializer.Deserialize<JsonElement>(createJson);

            if (!createResult.TryGetProperty("error", out var errorProp) || errorProp.GetInt32() != 0)
            {
                var errorMsg = createResult.TryGetProperty("message", out var msgProp)
                    ? msgProp.GetString() ?? "Unknown error"
                    : "Create article failed";
                _logger.LogWarning("Zalo create article failed: {Error}", createJson);
                return PublishResult.Fail($"Zalo: {errorMsg}");
            }

            if (!createResult.TryGetProperty("data", out var createData)
                || !createData.TryGetProperty("token", out var articleTokenProp))
            {
                return PublishResult.Fail("Zalo: No article token returned.");
            }

            var articleToken = articleTokenProp.GetString()!;

            // 5. Verify article to get article ID (with retry)
            var articleId = await VerifyArticleAsync(client, accessToken, articleToken, cancellationToken);

            if (string.IsNullOrEmpty(articleId))
            {
                // Article was created but ID not yet available - it's async
                _logger.LogWarning("Zalo article created but verify returned no ID yet. Token: {Token}", articleToken);
                return PublishResult.Ok($"https://oa.zalo.me/article/{articleToken}", articleToken);
            }

            _logger.LogInformation("Published article to Zalo OA, article ID: {ArticleId}", articleId);
            return PublishResult.Ok($"https://oa.zalo.me/article/{articleId}", articleId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to publish post {PostId} to Zalo OA", post.Id);
            return PublishResult.Fail($"Zalo API error: {ex.Message}");
        }
    }

    private async Task<string?> UploadImageToZaloAsync(HttpClient client, string accessToken, string imageUrl, CancellationToken ct)
    {
        try
        {
            var response = await client.GetAsync(imageUrl, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Failed to download image from {Url} to upload to Zalo. Status: {Status}", imageUrl, response.StatusCode);
                return null;
            }

            var imageBytes = await response.Content.ReadAsByteArrayAsync(ct);
            var form = new MultipartFormDataContent();
            var streamContent = new ByteArrayContent(imageBytes);
            streamContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
            form.Add(streamContent, "file", "image.jpg");

            var uploadUrl = $"{OpenApiBase}/v2.0/oa/upload/image";
            
            var request = new HttpRequestMessage(HttpMethod.Post, uploadUrl);
            request.Headers.Add("access_token", accessToken);
            request.Content = form;

            var uploadResponse = await client.SendAsync(request, ct);
            var json = await uploadResponse.Content.ReadAsStringAsync(ct);

            var result = JsonSerializer.Deserialize<JsonElement>(json);
            if (result.TryGetProperty("error", out var errorProp) && errorProp.GetInt32() == 0
                && result.TryGetProperty("data", out var dataProp)
                && dataProp.TryGetProperty("attachment_id", out var attachmentIdProp))
            {
                var token = attachmentIdProp.GetString();
                _logger.LogInformation("Successfully uploaded image {Url} to Zalo. AttachmentId: {AttachmentId}", imageUrl, token);
                return token;
            }

            _logger.LogError("Zalo image upload failed: {Response}. Fallbacking to raw URL...", json);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception when uploading image {Url} to Zalo", imageUrl);
            return null;
        }
    }

    /// <summary>
    /// Verify article to get the actual article ID.
    /// Zalo article creation is async - may need to retry.
    /// </summary>
    private async Task<string?> VerifyArticleAsync(
        HttpClient client, string accessToken, string articleToken, CancellationToken ct)
    {
        var verifyUrl = $"{OpenApiBase}/v2.0/article/verify?access_token={accessToken}";
        var verifyBody = new { token = articleToken };

        // Retry up to 3 times with delay (Zalo processes async)
        for (int attempt = 0; attempt < 3; attempt++)
        {
            if (attempt > 0)
                await Task.Delay(2000, ct); // Wait 2s between retries

            try
            {
                var response = await client.PostAsJsonAsync(verifyUrl, verifyBody, ct);
                var json = await response.Content.ReadAsStringAsync(ct);
                var result = JsonSerializer.Deserialize<JsonElement>(json);

                _logger.LogInformation("Zalo article verify attempt {Attempt}: {Response}", attempt + 1, json);

                if (result.TryGetProperty("error", out var err) && err.GetInt32() == 0
                    && result.TryGetProperty("data", out var data)
                    && data.TryGetProperty("id", out var idProp))
                {
                    return idProp.GetString();
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Zalo article verify attempt {Attempt} failed", attempt + 1);
            }
        }

        return null;
    }

    public async Task<bool> ValidateCredentialsAsync(SocialAccount account, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(account.AccessToken)) return false;

        var client = _httpClientFactory.CreateClient();
        var url = $"{OpenApiBase}/v3.0/oa/getoa?access_token={account.AccessToken}";

        try
        {
            var response = await client.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode) return false;

            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            var result = JsonSerializer.Deserialize<JsonElement>(json);

            return result.TryGetProperty("error", out var err) && err.GetInt32() == 0;
        }
        catch
        {
            return false;
        }
    }

    private string MakeAbsoluteUrl(string url)
    {
        if (url.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            return url;

        var baseUrl = _configuration["AppConfig:ApiBaseUrl"]?.TrimEnd('/');
        return !string.IsNullOrEmpty(baseUrl) ? $"{baseUrl}{url}" : url;
    }

    private static string StripHtmlTags(string html)
    {
        return System.Text.RegularExpressions.Regex.Replace(html, "<[^>]*>", string.Empty).Trim();
    }
}
