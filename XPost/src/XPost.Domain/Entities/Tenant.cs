using XPost.Domain.Common;

namespace XPost.Domain.Entities;

public class Tenant : BaseEntity
{
    // Basic Info
    public string Name { get; set; } = string.Empty; // Tên công ty
    public string? Description { get; set; }
    public string? LogoUrl { get; set; } // Avatar / Logo công ty
    public string? Domain { get; set; } // Website / Domain
    
    // Legal & Contact Info
    public string? TaxCode { get; set; } // Mã số thuế
    public string? Representative { get; set; } // Người đại diện pháp luật
    public string? Email { get; set; } // Email liên hệ chính
    public string? PhoneNumber { get; set; } // SĐT liên hệ chính
    
    // Location
    public string? Address { get; set; } // Địa chỉ trụ sở
    public string? PostCode { get; set; } // Mã bưu điện
    
    // System fields
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; } = false;
    public string? CreatedBy { get; set; }
    public string? LastModifiedBy { get; set; }

    // Navigation properties
    public ICollection<ApplicationUser> Users { get; set; } = new List<ApplicationUser>();
    public ICollection<Category> Categories { get; set; } = new List<Category>();
    public ICollection<Post> Posts { get; set; } = new List<Post>();
    public ICollection<SocialAccount> SocialAccounts { get; set; } = new List<SocialAccount>();
}
