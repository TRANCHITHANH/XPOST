namespace XPost.Application.DTOs;

public class CategoryDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public Guid? ParentId { get; set; }
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public Guid? SocialAccountId { get; set; }
    public string? ExternalId { get; set; }
}
