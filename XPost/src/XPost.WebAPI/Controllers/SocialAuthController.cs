using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using System.Net.Http;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using XPost.Domain.Entities;
using XPost.Domain.Enums;
using XPost.Domain.Interfaces;
using XPost.Infrastructure.Social;
using XPost.Application.DTOs;

namespace XPost.WebAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/social")]
public class SocialAuthController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly FacebookSettings _fbSettings;
    private readonly ZaloSettings _zaloSettings;
    private readonly TwitterSettings _twitterSettings;
    private readonly LinkedInSettings _linkedInSettings;
    private readonly BloggerSettings _bloggerSettings;
    private readonly ThreadsSettings _threadsSettings;
    private readonly TikTokSettings _tiktokSettings;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<SocialAuthController> _logger;
    private readonly IMemoryCache _cache;

    public SocialAuthController(
        IUnitOfWork unitOfWork,
        IOptions<FacebookSettings> fbSettings,
        IOptions<ZaloSettings> zaloSettings,
        IOptions<TwitterSettings> twitterSettings,
        IOptions<LinkedInSettings> linkedInSettings,
        IOptions<BloggerSettings> bloggerSettings,
        IOptions<ThreadsSettings> threadsSettings,
        IOptions<TikTokSettings> tiktokSettings,
        IHttpClientFactory httpClientFactory,
        ILogger<SocialAuthController> logger,
        IMemoryCache cache)
    {
        _unitOfWork = unitOfWork;
        _fbSettings = fbSettings.Value;
        _zaloSettings = zaloSettings.Value;
        _twitterSettings = twitterSettings.Value;
        _linkedInSettings = linkedInSettings.Value;
        _bloggerSettings = bloggerSettings.Value;
        _threadsSettings = threadsSettings.Value;
        _tiktokSettings = tiktokSettings.Value;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _cache = cache;
    }

    // ═══════════════════════════════════════════════════════
    //  FACEBOOK OAUTH
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// Step 1: Returns the Facebook OAuth URL for the frontend to open in a popup.
    /// </summary>
    [HttpGet("auth/facebook")]
    public IActionResult GetFacebookAuthUrl()
    {
        var state = Guid.NewGuid().ToString("N");
        var scopes = "pages_show_list,pages_manage_posts,pages_read_engagement,pages_manage_engagement,pages_read_usercontent,pages_messaging";
        var redirectUri = Uri.EscapeDataString(_fbSettings.RedirectUri);

        var url = $"https://www.facebook.com/v21.0/dialog/oauth"
                + $"?client_id={_fbSettings.AppId}"
                + $"&redirect_uri={redirectUri}"
                + $"&scope={scopes}"
                + $"&state={state}"
                + $"&response_type=code"
                + $"&auth_type=rerequest";

        return Ok(new { url, state });
    }

    /// <summary>
    /// Step 2: Facebook redirects here with ?code=xxx.
    /// Exchange code → user token → list pages → save each page as SocialAccount.
    /// Returns an HTML page that sends result back to opener window and closes itself.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("callback/facebook")]
    public async Task<IActionResult> FacebookCallback([FromQuery] string code, [FromQuery] string? state)
    {
        if (string.IsNullOrEmpty(code))
            return BadRequest(new { message = "Missing authorization code." });

        var client = _httpClientFactory.CreateClient();

        try
        {
            // 1. Exchange code for user access token
            var tokenUrl = $"https://graph.facebook.com/v21.0/oauth/access_token"
                         + $"?client_id={_fbSettings.AppId}"
                         + $"&client_secret={_fbSettings.AppSecret}"
                         + $"&redirect_uri={Uri.EscapeDataString(_fbSettings.RedirectUri)}"
                         + $"&code={code}";

            var tokenResponse = await client.GetStringAsync(tokenUrl);
            var tokenJson = JsonSerializer.Deserialize<JsonElement>(tokenResponse);

            if (!tokenJson.TryGetProperty("access_token", out var userTokenProp))
            {
                _logger.LogWarning("Facebook token exchange failed: {Response}", tokenResponse);
                return ReturnCallbackHtml(false, "Không thể lấy access token từ Facebook.");
            }

            var userAccessToken = userTokenProp.GetString()!;

            // 2. Get list of pages managed by this user
            var pagesUrl = $"https://graph.facebook.com/v21.0/me/accounts?access_token={userAccessToken}&fields=id,name,access_token,picture";
            var pagesResponse = await client.GetStringAsync(pagesUrl);
            var pagesJson = JsonSerializer.Deserialize<JsonElement>(pagesResponse);

            if (!pagesJson.TryGetProperty("data", out var pagesData))
            {
                return ReturnCallbackHtml(false, "Không tìm thấy Fanpage nào. Hãy đảm bảo bạn đã cấp quyền quản lý trang.");
            }

            var pages = new List<object>();
            foreach (var page in pagesData.EnumerateArray())
            {
                var pageId = page.GetProperty("id").GetString();
                var pageName = page.GetProperty("name").GetString();
                var pageToken = page.GetProperty("access_token").GetString();
                var pictureUrl = "";
                if (page.TryGetProperty("picture", out var pic)
                    && pic.TryGetProperty("data", out var picData)
                    && picData.TryGetProperty("url", out var picUrl))
                {
                    pictureUrl = picUrl.GetString() ?? "";
                }

                pages.Add(new
                {
                    pageId,
                    pageName,
                    pageToken,
                    pictureUrl
                });
            }

            // Return HTML that sends page list to opener
            var pagesJsonStr = JsonSerializer.Serialize(pages);
            return ReturnCallbackHtml(true, "OK", pagesJsonStr, "facebook");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Facebook OAuth callback error");
            return ReturnCallbackHtml(false, $"Lỗi: {ex.Message}");
        }
    }

    /// <summary>
    /// Step 3: Frontend sends selected pages to save as SocialAccounts.
    /// </summary>
    [HttpPost("connect/facebook")]
    public async Task<IActionResult> ConnectFacebookPages([FromBody] ConnectFacebookPagesDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var tenantId = User.FindFirstValue("TenantId");
        var repo = _unitOfWork.Repository<SocialAccount>();
        var saved = new List<object>();

        foreach (var page in dto.Pages)
        {
            // Check if already connected
            var existing = await repo.GetAsync(a =>
                a.UserId == userId
                && a.Platform == (int)SocialPlatform.Facebook
                && a.AccountIdentifier == page.PageId);

            if (existing.Any())
            {
                // Update the token instead of creating new
                var existingAccount = existing.First();
                existingAccount.AccessToken = page.PageToken;
                existingAccount.AccountName = page.PageName;
                existingAccount.AvatarUrl = page.PictureUrl;
                existingAccount.TokenExpiredAtUtc = DateTime.UtcNow.AddDays(60); // FB long-lived ≈ 60 days
                existingAccount.UpdatedAt = DateTime.UtcNow;
                await repo.UpdateAsync(existingAccount);

                saved.Add(new { existingAccount.Id, page.PageName, updated = true });
                continue;
            }

            var account = new SocialAccount
            {
                UserId = userId,
                TenantId = string.IsNullOrEmpty(tenantId) ? null : Guid.Parse(tenantId),
                Platform = (int)SocialPlatform.Facebook,
                AccountName = page.PageName,
                AccountIdentifier = page.PageId,
                AvatarUrl = page.PictureUrl,
                AccessToken = page.PageToken,
                AuthType = (int)AuthType.OAuth2,
                TokenExpiredAtUtc = DateTime.UtcNow.AddDays(60),
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            await repo.AddAsync(account);
            saved.Add(new { account.Id, page.PageName, updated = false });
        }

        await _unitOfWork.CompleteAsync();

        _logger.LogInformation("User {UserId} connected {Count} Facebook page(s)", userId, saved.Count);
        return Ok(new { message = $"Đã kết nối {saved.Count} trang Facebook.", accounts = saved });
    }

    // ═══════════════════════════════════════════════════════
    //  INSTAGRAM OAUTH
    // ═══════════════════════════════════════════════════════

    [HttpGet("auth/instagram")]
    public IActionResult GetInstagramAuthUrl()
    {
        var state = Guid.NewGuid().ToString("N");
        // Added business_management and auth_type=rerequest to force fresh permissions
        var scopes = "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management,instagram_manage_messages,instagram_manage_comments,pages_manage_metadata";
        var redirectUri = Uri.EscapeDataString(_fbSettings.RedirectUri.Replace("callback/facebook", "callback/instagram"));

        var url = $"https://www.facebook.com/v21.0/dialog/oauth"
                + $"?client_id={_fbSettings.AppId}"
                + $"&redirect_uri={redirectUri}"
                + $"&scope={scopes}"
                + $"&state={state}"
                + $"&response_type=code"
                + $"&auth_type=rerequest"; // Force re-ask for permissions

        return Ok(new { url, state });
    }

    [AllowAnonymous]
    [HttpGet("callback/instagram")]
    public async Task<IActionResult> InstagramCallback([FromQuery] string? code, [FromQuery] string? state, [FromQuery] string? error, [FromQuery] string? error_description)
    {
        _logger.LogInformation("Instagram Callback received. Full Query: {Query}", Request.QueryString.Value);

        if (!string.IsNullOrEmpty(error))
        {
            _logger.LogWarning("Instagram auth error: {Error} - {Desc}", error, error_description);
            return ReturnCallbackHtml(false, $"Lỗi từ Facebook: {error_description ?? error}", null, "instagram");
        }

        if (string.IsNullOrEmpty(code))
            return ReturnCallbackHtml(false, "Không nhận được mã xác thực (code) từ Facebook.", null, "instagram");

        var client = _httpClientFactory.CreateClient();

        try
        {
            // 1. Exchange code for user access token
            var redirectUri = _fbSettings.RedirectUri.Replace("callback/facebook", "callback/instagram");
            var tokenUrl = $"https://graph.facebook.com/v21.0/oauth/access_token"
                         + $"?client_id={_fbSettings.AppId}"
                         + $"&client_secret={_fbSettings.AppSecret}"
                         + $"&redirect_uri={Uri.EscapeDataString(redirectUri)}"
                         + $"&code={code}";

            var tokenResponse = await client.GetAsync(tokenUrl);
            var tokenJson = await tokenResponse.Content.ReadAsStringAsync();

            if (!tokenResponse.IsSuccessStatusCode)
            {
                _logger.LogWarning("Instagram token exchange failed: {Response}", tokenJson);
                return ReturnCallbackHtml(false, "Không thể lấy access token từ Facebook.", null, "instagram");
            }

            var tokenData = JsonSerializer.Deserialize<JsonElement>(tokenJson);
            var userAccessToken = tokenData.GetProperty("access_token").GetString()!;

            // 2. Get pages FIRST with their Page Tokens
            var pagesUrl = $"https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token={userAccessToken}";
            var pagesResponse = await client.GetAsync(pagesUrl);
            var pagesJson = await pagesResponse.Content.ReadAsStringAsync();
            _logger.LogInformation("RAW PAGES DATA: {Json}", pagesJson);

            if (!pagesResponse.IsSuccessStatusCode)
            {
                return ReturnCallbackHtml(false, "Không thể lấy danh sách Facebook Pages.", null, "instagram");
            }

            var pagesData = JsonSerializer.Deserialize<JsonElement>(pagesJson);
            var foundAccounts = new List<object>();

            foreach (var page in pagesData.GetProperty("data").EnumerateArray())
            {
                var pageId = page.GetProperty("id").GetString()!;
                var pageToken = page.GetProperty("access_token").GetString()!;
                var pageName = page.GetProperty("name").GetString()!;

                _logger.LogInformation("DEBUG PAGE: Found Page '{Name}' ({Id})", pageName, pageId);
                
                // 3. Query EACH Page for linked Instagram account using PAGE TOKEN
                var igUrl = $"https://graph.facebook.com/v21.0/{pageId}?fields=instagram_business_account{{id,username,profile_picture_url}}&access_token={pageToken}";
                var igResponse = await client.GetAsync(igUrl);
                var igJson = await igResponse.Content.ReadAsStringAsync();
                
                _logger.LogInformation("DEBUG IG RESPONSE for Page '{Name}': {Response}", pageName, igJson);

                if (igResponse.IsSuccessStatusCode)
                {
                    var igData = JsonSerializer.Deserialize<JsonElement>(igJson);
                    if (igData.TryGetProperty("instagram_business_account", out var igAccount))
                    {
                        var igId = igAccount.GetProperty("id").GetString()!;
                        var username = igAccount.GetProperty("username").GetString()!;
                        var pictureUrl = igAccount.TryGetProperty("profile_picture_url", out var p) ? p.GetString() : null;

                        foundAccounts.Add(new {
                            InstagramId = igId,
                            Username = username,
                            PictureUrl = pictureUrl,
                            AccessToken = pageToken // Important: Use Page Token for publishing to IG linked to it
                        });
                    }
                }
            }

            if (foundAccounts.Count == 0)
            {
                return ReturnCallbackHtml(false, "Không tìm thấy tài khoản Instagram Business nào liên kết với các Page của bạn.", null, "instagram");
            }

            // For simplicity, we show the list to let user choose (handled by frontend if needed)
            // But usually we just connect the first one or all.
            // Let's pass the first account found to the frontend "Save" step.
            var first = (dynamic)foundAccounts[0];
            var resultData = JsonSerializer.Serialize(new { 
                id = first.InstagramId, 
                name = first.Username, 
                avatar = first.PictureUrl,
                token = first.AccessToken
            });

            return ReturnCallbackHtml(true, $"Tìm thấy {foundAccounts.Count} tài khoản Instagram!", resultData, "instagram");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in Instagram callback");
            return ReturnCallbackHtml(false, $"Lỗi hệ thống: {ex.Message}", null, "instagram");
        }
    }

    [HttpPost("connect/instagram")]
    public async Task<IActionResult> ConnectInstagram([FromBody] CreateSocialAccountDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var tenantId = User.FindFirstValue("TenantId");
        var repo = _unitOfWork.Repository<SocialAccount>();

        var existing = await repo.GetAsync(a => a.UserId == userId && a.Platform == (int)SocialPlatform.Instagram && a.AccountIdentifier == dto.AccountIdentifier);
        if (existing.Any())
        {
            var acc = existing.First();
            acc.AccessToken = dto.AccessToken;
            acc.AccountName = dto.AccountName;
            acc.AvatarUrl = dto.AvatarUrl;
            acc.TokenExpiredAtUtc = DateTime.UtcNow.AddDays(60);
            acc.UpdatedAt = DateTime.UtcNow;
            await repo.UpdateAsync(acc);
        }
        else
        {
            var account = new SocialAccount
            {
                UserId = userId,
                TenantId = string.IsNullOrEmpty(tenantId) ? null : Guid.Parse(tenantId),
                Platform = (int)SocialPlatform.Instagram,
                AccountName = dto.AccountName,
                AccountIdentifier = dto.AccountIdentifier,
                AvatarUrl = dto.AvatarUrl,
                AccessToken = dto.AccessToken,
                AuthType = (int)AuthType.OAuth2,
                TokenExpiredAtUtc = DateTime.UtcNow.AddDays(60),
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            await repo.AddAsync(account);
        }

        await _unitOfWork.CompleteAsync();
        return Ok(new { message = "Kết nối Instagram thành công!" });
    }

    // ═══════════════════════════════════════════════════════
    //  TELEGRAM BOT
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// Connect a Telegram Bot by providing Bot Token and Chat ID.
    /// Validates by calling Telegram getMe API.
    /// </summary>
    [HttpPost("connect/telegram")]
    public async Task<IActionResult> ConnectTelegram([FromBody] ConnectTelegramDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        if (string.IsNullOrWhiteSpace(dto.BotToken) || string.IsNullOrWhiteSpace(dto.ChatId))
            return BadRequest(new { message = "Bot Token và Chat ID không được để trống." });

        var client = _httpClientFactory.CreateClient();

        // Validate Bot Token
        try
        {
            var getMeUrl = $"https://api.telegram.org/bot{dto.BotToken}/getMe";
            var response = await client.GetStringAsync(getMeUrl);
            var json = JsonSerializer.Deserialize<JsonElement>(response);

            if (!json.TryGetProperty("ok", out var okProp) || !okProp.GetBoolean())
            {
                return BadRequest(new { message = "Bot Token không hợp lệ." });
            }

            var botName = json.TryGetProperty("result", out var result)
                && result.TryGetProperty("first_name", out var fnProp)
                ? fnProp.GetString() ?? "Telegram Bot"
                : "Telegram Bot";

            var tenantId = User.FindFirstValue("TenantId");
            var repo = _unitOfWork.Repository<SocialAccount>();

            // Check existing
            var existing = await repo.GetAsync(a =>
                a.UserId == userId
                && a.Platform == (int)SocialPlatform.Telegram
                && a.AccountIdentifier == dto.ChatId);

            if (existing.Any())
            {
                var existingAccount = existing.First();
                existingAccount.AccessToken = dto.BotToken;
                existingAccount.AccountName = dto.AccountName ?? botName;
                existingAccount.UpdatedAt = DateTime.UtcNow;
                await repo.UpdateAsync(existingAccount);
                await _unitOfWork.CompleteAsync();

                return Ok(new { message = "Cập nhật kết nối Telegram thành công!", id = existingAccount.Id });
            }

            var account = new SocialAccount
            {
                UserId = userId,
                TenantId = string.IsNullOrEmpty(tenantId) ? null : Guid.Parse(tenantId),
                Platform = (int)SocialPlatform.Telegram,
                AccountName = dto.AccountName ?? botName,
                AccountIdentifier = dto.ChatId,
                AccessToken = dto.BotToken,
                AuthType = (int)AuthType.BearerToken,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            await repo.AddAsync(account);
            await _unitOfWork.CompleteAsync();

            _logger.LogInformation("User {UserId} connected Telegram bot {BotName}", userId, botName);
            return Ok(new { message = "Kết nối Telegram thành công!", id = account.Id });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Telegram connection error");
            return BadRequest(new { message = $"Lỗi kết nối Telegram: {ex.Message}" });
        }
    }

    // ═══════════════════════════════════════════════════════
    //  ZALO OA OAUTH (PKCE)
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// Step 1: Returns the Zalo OAuth URL for the frontend to open in a popup.
    /// Uses PKCE (code_challenge / code_verifier).
    /// </summary>
    [HttpGet("auth/zalo")]
    public IActionResult GetZaloAuthUrl()
    {
        var state = Guid.NewGuid().ToString("N");

        // Generate PKCE code_verifier and code_challenge
        var codeVerifier = GenerateCodeVerifier();
        var codeChallenge = GenerateCodeChallenge(codeVerifier);

        // Store code_verifier in memory cache (keyed by state, TTL 10 min)
        _cache.Set($"zalo_cv_{state}", codeVerifier, TimeSpan.FromMinutes(10));

        var redirectUri = Uri.EscapeDataString(_zaloSettings.RedirectUri);

        var url = $"https://oauth.zaloapp.com/v4/oa/permission"
                + $"?app_id={_zaloSettings.AppId}"
                + $"&redirect_uri={redirectUri}"
                + $"&code_challenge={codeChallenge}"
                + $"&state={state}";

        return Ok(new { url, state });
    }

    /// <summary>
    /// Step 2: Zalo redirects here with ?code=xxx&state=yyy.
    /// Exchange code + code_verifier → access_token → get OA info.
    /// Returns HTML that sends result back to opener window.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("callback/zalo")]
    public async Task<IActionResult> ZaloCallback([FromQuery] string code, [FromQuery] string? state)
    {
        if (string.IsNullOrEmpty(code))
            return BadRequest(new { message = "Missing authorization code." });

        // Retrieve code_verifier from cache
        string? codeVerifier = null;
        if (!string.IsNullOrEmpty(state))
        {
            _cache.TryGetValue($"zalo_cv_{state}", out codeVerifier);
            _cache.Remove($"zalo_cv_{state}");
        }

        if (string.IsNullOrEmpty(codeVerifier))
        {
            _logger.LogWarning("Zalo callback: code_verifier not found for state {State}", state);
            return ReturnCallbackHtml(false, "Phiên xác thực đã hết hạn. Vui lòng thử lại.", null, "zalo");
        }

        var client = _httpClientFactory.CreateClient();

        try
        {
            // 1. Exchange code for access_token
            var tokenUrl = "https://oauth.zaloapp.com/v4/oa/access_token";
            var tokenBody = new Dictionary<string, string>
            {
                ["code"] = code,
                ["app_id"] = _zaloSettings.AppId,
                ["grant_type"] = "authorization_code",
                ["code_verifier"] = codeVerifier
            };

            var tokenRequest = new HttpRequestMessage(HttpMethod.Post, tokenUrl)
            {
                Content = new FormUrlEncodedContent(tokenBody)
            };
            tokenRequest.Headers.Add("secret_key", _zaloSettings.AppSecret);

            var tokenResponse = await client.SendAsync(tokenRequest);
            var tokenJson = await tokenResponse.Content.ReadAsStringAsync();

            _logger.LogInformation("Zalo token exchange response: {Response}", tokenJson);

            var tokenResult = JsonSerializer.Deserialize<JsonElement>(tokenJson);

            if (!tokenResult.TryGetProperty("access_token", out var accessTokenProp))
            {
                var errorMsg = tokenResult.TryGetProperty("error_description", out var errDesc)
                    ? errDesc.GetString() : "Không thể lấy access token.";
                _logger.LogWarning("Zalo token exchange failed: {Response}", tokenJson);
                return ReturnCallbackHtml(false, errorMsg ?? "Lỗi xác thực Zalo.", null, "zalo");
            }

            var accessToken = accessTokenProp.GetString()!;
            var refreshToken = tokenResult.TryGetProperty("refresh_token", out var rtProp)
                ? rtProp.GetString() : null;
            long expiresIn = 86400; // default 24h
            if (tokenResult.TryGetProperty("expires_in", out var expProp))
            {
                if (expProp.ValueKind == JsonValueKind.Number) expiresIn = expProp.GetInt64();
                else if (expProp.ValueKind == JsonValueKind.String && long.TryParse(expProp.GetString(), out var parsed)) expiresIn = parsed;
            }

            // 2. Get OA info
            var oaInfoUrl = "https://openapi.zalo.me/v2.0/oa/getoa";
            var oaRequest = new HttpRequestMessage(HttpMethod.Get, oaInfoUrl);
            oaRequest.Headers.Add("access_token", accessToken);
            
            var oaResponseObj = await client.SendAsync(oaRequest);
            var oaResponse = await oaResponseObj.Content.ReadAsStringAsync();
            var oaResult = JsonSerializer.Deserialize<JsonElement>(oaResponse);

            _logger.LogInformation("Zalo OA info response: {Response}", oaResponse);

            if (oaResult.TryGetProperty("error", out var errProp) && errProp.GetInt32() != 0)
            {
                var errMsg = oaResult.TryGetProperty("message", out var msgProp) ? msgProp.GetString() : "Lỗi lấy thông tin OA";
                _logger.LogWarning("Failed to get OA info: {Message}", errMsg);
                return ReturnCallbackHtml(false, $"Zalo từ chối lấy thông tin: {errMsg}", null, "zalo");
            }

            string oaId = "";
            string oaName = "Zalo OA";
            string avatarUrl = "";

            if (oaResult.TryGetProperty("data", out var oaData))
            {
                if (oaData.TryGetProperty("oa_id", out var oidProp))
                {
                    oaId = oidProp.ValueKind == JsonValueKind.Number 
                        ? oidProp.GetRawText() // Using GetRawText or GetString depending on format 
                        : (oidProp.GetString() ?? "");
                    
                    if (string.IsNullOrEmpty(oaId) && oidProp.ValueKind == JsonValueKind.Number)
                        oaId = oidProp.GetRawText();
                }

                oaName = oaData.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? "Zalo OA" : "Zalo OA";
                avatarUrl = oaData.TryGetProperty("avatar", out var avProp) ? avProp.GetString() ?? "" : "";
            }

            // Return OA info to frontend
            var oaInfo = new[]
            {
                new
                {
                    oaId,
                    oaName,
                    avatarUrl,
                    accessToken,
                    refreshToken,
                    expiresIn
                }
            };

            var oaInfoJson = JsonSerializer.Serialize(oaInfo);
            return ReturnCallbackHtml(true, "OK", oaInfoJson, "zalo");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Zalo OAuth callback error");
            return ReturnCallbackHtml(false, $"Lỗi: {ex.Message}", null, "zalo");
        }
    }

    /// <summary>
    /// Step 3: Frontend sends selected OA to save as SocialAccount.
    /// </summary>
    [HttpPost("connect/zalo")]
    public async Task<IActionResult> ConnectZaloOA([FromBody] ConnectZaloDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        if (string.IsNullOrEmpty(dto.AccessToken))
            return BadRequest(new { message = "Access token không được để trống." });

        var tenantId = User.FindFirstValue("TenantId");
        var repo = _unitOfWork.Repository<SocialAccount>();

        // Check if already connected
        var existing = await repo.GetAsync(a =>
            a.UserId == userId
            && a.Platform == (int)SocialPlatform.Zalo
            && a.AccountIdentifier == dto.OaId);

        if (existing.Any())
        {
            var existingAccount = existing.First();
            existingAccount.AccessToken = dto.AccessToken;
            existingAccount.RefreshToken = dto.RefreshToken;
            existingAccount.AccountName = dto.OaName;
            existingAccount.AvatarUrl = dto.AvatarUrl;
            existingAccount.TokenExpiredAtUtc = DateTime.UtcNow.AddSeconds(dto.ExpiresIn);
            existingAccount.UpdatedAt = DateTime.UtcNow;
            await repo.UpdateAsync(existingAccount);
            await _unitOfWork.CompleteAsync();

            _logger.LogInformation("User {UserId} updated Zalo OA {OaName}", userId, dto.OaName);
            return Ok(new { message = "Cập nhật kết nối Zalo OA thành công!", id = existingAccount.Id, updated = true });
        }

        var account = new SocialAccount
        {
            UserId = userId,
            TenantId = string.IsNullOrEmpty(tenantId) ? null : Guid.Parse(tenantId),
            Platform = (int)SocialPlatform.Zalo,
            AccountName = dto.OaName,
            AccountIdentifier = dto.OaId,
            AvatarUrl = dto.AvatarUrl,
            AccessToken = dto.AccessToken,
            RefreshToken = dto.RefreshToken,
            AuthType = (int)AuthType.OAuth2,
            TokenExpiredAtUtc = DateTime.UtcNow.AddSeconds(dto.ExpiresIn),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        await repo.AddAsync(account);
        await _unitOfWork.CompleteAsync();

        _logger.LogInformation("User {UserId} connected Zalo OA {OaName}", userId, dto.OaName);
        return Ok(new { message = "Kết nối Zalo OA thành công!", id = account.Id, updated = false });
    }
    // ═══════════════════════════════════════════════════════
    //  TWITTER/X OAUTH (PKCE)
    // ═══════════════════════════════════════════════════════

    [HttpGet("auth/twitter")]
    public IActionResult GetTwitterAuthUrl()
    {
        var state = Guid.NewGuid().ToString("N");
        var codeVerifier = GenerateCodeVerifier();
        var codeChallenge = GenerateCodeChallenge(codeVerifier);

        _cache.Set($"twitter_cv_{state}", codeVerifier, TimeSpan.FromMinutes(10));

        var redirectUri = Uri.EscapeDataString(_twitterSettings.RedirectUri);
        var scopes = Uri.EscapeDataString("tweet.read tweet.write users.read offline.access");

        var url = $"https://twitter.com/i/oauth2/authorize"
                + $"?response_type=code"
                + $"&client_id={_twitterSettings.ClientId}"
                + $"&redirect_uri={redirectUri}"
                + $"&scope={scopes}"
                + $"&state={state}"
                + $"&code_challenge={codeChallenge}"
                + $"&code_challenge_method=S256";

        return Ok(new { url, state });
    }

    [AllowAnonymous]
    [HttpGet("callback/twitter")]
    public async Task<IActionResult> TwitterCallback([FromQuery] string code, [FromQuery] string? state, [FromQuery] string? error)
    {
        if (!string.IsNullOrEmpty(error))
            return ReturnCallbackHtml(false, $"Lỗi từ Twitter: {error}", null, "twitter");

        if (string.IsNullOrEmpty(code))
            return BadRequest(new { message = "Missing authorization code." });

        string? codeVerifier = null;
        if (!string.IsNullOrEmpty(state))
        {
            _cache.TryGetValue($"twitter_cv_{state}", out codeVerifier);
            _cache.Remove($"twitter_cv_{state}");
        }

        if (string.IsNullOrEmpty(codeVerifier))
        {
            _logger.LogWarning("Twitter callback: code_verifier not found for state {State}", state);
            return ReturnCallbackHtml(false, "Phiên xác thực đã hết hạn. Vui lòng thử lại.", null, "twitter");
        }

        var client = _httpClientFactory.CreateClient();

        try
        {
            var tokenUrl = "https://api.twitter.com/2/oauth2/token";
            var tokenBody = new Dictionary<string, string>
            {
                ["code"] = code,
                ["grant_type"] = "authorization_code",
                ["client_id"] = _twitterSettings.ClientId,
                ["redirect_uri"] = _twitterSettings.RedirectUri,
                ["code_verifier"] = codeVerifier
            };

            var tokenRequest = new HttpRequestMessage(HttpMethod.Post, tokenUrl)
            {
                Content = new FormUrlEncodedContent(tokenBody)
            };

            // Twitter requires Basic Auth with ClientId:ClientSecret
            var authBytes = Encoding.ASCII.GetBytes($"{_twitterSettings.ClientId}:{_twitterSettings.ClientSecret}");
            tokenRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));

            var tokenResponse = await client.SendAsync(tokenRequest);
            var tokenJson = await tokenResponse.Content.ReadAsStringAsync();

            if (!tokenResponse.IsSuccessStatusCode)
            {
                _logger.LogWarning("Twitter token exchange failed: {Response}", tokenJson);
                return ReturnCallbackHtml(false, "Không thể lấy access token từ Twitter.", null, "twitter");
            }

            var tokenResult = JsonSerializer.Deserialize<JsonElement>(tokenJson);
            var accessToken = tokenResult.GetProperty("access_token").GetString()!;
            var refreshToken = tokenResult.TryGetProperty("refresh_token", out var rtProp) ? rtProp.GetString() : null;
            int expiresIn = 7200;
            if (tokenResult.TryGetProperty("expires_in", out var expProp))
            {
                if (expProp.ValueKind == JsonValueKind.Number) expiresIn = expProp.GetInt32();
                else if (expProp.ValueKind == JsonValueKind.String && int.TryParse(expProp.GetString(), out var parsed)) expiresIn = parsed;
            }

            // Get User Info
            var userRequest = new HttpRequestMessage(HttpMethod.Get, "https://api.twitter.com/2/users/me?user.fields=profile_image_url");
            userRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
            var userResponse = await client.SendAsync(userRequest);
            var userJsonStr = await userResponse.Content.ReadAsStringAsync();

            var userResult = JsonSerializer.Deserialize<JsonElement>(userJsonStr);
            if (!userResult.TryGetProperty("data", out var userData))
            {
                return ReturnCallbackHtml(false, "Không thể lấy thông tin tài khoản Twitter.", null, "twitter");
            }

            var accountId = userData.GetProperty("id").GetString();
            var accountName = userData.GetProperty("name").GetString();
            var avatarUrl = userData.TryGetProperty("profile_image_url", out var avProp) ? avProp.GetString() : "";

            var accountInfo = new[]
            {
                new { accountId, accountName, avatarUrl, accessToken, refreshToken, expiresIn }
            };

            return ReturnCallbackHtml(true, "OK", JsonSerializer.Serialize(accountInfo), "twitter");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Twitter OAuth callback error");
            return ReturnCallbackHtml(false, $"Lỗi: {ex.Message}", null, "twitter");
        }
    }

    [HttpPost("connect/twitter")]
    public async Task<IActionResult> ConnectTwitter([FromBody] ConnectTwitterDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var tenantId = User.FindFirstValue("TenantId");
        var repo = _unitOfWork.Repository<SocialAccount>();

        var existing = await repo.GetAsync(a => a.UserId == userId && a.Platform == (int)SocialPlatform.Twitter && a.AccountIdentifier == dto.AccountId);

        if (existing.Any())
        {
            var existingAccount = existing.First();
            existingAccount.AccessToken = dto.AccessToken;
            existingAccount.RefreshToken = dto.RefreshToken;
            existingAccount.AccountName = dto.AccountName;
            existingAccount.AvatarUrl = dto.AvatarUrl;
            existingAccount.TokenExpiredAtUtc = DateTime.UtcNow.AddSeconds(dto.ExpiresIn);
            existingAccount.UpdatedAt = DateTime.UtcNow;
            await repo.UpdateAsync(existingAccount);
            await _unitOfWork.CompleteAsync();

            return Ok(new { message = "Cập nhật kết nối Twitter thành công!", id = existingAccount.Id, updated = true });
        }

        var account = new SocialAccount
        {
            UserId = userId,
            TenantId = string.IsNullOrEmpty(tenantId) ? null : Guid.Parse(tenantId),
            Platform = (int)SocialPlatform.Twitter,
            AccountName = dto.AccountName,
            AccountIdentifier = dto.AccountId,
            AvatarUrl = dto.AvatarUrl,
            AccessToken = dto.AccessToken,
            RefreshToken = dto.RefreshToken,
            AuthType = (int)AuthType.OAuth2,
            TokenExpiredAtUtc = DateTime.UtcNow.AddSeconds(dto.ExpiresIn),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        await repo.AddAsync(account);
        await _unitOfWork.CompleteAsync();

        return Ok(new { message = "Kết nối Twitter thành công!", id = account.Id, updated = false });
    }

    // ═══════════════════════════════════════════════════════
    //  LINKEDIN OAUTH
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// Step 1: Returns the LinkedIn OAuth URL for the frontend to open in a popup.
    /// </summary>
    [HttpGet("auth/linkedin")]
    public IActionResult GetLinkedInAuthUrl()
    {
        var state = Guid.NewGuid().ToString("N");
        var scopes = Uri.EscapeDataString("openid profile w_member_social");
        var redirectUri = Uri.EscapeDataString(_linkedInSettings.RedirectUri);

        var url = $"https://www.linkedin.com/oauth/v2/authorization"
                + $"?response_type=code"
                + $"&client_id={_linkedInSettings.ClientId}"
                + $"&redirect_uri={redirectUri}"
                + $"&scope={scopes}"
                + $"&state={state}";

        return Ok(new { url, state });
    }

    /// <summary>
    /// Step 2: LinkedIn redirects here with ?code=xxx&state=yyy.
    /// Exchange code → access_token → get user info.
    /// Returns HTML that sends result back to opener window.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("callback/linkedin")]
    public async Task<IActionResult> LinkedInCallback([FromQuery] string? code, [FromQuery] string? state, [FromQuery] string? error, [FromQuery] string? error_description)
    {
        if (!string.IsNullOrEmpty(error))
            return ReturnCallbackHtml(false, $"LinkedIn: {error_description ?? error}", null, "linkedin");

        if (string.IsNullOrEmpty(code))
            return BadRequest(new { message = "Missing authorization code." });

        var client = _httpClientFactory.CreateClient();

        try
        {
            // 1. Exchange code for access_token
            var tokenUrl = "https://www.linkedin.com/oauth/v2/accessToken";
            var tokenBody = new Dictionary<string, string>
            {
                ["grant_type"] = "authorization_code",
                ["code"] = code,
                ["client_id"] = _linkedInSettings.ClientId,
                ["client_secret"] = _linkedInSettings.ClientSecret,
                ["redirect_uri"] = _linkedInSettings.RedirectUri
            };

            var tokenRequest = new HttpRequestMessage(HttpMethod.Post, tokenUrl)
            {
                Content = new FormUrlEncodedContent(tokenBody)
            };

            var tokenResponse = await client.SendAsync(tokenRequest);
            var tokenJson = await tokenResponse.Content.ReadAsStringAsync();

            if (!tokenResponse.IsSuccessStatusCode)
            {
                _logger.LogWarning("LinkedIn token exchange failed: {Response}", tokenJson);
                return ReturnCallbackHtml(false, "Không thể lấy access token từ LinkedIn.", null, "linkedin");
            }

            var tokenResult = JsonSerializer.Deserialize<JsonElement>(tokenJson);
            var accessToken = tokenResult.GetProperty("access_token").GetString()!;
            int expiresIn = 5184000; // default ~60 days
            if (tokenResult.TryGetProperty("expires_in", out var expProp))
            {
                if (expProp.ValueKind == JsonValueKind.Number) expiresIn = expProp.GetInt32();
                else if (expProp.ValueKind == JsonValueKind.String && int.TryParse(expProp.GetString(), out var parsed)) expiresIn = parsed;
            }

            // 2. Get User Info via OpenID Connect userinfo endpoint
            var userRequest = new HttpRequestMessage(HttpMethod.Get, "https://api.linkedin.com/v2/userinfo");
            userRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

            var userResponse = await client.SendAsync(userRequest);
            var userJsonStr = await userResponse.Content.ReadAsStringAsync();

            if (!userResponse.IsSuccessStatusCode)
            {
                _logger.LogWarning("LinkedIn userinfo failed: {Response}", userJsonStr);
                return ReturnCallbackHtml(false, "Không thể lấy thông tin tài khoản LinkedIn.", null, "linkedin");
            }

            var userData = JsonSerializer.Deserialize<JsonElement>(userJsonStr);

            var accountId = userData.TryGetProperty("sub", out var subProp) ? subProp.GetString() ?? "" : "";
            var accountName = userData.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? "LinkedIn User" : "LinkedIn User";
            var avatarUrl = userData.TryGetProperty("picture", out var picProp) ? picProp.GetString() : "";

            var accountInfo = new[]
            {
                new { accountId, accountName, avatarUrl, accessToken, expiresIn }
            };

            return ReturnCallbackHtml(true, "OK", JsonSerializer.Serialize(accountInfo), "linkedin");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "LinkedIn OAuth callback error");
            return ReturnCallbackHtml(false, $"Lỗi: {ex.Message}", null, "linkedin");
        }
    }

    /// <summary>
    /// Step 3: Frontend sends LinkedIn account info to save as SocialAccount.
    /// </summary>
    [HttpPost("connect/linkedin")]
    public async Task<IActionResult> ConnectLinkedIn([FromBody] ConnectLinkedInDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var tenantId = User.FindFirstValue("TenantId");
        var repo = _unitOfWork.Repository<SocialAccount>();

        var existing = await repo.GetAsync(a => a.UserId == userId && a.Platform == (int)SocialPlatform.LinkedIn && a.AccountIdentifier == dto.AccountId);

        if (existing.Any())
        {
            var existingAccount = existing.First();
            existingAccount.AccessToken = dto.AccessToken;
            existingAccount.AccountName = dto.AccountName;
            existingAccount.AvatarUrl = dto.AvatarUrl;
            existingAccount.TokenExpiredAtUtc = DateTime.UtcNow.AddSeconds(dto.ExpiresIn);
            existingAccount.UpdatedAt = DateTime.UtcNow;
            await repo.UpdateAsync(existingAccount);
            await _unitOfWork.CompleteAsync();

            return Ok(new { message = "Cập nhật kết nối LinkedIn thành công!", id = existingAccount.Id, updated = true });
        }

        var account = new SocialAccount
        {
            UserId = userId,
            TenantId = string.IsNullOrEmpty(tenantId) ? null : Guid.Parse(tenantId),
            Platform = (int)SocialPlatform.LinkedIn,
            AccountName = dto.AccountName,
            AccountIdentifier = dto.AccountId,
            AvatarUrl = dto.AvatarUrl,
            AccessToken = dto.AccessToken,
            AuthType = (int)AuthType.OAuth2,
            TokenExpiredAtUtc = DateTime.UtcNow.AddSeconds(dto.ExpiresIn),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        await repo.AddAsync(account);
        await _unitOfWork.CompleteAsync();

        _logger.LogInformation("User {UserId} connected LinkedIn account {AccountName}", userId, dto.AccountName);
        return Ok(new { message = "Kết nối LinkedIn thành công!", id = account.Id, updated = false });
    }

    // ═══════════════════════════════════════════════════════
    //  THREADS OAUTH
    // ═══════════════════════════════════════════════════════

    [HttpGet("auth/threads")]
    public IActionResult GetThreadsAuthUrl()
    {
        var state = Guid.NewGuid().ToString("N");
        var scopes = "threads_basic,threads_content_publish";
        var redirectUri = Uri.EscapeDataString(_threadsSettings.RedirectUri);

        var url = $"https://threads.net/oauth/authorize"
                + $"?client_id={_threadsSettings.AppId}"
                + $"&redirect_uri={redirectUri}"
                + $"&scope={scopes}"
                + $"&state={state}"
                + $"&response_type=code";

        _logger.LogInformation("=== THREADS AUTH DEBUG ===");
        _logger.LogInformation("Threads AppId: {AppId}", _threadsSettings.AppId);
        _logger.LogInformation("Threads RedirectUri (raw): {RedirectUri}", _threadsSettings.RedirectUri);
        _logger.LogInformation("Threads RedirectUri (encoded): {EncodedUri}", redirectUri);
        _logger.LogInformation("Threads Full Auth URL: {Url}", url);
        _logger.LogInformation("=========================");

        return Ok(new { url, state, debug = new { appId = _threadsSettings.AppId, redirectUri = _threadsSettings.RedirectUri } });
    }

    [AllowAnonymous]
    [HttpGet("callback/threads")]
    public async Task<IActionResult> ThreadsCallback(
        [FromQuery] string? code, 
        [FromQuery] string? state, 
        [FromQuery] string? error, 
        [FromQuery] string? error_description,
        [FromQuery] string? error_message,
        [FromQuery] int? error_code)
    {
        _logger.LogInformation("=== THREADS CALLBACK DEBUG ===");
        _logger.LogInformation("Full Query: {Query}", HttpContext.Request.QueryString);
        _logger.LogInformation("Code: {Code}", code);
        _logger.LogInformation("Error: {Error}", error);
        _logger.LogInformation("Error Description: {Desc}", error_description);
        _logger.LogInformation("Error Message: {Msg}", error_message);
        _logger.LogInformation("Error Code: {Code}", error_code);
        _logger.LogInformation("==============================");

        if (!string.IsNullOrEmpty(error) || !string.IsNullOrEmpty(error_message))
        {
            var errMsg = error_message ?? error_description ?? error ?? "Unknown error";
            return ReturnCallbackHtml(false, $"Threads: {errMsg}", null, "threads");
        }

        if (string.IsNullOrEmpty(code))
            return ReturnCallbackHtml(false, "Không nhận được mã xác thực từ Threads.", null, "threads");

        var client = _httpClientFactory.CreateClient();

        try
        {
            // 1. Exchange code for access_token
            var tokenUrl = "https://graph.threads.net/oauth/access_token";
            var tokenBody = new Dictionary<string, string>
            {
                ["client_id"] = _threadsSettings.AppId,
                ["client_secret"] = _threadsSettings.AppSecret,
                ["grant_type"] = "authorization_code",
                ["redirect_uri"] = _threadsSettings.RedirectUri,
                ["code"] = code
            };

            var tokenResponse = await client.PostAsync(tokenUrl, new FormUrlEncodedContent(tokenBody));
            var tokenJson = await tokenResponse.Content.ReadAsStringAsync();

            if (!tokenResponse.IsSuccessStatusCode)
            {
                _logger.LogWarning("Threads token exchange failed: {Response}", tokenJson);
                return ReturnCallbackHtml(false, "Không thể lấy access token từ Threads.", null, "threads");
            }

            var tokenResult = JsonSerializer.Deserialize<JsonElement>(tokenJson);
            var accessToken = tokenResult.GetProperty("access_token").GetString()!;
            var threadsUserId = tokenResult.GetProperty("user_id").GetRawText();

            // ═══ NÂNG CẤP: Đổi sang Long-lived Token (60 ngày) ═══
            _logger.LogInformation("Threads: Exchanging short-lived token for long-lived token...");
            var (longLivedToken, expiresIn) = await ExchangeThreadsLongLivedToken(client, accessToken);
            accessToken = longLivedToken;
            _logger.LogInformation("Threads: Long-lived token acquired. Expires in {Seconds}s", expiresIn);
            // ════════════════════════════════════════════════════

            // 2. Get User Profile Info
            var profileUrl = $"https://graph.threads.net/v1.0/me?fields=id,username,threads_profile_picture_url&access_token={accessToken}";
            var profileResponse = await client.GetAsync(profileUrl);
            var profileJson = await profileResponse.Content.ReadAsStringAsync();

            string username = "Threads User";
            string? avatarUrl = null;

            if (profileResponse.IsSuccessStatusCode)
            {
                var profileData = JsonSerializer.Deserialize<JsonElement>(profileJson);
                username = profileData.TryGetProperty("username", out var u) ? u.GetString() ?? username : username;
                avatarUrl = profileData.TryGetProperty("threads_profile_picture_url", out var p) ? p.GetString() : null;
            }

            var resultData = JsonSerializer.Serialize(new { 
                id = threadsUserId, 
                name = username, 
                avatar = avatarUrl,
                token = accessToken
            });

            return ReturnCallbackHtml(true, "Xác thực Threads thành công!", resultData, "threads");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Threads callback error");
            return ReturnCallbackHtml(false, $"Lỗi: {ex.Message}", null, "threads");
        }
    }

    [HttpPost("connect/threads")]
    public async Task<IActionResult> ConnectThreads([FromBody] CreateSocialAccountDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var tenantId = User.FindFirstValue("TenantId");
        var repo = _unitOfWork.Repository<SocialAccount>();

        var existing = await repo.GetAsync(a => a.UserId == userId && a.Platform == (int)SocialPlatform.Threads && a.AccountIdentifier == dto.AccountIdentifier);
        
        if (existing.Any())
        {
            var acc = existing.First();
            acc.AccessToken = dto.AccessToken;
            acc.AccountName = dto.AccountName;
            acc.AvatarUrl = dto.AvatarUrl;
            acc.TokenExpiredAtUtc = DateTime.UtcNow.AddDays(60);
            acc.UpdatedAt = DateTime.UtcNow;
            await repo.UpdateAsync(acc);
        }
        else
        {
            var account = new SocialAccount
            {
                UserId = userId,
                TenantId = string.IsNullOrEmpty(tenantId) ? null : Guid.Parse(tenantId),
                Platform = (int)SocialPlatform.Threads,
                AccountName = dto.AccountName,
                AccountIdentifier = dto.AccountIdentifier,
                AvatarUrl = dto.AvatarUrl,
                AccessToken = dto.AccessToken,
                AuthType = (int)AuthType.OAuth2,
                TokenExpiredAtUtc = DateTime.UtcNow.AddDays(60),
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            await repo.AddAsync(account);
        }

        await _unitOfWork.CompleteAsync();
        return Ok(new { message = "Kết nối Threads thành công!" });
    }

    [HttpPost("connect/threads-manual")]
    public async Task<IActionResult> ConnectThreadsManual([FromBody] ConnectThreadsManualDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        if (string.IsNullOrEmpty(dto.AccessToken))
            return BadRequest(new { message = "Access Token không được để trống." });

        var client = _httpClientFactory.CreateClient();

        try
        {
            // 1. Validate token and get profile from Threads API
            var profileUrl = $"https://graph.threads.net/v1.0/me?fields=id,username,threads_profile_picture_url&access_token={dto.AccessToken}";
            var profileResponse = await client.GetAsync(profileUrl);
            var profileJson = await profileResponse.Content.ReadAsStringAsync();

            _logger.LogInformation("Threads manual connect - Profile response: {Response}", profileJson);

            if (!profileResponse.IsSuccessStatusCode)
            {
                return BadRequest(new { message = $"Token không hợp lệ hoặc đã hết hạn. Chi tiết: {profileJson}" });
            }

            // ═══ NÂNG CẤP: Đổi sang Long-lived Token (60 ngày) cho Manual Connect ═══
            var (longLivedToken, _) = await ExchangeThreadsLongLivedToken(client, dto.AccessToken);
            var finalToken = longLivedToken;
            // ══════════════════════════════════════════════════════════════════════

            var profileData = JsonSerializer.Deserialize<JsonElement>(profileJson);
            var threadsUserId = profileData.GetProperty("id").GetString()!;
            var username = profileData.TryGetProperty("username", out var u) ? u.GetString() ?? "Threads User" : "Threads User";
            var avatarUrl = profileData.TryGetProperty("threads_profile_picture_url", out var p) ? p.GetString() : null;

            // 2. Save to database
            var tenantId = User.FindFirstValue("TenantId");
            var repo = _unitOfWork.Repository<SocialAccount>();

            var existing = await repo.GetAsync(a => a.UserId == userId && a.Platform == (int)SocialPlatform.Threads && a.AccountIdentifier == threadsUserId);

            if (existing.Any())
            {
                var acc = existing.First();
                acc.AccessToken = finalToken;
                acc.AccountName = username;
                acc.AvatarUrl = avatarUrl;
                acc.TokenExpiredAtUtc = DateTime.UtcNow.AddDays(60);
                acc.UpdatedAt = DateTime.UtcNow;
                await repo.UpdateAsync(acc);
                _logger.LogInformation("Updated existing Threads account for user {UserId}: @{Username}", userId, username);
            }
            else
            {
                var account = new SocialAccount
                {
                    UserId = userId,
                    TenantId = string.IsNullOrEmpty(tenantId) ? null : Guid.Parse(tenantId),
                    Platform = (int)SocialPlatform.Threads,
                    AccountName = username,
                    AccountIdentifier = threadsUserId,
                    AvatarUrl = avatarUrl,
                    AccessToken = finalToken,
                    AuthType = (int)AuthType.OAuth2,
                    TokenExpiredAtUtc = DateTime.UtcNow.AddDays(60),
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                await repo.AddAsync(account);
                _logger.LogInformation("Created new Threads account for user {UserId}: @{Username}", userId, username);
            }

            await _unitOfWork.CompleteAsync();
            return Ok(new { message = $"Kết nối Threads thành công! Tài khoản: @{username}" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in ConnectThreadsManual");
            return StatusCode(500, new { message = $"Lỗi hệ thống: {ex.Message}" });
        }
    }
    // ═══════════════════════════════════════════════════════
    //  GOOGLE BLOGGER OAUTH
    // ═══════════════════════════════════════════════════════

    [HttpGet("auth/blogger")]
    public IActionResult GetBloggerAuthUrl()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var state = Guid.NewGuid().ToString("N");
        
        // Lưu UserId vào cache để dùng lúc callback (Rule 2: TenantId must come from authenticated context)
        _cache.Set($"auth_user_{state}", userId, TimeSpan.FromMinutes(10));

        var redirectUri = Uri.EscapeDataString(_bloggerSettings.RedirectUri);
        var scopes = Uri.EscapeDataString("https://www.googleapis.com/auth/blogger");

        var url = $"https://accounts.google.com/o/oauth2/v2/auth"
                + $"?client_id={_bloggerSettings.ClientId}"
                + $"&redirect_uri={redirectUri}"
                + $"&response_type=code"
                + $"&scope={scopes}"
                + $"&state={state}"
                + $"&access_type=offline"
                + $"&prompt=consent";

        return Ok(new { url, state });
    }

    [AllowAnonymous]
    [HttpGet("callback/blogger")]
    public async Task<IActionResult> BloggerCallback([FromQuery] string code, [FromQuery] string? state, [FromQuery] string? error)
    {
        if (!string.IsNullOrEmpty(error))
            return ReturnCallbackHtml(false, $"Lỗi từ Google: {error}", null, "blogger");

        if (string.IsNullOrEmpty(code))
            return BadRequest(new { message = "Missing authorization code." });

        var client = _httpClientFactory.CreateClient();

        try
        {
            // 1. Exchange code for access token
            var tokenUrl = "https://oauth2.googleapis.com/token";
            var tokenBody = new Dictionary<string, string>
            {
                ["code"] = code,
                ["client_id"] = _bloggerSettings.ClientId,
                ["client_secret"] = _bloggerSettings.ClientSecret,
                ["redirect_uri"] = _bloggerSettings.RedirectUri,
                ["grant_type"] = "authorization_code"
            };

            var tokenResponse = await client.PostAsync(tokenUrl, new FormUrlEncodedContent(tokenBody));
            var tokenJson = await tokenResponse.Content.ReadAsStringAsync();

            if (!tokenResponse.IsSuccessStatusCode)
            {
                _logger.LogWarning("Blogger token exchange failed: {Response}", tokenJson);
                return ReturnCallbackHtml(false, "Không thể lấy access token từ Google.", null, "blogger");
            }

            var tokenData = JsonSerializer.Deserialize<JsonElement>(tokenJson);
            var accessToken = tokenData.GetProperty("access_token").GetString()!;
            var refreshToken = tokenData.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;
            var expiresIn = tokenData.GetProperty("expires_in").GetInt32();

            // 2. Get user's blogs
            var blogsUrl = "https://www.googleapis.com/blogger/v3/users/self/blogs";
            client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
            client.DefaultRequestHeaders.Add("User-Agent", "XPost-SaaS");
            
            var blogsResponse = await client.GetAsync(blogsUrl);
            var blogsJson = await blogsResponse.Content.ReadAsStringAsync();

            if (!blogsResponse.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch Blogger blogs: {Response}", blogsJson);
                return ReturnCallbackHtml(false, $"Lỗi từ Google: {blogsJson}", null, "blogger");
            }

            var blogsData = JsonSerializer.Deserialize<JsonElement>(blogsJson);
            if (!blogsData.TryGetProperty("items", out var items) || items.GetArrayLength() == 0)
            {
                return ReturnCallbackHtml(false, "Bạn không có blog nào trên Blogger.", null, "blogger");
            }

            // For simplicity, we'll connect the first blog found. 
            // In a more advanced version, we could show a list to let user choose.
            var firstBlog = items[0];
            var blogId = firstBlog.GetProperty("id").GetString()!;
            var blogName = firstBlog.GetProperty("name").GetString()!;
            var blogUrl = firstBlog.GetProperty("url").GetString()!;

            // 3. Save to database
            var repo = _unitOfWork.Repository<SocialAccount>();
            var userId = _cache.Get<string>($"auth_user_{state}");
            
            if (string.IsNullOrEmpty(userId))
            {
                return ReturnCallbackHtml(false, "Phiên làm việc hết hạn, vui lòng thử lại.", null, "blogger");
            }

            // Get TenantId from claims if available (Rule 2)
            var tenantIdClaim = User.FindFirstValue("TenantId");
            Guid? tenantId = string.IsNullOrEmpty(tenantIdClaim) ? null : Guid.Parse(tenantIdClaim);
            
            var account = new SocialAccount
            {
                UserId = userId,
                TenantId = tenantId,
                Platform = (int)SocialPlatform.Blogger,
                AccountName = blogName,
                AccountIdentifier = blogId,
                AvatarUrl = null,
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                AuthType = (int)AuthType.OAuth2,
                TokenExpiredAtUtc = DateTime.UtcNow.AddSeconds(expiresIn),
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            // Link to the user who started the auth
            // We use the state to retrieve the userId we stored earlier (implementation depends on how GetBloggerAuthUrl is called)
            
            await repo.AddAsync(account);
            await _unitOfWork.CompleteAsync();

            return ReturnCallbackHtml(true, "Kết nối Blogger thành công!", JsonSerializer.Serialize(new { id = account.Id, name = blogName }), "blogger");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in Blogger callback");
            return ReturnCallbackHtml(false, $"Lỗi hệ thống: {ex.Message}", null, "blogger");
        }
    }

    // ═══════════════════════════════════════════════════════
    //  DISCONNECT
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// Disconnect (delete) a social account.
    /// </summary>
    [HttpDelete("disconnect/{id}")]
    public async Task<IActionResult> Disconnect(Guid id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var repo = _unitOfWork.Repository<SocialAccount>();
        var account = await repo.GetByIdAsync(id);

        if (account == null) return NotFound();
        if (account.UserId != userId) return Forbid();

        // Delete related PostTargets and their PostLogs first to avoid FK constraint errors
        var postTargetRepo = _unitOfWork.Repository<PostTarget>();
        var postTargets = (await postTargetRepo.GetAllAsync())
            .Where(pt => pt.SocialAccountId == id)
            .ToList();

        if (postTargets.Any())
        {
            var postLogRepo = _unitOfWork.Repository<PostLog>();
            foreach (var pt in postTargets)
            {
                var logs = (await postLogRepo.GetAllAsync())
                    .Where(l => l.PostTargetId == pt.Id)
                    .ToList();
                foreach (var log in logs)
                {
                    await postLogRepo.DeleteAsync(log);
                }
                await postTargetRepo.DeleteAsync(pt);
            }
        }

        await repo.DeleteAsync(account);
        await _unitOfWork.CompleteAsync();

        return Ok(new { message = "Đã ngắt kết nối tài khoản." });
    }

    // ═══════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════

    private ContentResult ReturnCallbackHtml(bool success, string message, string? data = null, string platform = "facebook")
    {
        var successStr = success.ToString().ToLower();
        var safeMessage = message.Replace("'", "\\'");
        var dataStr = data ?? "null";
        var bodyText = success ? "✅ Kết nối thành công! Hệ thống đang tải..." : "❌ " + message;
        var fallbackText = success ? "<p style='margin-top:20px; font-size:14px; color:#666;'>Nếu cửa sổ không tự động đóng, bạn hãy tự đóng cửa sổ này và làm mới (F5) trang chính nhé!</p>" : "";

        var html = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>XPost - Kết nối</title></head><body style='font-family:sans-serif; padding:40px; text-align:center;'>"
            + "<h3>" + bodyText + "</h3>"
            + fallbackText
            + "<script>"
            + "if (window.opener) {"
            + "  window.opener.postMessage({"
            + "    type: 'SOCIAL_AUTH_CALLBACK',"
            + "    platform: '" + platform + "',"
            + "    success: " + successStr + ","
            + "    message: '" + safeMessage + "',"
            + "    data: " + dataStr
            + "  }, '*');"
            + "  setTimeout(function() { window.close(); }, 1500);"
            + "}"
            + "</script></body></html>";

        return Content(html, "text/html");
    }

    // ═══════════════════════════════════════════════════════
    //  THREADS HELPERS
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// Exchange a Threads short-lived token for a long-lived token (60 days).
    /// Ref: https://developers.facebook.com/docs/threads/access-tokens/long-lived-tokens
    /// </summary>
    private async Task<(string token, int expiresIn)> ExchangeThreadsLongLivedToken(HttpClient client, string shortLivedToken)
    {
        try
        {
            _logger.LogInformation("Threads: Requesting long-lived token exchange...");
            
            var exchangeUrl = $"https://graph.threads.net/access_token"
                            + $"?grant_type=th_exchange_token"
                            + $"&client_secret={_threadsSettings.AppSecret}"
                            + $"&access_token={shortLivedToken}";

            var response = await client.GetAsync(exchangeUrl);
            var json = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                var data = JsonSerializer.Deserialize<JsonElement>(json);
                var longLivedToken = data.GetProperty("access_token").GetString()!;
                var expiresIn = data.TryGetProperty("expires_in", out var exp) ? exp.GetInt32() : 5184000;
                
                return (longLivedToken, expiresIn);
            }

            _logger.LogWarning("Threads long-lived token exchange failed: {Response}", json);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error exchanging Threads long-lived token");
        }

        // Return original token if exchange fails (fall back to short-lived)
        return (shortLivedToken, 3600);
    }

    // ═══════════════════════════════════════════════════════
    //  PKCE HELPERS
    // ═══════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════
    //  TIKTOK BUSINESS OAUTH
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// Step 1: Returns the TikTok OAuth URL for the frontend to open in a popup.
    /// Uses PKCE (code_challenge / code_verifier).
    /// </summary>
    [HttpGet("auth/tiktok")]
    public IActionResult GetTikTokAuthUrl()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var state = Guid.NewGuid().ToString("N");
        var codeVerifier = GenerateCodeVerifier();
        var codeChallenge = GenerateCodeChallenge(codeVerifier);

        _cache.Set($"tiktok_cv_{state}", codeVerifier, TimeSpan.FromMinutes(10));
        _cache.Set($"tiktok_user_{state}", userId, TimeSpan.FromMinutes(10));

        // NOTE: Chỉ request các scope đã được phê duyệt trên TikTok Developer Portal.
        // Sandbox app có thể dùng video.publish nhưng bài đăng sẽ ở chế độ private (chỉ mình tôi).
        // Sau khi app được audit, có thể thêm: comment.list,comment.list.manage
        var scopes = "user.info.basic,video.publish,video.upload,video.list";
        var redirectUri = Uri.EscapeDataString(_tiktokSettings.RedirectUri);

        var url = "https://www.tiktok.com/v2/auth/authorize/"
                + $"?client_key={_tiktokSettings.ClientKey}"
                + $"&response_type=code"
                + $"&scope={scopes}"
                + $"&redirect_uri={redirectUri}"
                + $"&state={state}"
                + $"&code_challenge={codeChallenge}"
                + $"&code_challenge_method=S256";

        return Ok(new { url, state });
    }

    /// <summary>
    /// Step 2: TikTok redirects here with ?code=xxx&state=yyy.
    /// Exchange code + code_verifier → access_token → get user info.
    /// Returns HTML that sends result back to opener window.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("callback/tiktok")]
    public async Task<IActionResult> TikTokCallback([FromQuery] string code, [FromQuery] string? state, [FromQuery] string? error, [FromQuery] string? error_description)
    {
        if (!string.IsNullOrEmpty(error))
        {
            _logger.LogWarning("TikTok auth error: {Error} - {Desc}", error, error_description);
            return ReturnCallbackHtml(false, $"Lỗi từ TikTok: {error_description ?? error}", null, "tiktok");
        }

        if (string.IsNullOrEmpty(code))
            return ReturnCallbackHtml(false, "Không nhận được mã xác thực (code) từ TikTok.", null, "tiktok");

        string? codeVerifier = null;
        if (!string.IsNullOrEmpty(state))
        {
            _cache.TryGetValue($"tiktok_cv_{state}", out codeVerifier);
            _cache.Remove($"tiktok_cv_{state}");
        }

        if (string.IsNullOrEmpty(codeVerifier))
        {
            _logger.LogWarning("TikTok callback: code_verifier not found for state {State}", state);
            return ReturnCallbackHtml(false, "Phiên xác thực đã hết hạn. Vui lòng thử lại.", null, "tiktok");
        }

        var client = _httpClientFactory.CreateClient();

        try
        {
            // 1. Exchange code for access_token
            var tokenUrl = "https://open.tiktokapis.com/v2/oauth/token/";
            var tokenBody = new Dictionary<string, string>
            {
                ["client_key"] = _tiktokSettings.ClientKey,
                ["client_secret"] = _tiktokSettings.ClientSecret,
                ["code"] = code,
                ["grant_type"] = "authorization_code",
                ["redirect_uri"] = _tiktokSettings.RedirectUri,
                ["code_verifier"] = codeVerifier
            };

            var tokenRequest = new HttpRequestMessage(HttpMethod.Post, tokenUrl)
            {
                Content = new FormUrlEncodedContent(tokenBody)
            };

            var tokenResponse = await client.SendAsync(tokenRequest);
            var tokenJson = await tokenResponse.Content.ReadAsStringAsync();

            _logger.LogInformation("TikTok token exchange response: {Response}", tokenJson);

            var tokenResult = JsonSerializer.Deserialize<JsonElement>(tokenJson);

            if (!tokenResult.TryGetProperty("access_token", out var accessTokenProp))
            {
                var errorMsg = tokenResult.TryGetProperty("error_description", out var errDesc)
                    ? errDesc.GetString() : "Không thể lấy access token.";
                _logger.LogWarning("TikTok token exchange failed: {Response}", tokenJson);
                return ReturnCallbackHtml(false, errorMsg ?? "Lỗi xác thực TikTok.", null, "tiktok");
            }

            var accessToken = accessTokenProp.GetString()!;
            var refreshToken = tokenResult.TryGetProperty("refresh_token", out var rtProp)
                ? rtProp.GetString() : null;
            var openId = tokenResult.TryGetProperty("open_id", out var oidProp)
                ? oidProp.GetString() ?? "" : "";
            long expiresIn = 86400;
            if (tokenResult.TryGetProperty("expires_in", out var expProp))
            {
                if (expProp.ValueKind == JsonValueKind.Number) expiresIn = expProp.GetInt64();
                else if (expProp.ValueKind == JsonValueKind.String && long.TryParse(expProp.GetString(), out var parsed)) expiresIn = parsed;
            }

            // 2. Get user info
            var userInfoUrl = "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name";
            var userRequest = new HttpRequestMessage(HttpMethod.Get, userInfoUrl);
            userRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

            var userResponse = await client.SendAsync(userRequest);
            var userJson = await userResponse.Content.ReadAsStringAsync();

            _logger.LogInformation("TikTok user info response: {Response}", userJson);

            string displayName = "TikTok User";
            string avatarUrl = "";

            if (userResponse.IsSuccessStatusCode)
            {
                var userResult = JsonSerializer.Deserialize<JsonElement>(userJson);
                if (userResult.TryGetProperty("data", out var userData) && userData.TryGetProperty("user", out var user))
                {
                    displayName = user.TryGetProperty("display_name", out var dnProp) ? dnProp.GetString() ?? "TikTok User" : "TikTok User";
                    avatarUrl = user.TryGetProperty("avatar_url", out var avProp) ? avProp.GetString() ?? "" : "";
                }
            }

            // ═══ Lưu trực tiếp vào DB (tránh lỗi ngrok interstitial mất window.opener) ═══
            var savedUserId = _cache.Get<string>($"tiktok_user_{state}");
            if (!string.IsNullOrEmpty(savedUserId))
            {
                _cache.Remove($"tiktok_user_{state}");
                var repo = _unitOfWork.Repository<SocialAccount>();
                var existing = await repo.GetAsync(a =>
                    a.UserId == savedUserId
                    && a.Platform == (int)SocialPlatform.TikTok
                    && a.AccountIdentifier == openId);

                if (existing.Any())
                {
                    var acc = existing.First();
                    acc.AccessToken = accessToken;
                    acc.RefreshToken = refreshToken;
                    acc.AccountName = displayName;
                    acc.AvatarUrl = avatarUrl;
                    acc.TokenExpiredAtUtc = DateTime.UtcNow.AddSeconds(expiresIn);
                    acc.UpdatedAt = DateTime.UtcNow;
                    await repo.UpdateAsync(acc);
                    _logger.LogInformation("Updated TikTok account for user {UserId}: {DisplayName}", savedUserId, displayName);
                }
                else
                {
                    var tenantIdClaim = User.FindFirstValue("TenantId");
                    var account = new SocialAccount
                    {
                        UserId = savedUserId,
                        TenantId = string.IsNullOrEmpty(tenantIdClaim) ? null : Guid.Parse(tenantIdClaim),
                        Platform = (int)SocialPlatform.TikTok,
                        AccountName = displayName,
                        AccountIdentifier = openId,
                        AvatarUrl = avatarUrl,
                        AccessToken = accessToken,
                        RefreshToken = refreshToken,
                        AuthType = (int)AuthType.OAuth2,
                        TokenExpiredAtUtc = DateTime.UtcNow.AddSeconds(expiresIn),
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    };
                    await repo.AddAsync(account);
                    _logger.LogInformation("Created TikTok account for user {UserId}: {DisplayName}", savedUserId, displayName);
                }
                await _unitOfWork.CompleteAsync();
            }

            // Return account info to frontend (postMessage fallback)
            var accountInfo = new[]
            {
                new
                {
                    openId,
                    displayName,
                    avatarUrl,
                    accessToken,
                    refreshToken,
                    expiresIn
                }
            };

            var accountInfoJson = JsonSerializer.Serialize(accountInfo);
            return ReturnCallbackHtml(true, "Kết nối TikTok thành công!", accountInfoJson, "tiktok");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TikTok OAuth callback error");
            return ReturnCallbackHtml(false, $"Lỗi: {ex.Message}", null, "tiktok");
        }
    }

    /// <summary>
    /// Step 3: Frontend sends TikTok account data to save as SocialAccount.
    /// </summary>
    [HttpPost("connect/tiktok")]
    public async Task<IActionResult> ConnectTikTok([FromBody] ConnectTikTokDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        if (string.IsNullOrEmpty(dto.AccessToken))
            return BadRequest(new { message = "Access token không được để trống." });

        var tenantId = User.FindFirstValue("TenantId");
        var repo = _unitOfWork.Repository<SocialAccount>();

        // Check if already connected
        var existing = await repo.GetAsync(a =>
            a.UserId == userId
            && a.Platform == (int)SocialPlatform.TikTok
            && a.AccountIdentifier == dto.OpenId);

        if (existing.Any())
        {
            var existingAccount = existing.First();
            existingAccount.AccessToken = dto.AccessToken;
            existingAccount.RefreshToken = dto.RefreshToken;
            existingAccount.AccountName = dto.DisplayName;
            existingAccount.AvatarUrl = dto.AvatarUrl;
            existingAccount.TokenExpiredAtUtc = DateTime.UtcNow.AddSeconds(dto.ExpiresIn);
            existingAccount.UpdatedAt = DateTime.UtcNow;
            await repo.UpdateAsync(existingAccount);
            await _unitOfWork.CompleteAsync();

            _logger.LogInformation("User {UserId} updated TikTok account {DisplayName}", userId, dto.DisplayName);
            return Ok(new { message = "Cập nhật kết nối TikTok thành công!", id = existingAccount.Id, updated = true });
        }

        var account = new SocialAccount
        {
            UserId = userId,
            TenantId = string.IsNullOrEmpty(tenantId) ? null : Guid.Parse(tenantId),
            Platform = (int)SocialPlatform.TikTok,
            AccountName = dto.DisplayName,
            AccountIdentifier = dto.OpenId,
            AvatarUrl = dto.AvatarUrl,
            AccessToken = dto.AccessToken,
            RefreshToken = dto.RefreshToken,
            AuthType = (int)AuthType.OAuth2,
            TokenExpiredAtUtc = DateTime.UtcNow.AddSeconds(dto.ExpiresIn),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        await repo.AddAsync(account);
        await _unitOfWork.CompleteAsync();

        _logger.LogInformation("User {UserId} connected TikTok account {DisplayName}", userId, dto.DisplayName);
        return Ok(new { message = "Kết nối TikTok thành công!", id = account.Id, updated = false });
    }

    // ═══════════════════════════════════════════════════════
    //  HELPER METHODS
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// Generate a random code_verifier for PKCE (43-128 chars, Base64URL).
    /// </summary>
    private static string GenerateCodeVerifier()
    {
        var bytes = new byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Base64UrlEncode(bytes);
    }

    /// <summary>
    /// Generate code_challenge = SHA256(code_verifier) as Base64URL (no padding).
    /// </summary>
    private static string GenerateCodeChallenge(string codeVerifier)
    {
        var bytes = SHA256.HashData(Encoding.ASCII.GetBytes(codeVerifier));
        return Base64UrlEncode(bytes);
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }
}

// ═══════════════════════════════════════════════════════
//  Request DTOs
// ═══════════════════════════════════════════════════════

public class ConnectFacebookPagesDto
{
    public List<FacebookPageDto> Pages { get; set; } = new();
}

public class FacebookPageDto
{
    public string PageId { get; set; } = string.Empty;
    public string PageName { get; set; } = string.Empty;
    public string PageToken { get; set; } = string.Empty;
    public string? PictureUrl { get; set; }
}

public class ConnectTelegramDto
{
    public string BotToken { get; set; } = string.Empty;
    public string ChatId { get; set; } = string.Empty;
    public string? AccountName { get; set; }
}

public class ConnectZaloDto
{
    public string OaId { get; set; } = string.Empty;
    public string OaName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string AccessToken { get; set; } = string.Empty;
    public string? RefreshToken { get; set; }
    public long ExpiresIn { get; set; } = 86400;
}

public class ConnectTwitterDto
{
    public string AccountId { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string AccessToken { get; set; } = string.Empty;
    public string? RefreshToken { get; set; }
    public long ExpiresIn { get; set; } = 7200;
}

public class ConnectLinkedInDto
{
    public string AccountId { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string AccessToken { get; set; } = string.Empty;
    public long ExpiresIn { get; set; } = 5184000;
}

public class ConnectThreadsManualDto
{
    public string AccessToken { get; set; } = string.Empty;
}

public class ConnectTikTokDto
{
    public string OpenId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string AccessToken { get; set; } = string.Empty;
    public string? RefreshToken { get; set; }
    public long ExpiresIn { get; set; } = 86400;
}
