using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Text.Json;
using System.Text.RegularExpressions;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Enums;

namespace XPost.Infrastructure.Social;

public class ThreadsPublisher : ISocialPublisher
{
    private readonly ILogger<ThreadsPublisher> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ThreadsSettings _settings;

    public ThreadsPublisher(
        ILogger<ThreadsPublisher> logger,
        IHttpClientFactory httpClientFactory,
        IOptions<ThreadsSettings> settings,
        IConfiguration configuration)
    {
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _settings = settings.Value;
        _configuration = configuration;
    }

    public int Platform => (int)SocialPlatform.Threads;

    public async Task<PublishResult> PublishAsync(SocialAccount account, Post post, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Publishing to Threads for account: {AccountName}", account.AccountName);

            if (string.IsNullOrEmpty(account.AccessToken))
                return PublishResult.Fail("Missing Access Token");

            if (string.IsNullOrEmpty(account.AccountIdentifier))
                return PublishResult.Fail("Missing Threads User ID");

            var client = _httpClientFactory.CreateClient();
            var userId = account.AccountIdentifier;

            // ═══ XỬ LÝ NỘI DUNG (giống Facebook/Telegram) ═══
            var rawContent = !string.IsNullOrEmpty(post.Content) ? post.Content : post.Title;
            var plainText = HtmlContentHelper.ConvertToPlainText(rawContent);

            _logger.LogInformation("Threads: Plain text length = {Len}", plainText.Length);

            // ═══ XỬ LÝ ẢNH (giống Facebook) ═══
            string? imageUrl = null;
            if (!string.IsNullOrEmpty(post.FeaturedImageUrl))
            {
                imageUrl = post.FeaturedImageUrl;
                // Chuyển URL relative thành absolute
                if (!imageUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase))
                {
                    var baseUrl = _configuration["AppConfig:ApiBaseUrl"]?.TrimEnd('/');
                    if (!string.IsNullOrEmpty(baseUrl))
                    {
                        imageUrl = $"{baseUrl}{imageUrl}";
                    }
                }
                _logger.LogInformation("Threads: Image URL = {Img}", imageUrl);
            }

            // ═══ CHIA NHỎ NỘI DUNG (Threads giới hạn 500 ký tự) ═══
            var chunks = SplitContent(plainText, 500);
            _logger.LogInformation("Threads: Split into {Count} chunk(s)", chunks.Count);

            string? parentPostId = null;
            string? firstPostUrl = null;

            for (int i = 0; i < chunks.Count; i++)
            {
                var content = chunks[i];
                
                var parameters = new Dictionary<string, string>
                {
                    { "access_token", account.AccessToken },
                    { "text", content }
                };

                // Chỉ đoạn đầu tiên mới có ảnh (nếu có + phải là URL public)
                if (i == 0 && !string.IsNullOrEmpty(imageUrl) && imageUrl.StartsWith("http"))
                {
                    parameters["media_type"] = "IMAGE";
                    parameters["image_url"] = imageUrl;
                }
                else
                {
                    parameters["media_type"] = "TEXT";
                }

                // Reply vào bài trước đó (tạo chuỗi thread)
                if (!string.IsNullOrEmpty(parentPostId))
                {
                    parameters["reply_to_id"] = parentPostId;
                }

                // ═══ BƯỚC 1: Tạo container ═══
                var containerId = await CreateContainer(client, userId, parameters, i, cancellationToken);
                if (containerId == null)
                {
                    return PublishResult.Fail($"Lỗi tạo container (đoạn {i + 1})");
                }

                // ═══ BƯỚC 2: Đợi container sẵn sàng ═══
                bool hasImage = i == 0 && parameters.ContainsKey("image_url");
                int waitSeconds = hasImage ? 15 : 5;
                _logger.LogInformation("Threads: Waiting {Seconds}s for container {Id}...", waitSeconds, containerId);
                await Task.Delay(waitSeconds * 1000, cancellationToken);

                // ═══ BƯỚC 3: Publish container (có retry) ═══
                var (publishedId, error) = await PublishContainerWithRetry(client, userId, containerId, account.AccessToken, i, cancellationToken);
                
                if (publishedId == null)
                {
                    return PublishResult.Fail($"Lỗi đăng bài (đoạn {i + 1}): {error}");
                }

                parentPostId = publishedId;

                if (i == 0)
                {
                    firstPostUrl = $"https://www.threads.net/post/{parentPostId}";
                }

                // Delay giữa các chunk
                if (i < chunks.Count - 1)
                {
                    await Task.Delay(2000, cancellationToken);
                }
            }

            _logger.LogInformation("Threads: Published successfully! URL = {Url}", firstPostUrl);
            return PublishResult.Ok(firstPostUrl ?? "", parentPostId ?? "");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception while publishing to Threads");
            return PublishResult.Fail(ex.Message);
        }
    }

    /// <summary>
    /// Tạo media container trên Threads API
    /// </summary>
    private async Task<string?> CreateContainer(HttpClient client, string userId, Dictionary<string, string> parameters, int chunkIndex, CancellationToken ct)
    {
        var createUrl = $"https://graph.threads.net/v1.0/{userId}/threads";
        
        try
        {
            var response = await client.PostAsync(createUrl, new FormUrlEncodedContent(parameters), ct);
            var responseContent = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                var errorMsg = ExtractErrorMessage(responseContent);
                _logger.LogError("Threads: Container creation failed for chunk {Index}. Status={Status}, Error={Error}", 
                    chunkIndex, response.StatusCode, errorMsg);
                return null;
            }

            var data = JsonSerializer.Deserialize<JsonElement>(responseContent);
            var containerId = data.GetProperty("id").GetString()!;
            _logger.LogInformation("Threads: Container created for chunk {Index}: {Id}", chunkIndex, containerId);
            return containerId;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Threads: Exception creating container for chunk {Index}", chunkIndex);
            return null;
        }
    }

    /// <summary>
    /// Publish container với retry (tối đa 5 lần, exponential backoff)
    /// </summary>
    private async Task<(string? publishedId, string? error)> PublishContainerWithRetry(
        HttpClient client, string userId, string containerId, string accessToken, int chunkIndex, CancellationToken ct)
    {
        var publishUrl = $"https://graph.threads.net/v1.0/{userId}/threads_publish";
        var publishParams = new Dictionary<string, string>
        {
            { "access_token", accessToken },
            { "creation_id", containerId }
        };

        for (int attempt = 1; attempt <= 5; attempt++)
        {
            try
            {
                var response = await client.PostAsync(publishUrl, new FormUrlEncodedContent(publishParams), ct);
                var resultStr = await response.Content.ReadAsStringAsync(ct);

                if (response.IsSuccessStatusCode)
                {
                    var data = JsonSerializer.Deserialize<JsonElement>(resultStr);
                    var publishedId = data.GetProperty("id").GetString();
                    _logger.LogInformation("Threads: Published chunk {ChunkIndex} -> Post {PostId} (attempt {Attempt})", 
                        chunkIndex, publishedId, attempt);
                    return (publishedId, null);
                }

                var errorMsg = ExtractErrorMessage(resultStr);
                _logger.LogWarning("Threads: Publish attempt {Attempt}/5 failed for chunk {ChunkIndex}: {Error}", 
                    attempt, chunkIndex, errorMsg);

                // "resource does not exist" = container chưa sẵn sàng → retry
                if (resultStr.Contains("does not exist") || resultStr.Contains("4279009"))
                {
                    await Task.Delay(3000 * attempt, ct);
                    continue;
                }

                // Lỗi khác → dừng ngay
                return (null, errorMsg);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Threads: Exception on publish attempt {Attempt} for chunk {ChunkIndex}", attempt, chunkIndex);
                if (attempt == 5) return (null, ex.Message);
                await Task.Delay(3000, ct);
            }
        }

        return (null, $"Không thể publish container {containerId} sau 5 lần thử.");
    }

    /// <summary>
    /// Chia nội dung thành các đoạn nhỏ (tối đa 500 ký tự), cắt ở vị trí hợp lý
    /// </summary>
    private List<string> SplitContent(string content, int limit)
    {
        var result = new List<string>();
        if (string.IsNullOrEmpty(content)) return result;
        
        string remaining = content;
        while (remaining.Length > 0)
        {
            if (remaining.Length <= limit)
            {
                result.Add(remaining);
                break;
            }

            // Ưu tiên cắt ở dấu xuống dòng gần giới hạn
            int cutIndex = remaining.LastIndexOf('\n', limit);
            if (cutIndex < limit * 0.5)
                cutIndex = remaining.LastIndexOf('.', limit);
            if (cutIndex < limit * 0.5)
                cutIndex = remaining.LastIndexOf(' ', limit);
            if (cutIndex == -1 || cutIndex < limit * 0.3)
                cutIndex = limit;

            result.Add(remaining.Substring(0, cutIndex).Trim());
            remaining = remaining.Substring(cutIndex).Trim();
        }
        return result;
    }

    /// <summary>
    /// Trích xuất thông báo lỗi từ JSON response của Meta API
    /// </summary>
    private static string ExtractErrorMessage(string json)
    {
        try
        {
            var doc = JsonSerializer.Deserialize<JsonElement>(json);
            if (doc.TryGetProperty("error", out var errorObj))
            {
                // Ưu tiên error_user_msg (thường là tiếng Việt/dễ hiểu hơn)
                if (errorObj.TryGetProperty("error_user_msg", out var userMsg))
                    return userMsg.GetString() ?? "Unknown error";
                if (errorObj.TryGetProperty("message", out var msg))
                    return msg.GetString() ?? "Unknown error";
            }
            if (doc.TryGetProperty("error_message", out var errMsg))
                return errMsg.GetString() ?? "Unknown error";
        }
        catch { }
        return json; // Trả raw JSON nếu parse thất bại
    }

    public async Task<bool> ValidateCredentialsAsync(SocialAccount account, CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrEmpty(account.AccessToken)) return false;
            
            var client = _httpClientFactory.CreateClient();
            var url = $"https://graph.threads.net/v1.0/me?fields=id&access_token={account.AccessToken}";
            var response = await client.GetAsync(url, cancellationToken);
            
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }
}
