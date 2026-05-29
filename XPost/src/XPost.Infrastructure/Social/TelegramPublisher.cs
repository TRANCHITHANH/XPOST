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
/// Publishes content to Telegram channels/groups via Bot API.
/// Uses Bot Token stored in AccessToken and Chat ID in AccountIdentifier.
/// </summary>
public class TelegramPublisher : ISocialPublisher
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<TelegramPublisher> _logger;
    private readonly IConfiguration _configuration;
    private readonly Microsoft.AspNetCore.Hosting.IWebHostEnvironment _env;
    private const string TelegramApiBase = "https://api.telegram.org";

    public int Platform => (int)SocialPlatform.Telegram;

    public TelegramPublisher(IHttpClientFactory httpClientFactory, ILogger<TelegramPublisher> logger, IConfiguration configuration, Microsoft.AspNetCore.Hosting.IWebHostEnvironment env)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _configuration = configuration;
        _env = env;
    }

    public async Task<PublishResult> PublishAsync(SocialAccount account, Post post, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(account.AccessToken))
            return PublishResult.Fail("Telegram Bot Token is missing.");

        if (string.IsNullOrEmpty(account.AccountIdentifier))
            return PublishResult.Fail("Telegram Chat ID is missing.");

        var client = _httpClientFactory.CreateClient();
        var botToken = account.AccessToken;
        var chatId = account.AccountIdentifier;

        try
        {
            // Build message content with HTML formatting
            var textBuilder = new StringBuilder();

            if (!string.IsNullOrEmpty(post.Title))
                textBuilder.AppendLine($"<b>{EscapeHtml(post.Title)}</b>");

            if (!string.IsNullOrEmpty(post.Content))
            {
                textBuilder.AppendLine();
                // Convert HTML to plain text first, then escape for Telegram HTML parse mode
                textBuilder.Append(EscapeHtml(HtmlContentHelper.ConvertToPlainText(post.Content)));
            }

            var text = textBuilder.ToString().Trim();

            // If has featured image, send as photo; otherwise send as text
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

                // Telegram caption limit is 1024 chars
                var caption = text;
                string? remainingText = null;
                if (caption.Length > 1024)
                {
                    caption = text.Substring(0, 1021) + "...";
                    remainingText = text;
                }

                var photoResult = await SendPhotoAsync(client, botToken, chatId, caption, photoUrl, cancellationToken);
                
                // If photo sent successfully and there's remaining text, send it as a follow-up message
                if (photoResult.Success && remainingText != null)
                {
                    await SendMessageAsync(client, botToken, chatId, remainingText, cancellationToken);
                }
                
                return photoResult;
            }

            return await SendMessageAsync(client, botToken, chatId, text, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to publish post {PostId} to Telegram chat {ChatId}", post.Id, chatId);
            return PublishResult.Fail($"Telegram API error: {ex.Message}");
        }
    }

    private async Task<PublishResult> SendMessageAsync(
        HttpClient client, string botToken, string chatId, string text, CancellationToken ct)
    {
        var url = $"{TelegramApiBase}/bot{botToken}/sendMessage";
        var payload = new
        {
            chat_id = chatId,
            text,
            parse_mode = "HTML",
            disable_web_page_preview = false
        };

        var response = await client.PostAsJsonAsync(url, payload, ct);
        var json = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Telegram API error: {StatusCode} — {Body}", response.StatusCode, json);
            return PublishResult.Fail($"Telegram: {ExtractErrorDescription(json)}");
        }

        var result = JsonSerializer.Deserialize<JsonElement>(json);
        var messageId = result.TryGetProperty("result", out var resultObj)
            && resultObj.TryGetProperty("message_id", out var msgId)
            ? msgId.GetInt32().ToString()
            : null;

        _logger.LogInformation("Sent message to Telegram chat {ChatId}, message ID: {MessageId}", chatId, messageId);
        return PublishResult.Ok($"https://t.me/c/{chatId}/{messageId}", messageId);
    }

    private async Task<PublishResult> SendPhotoAsync(
        HttpClient client, string botToken, string chatId, string caption, string photoUrl, CancellationToken ct)
    {
        var url = $"{TelegramApiBase}/bot{botToken}/sendPhoto";
        HttpResponseMessage response;

        var apiBaseUrl = _configuration["AppConfig:ApiBaseUrl"]?.TrimEnd('/');
        var isLocal = !string.IsNullOrEmpty(apiBaseUrl) && photoUrl.StartsWith(apiBaseUrl, StringComparison.OrdinalIgnoreCase);
        
        string? localPath = null;
        if (isLocal)
        {
            var relativePath = photoUrl.Substring(apiBaseUrl!.Length).TrimStart('/').Replace("/", "\\");
            localPath = Path.Combine(_env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"), relativePath);
        }

        if (localPath != null && File.Exists(localPath))
        {
            using var form = new MultipartFormDataContent();
            form.Add(new StringContent(chatId), "chat_id");
            form.Add(new StringContent(caption), "caption");
            form.Add(new StringContent("HTML"), "parse_mode");

            var fileContent = new StreamContent(File.OpenRead(localPath));
            // Basic content type inference based on extension
            var ext = Path.GetExtension(localPath).ToLower();
            var mimeType = ext == ".png" ? "image/png" : ext == ".gif" ? "image/gif" : "image/jpeg";
            fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(mimeType);
            
            form.Add(fileContent, "photo", Path.GetFileName(localPath));

            response = await client.PostAsync(url, form, ct);
        }
        else
        {
            var payload = new
            {
                chat_id = chatId,
                photo = photoUrl,
                caption,
                parse_mode = "HTML"
            };
            response = await client.PostAsJsonAsync(url, payload, ct);
        }

        var json = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Telegram photo API error: {StatusCode} — {Body}", response.StatusCode, json);
            return PublishResult.Fail($"Telegram: {ExtractErrorDescription(json)}");
        }

        var result = JsonSerializer.Deserialize<JsonElement>(json);
        var messageId = result.TryGetProperty("result", out var resultObj)
            && resultObj.TryGetProperty("message_id", out var msgId)
            ? msgId.GetInt32().ToString()
            : null;

        _logger.LogInformation("Sent photo to Telegram chat {ChatId}, message ID: {MessageId}", chatId, messageId);
        return PublishResult.Ok($"https://t.me/c/{chatId}/{messageId}", messageId);
    }

    public async Task<bool> ValidateCredentialsAsync(SocialAccount account, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(account.AccessToken)) return false;

        var client = _httpClientFactory.CreateClient();
        var url = $"{TelegramApiBase}/bot{account.AccessToken}/getMe";

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

    public async Task<bool> DeletePublishedPostAsync(SocialAccount account, string publishedPostId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(account.AccessToken) || string.IsNullOrEmpty(account.AccountIdentifier) || string.IsNullOrEmpty(publishedPostId))
            return false;

        if (!int.TryParse(publishedPostId, out var messageId))
        {
            _logger.LogWarning("Invalid message ID format for Telegram post deletion: {PublishedPostId}", publishedPostId);
            return false;
        }

        var client = _httpClientFactory.CreateClient();
        var url = $"{TelegramApiBase}/bot{account.AccessToken}/deleteMessage";
        var payload = new
        {
            chat_id = account.AccountIdentifier,
            message_id = messageId
        };

        try
        {
            var response = await client.PostAsJsonAsync(url, payload, cancellationToken);
            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully deleted Telegram message {MessageId} from chat {ChatId}", messageId, account.AccountIdentifier);
                return true;
            }
            else
            {
                _logger.LogWarning("Failed to delete Telegram message {MessageId} from chat {ChatId}. Status: {StatusCode}, Body: {Body}", messageId, account.AccountIdentifier, response.StatusCode, json);
                return false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting Telegram message {MessageId} from chat {ChatId}", messageId, account.AccountIdentifier);
            return false;
        }
    }

    private static string EscapeHtml(string text)
    {
        return text
            .Replace("&", "&amp;")
            .Replace("<", "&lt;")
            .Replace(">", "&gt;");
    }

    private static string StripHtmlTags(string html)
    {
        return System.Text.RegularExpressions.Regex.Replace(html, "<[^>]*>", string.Empty);
    }

    private static string ExtractErrorDescription(string json)
    {
        try
        {
            var doc = JsonSerializer.Deserialize<JsonElement>(json);
            if (doc.TryGetProperty("description", out var desc))
                return desc.GetString() ?? "Unknown error";
        }
        catch { }
        return "Unknown Telegram API error";
    }
}
