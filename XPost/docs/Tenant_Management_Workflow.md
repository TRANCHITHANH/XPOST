# Quy Trình Quản Lý & Phân Quyền Tenant (B2B SaaS)

Để hoàn thiện mô hình SaaS đa khách thuê, XPost cần được phân cấp phân quyền (RBAC) rõ ràng, tách biệt hoàn toàn luồng quản trị hệ thống và luồng sử dụng của khách hàng.

## 1. Hệ thống Phân quyền (Roles & Permissions)
Chúng ta sẽ kích hoạt cơ chế `IdentityRole` của ASP.NET Core với 3 cấp độ:
1. **SuperAdmin (Chủ sở hữu hệ thống):** Là bạn. Chỉ SuperAdmin mới thấy menu "Quản lý Hệ thống". Có đặc quyền tạo mới Công ty (Tenant), cấp phát tài trợ, hoặc khóa/đình chỉ Công ty vi phạm.
2. **TenantAdmin (Giám đốc Khách hàng):** Cấp độ cao nhất trong phạm vi 1 Công ty (TenantId). Được quyền truy cập mục "Hồ sơ doanh nghiệp", cấu hình Mã số thuế, Nguồn tiền, Mời/Đuổi việc nhân viên khỏi công ty.
3. **User (Nhân viên):** Nhân viên bình thường. Chỉ được phép Đăng bài, trả lời Comment, xem Analytics của công ty, không có quyền can thiệp setting của công ty.

---

## 2. Quy trình (Workflow) Vận Hành

### Bước 1: Khởi tạo dữ liệu lõi (Seed Data)
- Ngay khi server Backend .NET khởi chạy, hệ thống sẽ tự động quét SQL:
  - Nếu chưa có Roles, tự sinh 3 Role: `SuperAdmin`, `TenantAdmin`, `User`.
  - Nếu chưa có tài khoản chủ, tự đẻ ra 1 User `admin@xpost.vn` mang Role `SuperAdmin`.

### Bước 2: SuperAdmin Tạo Mới Công Ty
- **Frontend Route:** `/admin/tenants` (Chỉ Route này mới hiện khi Login bằng tài khoản SuperAdmin).
- **Thao tác:** Bạn (SuperAdmin) nhấn nút **"Thêm Công ty mới"**:
  1. Giao diện yêu cầu nhập: Tên Công ty, Tên miền.
  2. Kèm thông tin "Tài khoản Giám đốc" (Email & Mật khẩu khởi tạo).
  3. Bấm Submit -> Backend tạo ra 1 Record `Tenant` + 1 Record `User` mang Role `TenantAdmin` và gắn liền vào `TenantId` mới tạo.

### Bước 3: Khách hàng (Company) Đăng Nhập
- Khách hàng (Giám đốc) dùng Email mà bạn cấp để đăng nhập.
- Backend trả về JWT Token chứa Role `TenantAdmin` và ID Công ty của họ (`TenantId`). Lập tức giao diện React sẽ lọc sạch sẽ các chức năng, chỉ hiển thị "Môi trường của công ty họ".

### Bước 4: Khách hàng Tự Cập Nhật Hồ Sơ Công ty
- **Frontend Route:** `/settings/company`
- **Thao tác:** Khách hàng (có Role `TenantAdmin`) bấm vào menu "Hồ sơ Doanh nghiệp". Tại đây họ có sẵn Form Upload Logo, nhập Mã số thuế, PhoneNumber, Address.
- Backend xác thực bằng `TenantId` lấy từ Token, update bảng `Tenants` gọn gàng bảo mật.

---

## 3. Kế hoạch Coding (Next Steps)
1. Cấu hình EF Core Identity Role và viết Logic Seed SuperAdmin.
2. Thiết kế `AdminController` dành riêng cho SuperAdmin để quản lý các `Tenant`.
3. Xây dựng giao diện React Quản trị Hệ Thống.
4. Xây dựng giao diện React "Thiết lập Công ty" để Khách tự cập nhật TaxCode, Địa chỉ...
