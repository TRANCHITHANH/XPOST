using MediatR;
using XPost.Application.Interfaces;
using XPost.Domain.Interfaces;

namespace XPost.Application.Tenants.Queries.GetTenants;

public class TenantDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Domain { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class GetTenantsQuery : IRequest<List<TenantDto>>
{
}

public class GetTenantsQueryHandler : IRequestHandler<GetTenantsQuery, List<TenantDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetTenantsQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<List<TenantDto>> Handle(GetTenantsQuery request, CancellationToken cancellationToken)
    {
        var tenants = await _unitOfWork.Repository<Domain.Entities.Tenant>().GetAllAsync();

        return tenants.OrderByDescending(t => t.CreatedAt).Select(t => new TenantDto
        {
            Id = t.Id,
            Name = t.Name,
            Domain = t.Domain,
            IsActive = t.IsActive,
            CreatedAt = t.CreatedAt
        }).ToList();
    }
}
