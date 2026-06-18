TAI LIEU TICH HOP
FACEBOOK MESSENGER
Tich hop Chatbot AI vao Messenger cho SaaS .NET 10 + React

--------------------------------------------------
* THÔNG TIN CHUNG
--------------------------------------------------
- Phien ban API: Meta Messenger Platform v21.0+
- Stack backend: .NET 10 (C#) + HttpClient
- Mo hinh tin nhan: Webhook nhan + Send API gui
- Thoi gian trien khai: 2-3 ngay cho intern
- Chi phi: Mien phi - chi can Facebook Page

--------------------------------------------------
1. Tong quan kien truc
--------------------------------------------------
Messenger Platform hoat dong theo mo hinh Webhook: khi khach nhan tin vao Facebook Page, Meta gui POST request den server cua ban (webhook). Server xu ly va gui phan hoi lai qua Send API.

Luong tin nhan:
1. Khach nhan tin vao Facebook Page cua chu doanh nghi?p.
2. Meta POST tin nhan den Webhook URL: POST /api/messenger/webhook.
3. ChatController xu ly: goi Claude AI + tra cuu KnowledgeBase.
4. Gui phan hoi lai khach qua Send API: POST graph.facebook.com/v21.0/me/messages.

So sanh voi Web Widget:
Web widget = khach chu dong vao website moi chat. Messenger = bot chu dong trong hop nhan tin cua khach. Messenger co engagement cao hon nhieu vi khach khong can roi khoi Facebook.

--------------------------------------------------
2. Cai dat tren Meta for Developers
--------------------------------------------------
Day la buoc quan trong nhat. Lam sai o day thi code tot den dau cung khong chay duoc.

Buoc 1 - Tao Facebook App:
- Vao developers.facebook.com -> My Apps -> Create App.
- Chon loai app: "Business" (phu hop nhat cho chatbot).
- Dien ten app, email lien he -> Create App.
- Tu dashboard app, tim va them san pham "Messenger" -> Set Up.

Buoc 2 - Ket noi Facebook Page:
- Trong Messenger Settings -> Access Tokens.
- Chon hoac tao Facebook Page cua chu doanh nghi?p.
- Nhan "Generate Token" -> copy Page Access Token (bat dau bang "EAA...").
- Luu token vao appsettings.json (khong commit git).

Luu y: Page Access Token se het han neu app chua duoc duyet. Trong giai doan dev, dung "Never expires" token bang cach tich vao khi generate. Production can refresh token dinh ky hoac dung System User Token.

Buoc 3 - Cau hinh Webhook:
- Trong Messenger Settings -> Webhooks -> Add Callback URL.
- Callback URL: https://your-saas.com/api/messenger/webhook
- Verify Token: tu dat (vi du "my_secret_token_123") - dung de xac thuc Meta.
- Tick vao "messages" va "messaging_postbacks" trong Subscription Fields.
- Nhan Verify and Save - Meta se goi GET den webhook de xac thuc.

Webhook phai HTTPS: Meta yeu cau webhook phai co SSL hop le. Dung dev thi dung ngrok de expose localhost: ngrok http 5000. Production thi dung domain thuc voi cert.

--------------------------------------------------
3. Backend .NET 10
--------------------------------------------------

3.1 Cau truc thu muc
src/
|-- Controllers/
|   |-- MessengerController.cs      <- Moi: xu ly webhook + gui tin
|-- Services/
|   |-- MessengerService.cs         <- Moi: goi Send API
|   |-- SignatureValidator.cs       <- Moi: xac thuc chu ky Meta
|-- Models/
|   |-- MessengerWebhookDto.cs      <- Moi: deserialize payload tu Meta
|-- (cac file cu giu nguyen)

3.2 MessengerController.cs
Controller nay co 2 endpoint: GET de xac thuc webhook voi Meta, POST de nhan tin nhan.

[ApiController]
[Route("api/messenger")]
public class MessengerController : ControllerBase
{
    private readonly MessengerService _messenger;
    private readonly IAiService _ai;
    private readonly KnowledgeBaseService _kb;
    private readonly IConfiguration _config;

    // GET: Meta goi de xac thuc webhook khi setup
    [HttpGet("webhook")]
    public IActionResult Verify(
        [FromQuery(Name = "hub.mode")]       string mode,
        [FromQuery(Name = "hub.verify_token")] string token,
        [FromQuery(Name = "hub.challenge")]  string challenge)
    {
        var verifyToken = _config["Messenger:VerifyToken"];
        if (mode == "subscribe" && token == verifyToken)
            return Ok(challenge); // Tra ve challenge de Meta xac nhan
        return Forbid();
    }

    // POST: Meta gui tin nhan cua khach den day
    [HttpPost("webhook")]
    public async Task<IActionResult> Receive(
        [FromBody] MessengerWebhookDto payload,
        [FromHeader(Name = "X-Hub-Signature-256")] string signature)
    {
        // 1. Xac thuc chu ky (bat buoc - tranh gia mao request)
        if (!_validator.Validate(Request.Body, signature))
            return Unauthorized();

        // 2. Xu ly tung tin nhan
        foreach (var entry in payload.Entry)
            foreach (var msg in entry.Messaging)
                await HandleMessageAsync(msg);

        return Ok("EVENT_RECEIVED"); // Meta yeu cau tra ve 200 nhanh
    }

    private async Task HandleMessageAsync(MessagingItem msg)
    {
        if (msg.Message?.Text == null) return; // Bo qua non-text

        var senderId = msg.Sender.Id; // ID nguoi dung Facebook
        var text     = msg.Message.Text;

        // Tra typing indicator truoc (UX tot hon)
        await _messenger.SendTypingAsync(senderId);

        // Lay chatbot theo Page ID (moi Page = 1 tenant)
        var pageId  = msg.Recipient.Id;
        var chatbot = await GetChatbotByPageId(pageId);
        if (chatbot == null) return;

        // Lay lich su va knowledge
        var history = await LoadHistory(senderId, limit: 10);
        var context = await _kb.GetContext(chatbot.Id, text);

        // Goi AI
        var reply = await _ai.ChatAsync(chatbot, history, context, text);

        // Luu lich su
        await SaveHistory(senderId, chatbot.Id, text, reply);

        // Gui phan hoi
        await _messenger.SendTextAsync(senderId, reply);
    }
}

3.3 MessengerService.cs
Service nay gui tin nhan di qua Facebook Send API.

public class MessengerService
{
    private readonly HttpClient _http;
    private readonly string _pageToken;
    private const string API = "https://graph.facebook.com/v21.0/me/messages";

    // Gui tin nhan text thuong
    public async Task SendTextAsync(string recipientId, string text)
    {
        // Messenger gioi han 2000 ky tu / tin nhan
        var chunks = SplitMessage(text, 2000);
        foreach (var chunk in chunks)
        {
            await PostAsync(new {
                recipient = new { id = recipientId },
                message   = new { text = chunk },
                messaging_type = "RESPONSE",
            });
            if (chunks.Count > 1)
                await Task.Delay(300); // Tranh doanh nghi?pm, giu thu tu
        }
    }

    // Gui typing indicator ("dang soan tin...")
    public async Task SendTypingAsync(string recipientId)
    {
        await PostAsync(new {
            recipient     = new { id = recipientId },
            sender_action = "typing_on",
        });
    }

    // Gui Quick Reply buttons
    public async Task SendQuickRepliesAsync(
        string recipientId, string text, List<string> options)
    {
        var quickReplies = options.Select(o => new {
            content_type = "text",
            title        = o,
            payload      = o.ToUpper().Replace(" ", "_")
        });
        await PostAsync(new {
            recipient = new { id = recipientId },
            message   = new { text, quick_replies = quickReplies }
        });
    }

    private async Task PostAsync(object body)
    {
        var res = await _http.PostAsJsonAsync(
            $"{API}?access_token={_pageToken}", body);
        res.EnsureSuccessStatusCode();
    }

    private List<string> SplitMessage(string text, int maxLen)
    {
        if (text.Length <= maxLen) return [text];
        // Cat o khoang trang gan nhat de khong bi cut giua tu
        var chunks = new List<string>();
        while (text.Length > maxLen)
        {
            var cut = text.LastIndexOf(" ", maxLen);
            if (cut < 0) cut = maxLen;
            chunks.Add(text[..cut]);
            text = text[cut..].TrimStart();
        }
        chunks.Add(text);
        return chunks;
    }
}

3.4 MessengerWebhookDto.cs
Model de deserialize payload tu Meta. Meta gui JSON phuc tap, can map dung.

public class MessengerWebhookDto
{
    [JsonPropertyName("object")]
    public string Object { get; set; } = "";  // "page"

    [JsonPropertyName("entry")]
    public List<EntryItem> Entry { get; set; } = [];
}

public class EntryItem
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";  // Page ID

    [JsonPropertyName("messaging")]
    public List<MessagingItem> Messaging { get; set; } = [];
}

public class MessagingItem
{
    [JsonPropertyName("sender")]
    public IdObject Sender { get; set; } = new();  // User Facebook ID

    [JsonPropertyName("recipient")]
    public IdObject Recipient { get; set; } = new();  // Page ID

    [JsonPropertyName("message")]
    public MessageContent? Message { get; set; }

    [JsonPropertyName("postback")]
    public PostbackContent? Postback { get; set; }
}

public class MessageContent
{
    [JsonPropertyName("text")]
    public string? Text { get; set; }

    [JsonPropertyName("mid")]
    public string Mid { get; set; } = "";  // Message ID - dung de dedup
}

public class PostbackContent
{
    [JsonPropertyName("payload")]
    public string Payload { get; set; } = "";  // Quick reply payload
}

public class IdObject
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";
}

3.5 SignatureValidator.cs
Bat buoc: xac thuc moi request den tu Meta that su, khong phai gia mao.

public class SignatureValidator
{
    private readonly string _appSecret;

    public bool Validate(string rawBody, string signatureHeader)
    {
        // Header co dang: "sha256=abc123..."
        if (!signatureHeader.StartsWith("sha256="))
            return false;

        var expected = signatureHeader["sha256=".Length..];
        var key      = Encoding.UTF8.GetBytes(_appSecret);
        var data     = Encoding.UTF8.GetBytes(rawBody);

        using var hmac = new HMACSHA256(key);
        var hash = Convert.ToHexString(hmac.ComputeHash(data)).ToLower();

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(hash),
            Encoding.UTF8.GetBytes(expected));
    }
}

Quan trong: Phai doc raw body de tinh HMAC. Neu dung [FromBody] thi ASP.NET da deserialize mat raw bytes. Can them middleware EnableBuffering() hoac doc Request.BodyReader truoc khi bind vao DTO.

3.6 Dang ky trong Program.cs
// Program.cs
builder.Services.AddScoped<MessengerService>();
builder.Services.AddScoped<SignatureValidator>();

// Cho phep doc raw body (can cho SignatureValidator)
app.Use(async (ctx, next) => {
    ctx.Request.EnableBuffering();
    await next();
});

// appsettings.Development.json (KHONG commit git)
"Messenger": {
    "PageAccessToken": "EAAxxxxx...",
    "AppSecret":       "abc123...",
    "VerifyToken":     "my_secret_token_123"
}

--------------------------------------------------
4. Xu ly Multi-tenant voi Messenger
--------------------------------------------------
Moi Facebook Page = 1 tenant (1 cua doanh nghi?p). Can map Page ID sang ChatbotId de biet bot nao dang xu ly.

Them cot PageId vao bang Chatbots:
-- Migration: them PageId vao bang Chatbots hien co
ALTER TABLE Chatbots ADD
    MessengerPageId    NVARCHAR(50)  NULL,  -- Facebook Page ID
    MessengerPageToken NVARCHAR(500) NULL;  -- Page Access Token (ma hoa)

-- Index de lookup nhanh
CREATE INDEX IX_Chatbots_MessengerPageId
    ON Chatbots(MessengerPageId) WHERE MessengerPageId IS NOT NULL;

Lookup ChatbotId tu Page ID:
private async Task<Chatbot?> GetChatbotByPageId(string pageId)
    => await _db.Chatbots
        .FirstOrDefaultAsync(c =>
            c.MessengerPageId == pageId && c.IsActive);

Trang cau hinh Messenger trong React Admin:
Them vao trang /chatbot/:id/config cac truong:
- Facebook Page ID: chu doanh nghi?p copy tu Page Settings -> Page ID.
- Page Access Token: generate tu Meta for Developers -> Messenger Settings.
- Status: hien thi "Ket noi" hoac "Chua cau hinh" tuy theo da co token chua.

Bao mat token: Page Access Token la bi mat. Luu vao DB nen ma hoa bang AES-256 (dung IDataProtectionProvider co san trong ASP.NET). Khong hien thi full token trong admin UI, chi hien 8 ky tu dau + "****".

--------------------------------------------------
5. Quan ly Session va Lich su
--------------------------------------------------
Khac voi web widget (dung sessionKey tu browser), Messenger co senderPsid (Page-Scoped User ID) la ID on dinh cua moi nguoi dung voi moi Page. Day chinh la "session key" tu nhien.

Luu lich su hoi thoai:
// ChatSessions: them cot MessengerSenderPsid
ALTER TABLE ChatSessions ADD
    MessengerSenderPsid NVARCHAR(50) NULL;

// Lookup hoac tao session theo PSID
private async Task<ChatSession> GetOrCreateSessionByPsid(
    Guid chatbotId, string psid)
{
    var session = await _db.ChatSessions
        .Where(s => s.ChatbotId == chatbotId
                 && s.MessengerSenderPsid == psid
                 && s.StartedAt > DateTime.UtcNow.AddDays(-1))
        .OrderByDescending(s => s.StartedAt)
        .FirstOrDefaultAsync();

    if (session != null) return session;

    // Session moi (sau 24h khong hoat dong = bat dau lai)
    var newSession = new ChatSession {
        ChatbotId           = chatbotId,
        MessengerSenderPsid = psid,
        StartedAt           = DateTime.UtcNow,
    };
    _db.ChatSessions.Add(newSession);
    await _db.SaveChangesAsync();
    return newSession;
}

Tai sao 24h? Meta co chinh sach "24+1 rule": bot chi duoc gui tin nhan tu do trong vong 24h ke tu tin nhan cuoi cua khach. Sau 24h, neu khach khong nhan tin truoc, bot chi duoc gui 1 loai nhan tin dac biet (Message Tag). Dat timeout 24h de tranh loi policy.

--------------------------------------------------
6. Tinh nang nang cao
--------------------------------------------------

6.1 Quick Replies (nut goi y)
Sau khi bot chao, hien 3-4 nut de khach nhan nhanh thay vi phai go tay. Rat hieu qua cho mobile.

// Trong HandleMessageAsync: neu la tin nhan dau tien trong session
if (isFirstMessage)
{
    await _messenger.SendQuickRepliesAsync(
        senderId,
        "Xin chao! Em co the giup gi cho chi?",
        new List<string> {
            "Bang gia dich vu",
            "Dat lich hen",
            "Dia chi & gio mo cua",
            "Khuyen mai thang nay"
        });
    return;
}

6.2 Get Profile Facebook (lay ten khach tu Meta)
Khi co PSID, co the goi Graph API de lay ten va avatar cua khach hang, tu dong dien vao CustomerProfile.

public async Task<FacebookProfile?> GetUserProfileAsync(string psid)
{
    var url = $"https://graph.facebook.com/v21.0/{psid}"
            + $"?fields=name,first_name,last_name,profile_pic"
            + $"&access_token={_pageToken}";

    var res = await _http.GetFromJsonAsync<FacebookProfile>(url);
    return res;
}

// Su dung trong HandleMessageAsync lan dau nhan tin tu khach
if (isNewProfile)
{
    var fbProfile = await _messenger.GetUserProfileAsync(senderId);
    if (fbProfile != null)
        await _profileService.UpsertProfileAsync(
            chatbot.Id,
            phone: null,
            name: fbProfile.FirstName,
            messengerPsid: senderId);
}

Quyen truy cap: API lay profile can quyen "pages_messaging" va "pages_show_list". App o che do Development thi duoc lay profile cua test user. Production can submit app de duoc cap quyen chinh thuc.

6.3 Xu ly Postback (nut menu / Get Started)
Khi khach nhan nut "Get Started" lan dau hoac nut trong Persistent Menu, Meta gui Postback thay vi Message.

// Trong HandleMessageAsync
if (msg.Postback != null)
{
    var payload = msg.Postback.Payload;
    switch (payload)
    {
        case "GET_STARTED":
            await _messenger.SendQuickRepliesAsync(senderId,
                $"Xin chao! Chao mung ban den voi {chatbot.Name}.",
                ["Bang gia", "Dat lich", "Khuyen mai"]);
            break;
        case "BANG_GIA":
            // Xu ly nhu tin nhan "bang gia"
            await ProcessMessageAsync(senderId, chatbot, "bang gia dich vu");
            break;
        default:
            await ProcessMessageAsync(senderId, chatbot, payload);
            break;
    }
    return;
}

6.4 Persistent Menu (menu co dinh trong Messenger)
Setup menu co dinh de khach de tim thay cac chuc nang chinh. Goi 1 lan khi setup chatbot.

public async Task SetupPersistentMenuAsync()
{
    await _http.PostAsJsonAsync(
        $"https://graph.facebook.com/v21.0/me/messenger_profile"
        + $"?access_token={_pageToken}",
        new {
            persistent_menu = new[] {
                new {
                    locale = "default",
                    composer_input_disabled = false,
                    call_to_actions = new[] {
                        new { type = "postback", title = "Bang gia dich vu", payload = "BANG_GIA" },
                        new { type = "postback", title = "Dat lich hen",     payload = "DAT_LICH" },
                        new { type = "postback", title = "Lien he hotline",  payload = "LIEN_HE" }
                    },
                },
            },
        });
}

--------------------------------------------------
7. Gioi han & Chinh sach Meta can biet
--------------------------------------------------
- Do dai tin nhan: Toi da 2000 ky tu (SplitMessage() da xu ly phan nay)
- Quick Reply: Toi da 13 nut (Moi nut toi da 20 ky tu)
- Typing indicator: Tu dong tat sau 20s (Goi lai neu AI mat qua 20s)
- 24+1 Rule: 24h ke tu tin nhan cuoi (Sau 24h bot khong gui tu do duoc)
- Rate limit: 700 req/giay/page (Du thoai mai cho SME)
- App review: Can neu > 1000 nguoi dung (Giai doan dau khong can lo)
- Test users: Them trong App Roles (Max 25 nguoi khi app con la Dev)

24+1 Rule la quan trong nhat: Neu khach nhan tin, bot co 24h de tra loi tu do. Sau 24h chi duoc dung Message Tag (CONFIRMED_EVENT_UPDATE, POST_PURCHASE_UPDATE, ACCOUNT_UPDATE). Vi pham co the bi khoa Page. Bot chi nen tra loi khi co khach hoi truoc.

--------------------------------------------------
8. Huong dan Test
--------------------------------------------------

8.1 Test trong che do Development
- Khi app con la Development mode, chi co the test voi nhung nguoi duoc them vao App Roles.
- Vao app tren Meta for Developers -> App Roles -> Testers.
- Them Facebook account cua thanh vien team vao danh sach Testers.
- Tester can accept loi moi truoc khi test duoc.
- Nhan tin vao Page la test duoc ngay.

8.2 Test Webhook voi ngrok
# Cai ngrok
npm install -g ngrok

# Chay server .NET local
dotnet run  # chay o http://localhost:5000

# Expose ra internet bang ngrok
ngrok http 5000

# Lay URL dang: https://abc123.ngrok.io
# Dung URL nay lam Callback URL trong Meta Webhooks
# https://abc123.ngrok.io/api/messenger/webhook

Ngrok URL thay doi moi lan restart: Dung ngrok mien phi thi URL thay doi moi lan. Neu khong muon update lien tuc, dang ky ngrok free account de co URL co dinh (mien phi 1 static domain).

8.3 Test thu cong voi Graph API Explorer
Co the gia lap tin nhan den webhook de test ma khong can Messenger that:

# Dung curl gia lap webhook event tu Meta
curl -X POST https://abc123.ngrok.io/api/messenger/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=<tinh tu app_secret>" \
  -d '{
    "object": "page",
    "entry": [{
      "id": "PAGE_ID_123",
      "messaging": [{
        "sender":    {"id": "USER_PSID_456"},
        "recipient": {"id": "PAGE_ID_123"},
        "message":   {"mid": "mid.123", "text": "Bang gia nail la bao nhieu?""}
      }]
    }]
  }'

8.4 Checklist truoc khi go live
- [ ] Webhook URL dang ky thanh cong, Meta da verify (status "Active")
- [ ] POST /api/messenger/webhook xu ly duoc tin nhan test
- [ ] SignatureValidator tu choi request gia mao (test voi sai signature)
- [ ] Bot tra loi tin nhan trong < 5 giay (Messenger timeout 30s)
- [ ] Quick Replies hien thi dung 4 nut
- [ ] Tin nhan dai hon 2000 ky tu duoc tu dong chia nho
- [ ] Typing indicator hien thi truoc khi bot tra loi
- [ ] Luu lich su hoi thoai dung vao ChatMessages
- [ ] Multi-tenant: Page ID map dung sang ChatbotId

--------------------------------------------------
9. So sanh Web Widget va Messenger
--------------------------------------------------
- Khach hang biet dung: Web Widget (Khi vao website) | Messenger (Luc nao cung qua Facebook)
- Setup: Web Widget (Them 1 dong script vao website) | Messenger (Cau hinh webhook + Facebook Page)
- Nhu cau khach hang: Web Widget (Phai co website) | Messenger (Chi can Facebook Page)
- Engagement: Web Widget (Thap - phai vao web) | Messenger (Cao - Messenger la app hang ngay)
- Identity khach: Web Widget (Anh danh - sessionKey) | Messenger (Co ten + avatar Facebook)
- Session: Web Widget (Tab browser) | Messenger (PSID on dinh, khong het han)
- Re-engage: Web Widget (Khong duoc) | Messenger (Duoc trong 24h sau tin nhan cuoi)
- Duyet app: Web Widget (Khong can) | Messenger (Can khi > 1000 nguoi dung)
- Chi phi: Ca hai deu mien phi

Khuyen nghi: Xay ca hai. Web Widget cho khach hang chay Google Ads (landing page -> widget). Messenger cho chuoi doanh nghi?p co Facebook Page manh. Hai kenh bo sung cho nhau, khong loai tru. Them kenh = them diem tiep xuc voi khach = ti le convert cao hon.

--------------------------------------------------
10. Tai nguyen tham khao
--------------------------------------------------
- Meta Messenger Platform Docs: https://developers.facebook.com/docs/messenger-platform
- Send API Reference: https://developers.facebook.com/docs/messenger-platform/send-messages
- Webhook Reference: https://developers.facebook.com/docs/messenger-platform/webhooks
- Graph API Explorer (test API): https://developers.facebook.com/tools/explorer
- ngrok (expose localhost): https://ngrok.com

--------------------------------------------------
Thong tin App can luu lai (Dien sau khi tao app)
--------------------------------------------------
- App ID: 
- App Secret: (luu vao appsettings - KHONG commit git)
- Page Access Token: (luu vao DB, ma hoa AES-256)
- Verify Token: (tu dat, vi du: chatbot_verify_2024)
- Webhook URL: https://your-saas.com/api/messenger/webhook
- Facebook Page ID: (copy tu Page Settings -> Page ID)

--------------------------------------------------
Tai lieu noi bo -- Tich hop Facebook Messenger -- Phien ban 1.0
