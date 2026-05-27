using MediatR;
using XPost.Domain.Interfaces;
using XPost.Domain.Entities;

namespace XPost.Application.Tenants.Commands.DeleteTenant;

public class DeleteTenantCommand : IRequest<(bool Succeeded, string ErrorMessage)>
{
    public Guid TenantId { get; set; }
}

public class DeleteTenantCommandHandler : IRequestHandler<DeleteTenantCommand, (bool Succeeded, string ErrorMessage)>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeleteTenantCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<(bool Succeeded, string ErrorMessage)> Handle(DeleteTenantCommand request, CancellationToken cancellationToken)
    {
        var tenantRepo = _unitOfWork.Repository<Tenant>();
        var tenant = await tenantRepo.GetByIdAsync(request.TenantId);

        if (tenant == null)
            return (false, "Không tìm thấy khách hàng.");

        tenant.IsDeleted = true;
        tenant.IsActive = false; // Block it functionally as well

        await tenantRepo.UpdateAsync(tenant);
        await _unitOfWork.CompleteAsync();

        return (true, string.Empty);
    }
}
