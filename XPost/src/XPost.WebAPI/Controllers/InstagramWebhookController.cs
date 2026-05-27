using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using System.Text.Json;
using XPost.WebAPI.Hubs;

namespace XPost.WebAPI.Controllers
{
    [ApiController]
    [Route("api/instagram-webhook")]
    public class InstagramWebhookController : ControllerBase
    {
        private readonly ILogger<InstagramWebhookController> _logger;
        private readonly IHubContext<InstagramHub> _hubContext;
        private const string VerifyToken = "XPostWebhookToken2026"; // In production, move to appsettings.json or environment variables

        public InstagramWebhookController(ILogger<InstagramWebhookController> logger, IHubContext<InstagramHub> hubContext)
        {
            _logger = logger;
            _hubContext = hubContext;
        }

        /// <summary>
        /// GET method for Meta Webhook verification.
        /// </summary>
        [HttpGet]
        public IActionResult VerifyWebhook(
            [FromQuery(Name = "hub.mode")] string mode,
            [FromQuery(Name = "hub.verify_token")] string verifyToken,
            [FromQuery(Name = "hub.challenge")] string challenge)
        {
            if (mode == "subscribe" && verifyToken == VerifyToken)
            {
                _logger.LogInformation("Webhook verified successfully.");
                return Content(challenge, "text/plain");
            }

            _logger.LogWarning("Webhook verification failed.");
            return Forbid();
        }

        /// <summary>
        /// POST method to receive webhook events from Meta.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> ReceiveEvent([FromBody] JsonElement payload)
        {
            try
            {
                // Log the raw payload for debugging purposes
                string rawPayload = JsonSerializer.Serialize(payload);
                _logger.LogInformation("Received Instagram Webhook Payload: {Payload}", rawPayload);

                // Check if the payload is for an Instagram page/account (Meta uses "instagram" or "page" object type)
                if (payload.TryGetProperty("object", out JsonElement objectType) && 
                    (objectType.GetString() == "instagram" || objectType.GetString() == "page"))
                {
                    if (payload.TryGetProperty("entry", out JsonElement entries))
                    {
                        foreach (var entry in entries.EnumerateArray())
                        {
                            if (entry.TryGetProperty("messaging", out JsonElement messagingArray))
                            {
                                foreach (var messaging in messagingArray.EnumerateArray())
                                {
                                    if (messaging.TryGetProperty("message", out JsonElement message))
                                    {
                                        string senderId = messaging.TryGetProperty("sender", out var sender) && sender.TryGetProperty("id", out var sId) ? sId.GetString() ?? "" : "";
                                        string recipientId = messaging.TryGetProperty("recipient", out var recipient) && recipient.TryGetProperty("id", out var rId) ? rId.GetString() ?? "" : "";
                                        string text = message.TryGetProperty("text", out var t) ? t.GetString() ?? "" : "";
                                        string mid = message.TryGetProperty("mid", out var m) ? m.GetString() ?? "" : "";
                                        long timestamp = messaging.TryGetProperty("timestamp", out var ts) ? ts.GetInt64() : 0;
                                        
                                        var parsedMessage = new
                                        {
                                            id = mid,
                                            message = text,
                                            created_time = DateTimeOffset.FromUnixTimeMilliseconds(timestamp).ToString("o"),
                                            from = new { id = senderId, username = "Webhook User" },
                                            to = new { id = recipientId }
                                        };

                                        // Push the parsed message to the connected SignalR clients
                                        await _hubContext.Clients.All.SendAsync("ReceiveInstagramEvent", parsedMessage);
                                    }
                                }
                            }
                        }
                    }
                }
                else
                {
                    _logger.LogWarning("Received unhandled webhook object type: {ObjectType}", objectType.GetString());
                }

                // Return 200 OK to acknowledge receipt of the event
                return Ok("EVENT_RECEIVED");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing Instagram webhook payload.");
                // Still return 200 OK so Meta doesn't keep retrying excessively if it's a structural parsing error we can't handle
                return Ok("ERROR_PROCESSING");
            }
        }
    }
}
