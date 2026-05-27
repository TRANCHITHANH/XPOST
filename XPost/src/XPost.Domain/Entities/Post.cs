using XPost.Domain.Common;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

public class Post : BaseEntity, IMultiTenant
{
    public Guid? TenantId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public int? Ref_ID { get; set; } = 0;
    public int PostType { get; set; } = 0;
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Content { get; set; }
    public string? MetaTitle { get; set; }
    public string? MetaDescription { get; set; }
    public string? MetaKeywords { get; set; }
    public Guid? CategoryId { get; set; }
    public string? Tags { get; set; }
    public string? FeaturedImageUrl { get; set; }
    public string? FeaturedImageAlt { get; set; }
    public string? MediaJson { get; set; }
    public DateTime? DisplayStartUtc { get; set; }
    public DateTime? DisplayEndUtc { get; set; }
    public bool IsFeatured { get; set; } = false;
    public bool IsPinned { get; set; } = false;
    public bool AllowComment { get; set; } = true;
    public int Status { get; set; }
    public int ViewCount { get; set; } = 0;
    public int ShareCount { get; set; } = 0;
    public string? Str1 { get; set; }
    public string? Str2 { get; set; }
    public string? Str3 { get; set; }
    public int? Int1 { get; set; }
    public int? Int2 { get; set; }
    public decimal? Decimal1 { get; set; }
    public DateTime? PublishedAtUtc { get; set; }
    public string? CreatedBy { get; set; }
    public string? UpdatedBy { get; set; }

    // Navigation properties
    public ApplicationUser User { get; set; } = null!;
    public Category? Category { get; set; }
    public ICollection<PostProduct> PostProducts { get; set; } = new List<PostProduct>();
    public ICollection<PostMedia> PostMedias { get; set; } = new List<PostMedia>();
    public ICollection<PostTag> PostTags { get; set; } = new List<PostTag>();
    public ICollection<PostTarget> PostTargets { get; set; } = new List<PostTarget>();
}
