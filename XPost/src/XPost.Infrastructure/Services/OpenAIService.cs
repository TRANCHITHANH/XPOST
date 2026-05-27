using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using XPost.Application.Interfaces;

namespace XPost.Infrastructure.Services;

public class OpenAIService : IAIService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private readonly string _model;

    public OpenAIService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _apiKey = configuration["OpenAI:ApiKey"] ?? string.Empty;
        _model = configuration["OpenAI:Model"] ?? "gpt-3.5-turbo";

        if (!string.IsNullOrEmpty(_apiKey))
        {
            _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {_apiKey}");
        }
    }

    public async Task<string> GenerateContentAsync(string keyword, string promptTemplate, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(_apiKey))
        {
            throw new Exception("OpenAI API Key is not configured.");
        }

        var prompt = promptTemplate.Replace("{keyword}", keyword);

        var requestBody = new
        {
            model = _model,
            messages = new[]
            {
                new { role = "system", content = "You are a helpful social media content creator." },
                new { role = "user", content = prompt }
            },
            temperature = 0.7
        };

        var response = await _httpClient.PostAsJsonAsync("https://api.openai.com/v1/chat/completions", requestBody, ct);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(ct);
            throw new Exception($"OpenAI API error: {response.StatusCode} - {error}");
        }

        var result = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
        var content = result.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();

        return content ?? string.Empty;
    }
}
