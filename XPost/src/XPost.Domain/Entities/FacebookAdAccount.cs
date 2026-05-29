using XPost.Domain.Common;
using XPost.Domain.Interfaces;

namespace XPost.Domain.Entities;

public class FacebookAdAccount : BaseEntity, IMultiTenant
{
    public Guid? TenantId { get; set; }
    public string AdAccountId { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string AccessToken { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;

    // Navigation properties
    public ICollection<FacebookCampaign> Campaigns { get; set; } = new List<FacebookCampaign>();
}
