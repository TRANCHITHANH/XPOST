using XPost.Domain.Common;

namespace XPost.Domain.Entities;

public class PostMedia : BaseEntity
{
    public Guid PostId { get; set; }
    public string MediaType { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public string? Title { get; set; }
    public string? AltText { get; set; }
    public int SortOrder { get; set; } = 0;
    public bool IsMain { get; set; } = false;

    // Navigation properties
    public Post Post { get; set; } = null!;
}
