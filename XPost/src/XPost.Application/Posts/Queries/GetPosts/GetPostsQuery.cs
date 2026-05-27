using MediatR;
using XPost.Application.DTOs;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;

namespace XPost.Application.Posts.Queries.GetPosts;

public class GetPostsQuery : IRequest<PagedResult<PostDto>>
{
    public string? UserId { get; set; }
    public string? Keyword { get; set; }
    public Guid? CategoryId { get; set; }
    public int? Status { get; set; }
    public int PageIndex { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}

public class GetPostsQueryHandler : IRequestHandler<GetPostsQuery, PagedResult<PostDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetPostsQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<PagedResult<PostDto>> Handle(GetPostsQuery request, CancellationToken cancellationToken)
    {
        var postRepo = _unitOfWork.Repository<Post>();
        var query = await postRepo.GetAllAsync(); // Fetching all and filtering in-memory as a quick implementation.
        
        IEnumerable<Post> filtered = query;
        
        // Apply filters
        if (!string.IsNullOrEmpty(request.UserId))
            filtered = filtered.Where(p => p.UserId == request.UserId);
            
        if (!string.IsNullOrEmpty(request.Keyword))
        {
            var keywordLower = request.Keyword.ToLower();
            filtered = filtered.Where(p => 
                (p.Title != null && p.Title.ToLower().Contains(keywordLower)) || 
                (p.Content != null && p.Content.ToLower().Contains(keywordLower)));
        }
        
        if (request.CategoryId.HasValue)
            filtered = filtered.Where(p => p.CategoryId == request.CategoryId.Value);
            
        if (request.Status.HasValue)
            filtered = filtered.Where(p => p.Status == request.Status.Value);
            
        var totalCount = filtered.Count();
        
        // Pagination
        var skip = (request.PageIndex - 1) * request.PageSize;
        var pagedPosts = filtered.OrderByDescending(p => p.CreatedAt).Skip(skip).Take(request.PageSize).ToList();

        // Fetch related targets and social accounts for these paged posts ONLY
        var pagedPostIds = pagedPosts.Select(p => p.Id).ToList();
        var targetsRepo = _unitOfWork.Repository<PostTarget>();
        var allTargets = await targetsRepo.GetAsync(t => pagedPostIds.Contains(t.PostId));

        var accountIds = allTargets.Select(t => t.SocialAccountId).Distinct().ToList();
        var accountRepo = _unitOfWork.Repository<SocialAccount>();
        var allAccounts = await accountRepo.GetAsync(a => accountIds.Contains(a.Id));
        var accountDict = allAccounts.ToDictionary(a => a.Id);

        var items = pagedPosts.Select(p => new PostDto
        {
            Id = p.Id,
            Title = p.Title,
            Content = p.Content ?? string.Empty,
            Slug = p.Slug,
            Description = p.Description,
            MetaTitle = p.MetaTitle,
            MetaDescription = p.MetaDescription,
            MetaKeywords = p.MetaKeywords,
            FeaturedImageAlt = p.FeaturedImageAlt,
            Tags = p.Tags,
            FeaturedImageUrl = p.FeaturedImageUrl,
            DisplayStartUtc = p.DisplayStartUtc,
            DisplayEndUtc = p.DisplayEndUtc,
            MediaJson = p.MediaJson,
            Status = p.Status,
            PostType = p.PostType,
            CategoryId = p.CategoryId,
            CreatedAtUtc = p.CreatedAt,
            IsFeatured = p.IsFeatured,
            IsPinned = p.IsPinned,
            AllowComment = p.AllowComment,
            Targets = allTargets.Where(t => t.PostId == p.Id).Select(t => new PostTargetDto
            {
                SocialAccountId = t.SocialAccountId,
                ScheduledTimeUtc = t.ScheduledTimeUtc,
                Status = t.Status,
                Platform = accountDict.TryGetValue(t.SocialAccountId, out var acc) ? acc.Platform : 0,
                LastError = t.LastError,
                PublishedUrl = t.PublishedUrl
            }).ToList()
        }).ToList();
        
        return new PagedResult<PostDto>
        {
            Items = items,
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling(totalCount / (double)request.PageSize),
            PageIndex = request.PageIndex,
            PageSize = request.PageSize
        };
    }
}
