using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using XPost.Application.Users.Commands.CreateUser;
using XPost.Application.Users.Commands.ResetUserPassword;
using XPost.Application.Users.Commands.ToggleUserStatus;
using XPost.Application.Users.Commands.UpdateUser;
using XPost.Application.Users.Queries.GetUsers;

namespace XPost.WebAPI.Controllers;

[Authorize(Roles = "SuperAdmin,TenantAdmin")]
[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly IMediator _mediator;

    public UsersController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        var result = await _mediator.Send(new GetUsersQuery());
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserCommand command)
    {
        var (succeeded, errorMessage) = await _mediator.Send(command);
        if (!succeeded) return BadRequest(new { Message = errorMessage });

        return Ok(new { Message = "Đã tạo nhân viên mới và gửi email thông báo thành công." });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateUser(string id, [FromBody] UpdateUserCommand command)
    {
        command.UserId = id;
        var (succeeded, errorMessage) = await _mediator.Send(command);
        if (!succeeded) return BadRequest(new { Message = errorMessage });

        return Ok(new { Message = "Đã cập nhật thông tin nhân viên." });
    }

    [HttpPut("{id}/toggle-status")]
    public async Task<IActionResult> ToggleStatus(string id)
    {
        var (succeeded, errorMessage) = await _mediator.Send(new ToggleUserStatusCommand { UserId = id });
        if (!succeeded) return BadRequest(new { Message = errorMessage });

        return Ok(new { Message = "Đã cập nhật trạng thái nhân viên." });
    }

    [HttpPost("{id}/reset-password")]
    public async Task<IActionResult> ResetPassword(string id)
    {
        var (succeeded, errorMessage) = await _mediator.Send(new ResetUserPasswordCommand { UserId = id });
        if (!succeeded) return BadRequest(new { Message = errorMessage });

        return Ok(new { Message = "Đã đặt lại mật khẩu và gửi email cho nhân viên." });
    }
}
