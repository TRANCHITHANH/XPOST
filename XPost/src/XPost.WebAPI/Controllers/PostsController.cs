using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using XPost.Application.DTOs;
using XPost.Application.Posts.Commands.CreatePost;
using XPost.Application.Posts.Commands.UpdatePost;
using XPost.Application.Posts.Commands.DeletePost;
using XPost.Application.Posts.Commands.PublishPost;
using XPost.Application.Posts.Queries.GetPostById;
using XPost.Application.Posts.Queries.GetPosts;
using XPost.Application.Posts.Queries.GetPostStats;

namespace XPost.WebAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class PostsController : ControllerBase
{
    private readonly IMediator _mediator;

    public PostsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<PostDto>>> GetPosts(
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? keyword = null,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] int? status = null)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var query = new GetPostsQuery
        {
            UserId = userId,
            PageIndex = pageIndex,
            PageSize = pageSize,
            Keyword = keyword,
            CategoryId = categoryId,
            Status = status
        };
        var posts = await _mediator.Send(query);
        return Ok(posts);
    }

    [HttpGet("stats")]
    public async Task<ActionResult<PostStatsDto>> GetStats()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var query = new GetPostStatsQuery { UserId = userId };
        var stats = await _mediator.Send(query);
        return Ok(stats);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<PostDto>> GetPost(Guid id)
    {
        var result = await _mediator.Send(new GetPostByIdQuery { Id = id });
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<PostDto>> CreatePost([FromBody] CreatePostDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var command = new CreatePostCommand { UserId = userId, Dto = dto };
        var post = await _mediator.Send(command);

        return CreatedAtAction(nameof(GetPost), new { id = post.Id }, post);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<PostDto>> UpdatePost(Guid id, [FromBody] UpdatePostDto dto)
    {
        if (id != dto.Id)
            return BadRequest("ID mismatch");

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var result = await _mediator.Send(new UpdatePostCommand
        {
            UserId = userId,
            Dto = dto
        });
        return Ok(result);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeletePost(Guid id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        await _mediator.Send(new DeletePostCommand
        {
            Id = id,
            UserId = userId
        });
        return NoContent();
    }

    /// <summary>
    /// Publish a post to selected social accounts (immediately or scheduled).
    /// </summary>
    [HttpPost("{id}/publish")]
    public async Task<ActionResult<PublishPostResult>> PublishPost(Guid id, [FromBody] PublishPostRequestDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var result = await _mediator.Send(new PublishPostCommand
        {
            PostId = id,
            SocialAccountIds = dto.SocialAccountIds,
            ScheduledTimeUtc = dto.ScheduledTimeUtc,
            UserId = userId
        });

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }
}

public class PublishPostRequestDto
{
    public List<Guid> SocialAccountIds { get; set; } = new();
    public DateTime? ScheduledTimeUtc { get; set; }
}
