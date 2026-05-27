namespace XPost.Domain.Interfaces;

public interface IMultiTenant
{
    Guid? TenantId { get; set; }
}
