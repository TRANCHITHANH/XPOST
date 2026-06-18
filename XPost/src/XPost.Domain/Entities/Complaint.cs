using System;
using XPost.Domain.Common;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

public class Complaint : BaseEntity, IMultiTenant
{
    public Guid? TenantId { get; set; }
    public string PageId { get; set; } = string.Empty;
    public string Psid { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string Content { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
