using MediatR;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;

namespace XPost.Application.Tenants.Commands.UpdateTenantProfile;

public class UpdateTenantProfileCommand : IRequest<(bool Succeeded, string ErrorMessage)>
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

public class UpdateTenantProfileCommandHandler : IRequestHandler<UpdateTenantProfileCommand, (bool Succeeded, string ErrorMessage)>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUserService;

    public UpdateTenantProfileCommandHandler(IUnitOfWork unitOfWork, ICurrentUserService currentUserService)
    {
        _unitOfWork = unitOfWork;
        _currentUserService = currentUserService;
    }

    public async Task<(bool Succeeded, string ErrorMessage)> Handle(UpdateTenantProfileCommand request, CancellationToken cancellationToken)
    {
        var tenantIdStr = _currentUserService.TenantId;
        if (string.IsNullOrEmpty(tenantIdStr) || !Guid.TryParse(tenantIdStr, out var tenantId))
        {
            return (false, "Lỗi phân quyền: Không xác định được Công ty của bạn.");
        }

        var tenantRepo = _unitOfWork.Repository<Tenant>();
        var tenant = await tenantRepo.GetByIdAsync(tenantId);
        
        if (tenant == null)
            return (false, "Không tìm thấy hồ sơ Công ty.");

        tenant.Name = request.Name;
        tenant.Description = request.Description;
        tenant.LogoUrl = request.LogoUrl;
        tenant.Domain = request.Domain;
        tenant.TaxCode = request.TaxCode;
        tenant.Representative = request.Representative;
        tenant.Email = request.Email;
        tenant.PhoneNumber = request.PhoneNumber;
        tenant.Address = request.Address;
        tenant.PostCode = request.PostCode;

        await tenantRepo.UpdateAsync(tenant);
        await _unitOfWork.CompleteAsync();

        return (true, string.Empty);
    }
}
