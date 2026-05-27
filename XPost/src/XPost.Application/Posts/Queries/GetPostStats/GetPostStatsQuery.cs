using MediatR;
using XPost.Application.DTOs;
using XPost.Domain.Entities;
using XPost.Domain.Enums;
using XPost.Domain.Interfaces;

namespace XPost.Application.Posts.Queries.GetPostStats;

public class GetPostStatsQuery : IRequest<PostStatsDto>
{
    public string UserId { get; set; } = string.Empty;
}

public class GetPostStatsQueryHandler : IRequestHandler<GetPostStatsQuery, PostStatsDto>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetPostStatsQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<PostStatsDto> Handle(GetPostStatsQuery request, CancellationToken cancellationToken)
    {
        var postRepo = _unitOfWork.Repository<Post>();
        var allPosts = await postRepo.GetAsync(p => p.UserId == request.UserId);

        var now = DateTime.UtcNow;
        var startOfToday = now.Date;
        var startOfWeek = startOfToday.AddDays(-(int)startOfToday.DayOfWeek);
        var startOfMonth = new DateTime(now.Year, now.Month, 1);

        var todayPosts = allPosts.Where(p => p.CreatedAt >= startOfToday).ToList();
        var weekPosts = allPosts.Where(p => p.CreatedAt >= startOfWeek).ToList();
        var monthPosts = allPosts.Where(p => p.CreatedAt >= startOfMonth).ToList();

        return new PostStatsDto
        {
            TotalAll = allPosts.Count,
            TotalToday = todayPosts.Count,
            TotalThisWeek = weekPosts.Count,
            TotalThisMonth = monthPosts.Count,
            Today = BuildBreakdown(todayPosts),
            ThisWeek = BuildBreakdown(weekPosts),
            ThisMonth = BuildBreakdown(monthPosts),
        };
    }

    private static StatBreakdown BuildBreakdown(List<Post> posts) => new()
    {
        Pending = posts.Count(p => p.Status == (int)PostStatus.Pending),
        Published = posts.Count(p => p.Status == (int)PostStatus.Published),
        Failed = posts.Count(p => p.Status == (int)PostStatus.Failed),
    };
}
