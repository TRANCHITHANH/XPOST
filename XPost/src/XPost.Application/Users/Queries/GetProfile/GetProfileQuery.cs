using MediatR;
using XPost.Application.DTOs;
using XPost.Application.Interfaces;

namespace XPost.Application.Users.Queries.GetProfile;

public class GetProfileQuery : IRequest<ProfileDto?>
{
}

public class GetProfileQueryHandler : IRequestHandler<GetProfileQuery, ProfileDto?>
{
    private readonly IAuthService _authService;
    private readonly ICurrentUserService _currentUserService;

    public GetProfileQueryHandler(IAuthService authService, ICurrentUserService currentUserService)
    {
        _authService = authService;
        _currentUserService = currentUserService;
    }

    public async Task<ProfileDto?> Handle(GetProfileQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId;
        if (string.IsNullOrEmpty(userId)) return null;

        return await _authService.GetProfileAsync(userId);
    }
}
