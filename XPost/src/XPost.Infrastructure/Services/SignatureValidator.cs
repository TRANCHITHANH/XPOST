using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace XPost.Infrastructure.Services;

/// <summary>
/// Validates the X-Hub-Signature-256 header sent by Meta on every Webhook POST.
/// Uses HMAC-SHA256 computed from the raw request body and the configured
/// Facebook AppSecret.  The comparison is performed in constant time
/// (CryptographicOperations.FixedTimeEquals) to prevent timing attacks.
/// </summary>
public class SignatureValidator
{
    private readonly string _appSecret;
    private readonly ILogger<SignatureValidator> _logger;

    public SignatureValidator(IConfiguration configuration, ILogger<SignatureValidator> logger)
    {
        _appSecret = configuration["Facebook:AppSecret"] ?? string.Empty;
        _logger = logger;
    }

    /// <summary>
    /// Returns <c>true</c> when the signature is valid or when no AppSecret is
    /// configured (dev-mode bypass — log a warning).
    /// </summary>
    public bool VerifySignature(byte[] rawBodyBytes, string? signatureHeader)
    {
        if (string.IsNullOrEmpty(_appSecret))
        {
            _logger.LogWarning("Facebook:AppSecret is not configured — skipping signature verification (DEV MODE).");
            return true;
        }

        if (string.IsNullOrEmpty(signatureHeader) || !signatureHeader.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Missing or malformed X-Hub-Signature-256 header.");
            return false;
        }

        // Extract the hex digest after "sha256="
        var receivedHex = signatureHeader["sha256=".Length..];

        // Compute expected HMAC-SHA256 using the raw body and AppSecret
        var secretBytes = Encoding.UTF8.GetBytes(_appSecret);
        var computedHashBytes = HMACSHA256.HashData(secretBytes, rawBodyBytes);
        var computedHex = Convert.ToHexString(computedHashBytes); // upper-case hex

        // Convert received hex to bytes for timing-safe comparison
        byte[] receivedBytes;
        try
        {
            receivedBytes = Convert.FromHexString(receivedHex);
        }
        catch (FormatException)
        {
            _logger.LogWarning("X-Hub-Signature-256 header contains invalid hex string.");
            return false;
        }

        // Constant-time comparison to prevent timing attacks
        var isValid = CryptographicOperations.FixedTimeEquals(computedHashBytes, receivedBytes);

        if (!isValid)
        {
            _logger.LogWarning("X-Hub-Signature-256 verification failed. Possible spoofed request.");
        }

        return isValid;
    }
}
