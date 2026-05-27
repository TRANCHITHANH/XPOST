using MediatR;
using Microsoft.AspNetCore.Identity;
using XPost.Domain.Entities;

namespace XPost.Application.Users.Commands.ToggleUserStatus;

public class ToggleUserStatusCommand : IRequest<(bool Succeeded, string ErrorMessage)>
{
    public string UserId { get; set; } = string.Empty;
}

public class ToggleUserStatusCommandHandler : IRequestHandler<ToggleUserStatusCommand, (bool Succeeded, string ErrorMessage)>
{
    private readonly UserManager<ApplicationUser> _userManager;

    public ToggleUserStatusCommandHandler(UserManager<ApplicationUser> userManager)
    {
        _userManager = userManager;
    }

    public async Task<(bool Succeeded, string ErrorMessage)> Handle(ToggleUserStatusCommand request, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(request.UserId);
        if (user == null)
            return (false, "Không tìm thấy nhân viên.");

        user.IsActive = !user.IsActive;
        user.UpdatedAtUtc = DateTime.UtcNow;

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
            return (false, string.Join(", ", result.Errors.Select(e => e.Description)));

        return (true, string.Empty);
    }
}
