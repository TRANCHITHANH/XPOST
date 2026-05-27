# Yêu Cầu: Tối Ưu Tiến Trình Đăng Bài Đa Nền Tảng – Xử Lý Xung Đột Ảnh Upload vs Ảnh URL

## Bối cảnh & Vấn đề

Hệ thống hiện đang gặp xung đột khi xử lý đồng thời hai loại ảnh trong cùng một bài viết:
- **Ảnh cụ thể (Local Image):** Ảnh được người dùng tải lên trực tiếp từ thiết bị.
- **Ảnh URL (Remote Image):** Ảnh lấy từ đường dẫn trên internet.

Yêu cầu áp dụng phương pháp mới dưới đây cho **tất cả nền tảng hiện tại và các nền tảng sẽ được tích hợp thêm trong tương lai**.

---

## Phương Pháp Mới: Upload-First Per Platform

### Trigger

Khi người dùng thực hiện một trong hai hành động:
- Nhấn nút **"Tạo bài viết"**
- Nhấn nút **"Cập nhật & Đăng lên đa nền tảng"**

Hệ thống lập tức khởi chạy **song song các tiến trình độc lập**, mỗi tiến trình tương ứng với một nền tảng được chọn đăng.

---

### Luồng Xử Lý Cho MỖI Nền Tảng (Độc Lập Hoàn Toàn)

```
[Bước 1] Upload ảnh cụ thể (Local Image) lên chính nền tảng đó
         ↓
[Bước 2] Nhận URL ảnh trả về từ nền tảng đó (URL gốc của nền tảng)
         ↓
[Bước 3] Gắn URL ảnh vừa nhận vào phần nội dung bài viết
         ↓
[Bước 4] Đăng/cập nhật bài viết lên nền tảng đó với đầy đủ: ảnh + nội dung
```

---

## Ràng Buộc Bắt Buộc

> ⚠️ **TUYỆT ĐỐI KHÔNG** tái sử dụng URL ảnh từ nền tảng này sang nền tảng khác trong cùng một bài viết.

- URL ảnh thu được sau khi upload lên **nền tảng A** chỉ được dùng cho bài viết trên **nền tảng A**.
- Tương tự, URL ảnh của **nền tảng B** chỉ thuộc về bài viết trên **nền tảng B**.
- Lý do: Người dùng có thể chọn đăng **đồng thời lên tất cả nền tảng trong một lần**, nên các tiến trình chạy song song và hoàn toàn tách biệt nhau về dữ liệu ảnh.

---

## Tính Mở Rộng

Thiết kế luồng này phải có tính **generic** – không hardcode cho từng nền tảng cụ thể – để khi tích hợp thêm nền tảng mới, hệ thống tự động áp dụng đúng cùng quy trình mà không cần chỉnh sửa logic lõi.

---

## Tóm Tắt Nguyên Tắc Cốt Lõi

| Nguyên tắc | Mô tả |
|---|---|
| Upload-First | Ảnh local phải được upload lên nền tảng trước, lấy URL xong mới đăng nội dung |
| Per-Platform Isolation | Mỗi nền tảng là một tiến trình độc lập, dữ liệu ảnh không chia sẻ chéo |
| Parallel Execution | Các nền tảng chạy song song, không chờ nhau |
| Generic Design | Không hardcode nền tảng, dễ mở rộng khi thêm mới |
