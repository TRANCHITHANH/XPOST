using MediatR;
using System.ComponentModel.DataAnnotations;
using XPost.Application.DTOs;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;

namespace XPost.Application.Posts.Commands.UpdatePost;

public class UpdatePostCommand : IRequest<PostDto>
{
    public string UserId { get; set; } = string.Empty;
    public UpdatePostDto Dto { get; set; } = null!;
}

public class UpdatePostCommandHandler : IRequestHandler<UpdatePostCommand, PostDto>
{
    private readonly IUnitOfWork _unitOfWork;

    public UpdatePostCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<PostDto> Handle(UpdatePostCommand request, CancellationToken cancellationToken)
    {
        var postRepo = _unitOfWork.Repository<Post>();
        var post = await postRepo.GetByIdAsync(request.Dto.Id);

        if (post == null)
            throw new Exception("Post not found"); // Ideally use a custom Exception like NotFoundException

        if (post.UserId != request.UserId)
            throw new UnauthorizedAccessException("You are not authorized to edit this post");

        post.Title = request.Dto.Title;
        post.Content = request.Dto.Content;
        post.Slug = request.Dto.Slug ?? post.Slug;
        post.Description = request.Dto.Description;
        post.MetaTitle = request.Dto.MetaTitle;
        post.MetaDescription = request.Dto.MetaDescription;
        post.MetaKeywords = request.Dto.MetaKeywords;
        post.FeaturedImageAlt = request.Dto.FeaturedImageAlt;
        post.Tags = request.Dto.Tags;
        post.FeaturedImageUrl = request.Dto.FeaturedImageUrl;
        post.DisplayStartUtc = request.Dto.DisplayStartUtc;
        post.DisplayEndUtc = request.Dto.DisplayEndUtc;
        post.CategoryId = request.Dto.CategoryId;
        post.PostType = request.Dto.PostType;
        post.Status = request.Dto.Status;
        post.Ref_ID = request.Dto.Ref_ID;
        post.MediaJson = request.Dto.MediaJson;
        post.IsFeatured = request.Dto.IsFeatured;
        post.IsPinned = request.Dto.IsPinned;
        post.AllowComment = request.Dto.AllowComment;
        post.UpdatedAt = DateTime.UtcNow;

        await postRepo.UpdateAsync(post);

        // Handle PostTargets: remove old, add new
        var targetRepo = _unitOfWork.Repository<PostTarget>();
        var existingTargets = await targetRepo.GetAsync(pt => pt.PostId == post.Id);
        foreach (var old in existingTargets)
        {
            await targetRepo.DeleteAsync(old);
        }
        if (request.Dto.Targets?.Any() == true)
        {
            foreach (var t in request.Dto.Targets)
            {
                await targetRepo.AddAsync(new PostTarget
                {
                    PostId = post.Id,
                    SocialAccountId = t.SocialAccountId,
                    ScheduledTimeUtc = t.ScheduledTimeUtc,
                    Status = 0,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        await _unitOfWork.CompleteAsync();

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
            Targets = request.Dto.Targets ?? new List<PostTargetDto>()
        };
    }
}
