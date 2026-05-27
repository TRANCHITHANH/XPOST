using MediatR;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;

namespace XPost.Application.Tenants.Queries.GetTenantProfile;

public class TenantProfileDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? LogoUrl { get; set; }
    public string? Domain { get; set; }
    public string? TaxCode { get; set; }
    public string? Representative { get; set; }
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Address { get; set; }
    public string? PostCode { get; set; }
}

public class GetTenantProfileQuery : IRequest<TenantProfileDto?>
{
}

public class GetTenantProfileQueryHandler : IRequestHandler<GetTenantProfileQuery, TenantProfileDto?>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUserService;

    public GetTenantProfileQueryHandler(IUnitOfWork unitOfWork, ICurrentUserService currentUserService)
    {
        _unitOfWork = unitOfWork;
        _currentUserService = currentUserService;
    }

    public async Task<TenantProfileDto?> Handle(GetTenantProfileQuery request, CancellationToken cancellationToken)
    {
        var tenantIdStr = _currentUserService.TenantId;
        if (string.IsNullOrEmpty(tenantIdStr) || !Guid.TryParse(tenantIdStr, out var tenantId))
        {
            return null;
        }

        var tenant = await _unitOfWork.Repository<Tenant>().GetByIdAsync(tenantId);
        if (tenant == null) return null;

        return new TenantProfileDto
        {
            Name = tenant.Name,
            Description = tenant.Description,
            LogoUrl = tenant.LogoUrl,
            Domain = tenant.Domain,
            TaxCode = tenant.TaxCode,
            Representative = tenant.Representative,
            Email = tenant.Email,
            PhoneNumber = tenant.PhoneNumber,
            Address = tenant.Address,
            PostCode = tenant.PostCode
        };
    }
}
