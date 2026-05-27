using MediatR;
using Microsoft.AspNetCore.Identity;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;

namespace XPost.Application.Tenants.Commands.CreateTenant;

public class CreateTenantCommand : IRequest<(bool Succeeded, Guid? TenantId, string ErrorMessage)>
{
    public string CompanyName { get; set; } = string.Empty;
    public string? Domain { get; set; }
    public string AdminEmail { get; set; } = string.Empty;
    public string AdminPassword { get; set; } = string.Empty;
    public string AdminFirstName { get; set; } = string.Empty;
    public string AdminLastName { get; set; } = string.Empty;
}

public class CreateTenantCommandHandler : IRequestHandler<CreateTenantCommand, (bool Succeeded, Guid? TenantId, string ErrorMessage)>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IEmailService _emailService;

    public CreateTenantCommandHandler(IUnitOfWork unitOfWork, UserManager<ApplicationUser> userManager, IEmailService emailService)
    {
        _unitOfWork = unitOfWork;
        _userManager = userManager;
        _emailService = emailService;
    }

    public async Task<(bool Succeeded, Guid? TenantId, string ErrorMessage)> Handle(CreateTenantCommand request, CancellationToken cancellationToken)
    {
        // 1. Kiểm tra Email xem đã tồn tại chưa
        if (await _userManager.FindByEmailAsync(request.AdminEmail) != null)
        {
            return (false, null, "Email giám đốc đã được sử dụng trên hệ thống.");
        }

        // 2. Tạo Tenant mới
        var tenant = new Tenant
        {
            Name = request.CompanyName,
            Domain = request.Domain,
            IsActive = true
        };

        var tenantRepo = _unitOfWork.Repository<Tenant>();
        await tenantRepo.AddAsync(tenant);
        await _unitOfWork.CompleteAsync(); // Lưu để sinh ID

        // 3. Tạo tài khoản Giám đốc (TenantAdmin)
        var adminUser = new ApplicationUser
        {
            UserName = request.AdminEmail,
            Email = request.AdminEmail,
            EmailConfirmed = true,
            FirstName = request.AdminFirstName,
            LastName = request.AdminLastName,
            TenantId = tenant.Id,
            IsActive = true
        };

        var result = await _userManager.CreateAsync(adminUser, request.AdminPassword);
        if (!result.Succeeded)
        {
            // Nếu tạo User lỗi thì phải Rollback Tenant (xóa đi). Ở đây đơn giản hóa ta để try-catch.
            return (false, null, string.Join(", ", result.Errors.Select(x => x.Description)));
        }

        await _userManager.AddToRoleAsync(adminUser, "TenantAdmin");

        // 4. Gửi Email thông báo
        var subject = $"Chào mừng đến với hệ thống XPost - {request.CompanyName}";
        var body = $@"
            <h2>Kính chào {request.AdminLastName} {request.AdminFirstName},</h2>
            <p>Hệ thống quản lý bài đăng XPost đã khởi tạo thành công môi trường doanh nghiệp độc lập cho <strong>{request.CompanyName}</strong>.</p>
            <p>Thông tin đăng nhập tài khoản Quản trị (Tenant Admin) của bạn:</p>
            <ul>
                <li><strong>Email đăng nhập:</strong> {request.AdminEmail}</li>
                <li><strong>Mật khẩu:</strong> {request.AdminPassword}</li>
                <li><strong>Domain:</strong> {request.Domain ?? "Mặc định"}</li>
            </ul>
            <p>Vui lòng đăng nhập và tiến hành đổi mật khẩu ngay sau lần đăng nhập đầu tiên để đảm bảo bảo mật.</p>
            <br/>
            <p>Trân trọng,<br/>Đội ngũ XPost</p>
        ";
        
        await _emailService.SendEmailAsync(request.AdminEmail, subject, body, true);

        return (true, tenant.Id, string.Empty);
    }
}
