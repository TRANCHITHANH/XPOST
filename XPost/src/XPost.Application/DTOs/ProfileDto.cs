namespace XPost.Application.DTOs;

public class ProfileDto
{
    public string Email { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? PhoneNumber { get; set; }
    public string? CountryCode { get; set; }
    public string? AvatarUrl { get; set; }
}
