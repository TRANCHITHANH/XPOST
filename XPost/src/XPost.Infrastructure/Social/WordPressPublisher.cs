using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Enums;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;

namespace XPost.Infrastructure.Social;

public class WordPressPublisher : ISocialPublisher
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<WordPressPublisher> _logger;
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _env;

    public int Platform => (int)SocialPlatform.WordPress;

    public WordPressPublisher(
        IHttpClientFactory httpClientFactory,
        ILogger<WordPressPublisher> logger,
        IConfiguration configuration,
        IWebHostEnvironment env)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _configuration = configuration;
        _env = env;
    }

    public async Task<PublishResult> PublishAsync(SocialAccount account, Post post, CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(account.ApiBaseUrl))
            {
                return PublishResult.Fail("Cấu hình tài khoản WordPress thiếu API Base URL.");
            }

            var client = _httpClientFactory.CreateClient();
            
            if (account.AuthType == 1 && !string.IsNullOrWhiteSpace(account.ApiKey) && !string.IsNullOrWhiteSpace(account.ApiSecret))
            {
                var authString = $"{account.ApiKey}:{account.ApiSecret}";
                var base64Auth = Convert.ToBase64String(Encoding.UTF8.GetBytes(authString));
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", base64Auth);
            }
            else if (!string.IsNullOrWhiteSpace(account.AccessToken))
            {
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", account.AccessToken);
            }

            string baseUrl = account.ApiBaseUrl.TrimEnd('/');
            string endpoint = string.IsNullOrWhiteSpace(account.ApiPostEndpoint) ? "/posts" : (account.ApiPostEndpoint.StartsWith("/") ? account.ApiPostEndpoint : $"/{account.ApiPostEndpoint}");

            var contentBuilder = new StringBuilder();
            if (!string.IsNullOrWhiteSpace(post.Content))
            {
                contentBuilder.AppendLine(post.Content);
            }

            var appBaseUrl = _configuration["AppConfig:ApiBaseUrl"]?.TrimEnd('/');
            
            async Task AppendImageAsync(string imgUrl)
            {
                if (string.IsNullOrWhiteSpace(imgUrl)) return;
                
                var isLocal = !string.IsNullOrEmpty(appBaseUrl) && imgUrl.StartsWith(appBaseUrl, StringComparison.OrdinalIgnoreCase);
                if (!imgUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase) && !isLocal)
                {
                    isLocal = true;
                }

                string? finalUrl = null;
                if (isLocal)
                {
                    var relativePath = imgUrl.StartsWith("http") ? imgUrl.Substring(appBaseUrl!.Length) : imgUrl;
                    relativePath = relativePath.TrimStart('/').Replace("/", "\\");
                    var localPath = Path.Combine(_env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"), relativePath);
                    
                    if (File.Exists(localPath))
                    {
                        finalUrl = await UploadMediaAsync(account, localPath, cancellationToken);
                    }
                }

                if (finalUrl == null)
                {
                    finalUrl = imgUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase) ? imgUrl : $"{appBaseUrl}/{imgUrl.TrimStart('/')}";
                }

                contentBuilder.AppendLine($"<figure class=\"wp-block-image size-large\"><img src=\"{finalUrl}\" alt=\"\"/></figure>");
            }

            if (!string.IsNullOrWhiteSpace(post.FeaturedImageUrl))
            {
                await AppendImageAsync(post.FeaturedImageUrl);
            }

            if (!string.IsNullOrWhiteSpace(post.MediaJson))
            {
                try
                {
                    using var doc = JsonDocument.Parse(post.MediaJson);
                    if (doc.RootElement.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in doc.RootElement.EnumerateArray())
                        {
                            var mediaUrl = item.GetProperty("url").GetString();
                            if (!string.IsNullOrEmpty(mediaUrl) && mediaUrl != post.FeaturedImageUrl)
                            {
                                await AppendImageAsync(mediaUrl!);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to parse MediaJson for WordPress post {PostId}", post.Id);
                }
            }

            var finalContent = contentBuilder.ToString();
            var payload = new Dictionary<string, object>
            {
                { "title", post.Title ?? "" },
                { "content", finalContent },
                { "status", "publish" }
            };

            if (!string.IsNullOrWhiteSpace(post.Description))
            {
                payload.Add("excerpt", post.Description);
            }

            var jsonContent = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var response = await client.PostAsync(baseUrl + endpoint, jsonContent, cancellationToken);
            var resultStr = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                return PublishResult.Fail($"Lỗi WordPress API (HTTP {response.StatusCode}): {resultStr}");
            }
            
            var resultElement = JsonSerializer.Deserialize<JsonElement>(resultStr);
            var publishedPostId = resultElement.TryGetProperty("id", out var idProp) ? idProp.GetInt32().ToString() : null;
            var url = resultElement.TryGetProperty("link", out var linkProp) ? linkProp.GetString() : null;

            return PublishResult.Ok(url ?? string.Empty, publishedPostId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to publish post to WordPress");
            return PublishResult.Fail($"Lỗi hệ thống: {ex.Message}");
        }
    }

    public async Task<string?> UploadMediaAsync(SocialAccount account, string localPath, CancellationToken ct = default)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            if (account.AuthType == 1 && !string.IsNullOrWhiteSpace(account.ApiKey) && !string.IsNullOrWhiteSpace(account.ApiSecret))
            {
                var authString = $"{account.ApiKey}:{account.ApiSecret}";
                var base64Auth = Convert.ToBase64String(Encoding.UTF8.GetBytes(authString));
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", base64Auth);
            }
            else if (!string.IsNullOrWhiteSpace(account.AccessToken))
            {
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", account.AccessToken);
            }

            var baseUrl = account.ApiBaseUrl.TrimEnd('/');
            var mediaEndpoint = "/media";
            var fileName = Path.GetFileName(localPath);
            var ext = Path.GetExtension(localPath).ToLower();
            var mimeType = ext == ".png" ? "image/png" : ext == ".gif" ? "image/gif" : "image/jpeg";

            using var fileStream = File.OpenRead(localPath);
            using var content = new StreamContent(fileStream);
            content.Headers.ContentType = new MediaTypeHeaderValue(mimeType);
            content.Headers.ContentDisposition = new ContentDispositionHeaderValue("attachment")
            {
                FileName = fileName
            };

            var response = await client.PostAsync(baseUrl + mediaEndpoint, content, ct);
            var resultStr = await response.Content.ReadAsStringAsync(ct);

            if (response.IsSuccessStatusCode)
            {
                var mediaResult = JsonSerializer.Deserialize<JsonElement>(resultStr);
                return mediaResult.GetProperty("source_url").GetString();
            }
            _logger.LogWarning("Failed to upload media {File} to WordPress: {Error}", fileName, resultStr);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading media to WordPress");
        }
        return null;
    }

    public Task<bool> ValidateCredentialsAsync(SocialAccount account, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(true);
    }
}
