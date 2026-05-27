using MediatR;
using XPost.Application.Interfaces;

namespace XPost.Application.Users.Commands.UpdateProfile;

public class UpdateProfileCommand : IRequest<(bool Succeeded, string ErrorMessage)>
{
    public string FullName { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string CountryCode { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
}

public class UpdateProfileCommandHandler : IRequestHandler<UpdateProfileCommand, (bool Succeeded, string ErrorMessage)>
{
    private readonly IAuthService _authService;
    private readonly ICurrentUserService _currentUserService;

    public UpdateProfileCommandHandler(IAuthService authService, ICurrentUserService currentUserService)
    {
        _authService = authService;
        _currentUserService = currentUserService;
    }

    public async Task<(bool Succeeded, string ErrorMessage)> Handle(UpdateProfileCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId;
        if (string.IsNullOrEmpty(userId)) return (false, "Unauthorized");

        return await _authService.UpdateProfileAsync(userId, request.FullName, request.FirstName, request.LastName, request.PhoneNumber, request.CountryCode, request.AvatarUrl);
    }
}
