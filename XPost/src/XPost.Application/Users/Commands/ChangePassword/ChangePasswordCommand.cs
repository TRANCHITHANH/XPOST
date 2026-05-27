using MediatR;
using XPost.Application.Interfaces;

namespace XPost.Application.Users.Commands.ChangePassword;

public class ChangePasswordCommand : IRequest<(bool Succeeded, string ErrorMessage)>
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class ChangePasswordCommandHandler : IRequestHandler<ChangePasswordCommand, (bool Succeeded, string ErrorMessage)>
{
    private readonly IAuthService _authService;
    private readonly ICurrentUserService _currentUserService;

    public ChangePasswordCommandHandler(IAuthService authService, ICurrentUserService currentUserService)
    {
        _authService = authService;
        _currentUserService = currentUserService;
    }

    public async Task<(bool Succeeded, string ErrorMessage)> Handle(ChangePasswordCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId;
        if (string.IsNullOrEmpty(userId)) return (false, "Unauthorized");

        return await _authService.ChangePasswordAsync(userId, request.CurrentPassword, request.NewPassword);
    }
}
