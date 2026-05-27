using MediatR;
using XPost.Application.DTOs;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;

namespace XPost.Application.Categories.Queries.GetCategories;

public class GetCategoriesQuery : IRequest<IEnumerable<CategoryDto>>
{
}

public class GetCategoriesQueryHandler : IRequestHandler<GetCategoriesQuery, IEnumerable<CategoryDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetCategoriesQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<IEnumerable<CategoryDto>> Handle(GetCategoriesQuery request, CancellationToken cancellationToken)
    {
        var categoryRepo = _unitOfWork.Repository<Category>();
        var categories = await categoryRepo.GetAllAsync();

        return categories
            .Where(c => c.IsActive)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .Select(c => new CategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Slug = c.Slug,
                ParentId = c.ParentId,
                Description = c.Description,
                SortOrder = c.SortOrder
            }).ToList();
    }
}
