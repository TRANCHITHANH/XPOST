using MediatR;
using System.Net.Http;
using System.Text.Json;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;

namespace XPost.Application.Categories.Commands.SyncCategories;

public class SyncCategoriesCommand : IRequest<(bool Succeeded, string ErrorMessage)>
{
    public Guid SocialAccountId { get; set; }
}

public class SyncCategoriesCommandHandler : IRequestHandler<SyncCategoriesCommand, (bool Succeeded, string ErrorMessage)>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IHttpClientFactory _httpClientFactory;

    public SyncCategoriesCommandHandler(IUnitOfWork unitOfWork, IHttpClientFactory httpClientFactory)
    {
        _unitOfWork = unitOfWork;
        _httpClientFactory = httpClientFactory;
    }

    public async Task<(bool Succeeded, string ErrorMessage)> Handle(SyncCategoriesCommand request, CancellationToken cancellationToken)
    {
        var socialAccountRepo = _unitOfWork.Repository<SocialAccount>();
        var socialAccount = await socialAccountRepo.GetByIdAsync(request.SocialAccountId);
            
        if (socialAccount == null)
            return (false, "Tài khoản liên kết không tồn tại.");

        if (string.IsNullOrEmpty(socialAccount.ApiBaseUrl))
            return (false, "Tài khoản liên kết chưa được cấu hình API URL.");

        // Fetch WordPress Categories
        var url = $"{socialAccount.ApiBaseUrl.TrimEnd('/')}/wp-json/wp/v2/categories?per_page=100";
        HttpResponseMessage response;
        try 
        {
            var _httpClient = _httpClientFactory.CreateClient();
            response = await _httpClient.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
                return (false, $"Lỗi từ WordPress API: {response.StatusCode}");
        }
        catch (Exception ex)
        {
            return (false, $"Không thể kết nối tới WordPress: {ex.Message}");
        }

        var contentStream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(contentStream, cancellationToken: cancellationToken);
        var wpCategories = document.RootElement;
        
        if (wpCategories.ValueKind != JsonValueKind.Array)
            return (false, "Dữ liệu trả về từ WordPress không hợp lệ.");

        var categoryRepo = _unitOfWork.Repository<Category>();
        var allCategories = await categoryRepo.GetAllAsync();
        var existingForAccount = allCategories.Where(c => c.SocialAccountId == request.SocialAccountId).ToList();

        int syncedCount = 0;
        foreach (var wpCat in wpCategories.EnumerateArray())
        {
            var wpId = wpCat.GetProperty("id").GetInt32().ToString();
            var name = wpCat.GetProperty("name").GetString() ?? "Unknown";
            var slug = wpCat.GetProperty("slug").GetString() ?? name.ToLower();
            
            // Try to get description
            string description = "";
            if (wpCat.TryGetProperty("description", out var descElement))
                description = descElement.GetString() ?? "";

            var existingCategory = existingForAccount.FirstOrDefault(c => c.ExternalId == wpId);

            if (existingCategory == null)
            {
                var newCategory = new Category
                {
                    Name = name,
                    Slug = slug,
                    Description = description,
                    ExternalId = wpId,
                    SocialAccountId = request.SocialAccountId,
                    TenantId = socialAccount.TenantId,
                    IsActive = true
                };
                await categoryRepo.AddAsync(newCategory);
            }
            else
            {
                existingCategory.Name = name;
                existingCategory.Slug = slug;
                existingCategory.Description = description;
                await categoryRepo.UpdateAsync(existingCategory);
            }
            syncedCount++;
        }

        await _unitOfWork.CompleteAsync();
        return (true, $"Đã đồng bộ {syncedCount} chuyên mục thành công.");
    }
}
