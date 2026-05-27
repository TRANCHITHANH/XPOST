using Microsoft.AspNetCore.Mvc;
using XPost.Application.DTOs;
using XPost.Application.Interfaces;

namespace XPost.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto request)
    {
        var (succeeded, token, error) = await _authService.LoginAsync(request.Email, request.Password);
        
        if (!succeeded)
            return Unauthorized(new { Message = error });

        return Ok(new { Token = token });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDto request)
    {
        var (succeeded, error) = await _authService.RegisterAsync(request.Email, request.Password, request.FullName, request.FirstName, request.LastName);
        
        if (!succeeded)
            return BadRequest(new { Message = error });

        return Ok(new { Message = "Registration successful" });
    }
}
