build lại source phân theo thư mục d:\Dropbox\XPost\publish\  tách các thư mục API ,frontend,worker

# Hướng dẫn Publish và Deployment - XPost Platform

Tài liệu này hướng dẫn cách đóng gói (publish) mã nguồn và triển khai hệ thống XPost lên môi trường Production.

---

## 1. Yêu cầu hệ thống (Prerequisites)

- **Backend**: .NET 10.0 SDK.
- **Frontend**: Node.js v18+ & npm.
- **Database**: SQL Server 2019+.
- **Nền tảng**: Windows Server (IIS) hoặc Linux (Nginx + Kestrel).

---

## 2. Quy trình Publish mã nguồn

### Bước 1: Build Frontend (React)
Di chuyển vào thư mục frontend và chạy lệnh build:

npm run build 2>&1


```powershell
cd src/XPost.Frontend
npm install
npm run build
```
Kết quả build sẽ nằm tại: `src/XPost.Frontend/dist`

### Bước 2: Publish Backend (ASP.NET Core API)

dotnet publish src/XPost.WebAPI -c Release -o publish/api 2>&1 | Select-Object -Last 15
Chạy lệnh publish tại thư mục gốc của solution:
```powershell
dotnet publish src/XPost.WebAPI -c Release -o publish/api
```
Kết quả publish sẽ nằm tại: `publish/api`

### Bước 3: Tổ chức thư mục Deployment
Copy thư mục `dist` của frontend vào thư mục publish của backend để dễ quản lý:
```powershell
# Tạo thư mục con 'frontend' trong thư mục publish (tùy chọn theo cấu trúc server)
Copy-Item "src/XPost.Frontend/dist" -Destination "publish/api/wwwroot" -Recurse
```

---

## 3. Cấu hình Production (Configuration)

### Cập nhật `appsettings.Production.json`
Trên server, chỉnh sửa file cấu hình trong thư mục `publish/api`:

- **ConnectionStrings**: Trỏ tới database production.
- **Jwt**: Đảm bảo `Key` là mã bảo mật mạnh.
- **Facebook**: 
  - `AppId` & `AppSecret`: Lấy từ Facebook Developer.
  - `RedirectUri`: Phải trùng với domain production và được đăng ký trong Facebook Login settings.

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=YOUR_SERVER;Database=XPostDB;User Id=sa;Password=YOUR_PASSWORD;TrustServerCertificate=True"
  },
  "Facebook": {
    "AppId": "1461715378919602",
    "AppSecret": "YOUR_SECRET",
    "RedirectUri": "https://yourdomain.com/api/social/callback/facebook"
  }
}
```

---

## 4. Triển khai Database

Chạy các Scripts SQL trong thư mục `docs/` để khởi tạo database nếu triển khai lần đầu:
1. `docs/database.txt` (Schema gốc - nếu có).
2. `docs/01_AddMultiTenantColumns.sql` (Cấu hình Multi-tenant).

---

## 5. Hosting & Runner

### Chạy Backend (Kestrel trực tiếp)
```powershell
cd publish/api
dotnet XPost.WebAPI.dll --urls "http://0.0.0.0:5000"
```

### Sử dụng IIS (Windows)
1. Cài đặt **.NET Core Hosting Bundle**.
2. Tạo Website mới trỏ vào thư mục `publish/api`.
3. Chỉnh sửa Application Pool sang "No Managed Code".

### Sử dụng Nginx (Linux)
Cấu hình reverse proxy trỏ về port 5000 (mặc định của Kestrel):
```nginx
location /api {
    proxy_pass http://localhost:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection keep-alive;
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}

location / {
    root /var/www/xpost/frontend;
    try_files $uri $uri/ /index.html;
}
```

---

## 6. Lưu ý về Social Integration (Facebook OAuth)

Để luồng **One-Click Connect** hoạt động chính xác trên môi trường thật:
1. Domain của frontend phải là HTTPS.
2. Facebook App phải được chuyển sang chế độ **Live**.
3. Các quyền `pages_show_list`, `pages_manage_posts` cần được Facebook duyệt (với quyền Business công cộng).
