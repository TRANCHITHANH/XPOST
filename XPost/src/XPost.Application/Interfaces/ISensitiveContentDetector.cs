namespace XPost.Application.Interfaces;

public interface ISensitiveContentDetector
{
    bool ContainsSensitiveContent(string text, out string detectedType);
    string MaskSensitiveContent(string text);
}
