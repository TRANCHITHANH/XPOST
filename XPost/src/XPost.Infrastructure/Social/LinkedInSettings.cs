namespace XPost.Infrastructure.Social;

/// <summary>
/// Configuration for LinkedIn OAuth integration.
/// Loaded from appsettings.json section "LinkedIn".
/// </summary>
public class LinkedInSettings
{
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = string.Empty;
}
