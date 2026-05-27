using XPost.Domain.Common;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

public class SocialAccount : BaseEntity, IMultiTenant
{
    public Guid? TenantId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public int Platform { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public string? AccountIdentifier { get; set; }
    public string? AvatarUrl { get; set; }
    public string? ApiBaseUrl { get; set; }
    public string? ApiPostEndpoint { get; set; }
    public string? ApiMethod { get; set; }
    public int? AuthType { get; set; }
    public string? ApiKey { get; set; }
    public string? ApiSecret { get; set; }
    public string? AccessToken { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? TokenExpiredAtUtc { get; set; }
    public string? CustomHeadersJson { get; set; }
    public string? FieldMappingJson { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation properties
    public ApplicationUser User { get; set; } = null!;
    public ICollection<PostTarget> PostTargets { get; set; } = new List<PostTarget>();
}
