using XPost.Domain.Common;

namespace XPost.Domain.Entities;

public class Tag : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;

    // Navigation properties
    public ICollection<PostTag> PostTags { get; set; } = new List<PostTag>();
}
