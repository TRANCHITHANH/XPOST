using MediatR;
using XPost.Application.DTOs;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;

namespace XPost.Application.Posts.Queries.GetPostById;

public class GetPostByIdQuery : IRequest<PostDto>
{
    public Guid Id { get; set; }
}

public class GetPostByIdQueryHandler : IRequestHandler<GetPostByIdQuery, PostDto>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetPostByIdQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<PostDto> Handle(GetPostByIdQuery request, CancellationToken cancellationToken)
    {
        var postRepo = _unitOfWork.Repository<Post>();
        var post = await postRepo.GetByIdAsync(request.Id);

        if (post == null)
            throw new Exception("Post not found");

        return new PostDto
        {
            Id = post.Id,
            Title = post.Title,
            Content = post.Content,
            Slug = post.Slug,
            Description = post.Description,
            MetaTitle = post.MetaTitle,
            MetaDescription = post.MetaDescription,
            MetaKeywords = post.MetaKeywords,
            FeaturedImageAlt = post.FeaturedImageAlt,
            Tags = post.Tags,
            FeaturedImageUrl = post.FeaturedImageUrl,
            DisplayStartUtc = post.DisplayStartUtc,
            DisplayEndUtc = post.DisplayEndUtc,
            MediaJson = post.MediaJson,
            Status = post.Status,
            PostType = post.PostType,
            CategoryId = post.CategoryId,
            CreatedAtUtc = post.CreatedAt,
            IsFeatured = post.IsFeatured,
            IsPinned = post.IsPinned,
            AllowComment = post.AllowComment,
            Targets = (await _unitOfWork.Repository<PostTarget>().GetAsync(pt => pt.PostId == post.Id))
                .Select(pt => new PostTargetDto
                {
                    SocialAccountId = pt.SocialAccountId,
                    ScheduledTimeUtc = pt.ScheduledTimeUtc
                }).ToList()
        };
    }
}
