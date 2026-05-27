using System;

namespace XPost.Application.DTOs;

public class CreateSocialAccountDto
{
    public int Platform { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public string? AccountIdentifier { get; set; }
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
    public string? AvatarUrl { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UpdateSocialAccountDto
{
    public Guid Id { get; set; }
    public int Platform { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public string? AccountIdentifier { get; set; }
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
    public string? AvatarUrl { get; set; }
    public bool IsActive { get; set; } = true;
}
