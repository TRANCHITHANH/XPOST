using XPost.Domain.Common;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

public class Category : BaseEntity, IMultiTenant
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public Guid? ParentId { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; } = 0;

    // SaaS & Integration fields
    public Guid? TenantId { get; set; }
    public Guid? SocialAccountId { get; set; }
    public string? ExternalId { get; set; }

    // Navigation properties
    public Category? Parent { get; set; }
    public ICollection<Category> Children { get; set; } = new List<Category>();
    public ICollection<Post> Posts { get; set; } = new List<Post>();
}
