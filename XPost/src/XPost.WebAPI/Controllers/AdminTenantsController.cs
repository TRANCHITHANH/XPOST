using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using XPost.Application.Tenants.Commands.CreateTenant;
using XPost.Application.Tenants.Queries.GetTenants;

namespace XPost.WebAPI.Controllers;

[Authorize(Roles = "SuperAdmin")]
[ApiController]
[Route("api/admin/[controller]")]
public class TenantsController : ControllerBase
{
    private readonly IMediator _mediator;

    public TenantsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost]
    public async Task<IActionResult> CreateTenant([FromBody] CreateTenantCommand command)
    {
        var (succeeded, tenantId, errorMessage) = await _mediator.Send(command);
        
        if (!succeeded)
            return BadRequest(new { Message = errorMessage });

        return Ok(new { Message = "Đã tạo Công ty và Cấp phát tài khoản Giám đốc thành công", TenantId = tenantId });
    }

    [HttpGet]
    public async Task<IActionResult> GetTenants()
    {
        var result = await _mediator.Send(new GetTenantsQuery());
        return Ok(result);
    }

    [HttpPut("{id}/toggle-status")]
    public async Task<IActionResult> ToggleStatus(Guid id)
    {
        var (succeeded, errorMessage) = await _mediator.Send(new XPost.Application.Tenants.Commands.ToggleTenantStatus.ToggleTenantStatusCommand { TenantId = id });
        if (!succeeded) return BadRequest(new { Message = errorMessage });
        
        return Ok(new { Message = "Đã cập nhật trạng thái khách hàng." });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateTenant(Guid id, [FromBody] XPost.Application.Tenants.Commands.UpdateSystemTenant.UpdateSystemTenantCommand command)
    {
        command.TenantId = id;
        var (succeeded, errorMessage) = await _mediator.Send(command);
        if (!succeeded) return BadRequest(new { Message = errorMessage });
        
        return Ok(new { Message = "Đã cập nhật thông tin khách hàng." });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteTenant(Guid id)
    {
        var (succeeded, errorMessage) = await _mediator.Send(new XPost.Application.Tenants.Commands.DeleteTenant.DeleteTenantCommand { TenantId = id });
        if (!succeeded) return BadRequest(new { Message = errorMessage });
        
        return Ok(new { Message = "Đã xóa khách hàng thành công." });
    }
}
