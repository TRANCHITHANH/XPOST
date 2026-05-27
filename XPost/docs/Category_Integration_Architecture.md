# XPost SaaS Multi-Tenant & Integration Architecture

## 1. Tầm nhìn cốt lõi (Core Vision)
Hệ thống XPost đang chuyển đổi từ mô hình cá nhân đơn lẻ sang nền tảng **B2B SaaS (Đa khách thuê)**. Trọng tâm của sự thay đổi nằm ở việc các Chuyên mục (Category) và Bài viết (Post) sẽ xoay quanh các Cổng kết nối (Social Accounts / Integrations) thay vì quản lý thủ công rời rạc.

## 2. Cách ly Dữ liệu Công ty (Multi-Tenant Isolation)
Để phục vụ việc một Công ty có nhiều User cùng chia sẻ chung một nguồn tài nguyên:
- Bổ sung trường `TenantId` (Guid) vào tất cả các bảng dữ liệu lõi:
  - `ApplicationUser`
  - `Category`
  - `Post`
  - `SocialAccount`
- Backend (Entity Framework Core) có thể thiết lập cấu hình **Global Query Filter** để hệ thống tự động chỉ hiển thị và truy xuất dữ liệu thuộc về chính `TenantId` của công ty đang đăng nhập, đảm bảo bảo mật tuyệt đối.

## 3. Quản lý Kết nối Đa nền tảng (Integration Hub)
Bảng `SocialAccount` hiện hữu đóng vai trò như "Trạm kết nối trung tâm":
- Kênh tích hợp: Biến `Platform` dùng để nhận diện nền tảng (VD: WordPress, Blogger, Shopify...).
- Chứa Link API: Cột `ApiBaseUrl` chuyên dùng để lưu trữ link Domain hoặc Endpoint Website của khách hàng.
- Xác thực: Cột `ApiKey`, `AccessToken` lưu trữ token giao tiếp API.

## 4. Mô hình Đồng bộ Chuyên mục (Category Sync Model)
Chuyên mục sẽ không tạo tay, mà sẽ được **Đồng bộ tự động** từ mạng lưới các Nền tảng (SocialAccounts).

### Nâng cấp lược đồ cơ sở dữ liệu (Schema) cho Category
Thêm 3 trường quan trọng để định hình Category:
1. `TenantId` (Guid): Chuyên mục này thuộc thẩm quyền của Công ty nào.
2. `SocialAccountId` (Guid): Chuyên mục này được kéo từ Website/Nền tảng cụ thể nào (VD: Website wp-A hay wp-B).
3. `ExternalId` (string): Lưu lại ID số tự nhiên gốc do WordPress/Blogger sinh ra. Rất quan trọng để lúc đồng bộ nhiều lần không bị đẻ ra Category trùng lặp.

### Luồng nghiệp vụ (Business Flow)
1. **Liên kết Nền tảng:** Khách hàng thêm mới 1 Website WordPress, khai báo Domain (`ApiBaseUrl`) vào mục Tài khoản Liên kết.
2. **Kích hoạt Đồng bộ:** Tại màn hình Quản lý Chuyên mục, khách hàng bấm "Đồng bộ từ Website". Hệ thống XPost gọi API (VD: `/wp-json/wp/v2/categories`), bóc tách cây Danh mục Cha-Con và ánh xạ lưu vào local DB của XPost (Kèm ExternalId mỏ neo).
3. **Phân phối Nội dung:** Lúc nhân viên A viết một Post mới, phần mềm ép buộc chọn đích đến hiển thị (Website A). Dropdown Category lập tức filter sạch sẽ chỉ hiển thị những danh mục thuộc về Website A. Khi bấm Đăng (Publish), XPost thầm lặng sử dụng `ExternalId` để truyền cho WordPress API một cách nguyên bản nhất.
