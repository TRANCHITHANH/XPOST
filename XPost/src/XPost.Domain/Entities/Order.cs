using System;
using XPost.Domain.Common;

namespace XPost.Domain.Entities;

public class Order : BaseEntity
{
    public Guid? TenantId { get; set; }
    public string PageId { get; set; } = string.Empty;
    public string Psid { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string Address { get; set; } = string.Empty;
    public string? SelectedItem { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
