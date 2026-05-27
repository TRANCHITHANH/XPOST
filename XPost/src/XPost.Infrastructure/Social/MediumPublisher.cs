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

public class MediumPublisher : ISocialPublisher
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<MediumPublisher> _logger;
    private readonly IConfiguration _configuration;
    private readonly Microsoft.AspNetCore.Hosting.IWebHostEnvironment _env;
    private const string MediumApiBase = "https://api.medium.com/v1";

    public int Platform => (int)SocialPlatform.Medium;

    public MediumPublisher(IHttpClientFactory httpClientFactory, ILogger<MediumPublisher> logger, IConfiguration configuration, Microsoft.AspNetCore.Hosting.IWebHostEnvironment env)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _configuration = configuration;
        _env = env;
    }

    public async Task<PublishResult> PublishAsync(SocialAccount account, Post post, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(account.AccessToken))
            return PublishResult.Fail("Medium Integration Token is missing.");

        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", account.AccessToken);
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        try
        {
            // 1. Get User ID (authorId) if not already in AccountIdentifier
            string authorId = account.AccountIdentifier;
            if (string.IsNullOrEmpty(authorId))
            {
                var meResponse = await client.GetAsync($"{MediumApiBase}/me", cancellationToken);
                if (!meResponse.IsSuccessStatusCode)
                {
                    return PublishResult.Fail("Could not retrieve Medium user profile. Verify your token.");
                }
                var meJson = await meResponse.Content.ReadAsStringAsync(cancellationToken);
                using var meDoc = JsonDocument.Parse(meJson);
                authorId = meDoc.RootElement.GetProperty("data").GetProperty("id").GetString() ?? "";
            }

            if (string.IsNullOrEmpty(authorId))
                return PublishResult.Fail("Medium Author ID not found.");

            // 2. Prepare content
            var contentBuilder = new StringBuilder();
            
            // Upload Featured Image to Medium
            if (!string.IsNullOrEmpty(post.FeaturedImageUrl))
            {
                var uploadedUrl = await UploadImageAsync(client, post.FeaturedImageUrl, cancellationToken);
                if (!string.IsNullOrEmpty(uploadedUrl))
                {
                    contentBuilder.AppendLine($"<figure><img src=\"{uploadedUrl}\" /></figure>");
                }
            }

            if (!string.IsNullOrEmpty(post.Content))
            {
                contentBuilder.AppendLine(post.Content);
            }

            var finalContent = contentBuilder.ToString();

            // 3. Publish post
            var payload = new
            {
                title = post.Title ?? "Untitled Post",
                contentFormat = "html",
                content = finalContent,
                publishStatus = "public" // or "draft"
            };

            var response = await client.PostAsJsonAsync($"{MediumApiBase}/users/{authorId}/posts", payload, cancellationToken);
            var resultJson = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Medium API error: {StatusCode} - {Body}", response.StatusCode, resultJson);
                return PublishResult.Fail($"Medium: {resultJson}");
            }

            using var resDoc = JsonDocument.Parse(resultJson);
            var data = resDoc.RootElement.GetProperty("data");
            var publishedUrl = data.GetProperty("url").GetString() ?? "";
            var publishedId = data.GetProperty("id").GetString() ?? "";

            return PublishResult.Ok(publishedUrl, publishedId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error publishing to Medium");
            return PublishResult.Fail($"System error: {ex.Message}");
        }
    }

    private async Task<string?> UploadImageAsync(HttpClient client, string imageUrl, CancellationToken ct)
    {
        try
        {
            var apiBaseUrl = _configuration["AppConfig:ApiBaseUrl"]?.TrimEnd('/');
            var isLocal = !string.IsNullOrEmpty(apiBaseUrl) && imageUrl.StartsWith(apiBaseUrl, StringComparison.OrdinalIgnoreCase);
            
            string? localPath = null;
            if (isLocal)
            {
                var relativePath = imageUrl.Substring(apiBaseUrl!.Length).TrimStart('/').Replace("/", "\\");
                localPath = Path.Combine(_env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"), relativePath);
            }
            else if (!imageUrl.StartsWith("http"))
            {
                localPath = Path.Combine(_env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"), imageUrl.TrimStart('/').Replace("/", "\\"));
            }

            if (localPath != null && File.Exists(localPath))
            {
                using var form = new MultipartFormDataContent();
                var fileContent = new StreamContent(File.OpenRead(localPath));
                var ext = Path.GetExtension(localPath).ToLower();
                var mimeType = ext == ".png" ? "image/png" : ext == ".gif" ? "image/gif" : "image/jpeg";
                fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(mimeType);
                
                form.Add(fileContent, "image", Path.GetFileName(localPath));

                var response = await client.PostAsync($"{MediumApiBase}/images", form, ct);
                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadAsStringAsync(ct);
                    using var doc = JsonDocument.Parse(json);
                    return doc.RootElement.GetProperty("data").GetProperty("url").GetString();
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to upload image to Medium: {Url}", imageUrl);
        }
        return null;
    }

    public Task<bool> ValidateCredentialsAsync(SocialAccount account, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(!string.IsNullOrEmpty(account.AccessToken));
    }
}
