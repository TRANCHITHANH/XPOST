namespace XPost.Application.Interfaces;

/// <summary>
/// Represents a quick-action button in the Messenger persistent menu.
/// </summary>
/// <param name="Icon">Emoji icon displayed in the XPost UI (cosmetic only).</param>
/// <param name="Title">Button label shown to users (max 20 chars).</param>
/// <param name="Payload">Phone number (e.g. +84901234567), URL, or postback payload string.</param>
/// <param name="Type">Action type: "phone_number", "web_url", or "postback" (default).</param>
public record ChatbotButtonDto(string Icon, string Title, string Payload, string Type = "postback");

public record ChatbotUrlButtonInfo(string Title, string Url);

/// <summary>
/// Abstracts communication with the Meta Messenger Send API (Graph API v21.0+).
/// </summary>
public interface IMessengerService
{
    /// <summary>
    /// Sends one or more text messages to the given recipient.
    /// Automatically splits messages longer than 2 000 characters and adds
    /// a 300 ms delay between each chunk to preserve message order.
    /// </summary>
    Task SendTextAsync(string pageToken, string recipientId, string text, CancellationToken ct = default);

    /// <summary>
    /// Activates the "typing..." indicator for the recipient.
    /// </summary>
    Task SendTypingAsync(string pageToken, string recipientId, CancellationToken ct = default);

    /// <summary>
    /// Sends a read receipt ("mark_seen") for the conversation.
    /// </summary>
    Task SendReadReceiptAsync(string pageToken, string recipientId, CancellationToken ct = default);


    /// <summary>
    /// Sends a text message accompanied by quick-reply buttons (max 13, label max 20 chars).
    /// </summary>
    Task SendQuickRepliesAsync(string pageToken, string recipientId, string text, List<string> options, CancellationToken ct = default);

    /// <summary>
    /// Sends a text message with custom quick replies derived from ChatbotButtonDto.
    /// </summary>
    Task SendTextWithQuickRepliesAsync(string pageToken, string recipientId, string text, List<ChatbotButtonDto> buttons, CancellationToken ct = default);

    /// <summary>
    /// Sends a button template message with a single web URL button.
    /// </summary>
    Task SendUrlButtonAsync(string pageToken, string recipientId, string text, string buttonTitle, string url, List<ChatbotButtonDto>? quickReplies = null, CancellationToken ct = default);

    /// <summary>
    /// Sends a button template message with multiple web URL buttons (max 3).
    /// </summary>
    Task SendMultipleUrlButtonsAsync(string pageToken, string recipientId, string text, List<ChatbotUrlButtonInfo> buttons, List<ChatbotButtonDto>? quickReplies = null, CancellationToken ct = default);

    /// <summary>
    /// Sends a button template message with a single phone call button.
    /// </summary>
    Task SendCallButtonAsync(string pageToken, string recipientId, string text, string buttonTitle, string phoneNumber, List<ChatbotButtonDto>? quickReplies = null, CancellationToken ct = default);

    /// <summary>
    /// Fetches the public profile of a user identified by their PSID (first_name, last_name, profile_pic).
    /// </summary>
    Task<MessengerUserProfile?> GetProfileAsync(string pageToken, string psid, CancellationToken ct = default);

    /// <summary>
    /// Synchronizes Ice Breakers to Facebook Messenger Profile.
    /// </summary>
    Task SyncIceBreakersAsync(string pageToken, List<string> questions, CancellationToken ct = default);

    /// <summary>
    /// Synchronizes the Persistent Menu (quick-action buttons) to Facebook Messenger Profile.
    /// Supports phone_number, web_url and postback button types.
    /// Pass an empty list to delete the persistent menu.
    /// </summary>
    Task SyncPersistentMenuAsync(string pageToken, List<ChatbotButtonDto> buttons, CancellationToken ct = default);
}

public record MessengerUserProfile(string FirstName, string LastName, string? ProfilePic);
