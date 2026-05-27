# Bug Report & Yêu Cầu Sửa: Ảnh Bị Giữ Link Ngrok Khi Đăng Lên DEV.to và Blogger

## Tổng Quan Vấn Đề

Hệ thống hiện đang truyền **URL ảnh từ ngrok (server nội bộ tạm thời)** sang các nền tảng thay vì thực hiện đúng quy trình upload ảnh lên từng nền tảng. Điều này gây ra 2 lỗi cụ thể trên DEV.to và Blogger.

---

## Lỗi 1: DEV.to – Nhận Link Ngrok, Không Lưu Ảnh Nội Bộ

### Biểu Hiện
- Bài viết trên DEV.to chứa link ảnh dạng `https://<id>.ngrok.io/...` thay vì URL ảnh của DEV.to.

### Nguyên Nhân
DEV.to **không tự lưu trữ ảnh từ URL ngoài** vào hệ thống của họ.

Khi hệ thống gửi một URL ảnh bên ngoài (ngrok), DEV.to có 2 hành vi:
1. **Nếu dùng đúng endpoint upload ảnh chính thức của DEV.to** (`POST /api/articles` với binary ảnh hoặc upload API riêng): DEV.to lưu ảnh lên CDN của họ và cấp URL nội bộ → đây là hành vi đúng.
2. **Nếu chỉ truyền URL ảnh ngoài vào nội dung bài viết**: DEV.to giữ nguyên URL đó, mỗi lần bài được load thì DEV.to **gọi ngược lại (callback)** vào URL ngrok để lấy ảnh → không lưu trữ, phụ thuộc vào server tạm của mình, sẽ vỡ khi ngrok tắt.

### Hướng Xử Lý
Trước khi tạo/cập nhật bài viết trên DEV.to, hệ thống phải:
1. Gọi **endpoint upload ảnh chính thức/nội bộ của DEV.to** với file ảnh thực (binary).
2. Nhận về **URL ảnh CDN của DEV.to** (dạng `https://dev-to-uploads.s3.amazonaws.com/...`).
3. Gắn URL đó vào nội dung bài → mới gửi request tạo/cập nhật bài viết.

---

## Lỗi 2: Blogger – Ảnh Không Hiện Ngoài Dù Đã Nhận Nội Dung

### Biểu Hiện
- Nhìn trong giao diện quản trị của Blogger: ảnh hiển thị bình thường (vì ngrok đang chạy, fetch được).
- Nhìn từ **ngoài blog** (public view, người đọc thực tế): ảnh **không hiện**.
- Khi inspect link ảnh trong bài: thấy link là `https://<id>.ngrok.io/...` thay vì link công khai của Blogger/Google.

### Nguyên Nhân
Blogger **không upload ảnh lên Google Photos/Blogger CDN** nếu chỉ nhận URL ngoài trong nội dung HTML.

- Khi nội dung bài được đăng với `<img src="https://<id>.ngrok.io/...">`, Blogger giữ nguyên link đó.
- Trong quản trị: ảnh có thể thấy được vì ngrok còn sống, hoặc Blogger caching tạm.
- Ngoài public: nếu ngrok đã hết phiên / URL bị block / CORS chặn → ảnh không tải được.
- Ngoài ra, một số trình duyệt và Blogger CDN có thể **từ chối load ảnh từ nguồn không đáng tin cậy (ngrok)** theo chính sách bảo mật.

### Hướng Xử Lý
Trước khi tạo/cập nhật bài viết trên Blogger, hệ thống phải:
1. Upload ảnh lên **Google Blogger Media API** hoặc **Google Photos API** được liên kết với tài khoản Blogger.
2. Nhận về **URL công khai dạng `https://lh3.googleusercontent.com/...`** hoặc tương đương.
3. Gắn URL đó vào nội dung bài → mới gửi request tạo/cập nhật bài.

---

## Nguyên Nhân Gốc Rễ Chung

> Hệ thống hiện đang **bỏ qua bước upload ảnh lên từng nền tảng** và thay vào đó truyền thẳng URL ảnh từ server nội bộ (ngrok) vào nội dung bài viết.

Đây là vi phạm trực tiếp quy trình **Upload-First Per Platform** đã định nghĩa.

---

## Luồng Sai Hiện Tại (Cần Sửa)

```
[Người dùng bấm đăng bài]
        ↓
[Hệ thống lấy URL ảnh từ ngrok: https://<id>.ngrok.io/image.jpg]
        ↓
[Gắn URL ngrok vào nội dung bài]
        ↓
[Gửi bài lên DEV.to / Blogger với URL ngrok]
        ↓
❌ DEV.to gọi lại ngrok mỗi lần load bài
❌ Blogger lưu link ngrok → ảnh không hiện ngoài public
```

---

## Luồng Đúng Cần Áp Dụng (Upload-First Per Platform)

```
[Người dùng bấm đăng bài]
        ↓
[Với MỖI nền tảng, chạy tiến trình độc lập:]

  ── DEV.to ──────────────────────────────────────────────────────
  [1] Upload file ảnh lên DEV.to Media Upload API
  [2] Nhận URL ảnh CDN của DEV.to (https://dev-to-uploads.s3...)
  [3] Gắn URL đó vào nội dung bài dành cho DEV.to
  [4] POST /api/articles lên DEV.to với đầy đủ ảnh + nội dung ✅

  ── Blogger ──────────────────────────────────────────────────────
  [1] Upload file ảnh lên Blogger/Google Media API
  [2] Nhận URL công khai của Blogger (https://lh3.googleusercontent...)
  [3] Gắn URL đó vào nội dung bài dành cho Blogger
  [4] POST bài lên Blogger với đầy đủ ảnh + nội dung ✅
```

---

## Ràng Buộc Tuyệt Đối

| Ràng buộc | Mô tả |
|---|---|
| Không dùng URL ngrok | URL ngrok là tạm thời, sẽ chết sau phiên làm việc |
| Không dùng chéo URL | URL ảnh của DEV.to không được dùng cho bài Blogger và ngược lại |
| Upload trước – đăng sau | Phải có URL ảnh thuộc nền tảng đó thì mới đăng bài lên nền tảng đó |
| Mỗi nền tảng = 1 tiến trình riêng | Các nền tảng chạy song song, không chia sẻ dữ liệu ảnh |

---

## Lưu Ý Mở Rộng

Nguyên tắc này phải được thiết kế theo dạng **generic adapter** để khi thêm nền tảng mới (Medium, Hashnode, LinkedIn...), mỗi nền tảng chỉ cần implement đúng 2 method:

```
uploadImage(file) → platformImageUrl
publishPost(content_with_platform_image_url) → postUrl
```

Không hardcode logic xử lý ảnh cho từng nền tảng trong luồng chung.
