using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using XPost.Application.Interfaces;

namespace XPost.Infrastructure.Services;

public class GeminiService : IAIService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private readonly string _model;

    public GeminiService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _apiKey = configuration["Gemini:ApiKey"] ?? string.Empty;
        _model = configuration["Gemini:Model"] ?? "gemini-1.5-flash";
    }

    public async Task<string> GenerateContentAsync(string keyword, string promptTemplate, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(_apiKey))
        {
            throw new Exception("Gemini API Key is not configured.");
        }

        var prompt = promptTemplate.Replace("{keyword}", keyword);

        var requestBody = new
        {
            contents = new[]
            {
                new
                {
                    parts = new[]
                    {
                        new { text = prompt }
                    }
                }
            }
        };

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{_model}:generateContent?key={_apiKey}";
        
        var response = await _httpClient.PostAsJsonAsync(url, requestBody, ct);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(ct);
            throw new Exception($"Gemini API error: {response.StatusCode} - {error}");
        }

        var result = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
        
        try 
        {
            var content = result.GetProperty("candidates")[0]
                               .GetProperty("content")
                               .GetProperty("parts")[0]
                               .GetProperty("text")
                               .GetString();

            return content ?? string.Empty;
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to parse Gemini response: {ex.Message}. Raw response: {result}");
        }
    }
}
