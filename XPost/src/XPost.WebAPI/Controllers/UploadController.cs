using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace XPost.WebAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class UploadController : ControllerBase
{
    private static readonly string[] ImageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    private static readonly string[] VideoExtensions = [".mp4", ".mov", ".webm"];
    private const long MaxImageSize = 5 * 1024 * 1024;       // 5 MB
    private const long MaxVideoSize = 100 * 1024 * 1024;     // 100 MB

    private readonly IWebHostEnvironment _env;

    public UploadController(IWebHostEnvironment env)
    {
        _env = env;
    }

    [HttpPost]
    [RequestSizeLimit(100 * 1024 * 1024)] // 100 MB max
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Vui lòng chọn file để upload." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var isImage = ImageExtensions.Contains(ext);
        var isVideo = VideoExtensions.Contains(ext);

        if (!isImage && !isVideo)
            return BadRequest(new { message = $"Định dạng '{ext}' không được hỗ trợ. Chỉ chấp nhận ảnh ({string.Join(", ", ImageExtensions)}) hoặc video ({string.Join(", ", VideoExtensions)})." });

        if (isImage && file.Length > MaxImageSize)
            return BadRequest(new { message = "Ảnh không được vượt quá 5 MB." });

        if (isVideo && file.Length > MaxVideoSize)
            return BadRequest(new { message = "Video không được vượt quá 100 MB." });

        var fileType = isImage ? "image" : "video";
        var subFolder = isImage ? "images" : "videos";
        var now = DateTime.UtcNow;
        var relativePath = Path.Combine("uploads", subFolder, now.Year.ToString(), now.Month.ToString("D2"));
        var absolutePath = Path.Combine(_env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"), relativePath);

        Directory.CreateDirectory(absolutePath);

        var fileName = $"{Guid.NewGuid()}{ext}";
        var filePath = Path.Combine(absolutePath, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var url = $"/{relativePath.Replace("\\", "/")}/{fileName}";

        return Ok(new
        {
            url,
            type = fileType,
            fileName = file.FileName,
            size = file.Length
        });
    }
}
