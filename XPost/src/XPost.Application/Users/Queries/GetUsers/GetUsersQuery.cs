using MediatR;
using Microsoft.AspNetCore.Identity;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;

namespace XPost.Application.Users.Queries.GetUsers;

public class UserListItemDto
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? PhoneNumber { get; set; }
    public string? AvatarUrl { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public string RoleName { get; set; } = string.Empty;
    public string? TenantName { get; set; }
    public Guid? TenantId { get; set; }
}

public class GetUsersQuery : IRequest<List<UserListItemDto>>
{
}

public class GetUsersQueryHandler : IRequestHandler<GetUsersQuery, List<UserListItemDto>>
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ICurrentUserService _currentUserService;
    private readonly IUnitOfWork _unitOfWork;

    public GetUsersQueryHandler(UserManager<ApplicationUser> userManager, ICurrentUserService currentUserService, IUnitOfWork unitOfWork)
    {
        _userManager = userManager;
        _currentUserService = currentUserService;
        _unitOfWork = unitOfWork;
    }

    public async Task<List<UserListItemDto>> Handle(GetUsersQuery request, CancellationToken cancellationToken)
    {
        var allUsers = _userManager.Users.ToList();

        // Phân quyền: TenantAdmin chỉ thấy user cùng TenantId
        var currentUserId = _currentUserService.UserId;
        var currentUser = currentUserId != null ? await _userManager.FindByIdAsync(currentUserId) : null;
        var currentRoles = currentUser != null ? await _userManager.GetRolesAsync(currentUser) : new List<string>();
        var isSuperAdmin = currentRoles.Contains("SuperAdmin");

        IEnumerable<ApplicationUser> filteredUsers;

        if (isSuperAdmin)
        {
            // SuperAdmin thấy tất cả, trừ chính mình
            filteredUsers = allUsers.Where(u => u.Id != currentUserId);
        }
        else
        {
            // TenantAdmin chỉ thấy user trong cùng tenant, trừ chính mình
            var tenantId = _currentUserService.TenantId;
            if (string.IsNullOrEmpty(tenantId))
                return new List<UserListItemDto>();

            var tenantGuid = Guid.Parse(tenantId);
            filteredUsers = allUsers.Where(u => u.TenantId == tenantGuid && u.Id != currentUserId);
        }

        // Lấy tên Tenant
        var tenantRepo = _unitOfWork.Repository<Tenant>();
        var tenants = await tenantRepo.GetAllAsync();
        var tenantDict = tenants.ToDictionary(t => t.Id, t => t.Name);

        var result = new List<UserListItemDto>();
        foreach (var user in filteredUsers)
        {
            var roles = await _userManager.GetRolesAsync(user);
            result.Add(new UserListItemDto
            {
                Id = user.Id,
                Email = user.Email ?? "",
                FullName = user.FullName,
                FirstName = user.FirstName,
                LastName = user.LastName,
                PhoneNumber = user.PhoneNumber,
                AvatarUrl = user.AvatarUrl,
                IsActive = user.IsActive,
                CreatedAtUtc = user.CreatedAtUtc,
                RoleName = roles.FirstOrDefault() ?? "User",
                TenantId = user.TenantId,
                TenantName = user.TenantId.HasValue && tenantDict.ContainsKey(user.TenantId.Value) ? tenantDict[user.TenantId.Value] : null
            });
        }

        return result.OrderByDescending(x => x.CreatedAtUtc).ToList();
    }
}
