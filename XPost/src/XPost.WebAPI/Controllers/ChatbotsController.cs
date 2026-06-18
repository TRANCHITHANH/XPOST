using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Infrastructure.Persistence;

namespace XPost.WebAPI.Controllers;

[ApiController]
[Route("api/chatbots")]
[Authorize]
public class ChatbotsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<ChatbotsController> _logger;
    private readonly IMessengerService _messengerService;

    public ChatbotsController(ApplicationDbContext db, ILogger<ChatbotsController> logger, IMessengerService messengerService)
    {
        _db = db;
        _logger = logger;
        _messengerService = messengerService;
    }

    // GET api/chatbots
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var tenantIdStr = User.FindFirstValue("TenantId");
        Guid? tenantId = string.IsNullOrEmpty(tenantIdStr) ? null : Guid.Parse(tenantIdStr);
        var list = await _db.Chatbots
            .IgnoreQueryFilters()
            .Where(c => c.TenantId == tenantId)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.MessengerPageId,
                c.MessengerPageToken,
                c.IsActive,
                c.KnowledgeBase,
                c.IceBreakersJson,
                c.PriceListUrl,
                c.MaintenanceUrl,
                c.CreatedAt,
                c.UpdatedAt
            })
            .ToListAsync(ct);

        // Mask token in memory (cannot use C# range indexer in EF expression trees)
        var result = list.Select(c => new
        {
            c.Id,
            c.Name,
            c.MessengerPageId,
            MessengerPageTokenMasked = c.MessengerPageToken != null && c.MessengerPageToken.Length > 8
                ? c.MessengerPageToken[..8] + new string('*', 20)
                : "***",
            c.IsActive,
            c.KnowledgeBase,
            c.IceBreakersJson,
            c.PriceListUrl,
            c.MaintenanceUrl,
            c.CreatedAt,
            c.UpdatedAt
        });

        return Ok(result);
    }

    // GET api/chatbots/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var tenantIdStr = User.FindFirstValue("TenantId");
        Guid? tenantId = string.IsNullOrEmpty(tenantIdStr) ? null : Guid.Parse(tenantIdStr);
        var chatbot = await _db.Chatbots
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId, ct);

        if (chatbot is null) return NotFound();

        return Ok(new
        {
            chatbot.Id,
            chatbot.Name,
            chatbot.MessengerPageId,
            MessengerPageTokenMasked = chatbot.MessengerPageToken != null && chatbot.MessengerPageToken.Length > 8
                ? chatbot.MessengerPageToken[..8] + new string('*', 20)
                : "***",
            chatbot.IsActive,
            chatbot.KnowledgeBase,
            chatbot.IceBreakersJson,
            chatbot.PriceListUrl,
            chatbot.MaintenanceUrl,
            chatbot.MaxTokens,
            chatbot.UsedTokens,
            chatbot.CreatedAt,
            chatbot.UpdatedAt
        });
    }

    // POST api/chatbots
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ChatbotUpsertRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest(new { message = "Tên Chatbot không được để trống." });
        if (string.IsNullOrWhiteSpace(req.MessengerPageId)) return BadRequest(new { message = "MessengerPageId không được để trống." });
        if (string.IsNullOrWhiteSpace(req.MessengerPageToken)) return BadRequest(new { message = "MessengerPageToken không được để trống." });

        var tenantIdStr = User.FindFirstValue("TenantId");
        Guid? tenantId = string.IsNullOrEmpty(tenantIdStr) ? null : Guid.Parse(tenantIdStr);

        // Check duplicate page ID within the same tenant
        var exists = await _db.Chatbots
            .IgnoreQueryFilters()
            .AnyAsync(c => c.TenantId == tenantId && c.MessengerPageId == req.MessengerPageId, ct);

        if (exists) return Conflict(new { message = "Page ID này đã được cấu hình cho một Chatbot khác." });

        var chatbot = new Chatbot
        {
            TenantId = tenantId,
            Name = req.Name.Trim(),
            MessengerPageId = req.MessengerPageId.Trim(),
            MessengerPageToken = req.MessengerPageToken.Trim(),
            KnowledgeBase = req.KnowledgeBase?.Trim(),
            IceBreakersJson = req.IceBreakersJson?.Trim(),
            PriceListUrl = req.PriceListUrl?.Trim(),
            MaintenanceUrl = req.MaintenanceUrl?.Trim(),
            IsActive = true,
            MaxTokens = req.MaxTokens > 0 ? req.MaxTokens : 100000,
            UsedTokens = 0
        };

        _db.Chatbots.Add(chatbot);
        await _db.SaveChangesAsync(ct);

        // Sync Ice Breakers to Facebook
        if (!string.IsNullOrWhiteSpace(chatbot.MessengerPageToken))
        {
            List<string>? questions = null;
            if (!string.IsNullOrWhiteSpace(chatbot.IceBreakersJson))
            {
                try
                {
                    var questionsList = new List<string>();
                    var doc = JsonDocument.Parse(chatbot.IceBreakersJson);
                    if (doc.RootElement.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var el in doc.RootElement.EnumerateArray())
                        {
                            if (el.ValueKind == JsonValueKind.String)
                                questionsList.Add(el.GetString()!);
                            else if (el.ValueKind == JsonValueKind.Object && el.TryGetProperty("question", out var qProp))
                                questionsList.Add(qProp.GetString()!);
                        }
                    }
                    questions = questionsList;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error parsing IceBreakersJson during chatbot creation");
                }
            }
            await _messengerService.SyncIceBreakersAsync(chatbot.MessengerPageToken, questions ?? new List<string>(), ct);

            // Sync Persistent Menu (quick-action buttons) to Facebook
            var buttons = ParseButtons(chatbot.KnowledgeBase, _logger);
            await _messengerService.SyncPersistentMenuAsync(chatbot.MessengerPageToken, buttons, ct);
        }

        _logger.LogInformation("Chatbot {Name} created for Page {PageId} (Tenant {TenantId})", chatbot.Name, chatbot.MessengerPageId, tenantId);

        return CreatedAtAction(nameof(GetById), new { id = chatbot.Id }, new { chatbot.Id, chatbot.Name, chatbot.IceBreakersJson });
    }

    // PUT api/chatbots/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ChatbotUpsertRequest req, CancellationToken ct)
    {
        var tenantIdStr = User.FindFirstValue("TenantId");
        Guid? tenantId = string.IsNullOrEmpty(tenantIdStr) ? null : Guid.Parse(tenantIdStr);
        var chatbot = await _db.Chatbots
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId, ct);

        if (chatbot is null) return NotFound();

        chatbot.Name = req.Name?.Trim() ?? chatbot.Name;
        chatbot.MessengerPageId = req.MessengerPageId?.Trim() ?? chatbot.MessengerPageId;
        chatbot.IsActive = req.IsActive;
        chatbot.KnowledgeBase = req.KnowledgeBase?.Trim();
        chatbot.IceBreakersJson = req.IceBreakersJson?.Trim();
        chatbot.PriceListUrl = req.PriceListUrl?.Trim();
        chatbot.MaintenanceUrl = req.MaintenanceUrl?.Trim();
        chatbot.MaxTokens = req.MaxTokens > 0 ? req.MaxTokens : 100000;
        chatbot.UpdatedAt = DateTime.UtcNow;

        // Only update token if a new non-empty one is provided
        if (!string.IsNullOrWhiteSpace(req.MessengerPageToken))
            chatbot.MessengerPageToken = req.MessengerPageToken.Trim();

        await _db.SaveChangesAsync(ct);

        // Sync Ice Breakers to Facebook
        if (!string.IsNullOrWhiteSpace(chatbot.MessengerPageToken))
        {
            List<string>? questions = null;
            if (!string.IsNullOrWhiteSpace(chatbot.IceBreakersJson))
            {
                try
                {
                    var questionsList = new List<string>();
                    var doc = JsonDocument.Parse(chatbot.IceBreakersJson);
                    if (doc.RootElement.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var el in doc.RootElement.EnumerateArray())
                        {
                            if (el.ValueKind == JsonValueKind.String)
                                questionsList.Add(el.GetString()!);
                            else if (el.ValueKind == JsonValueKind.Object && el.TryGetProperty("question", out var qProp))
                                questionsList.Add(qProp.GetString()!);
                        }
                    }
                    questions = questionsList;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error parsing IceBreakersJson during chatbot update");
                }
            }
            await _messengerService.SyncIceBreakersAsync(chatbot.MessengerPageToken, questions ?? new List<string>(), ct);

            // Sync Persistent Menu (quick-action buttons) to Facebook
            var buttons = ParseButtons(chatbot.KnowledgeBase, _logger);
            await _messengerService.SyncPersistentMenuAsync(chatbot.MessengerPageToken, buttons, ct);
        }

        return Ok(new { message = "Cập nhật thành công." });
    }

    // PATCH api/chatbots/{id}/toggle
    [HttpPatch("{id:guid}/toggle")]
    public async Task<IActionResult> Toggle(Guid id, CancellationToken ct)
    {
        var tenantIdStr = User.FindFirstValue("TenantId");
        Guid? tenantId = string.IsNullOrEmpty(tenantIdStr) ? null : Guid.Parse(tenantIdStr);
        var chatbot = await _db.Chatbots
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId, ct);

        if (chatbot is null) return NotFound();

        chatbot.IsActive = !chatbot.IsActive;
        chatbot.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new { isActive = chatbot.IsActive });
    }

    // DELETE api/chatbots/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var tenantIdStr = User.FindFirstValue("TenantId");
        Guid? tenantId = string.IsNullOrEmpty(tenantIdStr) ? null : Guid.Parse(tenantIdStr);
        var chatbot = await _db.Chatbots
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId, ct);

        if (chatbot is null) return NotFound();

        _db.Chatbots.Remove(chatbot);
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    // GET api/chatbots/{id}/sessions — live chat history
    [HttpGet("{id:guid}/sessions")]
    public async Task<IActionResult> GetSessions(Guid id, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var tenantIdStr = User.FindFirstValue("TenantId");
        Guid? tenantId = string.IsNullOrEmpty(tenantIdStr) ? null : Guid.Parse(tenantIdStr);
        var chatbot = await _db.Chatbots
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId, ct);

        if (chatbot is null) return NotFound();

        var sessions = await _db.ChatbotSessions
            .IgnoreQueryFilters()
            .Where(s => s.ChatbotId == id)
            .OrderByDescending(s => s.LastInteractionAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new
            {
                s.Id,
                s.Psid,
                s.CustomerName,
                s.CustomerAvatarUrl,
                s.LastInteractionAtUtc,
                s.IsActive,
                MessageCount = _db.ChatbotMessages.Count(m => m.SessionId == s.Id)
            })
            .ToListAsync(ct);

        return Ok(sessions);
    }

    // GET api/chatbots/{id}/sessions/{sessionId}/messages
    [HttpGet("{id:guid}/sessions/{sessionId:guid}/messages")]
    public async Task<IActionResult> GetMessages(Guid id, Guid sessionId, CancellationToken ct)
    {
        var tenantIdStr = User.FindFirstValue("TenantId");
        Guid? tenantId = string.IsNullOrEmpty(tenantIdStr) ? null : Guid.Parse(tenantIdStr);

        var messages = await _db.ChatbotMessages
            .IgnoreQueryFilters()
            .Where(m => m.SessionId == sessionId && m.Session.ChatbotId == id && m.TenantId == tenantId)
            .OrderBy(m => m.SentAtUtc)
            .Select(m => new
            {
                m.Id,
                m.Mid,
                m.Text,
                m.IsFromUser,
                m.SentAtUtc,
                m.SenderId,
                m.RecipientId
            })
            .ToListAsync(ct);

        return Ok(messages);
    }

    /// <summary>
    /// Parses the KnowledgeBase JSON string (array of ChatbotButton objects) into a list of ChatbotButtonDto.
    /// </summary>
    private static List<ChatbotButtonDto> ParseButtons(string? knowledgeBaseJson, ILogger logger)
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
            logger.LogError(ex, "Error parsing KnowledgeBase buttons JSON for persistent menu sync");
        }
        return result;
    }
}

public record ChatbotUpsertRequest(
    string? Name,
    string? MessengerPageId,
    string? MessengerPageToken,
    string? KnowledgeBase,
    string? IceBreakersJson,
    string? PriceListUrl,
    string? MaintenanceUrl,
    bool IsActive = true,
    int MaxTokens = 100000
);
