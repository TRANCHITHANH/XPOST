using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using XPost.Application.DTOs;
using XPost.Application.SocialAccounts.Queries.GetActiveSocialAccounts;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;

namespace XPost.WebAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class SocialAccountsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IUnitOfWork _unitOfWork;

    public SocialAccountsController(IMediator mediator, IUnitOfWork unitOfWork)
    {
        _mediator = mediator;
        _unitOfWork = unitOfWork;
    }

    // GET: api/socialaccounts
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var repo = _unitOfWork.Repository<SocialAccount>();
        var accounts = await repo.GetAsync(a => a.UserId == userId);

        var result = accounts.OrderBy(a => a.Platform).Select(a => new
        {
            a.Id,
            a.Platform,
            a.AccountName,
            a.AccountIdentifier,
            a.AvatarUrl,
            a.ApiBaseUrl,
            a.ApiPostEndpoint,
            a.ApiMethod,
            a.AuthType,
            a.ApiKey,
            a.ApiSecret,
            a.AccessToken,
            a.RefreshToken,
            a.TokenExpiredAtUtc,
            a.CustomHeadersJson,
            a.FieldMappingJson,
            a.IsActive,
            CreatedAtUtc = a.CreatedAt
        }).ToList();

        return Ok(result);
    }

    // GET: api/socialaccounts/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var repo = _unitOfWork.Repository<SocialAccount>();
        var account = await repo.GetByIdAsync(id);

        if (account == null) return NotFound();
        if (account.UserId != userId) return Forbid();

        return Ok(new
        {
            account.Id,
            account.Platform,
            account.AccountName,
            account.AccountIdentifier,
            account.AvatarUrl,
            account.ApiBaseUrl,
            account.ApiPostEndpoint,
            account.ApiMethod,
            account.AuthType,
            account.ApiKey,
            account.ApiSecret,
            account.AccessToken,
            account.RefreshToken,
            account.TokenExpiredAtUtc,
            account.CustomHeadersJson,
            account.FieldMappingJson,
            account.IsActive,
            CreatedAtUtc = account.CreatedAt
        });
    }

    // POST: api/socialaccounts
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSocialAccountDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var repo = _unitOfWork.Repository<SocialAccount>();
        var account = new SocialAccount
        {
            UserId = userId,
            Platform = dto.Platform,
            AccountName = dto.AccountName,
            AccountIdentifier = dto.AccountIdentifier,
            ApiBaseUrl = dto.ApiBaseUrl,
            ApiPostEndpoint = dto.ApiPostEndpoint,
            ApiMethod = dto.ApiMethod,
            AuthType = dto.AuthType,
            ApiKey = dto.ApiKey,
            ApiSecret = dto.ApiSecret,
            AccessToken = dto.AccessToken,
            RefreshToken = dto.RefreshToken,
            TokenExpiredAtUtc = dto.TokenExpiredAtUtc,
            CustomHeadersJson = dto.CustomHeadersJson,
            FieldMappingJson = dto.FieldMappingJson,
            IsActive = dto.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        await repo.AddAsync(account);
        await _unitOfWork.CompleteAsync();

        return Ok(new { account.Id, message = "Social account created successfully." });
    }

    // PUT: api/socialaccounts/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateSocialAccountDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var repo = _unitOfWork.Repository<SocialAccount>();
        var account = await repo.GetByIdAsync(id);

        if (account == null) return NotFound();
        if (account.UserId != userId) return Forbid();

        account.Platform = dto.Platform;
        account.AccountName = dto.AccountName;
        account.AccountIdentifier = dto.AccountIdentifier;
        account.ApiBaseUrl = dto.ApiBaseUrl;
        account.ApiPostEndpoint = dto.ApiPostEndpoint;
        account.ApiMethod = dto.ApiMethod;
        account.AuthType = dto.AuthType;
        account.ApiKey = dto.ApiKey;
        account.ApiSecret = dto.ApiSecret;
        account.AccessToken = dto.AccessToken;
        account.RefreshToken = dto.RefreshToken;
        account.TokenExpiredAtUtc = dto.TokenExpiredAtUtc;
        account.CustomHeadersJson = dto.CustomHeadersJson;
        account.FieldMappingJson = dto.FieldMappingJson;
        account.IsActive = dto.IsActive;
        account.UpdatedAt = DateTime.UtcNow;

        await repo.UpdateAsync(account);
        await _unitOfWork.CompleteAsync();

        return Ok(new { message = "Social account updated successfully." });
    }

    // DELETE: api/socialaccounts/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var repo = _unitOfWork.Repository<SocialAccount>();
        var account = await repo.GetByIdAsync(id);

        if (account == null) return NotFound();
        if (account.UserId != userId) return Forbid();

        await repo.DeleteAsync(account);
        await _unitOfWork.CompleteAsync();

        return Ok(new { message = "Social account deleted successfully." });
    }
}
