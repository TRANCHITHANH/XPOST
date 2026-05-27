using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using XPost.Application.DTOs;
using XPost.Application.Interfaces;
using XPost.Application.Users.Commands.ChangePassword;
using XPost.Application.Users.Commands.UpdateProfile;

using XPost.Application.Users.Queries.GetProfile;

namespace XPost.WebAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ProfileController : ControllerBase
{
    private readonly IMediator _mediator;

    public ProfileController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<ProfileDto>> GetProfile()
    {
        var query = new GetProfileQuery();
        var result = await _mediator.Send(query);
        
        if (result == null) return NotFound(new { Message = "Profile not found" });

        return Ok(result);
    }

    [HttpPut]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileCommand command)
    {
        var (succeeded, error) = await _mediator.Send(command);
        
        if (!succeeded)
            return BadRequest(new { Message = error });

        return Ok(new { Message = "Profile updated successfully" });
    }

    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordCommand command)
    {
        var (succeeded, error) = await _mediator.Send(command);
        
        if (!succeeded)
            return BadRequest(new { Message = error });

        return Ok(new { Message = "Password changed successfully" });
    }

    [HttpPost("avatar")]
    public async Task<IActionResult> UploadAvatar(IFormFile file, [FromServices] IFileService fileService, [FromServices] ICurrentUserService currentUserService, [FromServices] IAuthService authService)
    {
        var userId = currentUserService.UserId;
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        if (file == null || file.Length == 0)
            return BadRequest(new { Message = "Please provide an image file." });

        // Save file
        using var stream = file.OpenReadStream();
        var fileUrl = await fileService.SaveFileAsync(stream, file.FileName, "avatars");

        // Update profile with new avatar
        var profile = await authService.GetProfileAsync(userId);
        if (profile != null)
        {
            await authService.UpdateProfileAsync(userId, profile.FullName, profile.FirstName, profile.LastName, profile.PhoneNumber, profile.CountryCode, fileUrl);
        }

        return Ok(new { AvatarUrl = fileUrl });
    }
}
