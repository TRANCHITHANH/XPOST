using System.Net;
using System.Text.RegularExpressions;

namespace XPost.Infrastructure.Social;

public static class HtmlContentHelper
{
    public static string ConvertToPlainText(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
            return string.Empty;

        var text = html;
        text = text.Replace("\r\n", "\n").Replace("\r", "\n");
        text = Regex.Replace(text, @"<br\s*/?>", "\n", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"</(?:p|div|h[1-6]|li|blockquote)>\s*<(?:p|div|h[1-6]|li|blockquote)[^>]*>", "\n\n", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"</(?:p|div|h[1-6]|li|blockquote|tr)>", "\n", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"<li[^>]*>", "• ", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"<[^>]+>", string.Empty);
        text = WebUtility.HtmlDecode(text);
        text = Regex.Replace(text, @"\n{3,}", "\n\n");
        return text.Trim();
    }

    public static string ConvertToMarkdown(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
            return string.Empty;

        var text = html;

        // 1. Convert <img> tags to Markdown ![image](url)
        text = Regex.Replace(text, @"<img[^>]+src=[""']([^""']+)[""'][^>]*>", "![image]($1)", RegexOptions.IgnoreCase);

        // 2. Convert standard HTML
        return ConvertToPlainText(text);
    }
}
