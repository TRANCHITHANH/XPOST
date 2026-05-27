using XPost.Domain.Common;
using XPost.Domain.Enums;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

public class Keyword : BaseEntity, IMultiTenant
{
    public Guid? TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public KeywordStatus Status { get; set; } = KeywordStatus.Pending;
    public string? GeneratedContent { get; set; }
    public string? LastErrorMessage { get; set; }
    public DateTime? LastGeneratedAtUtc { get; set; }
    public string? Language { get; set; } = "vi";

    // Related data if needed
    public Guid? LastPostId { get; set; }
    public Post? LastPost { get; set; }
}
