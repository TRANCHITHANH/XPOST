using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;

namespace XPost.Infrastructure.Social;

public class DevToPublisher : ISocialPublisher
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<DevToPublisher> _logger;
    private readonly IConfiguration _configuration;
    private readonly Microsoft.AspNetCore.Hosting.IWebHostEnvironment _env;
    private readonly IServiceProvider _serviceProvider;
    private const string DevToApiBase = "https://dev.to/api";

    public int Platform => (int)SocialPlatform.DevTo;

    public DevToPublisher(
        IHttpClientFactory httpClientFactory, 
        ILogger<DevToPublisher> logger, 
        IConfiguration configuration, 
        Microsoft.AspNetCore.Hosting.IWebHostEnvironment env,
        IServiceProvider serviceProvider)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _configuration = configuration;
        _env = env;
        _serviceProvider = serviceProvider;
    }

    public async Task<PublishResult> PublishAsync(SocialAccount account, Post post, CancellationToken cancellationToken = default)
    {
        // API Key can be stored in either AccessToken or ApiKey field
        var apiKey = !string.IsNullOrEmpty(account.AccessToken) ? account.AccessToken
                   : !string.IsNullOrEmpty(account.ApiKey) ? account.ApiKey
                   : null;

        if (string.IsNullOrEmpty(apiKey))
            return PublishResult.Fail("Dev.to API Key is missing.");

        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Add("api-key", apiKey);
        client.DefaultRequestHeaders.Add("User-Agent", "XPost/1.0");
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        try
        {
            var appBaseUrl = _configuration["AppConfig:ApiBaseUrl"]?.TrimEnd('/');
            
            // Step 1: Resolve Main Image via Relay if necessary
            string? mainImage = null;
            if (!string.IsNullOrEmpty(post.FeaturedImageUrl))
            {
                // Try to host on Dev.to first (if supported)
                mainImage = await UploadImageToDevToAsync(account, post.FeaturedImageUrl, cancellationToken);
                
                // If Dev.to upload fails (404/403), try WordPress Relay
                if (string.IsNullOrEmpty(mainImage) || mainImage.Contains("ERROR"))
                {
                    _logger.LogInformation("Dev.to Relay: Attempting to use WordPress as host for {Url}", post.FeaturedImageUrl);
                    using var scope = _serviceProvider.CreateScope();
                    var unitOfWork = scope.ServiceProvider.GetRequiredService<XPost.Domain.Interfaces.IUnitOfWork>();
                    var wpAccount = (await unitOfWork.Repository<SocialAccount>().GetAsync(a => 
                        a.UserId == account.UserId && a.IsActive && a.Platform == (int)SocialPlatform.WordPress))
                        .FirstOrDefault();

                    if (wpAccount != null)
                    {
                        var wpPublisher = scope.ServiceProvider.GetRequiredService<IEnumerable<ISocialPublisher>>()
                            .FirstOrDefault(p => p.Platform == (int)SocialPlatform.WordPress) as WordPressPublisher;
                        
                        if (wpPublisher != null)
                        {
                            var relativePath = post.FeaturedImageUrl.StartsWith("http") ? post.FeaturedImageUrl.Substring(appBaseUrl!.Length) : post.FeaturedImageUrl;
                            var localPath = Path.Combine(_env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"), relativePath.TrimStart('/').Replace("/", "\\"));
                            
                            if (File.Exists(localPath))
                            {
                                mainImage = await wpPublisher.UploadMediaAsync(wpAccount, localPath, cancellationToken);
                                if (!string.IsNullOrEmpty(mainImage))
                                    _logger.LogInformation("Dev.to Relay SUCCESS: Hosted on WordPress: {Url}", mainImage);
                            }
                        }
                    }
                }
            }

            // Step 2: Convert Content and deduplicate
            // If we have a main image, we don't need to put it at the top of the body again
            var body = !string.IsNullOrEmpty(post.Content)
                ? HtmlContentHelper.ConvertToMarkdown(post.Content)
                : "";

            var payload = new
            {
                article = new
                {
                    title = post.Title ?? "Untitled Post",
                    published = true,
                    body_markdown = body,
                    main_image = mainImage, // Only valid public URLs allowed here
                    tags = new string[] { "xpost" }
                }
            };

            var jsonContent = new System.Net.Http.StringContent(
                JsonSerializer.Serialize(payload),
                System.Text.Encoding.UTF8,
                "application/json");
            var response = await client.PostAsync($"{DevToApiBase}/articles", jsonContent, cancellationToken);
            var resultJson = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Dev.to API error: {StatusCode} - {Body}", response.StatusCode, resultJson);
                return PublishResult.Fail($"Dev.to: {resultJson}");
            }

            using var resDoc = JsonDocument.Parse(resultJson);
            var publishedUrl = resDoc.RootElement.GetProperty("url").GetString() ?? "";
            var publishedId = resDoc.RootElement.GetProperty("id").GetInt32().ToString();

            return PublishResult.Ok(publishedUrl, publishedId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error publishing to Dev.to");
            return PublishResult.Fail($"System error: {ex.Message}");
        }
    }

    public async Task<string?> UploadImageToDevToAsync(SocialAccount account, string imageUrl, CancellationToken ct)
    {
        // API Key can be stored in either AccessToken or ApiKey field
        var apiKey = !string.IsNullOrEmpty(account.AccessToken) ? account.AccessToken
                   : !string.IsNullOrEmpty(account.ApiKey) ? account.ApiKey
                   : null;

        if (string.IsNullOrEmpty(apiKey)) return null;

        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Add("api-key", apiKey);
        client.DefaultRequestHeaders.Add("User-Agent", "XPost/1.0");

        try
        {
            _logger.LogInformation("Uploading image to Dev.to CDN: {Url}", imageUrl);

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

            byte[] imageBytes;
            string fileName;

            if (localPath != null && File.Exists(localPath))
            {
                imageBytes = await File.ReadAllBytesAsync(localPath, ct);
                fileName = Path.GetFileName(localPath);
            }
            else
            {
                // Fallback to downloading
                var absoluteUrl = imageUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase) ? imageUrl : $"{apiBaseUrl}/{imageUrl.TrimStart('/')}";
                var clientDownload = _httpClientFactory.CreateClient();
                var imageResponse = await clientDownload.GetAsync(absoluteUrl, ct);
                if (!imageResponse.IsSuccessStatusCode) return null;

                imageBytes = await imageResponse.Content.ReadAsByteArrayAsync(ct);
                fileName = "image.jpg";
            }

            using var multipart = new MultipartFormDataContent();
            var imageContent = new ByteArrayContent(imageBytes);
            imageContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
            multipart.Add(imageContent, "file", fileName);

            var response = await client.PostAsync($"{DevToApiBase}/images", multipart, ct);
            var resultStr = await response.Content.ReadAsStringAsync(ct);

            if (response.IsSuccessStatusCode)
            {
                using var doc = JsonDocument.Parse(resultStr);
                return doc.RootElement.GetProperty("url").GetString();
            }

            _logger.LogWarning("Dev.to image upload failed: {Error}", resultStr);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading image to Dev.to");
        }
        return null;
    }

    public Task<bool> ValidateCredentialsAsync(SocialAccount account, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(!string.IsNullOrEmpty(account.AccessToken) || !string.IsNullOrEmpty(account.ApiKey));
    }
}
