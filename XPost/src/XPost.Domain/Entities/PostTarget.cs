using XPost.Domain.Common;

namespace XPost.Domain.Entities;

public class PostTarget : BaseEntity
{
    public Guid PostId { get; set; }
    public Guid SocialAccountId { get; set; }
    public int Status { get; set; } = 0;
    public int RetryCount { get; set; } = 0;
    public string? LastError { get; set; }
    public string? PublishedUrl { get; set; }
    public string? PublishedPostId { get; set; }
    public bool IsProcessing { get; set; } = false;
    public DateTime ScheduledTimeUtc { get; set; }
    public DateTime? ProcessedAtUtc { get; set; }

    // Navigation properties
    public Post Post { get; set; } = null!;
    public SocialAccount SocialAccount { get; set; } = null!;
    public ICollection<PostLog> PostLogs { get; set; } = new List<PostLog>();
}
