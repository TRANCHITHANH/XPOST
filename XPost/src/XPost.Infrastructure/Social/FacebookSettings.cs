namespace XPost.Infrastructure.Social;

/// <summary>
/// Configuration for Facebook OAuth integration.
/// Loaded from appsettings.json section "Facebook".
/// </summary>
public class FacebookSettings
{
    public string AppId { get; set; } = string.Empty;
    public string AppSecret { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = string.Empty;
}
