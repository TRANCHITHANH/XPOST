using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using XPost.Application.Tenants.Commands.UpdateTenantProfile;

namespace XPost.WebAPI.Controllers;

[Authorize(Roles = "TenantAdmin,SuperAdmin")] // SuperAdmin can also update if they log in as that tenant context
[ApiController]
[Route("api/tenants/profile")]
public class TenantProfileController : ControllerBase
{
    private readonly IMediator _mediator;

    public TenantProfileController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPut]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateTenantProfileCommand command)
    {
        var (succeeded, errorMessage) = await _mediator.Send(command);
        
        if (!succeeded)
            return BadRequest(new { Message = errorMessage });

        return Ok(new { Message = "Đã cập nhật Hồ sơ doanh nghiệp thành công." });
    }
    [HttpGet]
    public async Task<IActionResult> GetProfile()
    {
        var result = await _mediator.Send(new XPost.Application.Tenants.Queries.GetTenantProfile.GetTenantProfileQuery());
        if (result == null) return NotFound(new { Message = "Không tìm thấy hồ sơ doanh nghiệp." });
        
        return Ok(result);
    }
}
