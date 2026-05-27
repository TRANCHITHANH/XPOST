namespace XPost.Application.DTOs;

public class CreatePostDto
{
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? Slug { get; set; }
    public string? Description { get; set; }
    public string? MetaTitle { get; set; }
    public string? MetaDescription { get; set; }
    public string? MetaKeywords { get; set; }
    public string? FeaturedImageAlt { get; set; }
    public string? Tags { get; set; }
    public string? FeaturedImageUrl { get; set; }
    public DateTime? DisplayStartUtc { get; set; }
    public DateTime? DisplayEndUtc { get; set; }
    public Guid? CategoryId { get; set; }
    public int PostType { get; set; }
    public int Status { get; set; }
    public int? Ref_ID { get; set; }
    public string? MediaJson { get; set; }
    public bool IsFeatured { get; set; } = false;
    public bool IsPinned { get; set; } = false;
    public bool AllowComment { get; set; } = true;
    public List<PostTargetDto> Targets { get; set; } = new();
}
