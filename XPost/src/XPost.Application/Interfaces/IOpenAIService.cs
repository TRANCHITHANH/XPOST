namespace XPost.Application.Interfaces;

public interface IOpenAIService
{
    Task<string> GenerateContentAsync(string keyword, string promptTemplate, CancellationToken ct = default);
}
