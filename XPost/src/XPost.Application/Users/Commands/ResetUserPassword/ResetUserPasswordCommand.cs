using MediatR;
using Microsoft.AspNetCore.Identity;
using XPost.Application.Common.Helpers;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;

namespace XPost.Application.Users.Commands.ResetUserPassword;

public class ResetUserPasswordCommand : IRequest<(bool Succeeded, string ErrorMessage)>
{
    public string UserId { get; set; } = string.Empty;
}

public class ResetUserPasswordCommandHandler : IRequestHandler<ResetUserPasswordCommand, (bool Succeeded, string ErrorMessage)>
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IEmailService _emailService;

    public ResetUserPasswordCommandHandler(UserManager<ApplicationUser> userManager, IEmailService emailService)
    {
        _userManager = userManager;
        _emailService = emailService;
    }

    public async Task<(bool Succeeded, string ErrorMessage)> Handle(ResetUserPasswordCommand request, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(request.UserId);
        if (user == null)
            return (false, "Không tìm thấy nhân viên.");

        // Sinh mật khẩu ngẫu nhiên mới
        var newPassword = StringHelper.GenerateRandomPassword(12);

        // Reset password
        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var result = await _userManager.ResetPasswordAsync(user, token, newPassword);
        if (!result.Succeeded)
            return (false, string.Join(", ", result.Errors.Select(e => e.Description)));

        // Gửi email thông báo mật khẩu mới
        var subject = "XPost - Mật khẩu của bạn đã được đặt lại";
        var body = $@"
            <h2>Kính chào {user.LastName} {user.FirstName},</h2>
            <p>Mật khẩu tài khoản XPost của bạn đã được quản trị viên đặt lại.</p>
            <p>Thông tin đăng nhập mới:</p>
            <ul>
                <li><strong>Email:</strong> {user.Email}</li>
                <li><strong>Mật khẩu mới:</strong> {newPassword}</li>
            </ul>
            <p>Vui lòng đăng nhập và đổi mật khẩu ngay để đảm bảo bảo mật.</p>
            <br/>
            <p>Trân trọng,<br/>Đội ngũ XPost</p>
        ";

        await _emailService.SendEmailAsync(user.Email!, subject, body, true);

        return (true, string.Empty);
    }
}
