using System;

namespace XPost.Application.DTOs;

public class SocialAccountDto
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public int Platform { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public string? AccountIdentifier { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
