using XPost.Domain.Common;

namespace XPost.Domain.Entities;

public class PostLog : BaseEntity
{
    public Guid PostTargetId { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ResponseMessage { get; set; }
    public string? ErrorMessage { get; set; }
    public int RetryCount { get; set; } = 0;

    // Navigation properties
    public PostTarget PostTarget { get; set; } = null!;
}
