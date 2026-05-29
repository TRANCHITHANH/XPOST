using XPost.Domain.Entities;

namespace XPost.Application.Interfaces;

/// <summary>
/// Standard interface for publishing content to any social platform.
/// Each platform (Facebook, Telegram, etc.) implements this interface.
/// </summary>
public interface ISocialPublisher
{
    /// <summary>
    /// The platform enum value this publisher handles.
    /// </summary>
    int Platform { get; }

    /// <summary>
    /// Publish a post to the social platform using the account's credentials.
    /// </summary>
    Task<PublishResult> PublishAsync(SocialAccount account, Post post, CancellationToken cancellationToken = default);

    /// <summary>
    /// Validates that the account credentials are still valid.
    /// </summary>
    Task<bool> ValidateCredentialsAsync(SocialAccount account, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a published post from the external platform programmatically.
    /// </summary>
    Task<bool> DeletePublishedPostAsync(SocialAccount account, string publishedPostId, CancellationToken cancellationToken = default) => Task.FromResult(false);
}

/// <summary>
/// Result of a publish operation.
/// </summary>
public class PublishResult
{
    public bool Success { get; set; }
    public string? PublishedUrl { get; set; }
    public string? PublishedPostId { get; set; }
    public string? ErrorMessage { get; set; }

    public static PublishResult Ok(string publishedUrl, string? publishedPostId = null) => new()
    {
        Success = true,
        PublishedUrl = publishedUrl,
        PublishedPostId = publishedPostId
    };

    public static PublishResult Fail(string error) => new()
    {
        Success = false,
        ErrorMessage = error
    };
}
