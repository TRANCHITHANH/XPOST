using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MediatR;
using System.Security.Claims;
using XPost.Application.Keywords.Queries.GetKeywords;
using XPost.Application.Keywords.Commands.CreateKeyword;
using XPost.Application.Keywords.Commands.UpdateKeyword;
using XPost.Application.Keywords.Commands.DeleteKeyword;
using XPost.Application.Keywords.Commands.ImportKeywords;
using XPost.Application.Keywords.Commands.GenerateContent;
using XPost.Application.Keywords.Commands.Syndicate;
using XPost.Application.Posts.Commands.PublishPost;
using XPost.Application.DTOs;
using XPost.Domain.Enums;

namespace XPost.WebAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class KeywordsController : ControllerBase
{
    private readonly IMediator _mediator;

    public KeywordsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<List<KeywordDto>>> GetKeywords()
    {
        return await _mediator.Send(new GetKeywordsQuery());
    }

    [HttpPost]
    public async Task<ActionResult<Guid>> CreateKeyword([FromBody] CreateKeywordCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpPost("import")]
    public async Task<ActionResult<int>> ImportKeywords([FromBody] ImportKeywordsCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<bool>> UpdateKeyword(Guid id, [FromBody] UpdateKeywordCommand command)
    {
        if (id != command.Id) return BadRequest("ID mismatch");
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<bool>> DeleteKeyword(Guid id)
    {
        var result = await _mediator.Send(new DeleteKeywordCommand { Id = id });
        return Ok(result);
    }


    [HttpPost("{id}/generate")]
    public async Task<ActionResult<bool>> GenerateContent(Guid id, [FromQuery] ContentGenerationType type = ContentGenerationType.ShortIntro)
    {
        var result = await _mediator.Send(new GenerateContentFromKeywordCommand { KeywordId = id, Type = type });
        if (!result) return BadRequest("Failed to generate content.");
        return Ok(result);
    }

    [HttpPost("{id}/syndicate")]
    public async Task<ActionResult<PublishPostResult>> Syndicate(Guid id, [FromBody] PublishPostRequestDto dto)
    {
        var userId = User.FindFirstValue(System.Security.Claims.ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var result = await _mediator.Send(new KeywordSyndicationCommand
        {
            KeywordId = id,
            SocialAccountIds = dto.SocialAccountIds,
            UserId = userId
        });

        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }
}
