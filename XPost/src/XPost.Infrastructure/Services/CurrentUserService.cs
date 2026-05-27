using Microsoft.AspNetCore.Http;
using System.Security.Claims;
using XPost.Application.Interfaces;

namespace XPost.Infrastructure.Services;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public string? UserId => _httpContextAccessor.HttpContext?.User?.FindFirstValue(ClaimTypes.NameIdentifier);
    
    // For future multi-tenancy
    public string? TenantId => _httpContextAccessor.HttpContext?.User?.FindFirstValue("TenantId");
}
