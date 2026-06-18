namespace XPost.Application.Models;

public class IceBreakerConfig
{
    public string Question { get; set; } = string.Empty;
    public string? ReplyText { get; set; }
    public string? ButtonName { get; set; }
    public string? ButtonUrl { get; set; }
}
