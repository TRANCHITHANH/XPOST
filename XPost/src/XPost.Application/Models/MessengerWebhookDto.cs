using System.Text.Json.Serialization;

namespace XPost.Application.Models;

/// <summary>
/// Root-level DTO that Meta sends to the Webhook endpoint.
/// Structure: { "object": "page", "entry": [...] }
/// </summary>
public class MessengerWebhookDto
{
    [JsonPropertyName("object")]
    public string Object { get; set; } = string.Empty;

    [JsonPropertyName("entry")]
    public List<MessengerEntryDto> Entry { get; set; } = new();
}

public class MessengerEntryDto
{
    /// <summary>Facebook Page ID (our Tenant identifier for Messenger).</summary>
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("time")]
    public long Time { get; set; }

    [JsonPropertyName("messaging")]
    public List<MessengerEventDto> Messaging { get; set; } = new();
}

public class MessengerEventDto
{
    [JsonPropertyName("sender")]
    public MessengerParticipantDto? Sender { get; set; }

    [JsonPropertyName("recipient")]
    public MessengerParticipantDto? Recipient { get; set; }

    [JsonPropertyName("timestamp")]
    public long Timestamp { get; set; }

    [JsonPropertyName("message")]
    public MessengerMessageDto? Message { get; set; }

    [JsonPropertyName("postback")]
    public MessengerPostbackDto? Postback { get; set; }
}

public class MessengerParticipantDto
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;
}

public class MessengerMessageDto
{
    /// <summary>Unique Message ID — used for deduplication.</summary>
    [JsonPropertyName("mid")]
    public string Mid { get; set; } = string.Empty;

    [JsonPropertyName("text")]
    public string? Text { get; set; }

    [JsonPropertyName("attachments")]
    public List<MessengerAttachmentDto>? Attachments { get; set; }

    /// <summary>True when the message is an echo of a message sent by the page itself.</summary>
    [JsonPropertyName("is_echo")]
    public bool IsEcho { get; set; }

    [JsonPropertyName("quick_reply")]
    public MessengerQuickReplyDto? QuickReply { get; set; }
}

public class MessengerQuickReplyDto
{
    [JsonPropertyName("payload")]
    public string Payload { get; set; } = string.Empty;
}

public class MessengerAttachmentDto
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("payload")]
    public MessengerAttachmentPayloadDto? Payload { get; set; }
}

public class MessengerAttachmentPayloadDto
{
    [JsonPropertyName("url")]
    public string? Url { get; set; }

    [JsonPropertyName("sticker_id")]
    public long? StickerId { get; set; }
}

public class MessengerPostbackDto
{
    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("payload")]
    public string Payload { get; set; } = string.Empty;
}
