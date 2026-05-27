using MediatR;
using Microsoft.AspNetCore.Identity;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;

namespace XPost.Application.Users.Commands.CreateUser;

public class CreateUserCommand : IRequest<(bool Succeeded, string ErrorMessage)>
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
}

public class CreateUserCommandHandler : IRequestHandler<CreateUserCommand, (bool Succeeded, string ErrorMessage)>
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ICurrentUserService _currentUserService;
    private readonly IEmailService _emailService;

    public CreateUserCommandHandler(UserManager<ApplicationUser> userManager, ICurrentUserService currentUserService, IEmailService emailService)
    {
        _userManager = userManager;
        _currentUserService = currentUserService;
        _emailService = emailService;
    }

    public async Task<(bool Succeeded, string ErrorMessage)> Handle(CreateUserCommand request, CancellationToken cancellationToken)
    {
        // Kiểm tra email đã tồn tại
        if (await _userManager.FindByEmailAsync(request.Email) != null)
            return (false, "Email đã được sử dụng trên hệ thống.");

        // Lấy TenantId từ JWT của người tạo
        var tenantIdStr = _currentUserService.TenantId;
        Guid? tenantId = null;
        if (!string.IsNullOrEmpty(tenantIdStr))
            tenantId = Guid.Parse(tenantIdStr);

        var newUser = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            EmailConfirmed = true,
            FirstName = request.FirstName,
            LastName = request.LastName,
            FullName = $"{request.LastName} {request.FirstName}".Trim(),
            PhoneNumber = request.PhoneNumber,
            TenantId = tenantId,
            IsActive = true
        };

        var result = await _userManager.CreateAsync(newUser, request.Password);
        if (!result.Succeeded)
            return (false, string.Join(", ", result.Errors.Select(e => e.Description)));

        await _userManager.AddToRoleAsync(newUser, "User");

        // Gửi email thông báo
        var subject = "Thông báo tài khoản XPost mới";
        var body = $@"
            <h2>Kính chào {request.LastName} {request.FirstName},</h2>
            <p>Tài khoản hệ thống XPost của bạn đã được tạo thành công.</p>
            <p>Thông tin đăng nhập:</p>
            <ul>
                <li><strong>Email:</strong> {request.Email}</li>
                <li><strong>Mật khẩu:</strong> {request.Password}</li>
            </ul>
            <p>Vui lòng đăng nhập và đổi mật khẩu ngay sau lần đăng nhập đầu tiên để đảm bảo bảo mật.</p>
            <br/>
            <p>Trân trọng,<br/>Đội ngũ XPost</p>
        ";

        await _emailService.SendEmailAsync(request.Email, subject, body, true);

        return (true, string.Empty);
    }
}
