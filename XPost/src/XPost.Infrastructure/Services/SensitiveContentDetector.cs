using System.Text.RegularExpressions;
using XPost.Application.Interfaces;

namespace XPost.Infrastructure.Services;

public class SensitiveContentDetector : ISensitiveContentDetector
{
    // Vietnamese phone numbers (10-11 digits starting with 0 or +84), allows spaces/dots/dashes
    private static readonly Regex PhoneRegex = new Regex(@"(\+84|0)[\s\.\-]*([0-9][\s\.\-]*){9,10}\b", RegexOptions.Compiled);
    
    // Emails
    private static readonly Regex EmailRegex = new Regex(@"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", RegexOptions.Compiled);
    
    // CCCD / CMND (9 or 12 digits)
    private static readonly Regex CccdRegex = new Regex(@"\b([0-9]{9}|[0-9]{12})\b", RegexOptions.Compiled);

    // URL/Links (matches with or without http/www)
    private static readonly Regex LinkRegex = new Regex(@"\b(?:https?://|www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{2,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public bool ContainsSensitiveContent(string text, out string detectedType)
    {
        detectedType = string.Empty;
        if (string.IsNullOrWhiteSpace(text)) return false;

        if (PhoneRegex.IsMatch(text))
        {
            detectedType = "Phone Number";
            return true;
        }

        if (EmailRegex.IsMatch(text))
        {
            detectedType = "Email";
            return true;
        }

        if (CccdRegex.IsMatch(text))
        {
            detectedType = "CCCD/CMND";
            return true;
        }

        if (LinkRegex.IsMatch(text))
        {
            detectedType = "Đường link (URL)";
            return true;
        }

        return false;
    }

    public string MaskSensitiveContent(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return text;

        var result = text;
        result = PhoneRegex.Replace(result, "[PHONE HIDDEN]");
        result = EmailRegex.Replace(result, "[EMAIL HIDDEN]");
        result = CccdRegex.Replace(result, "[ID HIDDEN]");
        result = LinkRegex.Replace(result, "[LINK HIDDEN]");
        
        return result;
    }
}
