namespace XPost.Infrastructure.Social;

/// <summary>
/// Configuration for Zalo OA OAuth integration.
/// Loaded from appsettings.json section "Zalo".
/// </summary>
public class ZaloSettings
{
    public string AppId { get; set; } = string.Empty;
    public string AppSecret { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = string.Empty;
}
