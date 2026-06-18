using XPost.Domain.Enums;

namespace XPost.Application.DTOs;

public class KeywordDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public KeywordStatus Status { get; set; }
    public string? GeneratedContent { get; set; }
    public string? LastErrorMessage { get; set; }
    public DateTime? LastGeneratedAtUtc { get; set; }
    public string? Language { get; set; }
    public Guid? LastPostId { get; set; }
    public string? ImageUrl { get; set; }
    public DateTime CreatedAt { get; set; }
}
