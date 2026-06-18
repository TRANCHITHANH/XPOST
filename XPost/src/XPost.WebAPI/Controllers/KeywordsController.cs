using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using XPost.Application.Interfaces;
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
using XPost.Domain.Interfaces;
using XPost.Domain.Entities;
using System.Net.Http.Json;
using System.IO;

namespace XPost.WebAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class KeywordsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _webHostEnvironment;
    private readonly IAIService _aiService;

    public KeywordsController(
        IMediator mediator,
        IUnitOfWork unitOfWork,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        IWebHostEnvironment webHostEnvironment,
        IAIService aiService)
    {
        _mediator = mediator;
        _unitOfWork = unitOfWork;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _webHostEnvironment = webHostEnvironment;
        _aiService = aiService;
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

    [HttpPut("{id}/image")]
    public async Task<ActionResult<bool>> UpdateImage(Guid id, [FromBody] UpdateKeywordImageRequest req)
    {
        var keyword = await _unitOfWork.Repository<Keyword>().GetByIdAsync(id);
        if (keyword == null) return NotFound();

        keyword.ImageUrl = req.ImageUrl?.Trim();
        await _unitOfWork.Repository<Keyword>().UpdateAsync(keyword);
        await _unitOfWork.CompleteAsync();

        return Ok(true);
    }

    [HttpPost("{id}/generate-image")]
    public async Task<IActionResult> GenerateImage(Guid id, CancellationToken ct)
    {
        var keyword = await _unitOfWork.Repository<Keyword>().GetByIdAsync(id);
        if (keyword == null) return NotFound();

        var openAiApiKey = _configuration["OpenAI:ApiKey"];
        if (string.IsNullOrEmpty(openAiApiKey))
        {
            return BadRequest(new { message = "OpenAI API Key chưa được cấu hình." });
        }

        var prompt = $"Marketing illustration related to keyword '{keyword.Name}' and content: {keyword.GeneratedContent ?? keyword.Description}".Trim();
        if (prompt.Length > 1000) prompt = prompt[..1000];

        var requestBody = new
        {
            model = "dall-e-3",
            prompt = prompt,
            n = 1,
            size = "1024x1024",
            quality = "standard"
        };

        try
        {
            var httpClient = _httpClientFactory.CreateClient();
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/images/generations");
            request.Headers.Add("Authorization", $"Bearer {openAiApiKey}");
            request.Content = JsonContent.Create(requestBody);

            var response = await httpClient.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync(ct);
                return BadRequest(new { message = $"Lỗi OpenAI DALL-E 3: {err}" });
            }

            var jsonResult = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>(cancellationToken: ct);
            var imageUrl = jsonResult.GetProperty("data")[0].GetProperty("url").GetString();
            if (string.IsNullOrEmpty(imageUrl))
            {
                return BadRequest(new { message = "Không nhận được link ảnh từ OpenAI." });
            }

            // Download image locally to prevent link expiration
            var imageResponse = await httpClient.GetAsync(imageUrl, ct);
            if (!imageResponse.IsSuccessStatusCode)
            {
                return BadRequest(new { message = "Không thể tải ảnh từ link của OpenAI về máy." });
            }

            var rootPath = _webHostEnvironment.WebRootPath ?? Path.Combine(_webHostEnvironment.ContentRootPath, "wwwroot");
            var uploadsFolder = Path.Combine(rootPath, "uploads", "images");
            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }

            var fileName = $"{Guid.NewGuid():N}.png";
            var filePath = Path.Combine(uploadsFolder, fileName);

            using (var fs = new FileStream(filePath, FileMode.Create))
            {
                await imageResponse.Content.CopyToAsync(fs, ct);
            }

            var localUrl = $"/uploads/images/{fileName}";
            keyword.ImageUrl = localUrl;
            await _unitOfWork.Repository<Keyword>().UpdateAsync(keyword);
            await _unitOfWork.CompleteAsync();

            return Ok(new { imageUrl = localUrl });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Lỗi xử lý tạo ảnh: {ex.Message}" });
        }
    }

    [HttpPost("ai/custom")]
    public async Task<IActionResult> GenerateCustomAiContent([FromBody] CustomAiRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Prompt) || string.IsNullOrWhiteSpace(request.SelectedText))
        {
            return BadRequest(new { message = "Prompt và đoạn văn bản bôi đen không được để trống." });
        }

        try
        {
            var promptTemplate = $"Bạn là trợ lý AI biên tập văn bản. Hãy thực hiện yêu cầu sau đây với đoạn văn bản được cung cấp:\n" +
                                 $"Yêu cầu: {request.Prompt}\n\n" +
                                 $"Đoạn văn bản gốc:\n{request.SelectedText}\n\n" +
                                 $"Chỉ trả về đoạn văn bản đã được xử lý/viết lại, KHÔNG giải thích gì thêm, KHÔNG dùng markdown block code.";

            var content = await _aiService.GenerateContentAsync("CustomTask", promptTemplate);
            return Ok(new { generatedText = content.Trim() });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Lỗi AI: {ex.Message}" });
        }
    }
}

public record UpdateKeywordImageRequest(string ImageUrl);
public record CustomAiRequest(string Prompt, string SelectedText);
