namespace XPost.Application.Interfaces;

public interface IAIService
{
    Task<string> GenerateContentAsync(string keyword, string promptTemplate, CancellationToken ct = default);
}
