using MediatR;
using XPost.Domain.Interfaces;
using XPost.Domain.Entities;

namespace XPost.Application.Tenants.Commands.ToggleTenantStatus;

public class ToggleTenantStatusCommand : IRequest<(bool Succeeded, string ErrorMessage)>
{
    public Guid TenantId { get; set; }
}

public class ToggleTenantStatusCommandHandler : IRequestHandler<ToggleTenantStatusCommand, (bool Succeeded, string ErrorMessage)>
{
    private readonly IUnitOfWork _unitOfWork;

    public ToggleTenantStatusCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<(bool Succeeded, string ErrorMessage)> Handle(ToggleTenantStatusCommand request, CancellationToken cancellationToken)
    {
        var tenantRepo = _unitOfWork.Repository<Tenant>();
        var tenant = await tenantRepo.GetByIdAsync(request.TenantId);

        if (tenant == null)
            return (false, "Không tìm thấy khách hàng.");

        tenant.IsActive = !tenant.IsActive;

        await tenantRepo.UpdateAsync(tenant);
        await _unitOfWork.CompleteAsync();

        return (true, string.Empty);
    }
}
