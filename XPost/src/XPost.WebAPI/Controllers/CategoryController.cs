using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using XPost.Application.Categories.Commands.SyncCategories;
using XPost.Application.Categories.Queries.GetCategories;

namespace XPost.WebAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CategoryController : ControllerBase
{
    private readonly IMediator _mediator;

    public CategoryController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<IActionResult> GetCategories()
    {
        var query = new GetCategoriesQuery();
        var categories = await _mediator.Send(query);
        return Ok(categories);
    }

    [HttpPost("sync/{socialAccountId}")]
    public async Task<IActionResult> SyncCategories(Guid socialAccountId)
    {
        var command = new SyncCategoriesCommand { SocialAccountId = socialAccountId };
        var (succeeded, error) = await _mediator.Send(command);

        if (!succeeded)
            return BadRequest(new { Message = error });

        return Ok(new { Message = error }); // Returns the success message
    }
}
