using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Text;
using System.Text.Json;
using XPost.Application.Interfaces;
using XPost.Application.Models;
using XPost.Domain.Entities;
using XPost.Infrastructure.Persistence;
using XPost.Infrastructure.Services;
using XPost.WebAPI.Hubs;

namespace XPost.WebAPI.Controllers;

/// <summary>
/// Facebook Messenger Webhook Controller.
/// GET  api/messenger/webhook  — Meta verification handshake.
/// POST api/messenger/webhook  — Receives events from Meta, validates HMAC-SHA256
///                               signature, and processes messages asynchronously.
/// </summary>
[ApiController]
[Route("api/messenger/webhook")]
public class MessengerController : ControllerBase
{
    private readonly ILogger<MessengerController> _logger;
    private readonly SignatureValidator _signatureValidator;
    private readonly IConfiguration _configuration;
    private readonly IServiceScopeFactory _scopeFactory;

    public MessengerController(
        ILogger<MessengerController> logger,
        SignatureValidator signatureValidator,
        IConfiguration configuration,
        IServiceScopeFactory scopeFactory)
    {
        _logger = logger;
        _signatureValidator = signatureValidator;
        _configuration = configuration;
        _scopeFactory = scopeFactory;
    }

    // =========================================================================
    // GET — Meta webhook verification handshake
    // =========================================================================

    /// <summary>
    /// Called by Meta when you save the Webhook URL in the App Dashboard.
    /// Responds with hub.challenge when hub.mode == "subscribe" and
    /// hub.verify_token matches the configured value.
    /// </summary>
    [HttpGet]
    public IActionResult VerifyWebhook(
        [FromQuery(Name = "hub.mode")] string? mode,
        [FromQuery(Name = "hub.verify_token")] string? verifyToken,
        [FromQuery(Name = "hub.challenge")] string? challenge)
    {
        var configuredToken = _configuration["Facebook:MessengerVerifyToken"] ?? "XPostMessengerVerifyToken2026";

        if (mode == "subscribe" && verifyToken == configuredToken)
        {
            _logger.LogInformation("Messenger webhook verified successfully.");
            return Content(challenge ?? "", "text/plain");
        }

        _logger.LogWarning("Messenger webhook verification failed. Mode={Mode} Token={Token}", mode, verifyToken);
        return Forbid();
    }

    // =========================================================================
    // POST — Receive events from Meta
    // =========================================================================

    /// <summary>
    /// Receives Messenger events.  We must return 200 within 30 seconds or Meta
    /// will mark the request as failed.  Heavy processing is therefore kicked off
    /// as a fire-and-forget background task so we can acknowledge immediately.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> ReceiveEvent()
    {
        // 1. Read the raw body (Request.EnableBuffering() in Program.cs allows re-reading)
        Request.Body.Position = 0;
        using var reader = new StreamReader(Request.Body, Encoding.UTF8, leaveOpen: true);
        var rawBody = await reader.ReadToEndAsync();
        var rawBodyBytes = Encoding.UTF8.GetBytes(rawBody);

        // 2. Validate HMAC-SHA256 signature
        var signatureHeader = Request.Headers["X-Hub-Signature-256"].FirstOrDefault();
        if (!_signatureValidator.VerifySignature(rawBodyBytes, signatureHeader))
            return Unauthorized("Invalid signature");

        // 3. Deserialize payload
        MessengerWebhookDto? payload;
        try
        {
            payload = JsonSerializer.Deserialize<MessengerWebhookDto>(rawBody,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to deserialize Messenger webhook payload.");
            return Ok("EVENT_RECEIVED"); // still return 200 so Meta doesn't retry
        }

        if (payload is null || payload.Object != "page")
        {
            _logger.LogInformation("Received non-page Messenger payload: {Object}", payload?.Object);
            return Ok("EVENT_RECEIVED");
        }

        // 4. Acknowledge immediately — process in background using a separate DI scope to avoid ObjectDisposedException
        _ = Task.Run(async () =>
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var log = scope.ServiceProvider.GetRequiredService<ILogger<MessengerController>>();
            var ms = scope.ServiceProvider.GetRequiredService<IMessengerService>();
            var hub = scope.ServiceProvider.GetRequiredService<IHubContext<MessengerHub>>();
            var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
            var hcf = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>();

            var processor = new PayloadProcessor(db, log, ms, hub, config, hcf);
            try
            {
                await processor.ProcessPayloadAsync(payload, CancellationToken.None);
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Background processing of Messenger payload failed.");
            }
        });

        return Ok("EVENT_RECEIVED");
    }

    public class SubmitOrderRequest
    {
        public string? PageId { get; set; }
        public string? Psid { get; set; }
        public string? FullName { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Email { get; set; }
        public string? Address { get; set; }
        public string? SelectedItem { get; set; }
    }

    [HttpPost("submit-order")]
    public async Task<IActionResult> SubmitOrder(
        [FromBody] SubmitOrderRequest req,
        [FromServices] ApplicationDbContext db,
        [FromServices] IMessengerService messengerService,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.PageId) || string.IsNullOrWhiteSpace(req.Psid))
            return BadRequest(new { message = "Không tìm thấy PageId hoặc Psid của cuộc trò chuyện." });

        // Chặn trùng lặp (Deduplication) - nếu cùng PageId, Psid và dịch vụ/thiết bị trong vòng 10 giây qua
        var tenSecondsAgo = DateTime.UtcNow.AddSeconds(-10);
        var isDuplicate = await db.Orders
            .IgnoreQueryFilters()
            .AnyAsync(o => o.PageId == req.PageId && 
                           o.Psid == req.Psid && 
                           o.SelectedItem == req.SelectedItem && 
                           o.CreatedAtUtc >= tenSecondsAgo, ct);

        if (isDuplicate)
        {
            Console.WriteLine($"[INFO] Ignoring duplicate order submission from PSID {req.Psid} in the last 10 seconds.");
            return Ok(new { success = true, duplicate = true });
        }

        var chatbot = await db.Chatbots
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.MessengerPageId == req.PageId && c.IsActive, ct);

        if (chatbot == null)
            return NotFound(new { message = "Không tìm thấy chatbot đang hoạt động cho trang này." });

        var pageToken = chatbot.MessengerPageToken;
        if (string.IsNullOrEmpty(pageToken))
            return BadRequest(new { message = "Chatbot chưa được cấu hình Page Token." });

        // Get or create session
        var session = await db.ChatbotSessions
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.ChatbotId == chatbot.Id && s.Psid == req.Psid && s.IsActive, ct);

        if (session == null)
        {
            var profile = await messengerService.GetProfileAsync(pageToken, req.Psid, ct);
            session = new ChatbotSession
            {
                TenantId = chatbot.TenantId,
                ChatbotId = chatbot.Id,
                Psid = req.Psid,
                LastInteractionAtUtc = DateTime.UtcNow,
                IsActive = true,
                CustomerName = !string.IsNullOrWhiteSpace(req.FullName) ? req.FullName.Trim() : (profile is not null ? $"{profile.FirstName} {profile.LastName}".Trim() : "Khách hàng"),
                CustomerAvatarUrl = profile?.ProfilePic
            };
            db.ChatbotSessions.Add(session);
        }
        else
        {
            if (!string.IsNullOrWhiteSpace(req.FullName))
            {
                session.CustomerName = req.FullName.Trim();
            }
        }

        // Construct confirmation message
        var msgText = $"Dạ, em đã nhận được yêu cầu đặt hàng của anh/chị với thông tin sau:\n" +
                      $"- Họ và tên: {req.FullName}\n" +
                      $"- Số điện thoại: {req.PhoneNumber}\n" +
                      $"- Email: {req.Email}\n" +
                      $"- Địa chỉ: {req.Address}\n" +
                      $"- Dịch vụ/Thiết bị: {req.SelectedItem}\n\n" +
                      $"Đơn hàng của anh/chị đang trong quá trình xử lý! Nhân viên tư vấn sẽ liên hệ lại với anh/chị sớm nhất có thể ạ. 🛍️";

        // Log user order to DB
        var userMid = $"ord_in_{DateTime.UtcNow.Ticks}_{Guid.NewGuid():N}";
        db.ChatbotMessages.Add(new ChatbotMessage
        {
            TenantId = chatbot.TenantId,
            SessionId = session.Id,
            Mid = userMid,
            SenderId = req.Psid,
            RecipientId = req.PageId,
            Text = $"[Đặt đơn đang xử lý]\n- Dịch vụ/Thiết bị: {req.SelectedItem}\n- Họ tên: {req.FullName}\n- SĐT: {req.PhoneNumber}\n- Email: {req.Email}\n- Địa chỉ: {req.Address}",
            IsFromUser = true,
            SentAtUtc = DateTime.UtcNow
        });

        // Save formal order record to Orders table
        db.Orders.Add(new Order
        {
            TenantId = chatbot.TenantId,
            PageId = req.PageId,
            Psid = req.Psid,
            FullName = req.FullName?.Trim() ?? string.Empty,
            PhoneNumber = req.PhoneNumber?.Trim() ?? string.Empty,
            Email = req.Email?.Trim() ?? string.Empty,
            Address = req.Address?.Trim() ?? string.Empty,
            SelectedItem = req.SelectedItem,
            Status = "Pending",
            CreatedAtUtc = DateTime.UtcNow
        });

        // Log bot reply to DB
        var botMid = $"ord_out_{DateTime.UtcNow.Ticks}_{Guid.NewGuid():N}";
        db.ChatbotMessages.Add(new ChatbotMessage
        {
            TenantId = chatbot.TenantId,
            SessionId = session.Id,
            Mid = botMid,
            SenderId = req.PageId,
            RecipientId = req.Psid,
            Text = msgText,
            IsFromUser = false,
            SentAtUtc = DateTime.UtcNow
        });

        session.LastInteractionAtUtc = DateTime.UtcNow;
        session.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        var hubContext = HttpContext.RequestServices.GetRequiredService<IHubContext<MessengerHub>>();

        // Send SignalR events to admin panel
        await hubContext.Clients.All.SendAsync("ReceiveMessengerEvent", new
        {
            chatbotId = chatbot.Id,
            sessionId = session.Id,
            psid = req.Psid,
            customerName = session.CustomerName,
            customerAvatarUrl = session.CustomerAvatarUrl,
            message = $"[Đặt đơn đang xử lý]\n- Dịch vụ/Thiết bị: {req.SelectedItem}\n- Họ tên: {req.FullName}\n- SĐT: {req.PhoneNumber}\n- Email: {req.Email}\n- Địa chỉ: {req.Address}",
            isFromUser = true,
            timestamp = DateTime.UtcNow.ToString("o"),
            tenantId = chatbot.TenantId
        }, ct);

        await hubContext.Clients.All.SendAsync("ReceiveMessengerEvent", new
        {
            chatbotId = chatbot.Id,
            sessionId = session.Id,
            psid = req.Psid,
            customerName = session.CustomerName,
            customerAvatarUrl = session.CustomerAvatarUrl,
            message = msgText,
            isFromUser = false,
            timestamp = DateTime.UtcNow.ToString("o"),
            tenantId = chatbot.TenantId
        }, ct);

        // Send message to Facebook Messenger
        var quickReplies = HelperParseButtons(chatbot.KnowledgeBase, _logger);
        await messengerService.SendTextWithQuickRepliesAsync(pageToken, req.Psid, msgText, quickReplies, ct);

        return Ok(new { success = true });
    }

    public class SubmitComplaintRequest
    {
        public string? PageId { get; set; }
        public string? Psid { get; set; }
        public string? FullName { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Email { get; set; }
        public string? Content { get; set; }
    }

    [HttpPost("submit-complaint")]
    public async Task<IActionResult> SubmitComplaint(
        [FromBody] SubmitComplaintRequest req,
        [FromServices] ApplicationDbContext db,
        [FromServices] IMessengerService messengerService,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.PageId) || string.IsNullOrWhiteSpace(req.Psid))
            return BadRequest(new { message = "Không tìm thấy PageId hoặc Psid của cuộc trò chuyện." });

        // Chặn trùng lặp (Deduplication) - nếu cùng PageId, Psid và nội dung trong vòng 10 giây qua
        var tenSecondsAgo = DateTime.UtcNow.AddSeconds(-10);
        var isDuplicate = await db.Complaints
            .IgnoreQueryFilters()
            .AnyAsync(c => c.PageId == req.PageId && 
                           c.Psid == req.Psid && 
                           c.Content == (req.Content ?? "") && 
                           c.CreatedAtUtc >= tenSecondsAgo, ct);

        if (isDuplicate)
        {
            Console.WriteLine($"[INFO] Ignoring duplicate complaint submission from PSID {req.Psid} in the last 10 seconds.");
            return Ok(new { success = true, duplicate = true });
        }

        var chatbot = await db.Chatbots
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.MessengerPageId == req.PageId && c.IsActive, ct);

        if (chatbot == null)
            return NotFound(new { message = "Không tìm thấy chatbot đang hoạt động cho trang này." });

        // Get or create session
        var session = await db.ChatbotSessions
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.ChatbotId == chatbot.Id && s.Psid == req.Psid && s.IsActive, ct);

        if (session == null)
        {
            var pageToken = chatbot.MessengerPageToken;
            var profile = string.IsNullOrEmpty(pageToken) ? null : await messengerService.GetProfileAsync(pageToken, req.Psid, ct);
            session = new ChatbotSession
            {
                TenantId = chatbot.TenantId,
                ChatbotId = chatbot.Id,
                Psid = req.Psid,
                LastInteractionAtUtc = DateTime.UtcNow,
                IsActive = true,
                CustomerName = !string.IsNullOrWhiteSpace(req.FullName) ? req.FullName.Trim() : (profile is not null ? $"{profile.FirstName} {profile.LastName}".Trim() : "Khách hàng"),
                CustomerAvatarUrl = profile?.ProfilePic
            };
            db.ChatbotSessions.Add(session);
        }
        else
        {
            if (!string.IsNullOrWhiteSpace(req.FullName))
            {
                session.CustomerName = req.FullName.Trim();
            }
        }

        // Save Complaint record to Complaints table
        var complaint = new Complaint
        {
            TenantId = chatbot.TenantId,
            PageId = req.PageId,
            Psid = req.Psid,
            FullName = req.FullName?.Trim() ?? string.Empty,
            PhoneNumber = req.PhoneNumber?.Trim() ?? string.Empty,
            Email = req.Email?.Trim(),
            Content = req.Content?.Trim() ?? string.Empty,
            Status = "Pending",
            CreatedAtUtc = DateTime.UtcNow
        };
        db.Complaints.Add(complaint);

        // Construct reply message
        var msgText = $"Dạ, em đã nhận được yêu cầu khiếu nại của anh/chị với nội dung sau:\n" +
                      $"- Họ và tên: {req.FullName}\n" +
                      $"- Số điện thoại: {req.PhoneNumber}\n" +
                      $"- Nội dung khiếu nại: {req.Content}\n\n" +
                      $"Thông tin khiếu nại đã được ghi nhận. Nhân viên phụ trách của chúng em sẽ kiểm tra và liên hệ lại với anh/chị sớm nhất có thể ạ. 📝";

        // Log bot reply to DB
        var botMid = $"comp_out_{DateTime.UtcNow.Ticks}_{Guid.NewGuid():N}";
        db.ChatbotMessages.Add(new ChatbotMessage
        {
            TenantId = chatbot.TenantId,
            SessionId = session.Id,
            Mid = botMid,
            SenderId = req.PageId,
            RecipientId = req.Psid,
            Text = msgText,
            IsFromUser = false,
            SentAtUtc = DateTime.UtcNow
        });

        session.LastInteractionAtUtc = DateTime.UtcNow;
        session.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        var hubContext = HttpContext.RequestServices.GetRequiredService<IHubContext<MessengerHub>>();

        // Send SignalR events to admin panel
        await hubContext.Clients.All.SendAsync("ReceiveMessengerEvent", new
        {
            chatbotId = chatbot.Id,
            sessionId = session.Id,
            psid = req.Psid,
            customerName = session.CustomerName,
            customerAvatarUrl = session.CustomerAvatarUrl,
            message = $"[Gửi khiếu nại]\n- Họ tên: {req.FullName}\n- SĐT: {req.PhoneNumber}\n- Nội dung: {req.Content}",
            isFromUser = true,
            timestamp = DateTime.UtcNow.ToString("o"),
            tenantId = chatbot.TenantId
        }, ct);

        await hubContext.Clients.All.SendAsync("ReceiveMessengerEvent", new
        {
            chatbotId = chatbot.Id,
            sessionId = session.Id,
            psid = req.Psid,
            customerName = session.CustomerName,
            customerAvatarUrl = session.CustomerAvatarUrl,
            message = msgText,
            isFromUser = false,
            timestamp = DateTime.UtcNow.ToString("o"),
            tenantId = chatbot.TenantId
        }, ct);

        // Send message to Facebook Messenger
        if (!string.IsNullOrEmpty(chatbot.MessengerPageToken))
        {
            var quickReplies = HelperParseButtons(chatbot.KnowledgeBase, _logger);
            await messengerService.SendTextWithQuickRepliesAsync(chatbot.MessengerPageToken, req.Psid, msgText, quickReplies, ct);
        }

        return Ok(new { success = true });
    }


    private static List<ChatbotButtonDto> HelperParseButtons(string? knowledgeBaseJson, ILogger logger)
    {
        var result = new List<ChatbotButtonDto>();
        if (string.IsNullOrWhiteSpace(knowledgeBaseJson)) return result;
        try
        {
            var doc = JsonDocument.Parse(knowledgeBaseJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return result;

            foreach (var el in doc.RootElement.EnumerateArray())
            {
                if (el.ValueKind != JsonValueKind.Object) continue;

                var icon    = el.TryGetProperty("icon",    out var ic) ? ic.GetString() ?? "" : "";
                var title   = el.TryGetProperty("title",   out var ti) ? ti.GetString() ?? "" : "";
                var payload = el.TryGetProperty("payload", out var pa) ? pa.GetString() ?? "" : "";
                var type    = el.TryGetProperty("type",    out var ty) ? ty.GetString() ?? "postback" : "postback";

                if (!string.IsNullOrWhiteSpace(title))
                    result.Add(new ChatbotButtonDto(icon, title, payload, type));
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error parsing KnowledgeBase buttons JSON");
        }
        return result;
    }

    // =========================================================================
    // Private Nested Processor for Thread-Safe Webhook Event Execution
    // =========================================================================
    private class PayloadProcessor
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly ILogger _logger;
        private readonly IMessengerService _messengerService;
        private readonly IHubContext<MessengerHub> _hubContext;
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;

        public PayloadProcessor(
            ApplicationDbContext dbContext,
            ILogger logger,
            IMessengerService messengerService,
            IHubContext<MessengerHub> hubContext,
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory)
        {
            _dbContext = dbContext;
            _logger = logger;
            _messengerService = messengerService;
            _hubContext = hubContext;
            _configuration = configuration;
            _httpClientFactory = httpClientFactory;
        }

        public async Task ProcessPayloadAsync(MessengerWebhookDto payload, CancellationToken ct)
        {
            foreach (var entry in payload.Entry)
            {
                var pageId = entry.Id;

                var chatbot = await _dbContext.Chatbots
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(c => c.MessengerPageId == pageId && c.IsActive, ct);

                if (chatbot is null)
                {
                    _logger.LogWarning("No active Chatbot found for Messenger Page ID: {PageId}", pageId);
                    continue;
                }

                var pageToken = chatbot.MessengerPageToken;
                if (string.IsNullOrEmpty(pageToken))
                {
                    _logger.LogWarning("Chatbot {ChatbotId} has no Messenger page token configured.", chatbot.Id);
                    continue;
                }

                foreach (var msgEvent in entry.Messaging)
                {
                    try
                    {
                        await HandleMessagingEventAsync(chatbot, pageToken, msgEvent, ct);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error handling Messenger event for Chatbot {ChatbotId}.", chatbot.Id);
                    }
                }
            }
        }

        private async Task HandleMessagingEventAsync(
            Chatbot chatbot,
            string pageToken,
            MessengerEventDto msgEvent,
            CancellationToken ct)
        {
            var senderPsid = msgEvent.Sender?.Id;
            var recipientId = msgEvent.Recipient?.Id;

            if (string.IsNullOrEmpty(senderPsid)) return;
            if (msgEvent.Message?.IsEcho == true) return;

            if (msgEvent.Postback is { } postback)
            {
                await HandlePostbackAsync(chatbot, pageToken, senderPsid, recipientId ?? chatbot.MessengerPageId ?? "", postback, msgEvent.Timestamp, ct);
                return;
            }

            if (msgEvent.Message is { } msg)
            {
                var mid = msg.Mid;
                var text = msg.Text;

                // Nếu click vào nút phản hồi nhanh (Quick Reply)
                if (msg.QuickReply != null && !string.IsNullOrEmpty(msg.QuickReply.Payload))
                {
                    var postbackDto = new MessengerPostbackDto
                    {
                        Title = text ?? "",
                        Payload = msg.QuickReply.Payload
                    };
                    await HandlePostbackAsync(chatbot, pageToken, senderPsid, recipientId ?? chatbot.MessengerPageId ?? "", postbackDto, msgEvent.Timestamp, ct);
                    return;
                }

                if (string.IsNullOrEmpty(text)) return;

                var timestamp = DateTimeOffset.FromUnixTimeMilliseconds(msgEvent.Timestamp).UtcDateTime;
                await ProcessUserMessageAsync(chatbot, pageToken, senderPsid, recipientId ?? chatbot.MessengerPageId ?? "", mid, text, timestamp, ct);
            }
        }

        private async Task ProcessUserMessageAsync(
            Chatbot chatbot,
            string pageToken,
            string senderPsid,
            string recipientId,
            string mid,
            string text,
            DateTime timestamp,
            CancellationToken ct)
        {
            // 1. Immediately trigger read receipt ("mark_seen") and typing indicator ("typing_on") in parallel
            var markSeenTask = _messengerService.SendReadReceiptAsync(pageToken, senderPsid, ct);
            var typingTask = _messengerService.SendTypingAsync(pageToken, senderPsid, ct);

            // 2. Perform DB check for duplication concurrently
            var alreadyProcessed = await _dbContext.ChatbotMessages
                .IgnoreQueryFilters()
                .AnyAsync(m => m.Mid == mid, ct);

            if (alreadyProcessed)
            {
                _logger.LogDebug("Duplicate Messenger message ignored: {Mid}", mid);
                await Task.WhenAll(markSeenTask, typingTask);
                return;
            }

            var session = await GetOrCreateSessionByPsidAsync(chatbot, pageToken, senderPsid, ct);

            var inboundMsg = new ChatbotMessage
            {
                TenantId = chatbot.TenantId,
                SessionId = session.Id,
                Mid = mid,
                SenderId = senderPsid,
                RecipientId = recipientId,
                Text = text,
                IsFromUser = true,
                SentAtUtc = timestamp
            };
            _dbContext.ChatbotMessages.Add(inboundMsg);

            session.LastInteractionAtUtc = timestamp;
            session.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync(ct);

            await _hubContext.Clients.All.SendAsync("ReceiveMessengerEvent", new
            {
                chatbotId = chatbot.Id,
                sessionId = session.Id,
                psid = senderPsid,
                customerName = session.CustomerName,
                customerAvatarUrl = session.CustomerAvatarUrl,
                message = text,
                isFromUser = true,
                timestamp = timestamp.ToString("o"),
                tenantId = chatbot.TenantId
            }, ct);

            // Make sure the read receipt and typing indicators are fully sent before we call AI
            await Task.WhenAll(markSeenTask, typingTask);

            string aiReply = string.Empty;
            var lowerText = text.ToLowerInvariant();
            bool isHandledByIceBreaker = false;

            if (!string.IsNullOrWhiteSpace(chatbot.IceBreakersJson))
            {
                try
                {
                    var doc = JsonDocument.Parse(chatbot.IceBreakersJson);
                    if (doc.RootElement.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var el in doc.RootElement.EnumerateArray())
                        {
                            if (el.ValueKind == JsonValueKind.Object && el.TryGetProperty("question", out var qProp))
                            {
                                var qText = qProp.GetString() ?? "";
                                var qTextNorm = qText.Normalize(System.Text.NormalizationForm.FormC).ToLowerInvariant();
                                var textNorm = text.Normalize(System.Text.NormalizationForm.FormC).ToLowerInvariant();

                                var cleanQ = new string(qTextNorm.Where(c => !char.IsPunctuation(c) && !char.IsWhiteSpace(c)).ToArray());
                                var cleanT = new string(textNorm.Where(c => !char.IsPunctuation(c) && !char.IsWhiteSpace(c)).ToArray());

                                _logger.LogInformation("IceBreaker Match check: cleanQ='{cleanQ}' cleanT='{cleanT}'?", cleanQ, cleanT);

                                if (cleanQ == cleanT || (!string.IsNullOrEmpty(cleanQ) && cleanT.Contains(cleanQ)))
                                {
                                    _logger.LogInformation("Icebreaker MATCHED!");
                                    var replyText = el.TryGetProperty("replyText", out var rProp) ? rProp.GetString() : null;
                                    var btnName = el.TryGetProperty("buttonName", out var bnProp) ? bnProp.GetString() : null;
                                    var btnUrl = el.TryGetProperty("buttonUrl", out var buProp) ? buProp.GetString() : null;

                                    if (!string.IsNullOrWhiteSpace(btnUrl) && !string.IsNullOrWhiteSpace(btnName))
                                    {
                                        var prompt = $"Khách hàng vừa hỏi về: '{qText}'. Hãy đóng vai nhân viên tư vấn, viết MỘT CÂU DUY NHẤT thật ngắn gọn, thân thiện (có thưa gửi Dạ/Vâng) để mời khách hàng nhấn vào nút '{btnName}' bên dưới để xem chi tiết. Tuyệt đối không trả lời dài dòng.";
                                        aiReply = await GenerateAiReplyAsync(chatbot, session, text, prompt, ct);
                                        var buttons = ParseButtons(chatbot.KnowledgeBase);
                                        await _messengerService.SendUrlButtonAsync(pageToken, senderPsid, aiReply, btnName, btnUrl, buttons, ct);
                                        _logger.LogInformation("Sent URL button response for icebreaker.");
                                    }
                                    else
                                    {
                                        var prompt = string.IsNullOrWhiteSpace(replyText) ? null : $"Đây là thông tin chính thức:\n{replyText}\n\nHãy dựa CHÍNH XÁC vào thông tin trên để trả lời câu hỏi '{qText}'. TUYỆT ĐỐI KHÔNG được bịa đặt hoặc tự sáng tạo thêm thông tin không có trong tài liệu này.";
                                        aiReply = await GenerateAiReplyAsync(chatbot, session, text, prompt, ct);
                                        var buttons = ParseButtons(chatbot.KnowledgeBase);
                                        await _messengerService.SendTextWithQuickRepliesAsync(pageToken, senderPsid, aiReply, buttons, ct);
                                    }
                                    
                                    isHandledByIceBreaker = true;
                                    break;
                                }
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error parsing IceBreakersJson for auto-reply");
                }
            }

            if (!isHandledByIceBreaker)
            {
                aiReply = await GenerateAiReplyAsync(chatbot, session, text, null, ct);
                var buttons = ParseButtons(chatbot.KnowledgeBase);
                await _messengerService.SendTextWithQuickRepliesAsync(pageToken, senderPsid, aiReply, buttons, ct);
            }

            var botMid = $"bot_{Guid.NewGuid():N}";
            _dbContext.ChatbotMessages.Add(new ChatbotMessage
            {
                TenantId = chatbot.TenantId,
                SessionId = session.Id,
                Mid = botMid,
                SenderId = chatbot.MessengerPageId ?? "",
                RecipientId = senderPsid,
                Text = aiReply,
                IsFromUser = false,
                SentAtUtc = DateTime.UtcNow
            });

            await _dbContext.SaveChangesAsync(ct);

            await _hubContext.Clients.All.SendAsync("ReceiveMessengerEvent", new
            {
                chatbotId = chatbot.Id,
                sessionId = session.Id,
                psid = senderPsid,
                customerName = session.CustomerName,
                message = aiReply,
                isFromUser = false,
                timestamp = DateTime.UtcNow.ToString("o"),
                tenantId = chatbot.TenantId
            }, ct);
        }

        private async Task HandlePostbackAsync(
            Chatbot chatbot,
            string pageToken,
            string senderPsid,
            string recipientId,
            MessengerPostbackDto postback,
            long eventTimestamp,
            CancellationToken ct)
        {
            _logger.LogInformation("Messenger Postback: {Payload} from PSID {Psid}", postback.Payload, senderPsid);

            if (postback.Payload == "GET_STARTED")
            {
                var session = await GetOrCreateSessionByPsidAsync(chatbot, pageToken, senderPsid, ct);
                var greeting = "Xin chào! Mình có thể giúp gì cho bạn ạ? 😊";

                // Ghi nhận tin nhắn người dùng click Bắt đầu vào DB
                var midIn = $"pb_in_{eventTimestamp}_{Guid.NewGuid():N}";
                var timestampIn = DateTimeOffset.FromUnixTimeMilliseconds(eventTimestamp).UtcDateTime;
                var inboundMsg = new ChatbotMessage
                {
                    TenantId = chatbot.TenantId,
                    SessionId = session.Id,
                    Mid = midIn,
                    SenderId = senderPsid,
                    RecipientId = recipientId,
                    Text = "Bắt đầu",
                    IsFromUser = true,
                    SentAtUtc = timestampIn
                };
                _dbContext.ChatbotMessages.Add(inboundMsg);

                // Ghi nhận câu chào của Bot vào DB
                var midOut = $"pb_out_{eventTimestamp}_{Guid.NewGuid():N}";
                var outboundMsg = new ChatbotMessage
                {
                    TenantId = chatbot.TenantId,
                    SessionId = session.Id,
                    Mid = midOut,
                    SenderId = chatbot.MessengerPageId ?? "",
                    RecipientId = senderPsid,
                    Text = greeting,
                    IsFromUser = false,
                    SentAtUtc = DateTime.UtcNow
                };
                _dbContext.ChatbotMessages.Add(outboundMsg);

                session.LastInteractionAtUtc = DateTime.UtcNow;
                session.UpdatedAt = DateTime.UtcNow;

                await _dbContext.SaveChangesAsync(ct);

                // Gửi sự kiện SignalR để cập nhật real-time trên admin dashboard
                await _hubContext.Clients.All.SendAsync("ReceiveMessengerEvent", new
                {
                    chatbotId = chatbot.Id,
                    sessionId = session.Id,
                    psid = senderPsid,
                    customerName = session.CustomerName,
                    customerAvatarUrl = session.CustomerAvatarUrl,
                    message = inboundMsg.Text,
                    isFromUser = true,
                    timestamp = timestampIn.ToString("o"),
                    tenantId = chatbot.TenantId
                }, ct);

                await _hubContext.Clients.All.SendAsync("ReceiveMessengerEvent", new
                {
                    chatbotId = chatbot.Id,
                    sessionId = session.Id,
                    psid = senderPsid,
                    customerName = session.CustomerName,
                    message = greeting,
                    isFromUser = false,
                    timestamp = DateTime.UtcNow.ToString("o"),
                    tenantId = chatbot.TenantId
                }, ct);

                // Gửi tin nhắn chào mừng cho khách hàng trên Messenger kèm các nút phản hồi nhanh
                var buttons = ParseButtons(chatbot.KnowledgeBase);
                await _messengerService.SendTextWithQuickRepliesAsync(pageToken, senderPsid, greeting, buttons, ct);
                return;
            }
            else if (!string.IsNullOrEmpty(postback.Payload))
            {
                if (postback.Payload.StartsWith("CALL_PHONE_NUMBER:"))
                {
                    var phoneNumber = postback.Payload.Substring("CALL_PHONE_NUMBER:".Length);
                    var session = await GetOrCreateSessionByPsidAsync(chatbot, pageToken, senderPsid, ct);

                    // Log user click to DB
                    var midIn = $"pb_in_{eventTimestamp}_{Guid.NewGuid():N}";
                    var timestampIn = DateTimeOffset.FromUnixTimeMilliseconds(eventTimestamp).UtcDateTime;
                    var inboundMsg = new ChatbotMessage
                    {
                        TenantId = chatbot.TenantId,
                        SessionId = session.Id,
                        Mid = midIn,
                        SenderId = senderPsid,
                        RecipientId = recipientId,
                        Text = string.IsNullOrWhiteSpace(postback.Title) ? "📞 Gọi" : postback.Title,
                        IsFromUser = true,
                        SentAtUtc = timestampIn
                    };
                    _dbContext.ChatbotMessages.Add(inboundMsg);

                    // Log bot response to DB
                    var botMsgText = $"Nhấn vào nút bên dưới để gọi hotline ({phoneNumber}) nhé! 📞";
                    var midOut = $"pb_out_{eventTimestamp}_{Guid.NewGuid():N}";
                    var outboundMsg = new ChatbotMessage
                    {
                        TenantId = chatbot.TenantId,
                        SessionId = session.Id,
                        Mid = midOut,
                        SenderId = chatbot.MessengerPageId ?? "",
                        RecipientId = senderPsid,
                        Text = botMsgText,
                        IsFromUser = false,
                        SentAtUtc = DateTime.UtcNow
                    };
                    _dbContext.ChatbotMessages.Add(outboundMsg);

                    session.LastInteractionAtUtc = DateTime.UtcNow;
                    session.UpdatedAt = DateTime.UtcNow;

                    await _dbContext.SaveChangesAsync(ct);

                    // Send SignalR events
                    await _hubContext.Clients.All.SendAsync("ReceiveMessengerEvent", new
                    {
                        chatbotId = chatbot.Id,
                        sessionId = session.Id,
                        psid = senderPsid,
                        customerName = session.CustomerName,
                        customerAvatarUrl = session.CustomerAvatarUrl,
                        message = inboundMsg.Text,
                        isFromUser = true,
                        timestamp = timestampIn.ToString("o"),
                        tenantId = chatbot.TenantId
                    }, ct);

                    await _hubContext.Clients.All.SendAsync("ReceiveMessengerEvent", new
                    {
                        chatbotId = chatbot.Id,
                        sessionId = session.Id,
                        psid = senderPsid,
                        customerName = session.CustomerName,
                        message = botMsgText,
                        isFromUser = false,
                        timestamp = DateTime.UtcNow.ToString("o"),
                        tenantId = chatbot.TenantId
                    }, ct);

                    // Send call button
                    var buttons = ParseButtons(chatbot.KnowledgeBase);
                    await _messengerService.SendCallButtonAsync(pageToken, senderPsid, botMsgText, "Gọi ngay", phoneNumber, buttons, ct);
                    return;
                }
                
                if (postback.Payload.StartsWith("SEND_EMAIL:"))
                {
                    var email = postback.Payload.Substring("SEND_EMAIL:".Length);
                    var session = await GetOrCreateSessionByPsidAsync(chatbot, pageToken, senderPsid, ct);

                    // Log user click to DB
                    var midIn = $"pb_in_{eventTimestamp}_{Guid.NewGuid():N}";
                    var timestampIn = DateTimeOffset.FromUnixTimeMilliseconds(eventTimestamp).UtcDateTime;
                    var inboundMsg = new ChatbotMessage
                    {
                        TenantId = chatbot.TenantId,
                        SessionId = session.Id,
                        Mid = midIn,
                        SenderId = senderPsid,
                        RecipientId = recipientId,
                        Text = string.IsNullOrWhiteSpace(postback.Title) ? "✉️ Gửi Email" : postback.Title,
                        IsFromUser = true,
                        SentAtUtc = timestampIn
                    };
                    _dbContext.ChatbotMessages.Add(inboundMsg);

                    // Log bot response to DB
                    var botMsgText = $"Bạn có thể gửi email liên hệ cho chúng tôi qua địa chỉ: {email} ✉️";
                    var midOut = $"pb_out_{eventTimestamp}_{Guid.NewGuid():N}";
                    var outboundMsg = new ChatbotMessage
                    {
                        TenantId = chatbot.TenantId,
                        SessionId = session.Id,
                        Mid = midOut,
                        SenderId = chatbot.MessengerPageId ?? "",
                        RecipientId = senderPsid,
                        Text = botMsgText,
                        IsFromUser = false,
                        SentAtUtc = DateTime.UtcNow
                    };
                    _dbContext.ChatbotMessages.Add(outboundMsg);

                    session.LastInteractionAtUtc = DateTime.UtcNow;
                    session.UpdatedAt = DateTime.UtcNow;

                    await _dbContext.SaveChangesAsync(ct);

                    // Send SignalR events
                    await _hubContext.Clients.All.SendAsync("ReceiveMessengerEvent", new
                    {
                        chatbotId = chatbot.Id,
                        sessionId = session.Id,
                        psid = senderPsid,
                        customerName = session.CustomerName,
                        customerAvatarUrl = session.CustomerAvatarUrl,
                        message = inboundMsg.Text,
                        isFromUser = true,
                        timestamp = timestampIn.ToString("o"),
                        tenantId = chatbot.TenantId
                    }, ct);

                    await _hubContext.Clients.All.SendAsync("ReceiveMessengerEvent", new
                    {
                        chatbotId = chatbot.Id,
                        sessionId = session.Id,
                        psid = senderPsid,
                        customerName = session.CustomerName,
                        message = botMsgText,
                        isFromUser = false,
                        timestamp = DateTime.UtcNow.ToString("o"),
                        tenantId = chatbot.TenantId
                    }, ct);

                    // Send text back
                    var buttons = ParseButtons(chatbot.KnowledgeBase);
                    await _messengerService.SendTextWithQuickRepliesAsync(pageToken, senderPsid, botMsgText, buttons, ct);
                    return;
                }

                if (postback.Payload.StartsWith("VISIT_WEBSITE:"))
                {
                    var url = postback.Payload.Substring("VISIT_WEBSITE:".Length);
                    var session = await GetOrCreateSessionByPsidAsync(chatbot, pageToken, senderPsid, ct);

                    // Determine appropriate intro text based on the button title or URL target
                    var introText = "Dạ, em gửi anh/chị liên kết chi tiết bên dưới nhé! Mời anh/chị nhấn vào nút để xem thông tin ạ. 😊";
                    if (!string.IsNullOrEmpty(postback.Title) && 
                        (postback.Title.Contains("khiếu nại", StringComparison.OrdinalIgnoreCase) || 
                         postback.Title.Contains("khieu nai", StringComparison.OrdinalIgnoreCase)))
                    {
                        introText = "Dạ, anh/chị vui lòng nhấn vào nút bên dưới để điền thông tin khiếu nại giúp em nhé. Hệ thống sẽ tiếp nhận và xử lý ngay ạ! 📝";
                    }
                    else if (!string.IsNullOrEmpty(url) && (url.Contains("forms.gle") || url.Contains("forms") || url.Contains("google.com/forms")))
                    {
                        introText = "Dạ, anh/chị vui lòng nhấn vào nút bên dưới để điền thông tin khiếu nại giúp em nhé. Hệ thống sẽ tiếp nhận và xử lý ngay ạ! 📝";
                    }
                    else if (!string.IsNullOrEmpty(postback.Title) && 
                             (postback.Title.Contains("báo giá", StringComparison.OrdinalIgnoreCase) || 
                              postback.Title.Contains("bao gia", StringComparison.OrdinalIgnoreCase)))
                    {
                        introText = "Dạ, em gửi anh/chị liên kết báo giá chi tiết bên dưới nhé! Mời anh/chị nhấn vào nút để xem thông tin ạ. 😊";
                    }

                    var subButtons = new List<ChatbotUrlButtonInfo>();
                    bool isJson = false;
                    string botMsgText = "";

                    if (url.TrimStart().StartsWith("["))
                    {
                        try
                        {
                            using var doc = JsonDocument.Parse(url);
                            if (doc.RootElement.ValueKind == JsonValueKind.Array)
                            {
                                isJson = true;
                                foreach (var el in doc.RootElement.EnumerateArray())
                                {
                                    var titleProp = el.TryGetProperty("title", out var tProp) ? tProp.GetString() : null;
                                    var urlProp = el.TryGetProperty("url", out var uProp) ? uProp.GetString() : null;
                                    if (!string.IsNullOrWhiteSpace(titleProp) && !string.IsNullOrWhiteSpace(urlProp))
                                    {
                                        var replacedUrl = urlProp.Replace("PAGE_ID", chatbot.MessengerPageId ?? "").Replace("PSID", senderPsid);
                                        subButtons.Add(new ChatbotUrlButtonInfo(titleProp, replacedUrl));
                                    }
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Failed to parse sub-buttons JSON array from: {Url}", url);
                        }
                    }

                    if (!isJson)
                    {
                        // Fallback to comma-separated URLs
                        var urls = url.Split(',').Select(u => u.Trim()).Where(u => !string.IsNullOrEmpty(u)).ToList();
                        if (urls.Count > 1)
                        {
                            for (int i = 0; i < urls.Count; i++)
                            {
                                var replacedUrl = urls[i].Replace("PAGE_ID", chatbot.MessengerPageId ?? "").Replace("PSID", senderPsid);
                                subButtons.Add(new ChatbotUrlButtonInfo($"Liên kết {i + 1}", replacedUrl));
                            }
                        }
                        else if (urls.Count == 1)
                        {
                            var replacedUrl = urls[0].Replace("PAGE_ID", chatbot.MessengerPageId ?? "").Replace("PSID", senderPsid);
                            subButtons.Add(new ChatbotUrlButtonInfo("Xem chi tiết", replacedUrl));
                        }
                    }

                    // Build display/logged text
                    if (subButtons.Count > 1)
                    {
                        var sb = new StringBuilder();
                        sb.AppendLine(introText);
                        foreach (var btn in subButtons)
                        {
                            sb.AppendLine($"- {btn.Title}: {btn.Url}");
                        }
                        botMsgText = sb.ToString();
                    }
                    else if (subButtons.Count == 1)
                    {
                        botMsgText = $"{introText}\n- Link: {subButtons[0].Url}";
                    }
                    else
                    {
                        botMsgText = "Không tìm thấy liên kết hợp lệ.";
                    }

                    // Log user click to DB
                    var midIn = $"pb_in_{eventTimestamp}_{Guid.NewGuid():N}";
                    var timestampIn = DateTimeOffset.FromUnixTimeMilliseconds(eventTimestamp).UtcDateTime;
                    var inboundMsg = new ChatbotMessage
                    {
                        TenantId = chatbot.TenantId,
                        SessionId = session.Id,
                        Mid = midIn,
                        SenderId = senderPsid,
                        RecipientId = recipientId,
                        Text = string.IsNullOrWhiteSpace(postback.Title) ? "🌐 Xem Website" : postback.Title,
                        IsFromUser = true,
                        SentAtUtc = timestampIn
                    };
                    _dbContext.ChatbotMessages.Add(inboundMsg);

                    // Log bot response to DB
                    var midOut = $"pb_out_{eventTimestamp}_{Guid.NewGuid():N}";
                    var outboundMsg = new ChatbotMessage
                    {
                        TenantId = chatbot.TenantId,
                        SessionId = session.Id,
                        Mid = midOut,
                        SenderId = chatbot.MessengerPageId ?? "",
                        RecipientId = senderPsid,
                        Text = botMsgText,
                        IsFromUser = false,
                        SentAtUtc = DateTime.UtcNow
                    };
                    _dbContext.ChatbotMessages.Add(outboundMsg);

                    session.LastInteractionAtUtc = DateTime.UtcNow;
                    session.UpdatedAt = DateTime.UtcNow;

                    await _dbContext.SaveChangesAsync(ct);

                    // Send SignalR events
                    await _hubContext.Clients.All.SendAsync("ReceiveMessengerEvent", new
                    {
                        chatbotId = chatbot.Id,
                        sessionId = session.Id,
                        psid = senderPsid,
                        customerName = session.CustomerName,
                        customerAvatarUrl = session.CustomerAvatarUrl,
                        message = inboundMsg.Text,
                        isFromUser = true,
                        timestamp = timestampIn.ToString("o"),
                        tenantId = chatbot.TenantId
                    }, ct);

                    await _hubContext.Clients.All.SendAsync("ReceiveMessengerEvent", new
                    {
                        chatbotId = chatbot.Id,
                        sessionId = session.Id,
                        psid = senderPsid,
                        customerName = session.CustomerName,
                        message = botMsgText,
                        isFromUser = false,
                        timestamp = DateTime.UtcNow.ToString("o"),
                        tenantId = chatbot.TenantId
                    }, ct);

                    // Send URL Button or text message back
                    var quickReplies = ParseButtons(chatbot.KnowledgeBase);
                    if (subButtons.Count > 1)
                    {
                        // Send up to 3 buttons in a button template (capping at 3 to comply with Facebook Ads limitations)
                        var buttonsToSend = subButtons.Take(3).ToList();
                        await _messengerService.SendMultipleUrlButtonsAsync(pageToken, senderPsid, introText, buttonsToSend, quickReplies, ct);
                    }
                    else if (subButtons.Count == 1)
                    {
                        await _messengerService.SendUrlButtonAsync(pageToken, senderPsid, introText, subButtons[0].Title, subButtons[0].Url, quickReplies, ct);
                    }
                    else
                    {
                        await _messengerService.SendTextWithQuickRepliesAsync(pageToken, senderPsid, botMsgText, quickReplies, ct);
                    }
                    return;
                }

                if (postback.Payload.StartsWith("ORDER_FORM:"))
                {
                    var options = postback.Payload.Substring("ORDER_FORM:".Length);
                    var session = await GetOrCreateSessionByPsidAsync(chatbot, pageToken, senderPsid, ct);
                    
                    var midIn = $"pb_in_{eventTimestamp}_{Guid.NewGuid():N}";
                    var timestampIn = DateTimeOffset.FromUnixTimeMilliseconds(eventTimestamp).UtcDateTime;
                    var inboundMsg = new ChatbotMessage
                    {
                        TenantId = chatbot.TenantId,
                        SessionId = session.Id,
                        Mid = midIn,
                        SenderId = senderPsid,
                        RecipientId = recipientId,
                        Text = string.IsNullOrWhiteSpace(postback.Title) ? "🛒 Đặt hàng" : postback.Title,
                        IsFromUser = true,
                        SentAtUtc = timestampIn
                    };
                    _dbContext.ChatbotMessages.Add(inboundMsg);

                    var botMsgText = "Dạ, anh/chị vui lòng nhấn vào nút bên dưới để điền thông tin đặt hàng nhé! 👇";
                    var midOut = $"pb_out_{eventTimestamp}_{Guid.NewGuid():N}";
                    var outboundMsg = new ChatbotMessage
                    {
                        TenantId = chatbot.TenantId,
                        SessionId = session.Id,
                        Mid = midOut,
                        SenderId = chatbot.MessengerPageId ?? "",
                        RecipientId = senderPsid,
                        Text = botMsgText,
                        IsFromUser = false,
                        SentAtUtc = DateTime.UtcNow
                    };
                    _dbContext.ChatbotMessages.Add(outboundMsg);

                    session.LastInteractionAtUtc = DateTime.UtcNow;
                    session.UpdatedAt = DateTime.UtcNow;

                    await _dbContext.SaveChangesAsync(ct);

                    await _hubContext.Clients.All.SendAsync("ReceiveMessengerEvent", new
                    {
                        chatbotId = chatbot.Id,
                        sessionId = session.Id,
                        psid = senderPsid,
                        customerName = session.CustomerName,
                        customerAvatarUrl = session.CustomerAvatarUrl,
                        message = inboundMsg.Text,
                        isFromUser = true,
                        timestamp = timestampIn.ToString("o"),
                        tenantId = chatbot.TenantId
                    }, ct);

                    await _hubContext.Clients.All.SendAsync("ReceiveMessengerEvent", new
                    {
                        chatbotId = chatbot.Id,
                        sessionId = session.Id,
                        psid = senderPsid,
                        customerName = session.CustomerName,
                        message = botMsgText,
                        isFromUser = false,
                        timestamp = DateTime.UtcNow.ToString("o"),
                        tenantId = chatbot.TenantId
                    }, ct);

                    var frontendUrl = _configuration["AppConfig:FrontendUrl"] ?? "https://post.mangxuyenviet.vn";
                    var orderUrl = $"{frontendUrl.TrimEnd('/')}/order-form?pageId={chatbot.MessengerPageId}&psid={senderPsid}&options={Uri.EscapeDataString(options)}";

                    var quickReplies = ParseButtons(chatbot.KnowledgeBase);
                    await _messengerService.SendUrlButtonAsync(pageToken, senderPsid, botMsgText, "Điền đơn đặt hàng 🛒", orderUrl, quickReplies, ct);
                    return;
                }

                var mid = $"pb_{eventTimestamp}_{Guid.NewGuid():N}";
                var timestamp = DateTimeOffset.FromUnixTimeMilliseconds(eventTimestamp).UtcDateTime;
                await ProcessUserMessageAsync(chatbot, pageToken, senderPsid, recipientId, mid, postback.Payload, timestamp, ct);
            }
        }

        private async Task<ChatbotSession> GetOrCreateSessionByPsidAsync(
            Chatbot chatbot,
            string pageToken,
            string senderPsid,
            CancellationToken ct)
        {
            var cutoff = DateTime.UtcNow.AddHours(-24);

            var session = await _dbContext.ChatbotSessions
                .IgnoreQueryFilters()
                .Where(s => s.ChatbotId == chatbot.Id && s.Psid == senderPsid && s.IsActive)
                .FirstOrDefaultAsync(ct);

            if (session is not null && session.LastInteractionAtUtc < cutoff)
            {
                _logger.LogInformation(
                    "Session {SessionId} for PSID {Psid} has expired (last interaction {Last:O}). Creating new session.",
                    session.Id, senderPsid, session.LastInteractionAtUtc);

                session.IsActive = false;
                session.UpdatedAt = DateTime.UtcNow;
                session = null;
            }

            if (session is null)
            {
                var profile = await _messengerService.GetProfileAsync(pageToken, senderPsid, ct);

                session = new ChatbotSession
                {
                    TenantId = chatbot.TenantId,
                    ChatbotId = chatbot.Id,
                    Psid = senderPsid,
                    LastInteractionAtUtc = DateTime.UtcNow,
                    IsActive = true,
                    CustomerName = profile is not null ? $"{profile.FirstName} {profile.LastName}".Trim() : null,
                    CustomerAvatarUrl = profile?.ProfilePic
                };

                _dbContext.ChatbotSessions.Add(session);
                await _dbContext.SaveChangesAsync(ct);

                _logger.LogInformation("Created new Messenger session {SessionId} for PSID {Psid}.", session.Id, senderPsid);
            }

            return session;
        }

        private async Task<string> GenerateAiReplyAsync(
            Chatbot chatbot,
            ChatbotSession session,
            string userMessage,
            string? customSystemPrompt,
            CancellationToken ct)
        {
            try
            {
                if (chatbot.MaxTokens > 0 && chatbot.UsedTokens >= chatbot.MaxTokens)
                {
                    _logger.LogWarning("Chatbot {Id} has exceeded its token budget ({Used}/{Max}).", chatbot.Id, chatbot.UsedTokens, chatbot.MaxTokens);
                    return "Rất tiếc, hệ thống tư vấn AI hiện tại đã hết hạn mức (Token Budget). Vui lòng liên hệ với quản trị viên fanpage để được hỗ trợ trực tiếp. Xin cảm ơn!";
                }

                var history = await _dbContext.ChatbotMessages
                    .IgnoreQueryFilters()
                    .Where(m => m.SessionId == session.Id)
                    .OrderByDescending(m => m.SentAtUtc)
                    .Take(4) // Reduce from 10 to 4 to aggressively save tokens
                    .OrderBy(m => m.SentAtUtc)
                    .ToListAsync(ct);

                var basePrompt = string.IsNullOrWhiteSpace(customSystemPrompt)
                    ? (string.IsNullOrWhiteSpace(chatbot.KnowledgeBase)
                        ? "Bạn là CSKH. Trả lời ngắn gọn, tự nhiên như người thật."
                        : chatbot.KnowledgeBase)
                    : customSystemPrompt;

                // Optimize prompt length to save tokens
                var systemPrompt = basePrompt + "\n\n" +
                    "[QUY TẮC BẮT BUỘC]\n" +
                    "- Bạn là NV tư vấn (xưng 'em/mình', gọi khách là 'anh/chị/bạn'). Tuyệt đối KHÔNG nhận là AI/Bot.\n" +
                    "- Trả lời cực ngắn gọn, đi thẳng vấn đề. Dùng từ đệm thân thiện (dạ, ạ, nhé).\n" +
                    "- Chat tự nhiên, không viết dài dòng hay chia mục lục.";

                var contextBuilder = new StringBuilder();
                foreach (var msg in history)
                {
                    var role = msg.IsFromUser ? "Khách hàng" : "Tư vấn viên";
                    contextBuilder.AppendLine($"{role}: {msg.Text}");
                }

                var claudeApiKey = _configuration["Claude:ApiKey"] ?? "";
                var claudeModel = _configuration["Claude:Model"] ?? "claude-3-5-sonnet-20241022";
                var openAiApiKey = _configuration["OpenAI:ApiKey"] ?? "";
                var openAiModel = _configuration["OpenAI:Model"] ?? "gpt-3.5-turbo";
                var openAiBaseUrl = _configuration["OpenAI:BaseUrl"] ?? "https://api.openai.com/v1/chat/completions";

                if (string.IsNullOrEmpty(claudeApiKey) && string.IsNullOrEmpty(openAiApiKey))
                {
                    _logger.LogWarning("Neither Claude nor OpenAI API keys are configured. Returning fallback reply.");
                    return "Xin chào! Hiện tại tôi đang bận một chút. Vui lòng liên hệ lại sau ít phút hoặc gọi hotline cho chúng tôi nhé! 😊";
                }

                // Use the pooled HttpClient from IHttpClientFactory for connection reuse
                var httpClient = _httpClientFactory.CreateClient();

                if (!string.IsNullOrEmpty(claudeApiKey))
                {
                    var messages = new List<object>
                    {
                        new { role = "user", content = contextBuilder.Length > 0
                            ? $"Lịch sử:\n{contextBuilder}\n\nTin nhắn mới: {userMessage}"
                            : userMessage }
                    };

                    var requestBody = new
                    {
                        model = claudeModel,
                        max_tokens = 1024,
                        system = systemPrompt,
                        messages
                    };

                    using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages");
                    request.Headers.Add("x-api-key", claudeApiKey);
                    request.Headers.Add("anthropic-version", "2023-06-01");
                    request.Content = System.Net.Http.Json.JsonContent.Create(requestBody);

                    var response = await httpClient.SendAsync(request, ct);

                    if (!response.IsSuccessStatusCode)
                    {
                        var err = await response.Content.ReadAsStringAsync(ct);
                        _logger.LogError("Claude API error: {Status} — {Error}", response.StatusCode, err);
                        return "Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng thử lại sau! 🙏";
                    }

                    var result = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
                    var aiText = result
                        .GetProperty("content")[0]
                        .GetProperty("text")
                        .GetString();

                    if (result.TryGetProperty("usage", out var usageProp) && usageProp.TryGetProperty("input_tokens", out var inTokens) && usageProp.TryGetProperty("output_tokens", out var outTokens))
                    {
                        chatbot.UsedTokens += inTokens.GetInt32() + outTokens.GetInt32();
                        await _dbContext.SaveChangesAsync(ct);
                    }

                    return aiText ?? "Xin lỗi, tôi không hiểu yêu cầu của bạn. Bạn có thể nói lại không? 😊";
                }
                else
                {
                    var messages = new List<object>();
                    messages.Add(new { role = "system", content = systemPrompt });
                    foreach (var msg in history)
                    {
                        messages.Add(new { role = msg.IsFromUser ? "user" : "assistant", content = msg.Text });
                    }
                    messages.Add(new { role = "user", content = userMessage });

                    var requestBody = new
                    {
                        model = openAiModel,
                        messages = messages,
                        max_tokens = 1024
                    };

                    using var request = new HttpRequestMessage(HttpMethod.Post, openAiBaseUrl);
                    request.Headers.Add("Authorization", $"Bearer {openAiApiKey}");
                    request.Content = System.Net.Http.Json.JsonContent.Create(requestBody);

                    var response = await httpClient.SendAsync(request, ct);

                    if (!response.IsSuccessStatusCode)
                    {
                        var err = await response.Content.ReadAsStringAsync(ct);
                        _logger.LogError("OpenAI API error: {Status} — {Error}", response.StatusCode, err);
                        return "Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng thử lại sau! 🙏";
                    }

                    var result = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
                    var aiText = result
                        .GetProperty("choices")[0]
                        .GetProperty("message")
                        .GetProperty("content")
                        .GetString();

                    if (result.TryGetProperty("usage", out var usageProp) && usageProp.TryGetProperty("total_tokens", out var totalTokens))
                    {
                        chatbot.UsedTokens += totalTokens.GetInt32();
                        await _dbContext.SaveChangesAsync(ct);
                    }

                    return aiText ?? "Xin lỗi, tôi không hiểu yêu cầu của bạn. Bạn có thể nói lại không? 😊";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating AI reply for session {SessionId}", session.Id);
                return "Xin lỗi, hệ thống đang gặp sự cố. Vui lòng liên hệ lại sau! 🙏";
            }
        }

        private List<ChatbotButtonDto> ParseButtons(string? knowledgeBaseJson)
        {
            var result = new List<ChatbotButtonDto>();
            if (string.IsNullOrWhiteSpace(knowledgeBaseJson)) return result;
            try
            {
                var doc = JsonDocument.Parse(knowledgeBaseJson);
                if (doc.RootElement.ValueKind != JsonValueKind.Array) return result;

                foreach (var el in doc.RootElement.EnumerateArray())
                {
                    if (el.ValueKind != JsonValueKind.Object) continue;

                    var icon    = el.TryGetProperty("icon",    out var ic) ? ic.GetString() ?? "" : "";
                    var title   = el.TryGetProperty("title",   out var ti) ? ti.GetString() ?? "" : "";
                    var payload = el.TryGetProperty("payload", out var pa) ? pa.GetString() ?? "" : "";
                    var type    = el.TryGetProperty("type",    out var ty) ? ty.GetString() ?? "postback" : "postback";

                    if (!string.IsNullOrWhiteSpace(title))
                        result.Add(new ChatbotButtonDto(icon, title, payload, type));
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error parsing KnowledgeBase buttons JSON for quick replies");
            }
            return result;
        }
    }
}


