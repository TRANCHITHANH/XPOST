using MediatR;
using Microsoft.AspNetCore.Identity;
using XPost.Domain.Entities;

namespace XPost.Application.Users.Commands.UpdateUser;

public class UpdateUserCommand : IRequest<(bool Succeeded, string ErrorMessage)>
{
    public string UserId { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? PhoneNumber { get; set; }
}

public class UpdateUserCommandHandler : IRequestHandler<UpdateUserCommand, (bool Succeeded, string ErrorMessage)>
{
    private readonly UserManager<ApplicationUser> _userManager;

    public UpdateUserCommandHandler(UserManager<ApplicationUser> userManager)
    {
        _userManager = userManager;
    }

    public async Task<(bool Succeeded, string ErrorMessage)> Handle(UpdateUserCommand request, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(request.UserId);
        if (user == null)
            return (false, "Không tìm thấy nhân viên.");

        user.FirstName = request.FirstName;
        user.LastName = request.LastName;
        user.FullName = request.FullName ?? $"{request.LastName} {request.FirstName}".Trim();
        user.PhoneNumber = request.PhoneNumber;
        user.UpdatedAtUtc = DateTime.UtcNow;

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
            return (false, string.Join(", ", result.Errors.Select(e => e.Description)));

        return (true, string.Empty);
    }
}
