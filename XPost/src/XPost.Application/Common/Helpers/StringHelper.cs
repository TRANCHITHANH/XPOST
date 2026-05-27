using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace XPost.Application.Common.Helpers;

public static class StringHelper
{
    public static string GenerateSlug(string phrase)
    {
        string MakeValid(string s)
        {
            var valid = new StringBuilder();
            foreach (var c in s)
            {
                if (char.IsLetterOrDigit(c) || c == '-' || c == '_')
                    valid.Append(c);
            }
            return valid.ToString();
        }

        string RemoveDiacritics(string text)
        {
            var normalizedString = text.Normalize(NormalizationForm.FormD);
            var stringBuilder = new StringBuilder();

            foreach (var c in normalizedString)
            {
                var unicodeCategory = CharUnicodeInfo.GetUnicodeCategory(c);
                if (unicodeCategory != UnicodeCategory.NonSpacingMark)
                {
                    stringBuilder.Append(c);
                }
            }

            return stringBuilder.ToString().Normalize(NormalizationForm.FormC);
        }

        string str = RemoveDiacritics(phrase).ToLower();
        
        // invalid chars           
        str = Regex.Replace(str, @"[^a-z0-9\s-]", "");
        
        // convert multiple spaces into one space   
        str = Regex.Replace(str, @"\s+", " ").Trim();
        
        // cut and trim 
        str = str.Substring(0, str.Length <= 45 ? str.Length : 45).Trim();
        str = Regex.Replace(str, @"\s", "-"); // hyphens   
        
        return str;
    }

    public static string GenerateRandomPassword(int length = 12)
    {
        const string validChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890!@#$%^&*";
        StringBuilder res = new StringBuilder();
        Random rnd = new Random();
        while (0 < length--)
        {
            res.Append(validChars[rnd.Next(validChars.Length)]);
        }
        return res.ToString();
    }
}
