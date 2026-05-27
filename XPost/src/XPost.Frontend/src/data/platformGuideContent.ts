// ════════════════════════════════════════════════════════════════
//  Platform Guide Content
//  ────────────────────────────────────────────────────────────────
//  File dữ liệu hướng dẫn thiết lập từng nền tảng.
//  Bạn có thể cập nhật nội dung bất cứ lúc nào — chỉ cần sửa
//  mảng `platformGuides` bên dưới.
//
//  ▸ Mỗi guide có: id, title, platformId (khớp platformDefs),
//    icon, difficulty, estimatedTime, và danh sách steps.
//  ▸ Mỗi step hỗ trợ: title, content (HTML string), tips, warnings.
// ════════════════════════════════════════════════════════════════

export interface GuideStep {
    title: string;
    /** Nội dung HTML — hỗ trợ <code>, <strong>, <a>, <ul>/<ol>/<li>, <img> */
    content: string;
    /** Mẹo / gợi ý (hiện dưới dạng info box) */
    tips?: string[];
    /** Cảnh báo quan trọng (hiện dưới dạng warning box) */
    warnings?: string[];
}

export interface PlatformGuide {
    id: string;
    /** Tên nền tảng */
    title: string;
    /** ID platform khớp với platformDefs (vd: 'facebook', 'telegram', ...) */
    platformId: string;
    /** Mô tả ngắn gọn */
    description: string;
    /** Mức độ khó: 'easy' | 'medium' | 'advanced' */
    difficulty: 'easy' | 'medium' | 'advanced';
    /** Thời gian ước tính (vd: '5 phút', '10-15 phút') */
    estimatedTime: string;
    /** Ngày cập nhật (hiển thị cho người dùng biết guide còn mới) */
    lastUpdated: string;
    /** Các bước hướng dẫn */
    steps: GuideStep[];
}

// ════════════════════════════════════════════════════════════════
//  NỘI DUNG HƯỚNG DẪN — SỬA Ở ĐÂY
// ════════════════════════════════════════════════════════════════

export const platformGuides: PlatformGuide[] = [
    // ── Facebook ──────────────────────────────────────────────
    {
        id: 'facebook',
        title: 'Facebook Fanpage',
        platformId: 'facebook',
        description: 'Kết nối Fanpage qua OAuth để tự động đăng bài và ảnh.',
        difficulty: 'easy',
        estimatedTime: '3-5 phút',
        lastUpdated: '2026-05-13',
        steps: [
            {
                title: 'Yêu cầu trước khi bắt đầu',
                content: `
                    <p>Để kết nối Facebook Fanpage, bạn cần có:</p>
                    <ul>
                        <li>Tài khoản Facebook có quyền <strong>quản trị</strong> ít nhất 1 Fanpage.</li>
                        <li>Fanpage đã được <strong>công khai</strong> (không ở chế độ unpublished).</li>
                    </ul>
                `,
                tips: ['Nếu bạn chưa có Fanpage, hãy tạo mới tại <a href="https://www.facebook.com/pages/create" target="_blank">facebook.com/pages/create</a>.'],
            },
            {
                title: 'Bấm nút "Kết nối"',
                content: `
                    <p>Tại trang <strong>Nền tảng</strong>, tìm thẻ <strong>Facebook</strong> và nhấn nút <code>Kết nối</code>.</p>
                    <p>Một cửa sổ popup sẽ mở ra để bạn đăng nhập Facebook và cấp quyền cho ứng dụng.</p>
                `,
            },
            {
                title: 'Chọn Fanpage muốn kết nối',
                content: `
                    <p>Sau khi đăng nhập thành công, hệ thống sẽ hiển thị danh sách các Fanpage mà bạn quản trị.</p>
                    <p>Chọn 1 hoặc nhiều trang → nhấn <strong>Lưu</strong>.</p>
                `,
                tips: ['Bạn có thể kết nối nhiều Fanpage cùng lúc.'],
            },
        ],
    },

    // ── Telegram ──────────────────────────────────────────────
    {
        id: 'telegram',
        title: 'Telegram Bot',
        platformId: 'telegram',
        description: 'Gửi bài tự động đến Channel/Group thông qua Telegram Bot.',
        difficulty: 'medium',
        estimatedTime: '5-10 phút',
        lastUpdated: '2026-05-13',
        steps: [
            {
                title: 'Tạo Bot trên Telegram',
                content: `
                    <p>Mở Telegram, tìm <strong>@BotFather</strong> và gửi lệnh:</p>
                    <pre><code>/newbot</code></pre>
                    <p>Làm theo hướng dẫn để đặt tên bot. Sau khi tạo xong, BotFather sẽ gửi cho bạn một <strong>Bot Token</strong>.</p>
                `,
                warnings: ['Không chia sẻ Bot Token cho người khác — ai có token sẽ có toàn quyền điều khiển bot.'],
            },
            {
                title: 'Thêm Bot vào Channel/Group',
                content: `
                    <p>Mở Channel hoặc Group mà bạn muốn đăng bài → <strong>Thêm thành viên</strong> → tìm tên bot và thêm vào.</p>
                    <p>Nếu là <strong>Channel</strong>: thêm bot làm <strong>Admin</strong> với quyền "Post Messages".</p>
                    <p>Nếu là <strong>Group</strong>: chỉ cần thêm bot làm thành viên.</p>
                `,
            },
            {
                title: 'Lấy Chat ID',
                content: `
                    <p>Chat ID có thể là:</p>
                    <ul>
                        <li>Với <strong>Channel công khai</strong>: dùng <code>@tên_channel</code> (ví dụ: <code>@my_channel</code>).</li>
                        <li>Với <strong>Channel/Group riêng tư</strong>: dùng bot <a href="https://t.me/userinfobot" target="_blank">@userinfobot</a> hoặc forward tin nhắn từ channel để lấy ID số (ví dụ: <code>-1001234567890</code>).</li>
                    </ul>
                `,
                tips: ['Chat ID của channel/group thường bắt đầu bằng dấu trừ (-).'],
            },
            {
                title: 'Điền thông tin kết nối',
                content: `
                    <p>Tại trang <strong>Nền tảng</strong>, nhấn <code>Kết nối</code> ở thẻ Telegram. Nhập:</p>
                    <ul>
                        <li><strong>Tên tài khoản</strong>: Tên hiển thị tuỳ ý.</li>
                        <li><strong>Bot Token</strong>: Token nhận được từ BotFather.</li>
                        <li><strong>Chat ID</strong>: ID kênh/nhóm vừa lấy.</li>
                    </ul>
                    <p>Nhấn <strong>Kết nối</strong> để hoàn tất.</p>
                `,
            },
        ],
    },

    // ── WordPress ─────────────────────────────────────────────
    {
        id: 'wordpress',
        title: 'WordPress',
        platformId: 'wordpress',
        description: 'Đăng bài lên WordPress thông qua REST API.',
        difficulty: 'medium',
        estimatedTime: '5-10 phút',
        lastUpdated: '2026-05-13',
        steps: [
            {
                title: 'Yêu cầu',
                content: `
                    <p>Bạn cần có website WordPress self-hosted hoặc WordPress.com với:</p>
                    <ul>
                        <li>Quyền <strong>Administrator</strong> hoặc <strong>Editor</strong>.</li>
                        <li>REST API đã được bật (mặc định bật trên WordPress 4.7+).</li>
                        <li>Plugin <strong>Application Passwords</strong> (có sẵn từ WordPress 5.6).</li>
                    </ul>
                `,
            },
            {
                title: 'Tạo Application Password',
                content: `
                    <p>Đăng nhập WordPress Admin → <strong>Users → Profile</strong> → kéo xuống mục <strong>Application Passwords</strong>.</p>
                    <p>Nhập tên ứng dụng (ví dụ: "XPost") → nhấn <strong>Add New Application Password</strong>.</p>
                    <p>Sao chép mật khẩu hiển thị (chỉ hiện <strong>1 lần</strong>).</p>
                `,
                warnings: ['Hãy lưu Application Password ngay lập tức — sau khi đóng, bạn sẽ không thể xem lại.'],
            },
            {
                title: 'Cấu hình kết nối',
                content: `
                    <p>Tại trang <strong>Nền tảng</strong>, nhấn <code>Cấu hình thủ công</code> ở thẻ WordPress. Điền:</p>
                    <ul>
                        <li><strong>API Base URL</strong>: <code>https://your-site.com/wp-json</code></li>
                        <li><strong>Endpoint</strong>: <code>/wp/v2/posts</code></li>
                        <li><strong>Auth Type</strong>: Basic Auth (Application Password)</li>
                        <li><strong>API Key</strong>: Tên đăng nhập WordPress</li>
                        <li><strong>API Secret</strong>: Application Password vừa tạo</li>
                    </ul>
                `,
                tips: ['Nếu dùng WordPress.com, Base URL sẽ là <code>https://public-api.wordpress.com/wp/v2/sites/your-site.wordpress.com</code>.'],
            },
        ],
    },

    // ── Medium ────────────────────────────────────────────────
    {
        id: 'medium',
        title: 'Medium',
        platformId: 'medium',
        description: 'Đăng bài lên Medium với hỗ trợ Canonical URL.',
        difficulty: 'easy',
        estimatedTime: '3-5 phút',
        lastUpdated: '2026-05-13',
        steps: [
            {
                title: 'Lấy Integration Token',
                content: `
                    <p>Đăng nhập Medium → vào <strong>Settings → Security and apps → Integration tokens</strong>.</p>
                    <p>Nhập mô tả (ví dụ: "XPost") → nhấn <strong>Get token</strong>.</p>
                    <p>Sao chép token hiển thị.</p>
                `,
            },
            {
                title: 'Cấu hình trên XPost',
                content: `
                    <p>Tại trang <strong>Nền tảng</strong>, nhấn <code>Cấu hình thủ công</code> ở thẻ Medium. Điền:</p>
                    <ul>
                        <li><strong>API Base URL</strong>: <code>https://api.medium.com/v1</code></li>
                        <li><strong>Auth Type</strong>: Bearer Token</li>
                        <li><strong>Access Token</strong>: Integration Token vừa tạo</li>
                    </ul>
                `,
                tips: ['Medium hỗ trợ Canonical URL — giúp bài viết không bị đánh dấu trùng lặp khi SEO.'],
            },
        ],
    },

    // ── Dev.to ────────────────────────────────────────────────
    {
        id: 'devto',
        title: 'Dev.to',
        platformId: 'devto',
        description: 'Đăng bài lên cộng đồng Dev.to dành cho lập trình viên.',
        difficulty: 'easy',
        estimatedTime: '2-3 phút',
        lastUpdated: '2026-05-13',
        steps: [
            {
                title: 'Lấy API Key',
                content: `
                    <p>Đăng nhập Dev.to → vào <strong>Settings → Extensions → DEV Community API Keys</strong>.</p>
                    <p>Hoặc truy cập trực tiếp: <a href="https://dev.to/settings/extensions" target="_blank">dev.to/settings/extensions</a></p>
                    <p>Nhập mô tả → nhấn <strong>Generate API Key</strong> → sao chép key.</p>
                `,
            },
            {
                title: 'Cấu hình trên XPost',
                content: `
                    <p>Tại trang <strong>Nền tảng</strong>, nhấn <code>Cấu hình thủ công</code> ở thẻ Dev.to. Điền:</p>
                    <ul>
                        <li><strong>API Base URL</strong>: <code>https://dev.to/api</code></li>
                        <li><strong>Endpoint</strong>: <code>/articles</code></li>
                        <li><strong>Auth Type</strong>: API Key</li>
                        <li><strong>API Key</strong>: Key vừa tạo</li>
                    </ul>
                `,
            },
        ],
    },

    // ── Blogger ───────────────────────────────────────────────
    {
        id: 'blogger',
        title: 'Google Blogger',
        platformId: 'blogger',
        description: 'Đăng bài lên Blogger (Blogspot) qua Google OAuth2.',
        difficulty: 'easy',
        estimatedTime: '3-5 phút',
        lastUpdated: '2026-05-13',
        steps: [
            {
                title: 'Yêu cầu',
                content: `
                    <p>Bạn cần có:</p>
                    <ul>
                        <li>Tài khoản Google có blog trên <a href="https://www.blogger.com" target="_blank">Blogger</a>.</li>
                        <li>Blog đã được công khai.</li>
                    </ul>
                `,
            },
            {
                title: 'Kết nối qua OAuth',
                content: `
                    <p>Tại trang <strong>Nền tảng</strong>, nhấn <code>Kết nối</code> ở thẻ Blogger.</p>
                    <p>Đăng nhập tài khoản Google → cấp quyền cho ứng dụng.</p>
                    <p>Hệ thống sẽ tự động lấy thông tin blog và kết nối.</p>
                `,
                tips: ['Nếu bạn có nhiều blog, hệ thống sẽ kết nối blog mặc định (đầu tiên).'],
            },
        ],
    },

    // ── Threads ───────────────────────────────────────────────
    {
        id: 'threads',
        title: 'Threads (Meta)',
        platformId: 'threads',
        description: 'Đăng nội dung ngắn và hình ảnh lên Threads.',
        difficulty: 'medium',
        estimatedTime: '5-10 phút',
        lastUpdated: '2026-05-13',
        steps: [
            {
                title: 'Yêu cầu',
                content: `
                    <p>Để kết nối Threads, bạn cần có:</p>
                    <ul>
                        <li>Tài khoản Instagram/Threads.</li>
                        <li>Access Token từ Meta Threads API.</li>
                    </ul>
                `,
            },
            {
                title: 'Nhập Access Token',
                content: `
                    <p>Tại trang <strong>Nền tảng</strong>, nhấn <code>Kết nối</code> ở thẻ Threads.</p>
                    <p>Nhập <strong>Access Token</strong> vào form và nhấn <strong>Kết nối</strong>.</p>
                    <p>Hệ thống sẽ xác minh token và lấy thông tin tài khoản tự động.</p>
                `,
                warnings: ['Token của Threads có thời hạn — bạn cần gia hạn hoặc lấy token mới khi hết hạn.'],
            },
        ],
    },

    // ── Twitter/X ─────────────────────────────────────────────
    {
        id: 'twitter',
        title: 'Twitter / X',
        platformId: 'twitter',
        description: 'Đăng tweet tự động lên tài khoản cá nhân.',
        difficulty: 'medium',
        estimatedTime: '5 phút',
        lastUpdated: '2026-05-13',
        steps: [
            {
                title: 'Kết nối qua OAuth',
                content: `
                    <p>Tại trang <strong>Nền tảng</strong>, nhấn <code>Kết nối</code> ở thẻ Twitter/X.</p>
                    <p>Đăng nhập tài khoản Twitter → cấp quyền đăng bài cho ứng dụng.</p>
                    <p>Hệ thống sẽ tự động lưu thông tin kết nối.</p>
                `,
            },
        ],
    },

    // ── LinkedIn ──────────────────────────────────────────────
    {
        id: 'linkedin',
        title: 'LinkedIn',
        platformId: 'linkedin',
        description: 'Đăng bài tự động lên tài khoản LinkedIn cá nhân.',
        difficulty: 'medium',
        estimatedTime: '5 phút',
        lastUpdated: '2026-05-13',
        steps: [
            {
                title: 'Kết nối qua OAuth',
                content: `
                    <p>Tại trang <strong>Nền tảng</strong>, nhấn <code>Kết nối</code> ở thẻ LinkedIn.</p>
                    <p>Đăng nhập LinkedIn → cho phép ứng dụng đăng bài thay bạn.</p>
                    <p>Xác nhận thông tin tài khoản và lưu.</p>
                `,
            },
        ],
    },

    // ── Instagram ─────────────────────────────────────────────
    {
        id: 'instagram',
        title: 'Instagram Business',
        platformId: 'instagram',
        description: 'Đăng ảnh tự động lên tài khoản Instagram Business.',
        difficulty: 'medium',
        estimatedTime: '5 phút',
        lastUpdated: '2026-05-13',
        steps: [
            {
                title: 'Yêu cầu',
                content: `
                    <p>Bạn cần:</p>
                    <ul>
                        <li>Tài khoản Instagram <strong>Business</strong> hoặc <strong>Creator</strong> (không phải tài khoản cá nhân).</li>
                        <li>Tài khoản Instagram đã liên kết với <strong>Facebook Page</strong>.</li>
                    </ul>
                `,
                warnings: ['Instagram API không hỗ trợ tài khoản cá nhân — chỉ hoạt động với Business hoặc Creator.'],
            },
            {
                title: 'Kết nối qua OAuth',
                content: `
                    <p>Nhấn <code>Kết nối</code> ở thẻ Instagram → đăng nhập Facebook → cấp quyền Instagram.</p>
                    <p>Hệ thống sẽ tự động phát hiện tài khoản Instagram Business liên kết.</p>
                `,
            },
        ],
    },

    // ── Zalo OA ───────────────────────────────────────────────
    {
        id: 'zalo',
        title: 'Zalo Official Account',
        platformId: 'zalo',
        description: 'Đăng bài viết lên Zalo Official Account.',
        difficulty: 'medium',
        estimatedTime: '5-10 phút',
        lastUpdated: '2026-05-13',
        steps: [
            {
                title: 'Yêu cầu',
                content: `
                    <p>Bạn cần có <strong>Zalo Official Account</strong> (OA) đã được xác minh.</p>
                    <p>Đăng ký OA tại: <a href="https://oa.zalo.me" target="_blank">oa.zalo.me</a></p>
                `,
            },
            {
                title: 'Kết nối qua OAuth',
                content: `
                    <p>Nhấn <code>Kết nối</code> ở thẻ Zalo OA → đăng nhập Zalo → cấp quyền cho ứng dụng.</p>
                    <p>Xác nhận thông tin OA và nhấn <strong>Lưu</strong>.</p>
                `,
            },
        ],
    },

    // ── Website/API ───────────────────────────────────────────
    {
        id: 'website',
        title: 'Website / Custom API',
        platformId: 'website',
        description: 'Kết nối thủ công đến bất kỳ REST API nào.',
        difficulty: 'advanced',
        estimatedTime: '10-15 phút',
        lastUpdated: '2026-05-13',
        steps: [
            {
                title: 'Thông tin cần có',
                content: `
                    <p>Để kết nối API tuỳ chỉnh, bạn cần biết:</p>
                    <ul>
                        <li><strong>Base URL</strong> của API (ví dụ: <code>https://api.example.com</code>)</li>
                        <li><strong>Endpoint</strong> để tạo bài viết (ví dụ: <code>/posts</code>)</li>
                        <li><strong>Phương thức HTTP</strong> (POST / PUT)</li>
                        <li><strong>Cách xác thực</strong> (API Key, Bearer Token, OAuth...)</li>
                        <li><strong>Field mapping</strong> (JSON mô tả cách ánh xạ trường dữ liệu)</li>
                    </ul>
                `,
                warnings: ['Tính năng này dành cho người dùng có kiến thức kỹ thuật về REST API.'],
            },
            {
                title: 'Cấu hình kết nối',
                content: `
                    <p>Nhấn <code>Cấu hình thủ công</code> ở thẻ Website/API và điền đầy đủ các trường.</p>
                    <p>Nếu API yêu cầu custom headers, nhập dạng JSON:</p>
                    <pre><code>{"X-Custom-Header": "value", "Another-Header": "value2"}</code></pre>
                `,
                tips: [
                    'Field Mapping JSON giúp hệ thống biết cách ánh xạ dữ liệu từ XPost sang format API của bạn.',
                    'Thử gọi API bằng Postman/cURL trước để đảm bảo thông tin chính xác.'
                ],
            },
        ],
    },
];
