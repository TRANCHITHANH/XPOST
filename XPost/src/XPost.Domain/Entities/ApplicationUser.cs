using Microsoft.AspNetCore.Identity;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

public class ApplicationUser : IdentityUser, IMultiTenant
{
    public string? FullName { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? CountryCode { get; set; }
    public string? AvatarUrl { get; set; }
    public Guid? TenantId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }

    // Navigation properties
    public ICollection<Post> Posts { get; set; } = new List<Post>();
    public ICollection<SocialAccount> SocialAccounts { get; set; } = new List<SocialAccount>();
}
