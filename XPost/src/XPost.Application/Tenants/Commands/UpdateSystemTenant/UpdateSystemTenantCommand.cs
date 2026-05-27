using MediatR;
using XPost.Domain.Interfaces;
using XPost.Domain.Entities;

namespace XPost.Application.Tenants.Commands.UpdateSystemTenant;

public class UpdateSystemTenantCommand : IRequest<(bool Succeeded, string ErrorMessage)>
{
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Domain { get; set; }
}

public class UpdateSystemTenantCommandHandler : IRequestHandler<UpdateSystemTenantCommand, (bool Succeeded, string ErrorMessage)>
{
    private readonly IUnitOfWork _unitOfWork;

    public UpdateSystemTenantCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<(bool Succeeded, string ErrorMessage)> Handle(UpdateSystemTenantCommand request, CancellationToken cancellationToken)
    {
        // Require name
        if (string.IsNullOrWhiteSpace(request.Name))
            return (false, "Tên công ty không được để trống.");

        var tenantRepo = _unitOfWork.Repository<Tenant>();
        var tenant = await tenantRepo.GetByIdAsync(request.TenantId);

        if (tenant == null)
            return (false, "Không tìm thấy khách hàng.");

        tenant.Name = request.Name;
        tenant.Domain = request.Domain;

        await tenantRepo.UpdateAsync(tenant);
        await _unitOfWork.CompleteAsync();

        return (true, string.Empty);
    }
}
