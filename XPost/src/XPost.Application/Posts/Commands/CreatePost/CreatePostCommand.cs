using MediatR;
using XPost.Application.DTOs;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;

namespace XPost.Application.Posts.Commands.CreatePost;

public class CreatePostCommand : IRequest<PostDto>
{
    public string UserId { get; set; } = string.Empty;
    public CreatePostDto Dto { get; set; } = null!;
}

public class CreatePostCommandHandler : IRequestHandler<CreatePostCommand, PostDto>
{
    private readonly IUnitOfWork _unitOfWork;

    public CreatePostCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<PostDto> Handle(CreatePostCommand request, CancellationToken cancellationToken)
    {
        var post = new Post
        {
            Content = request.Dto.Content,
            Title = request.Dto.Title,
            Slug = !string.IsNullOrWhiteSpace(request.Dto.Slug) ? request.Dto.Slug : GenerateSlug(request.Dto.Title),
            Description = request.Dto.Description,
            MetaTitle = request.Dto.MetaTitle,
            MetaDescription = request.Dto.MetaDescription,
            MetaKeywords = request.Dto.MetaKeywords,
            FeaturedImageAlt = request.Dto.FeaturedImageAlt,
            Tags = request.Dto.Tags,
            FeaturedImageUrl = request.Dto.FeaturedImageUrl,
            DisplayStartUtc = request.Dto.DisplayStartUtc,
            DisplayEndUtc = request.Dto.DisplayEndUtc,
            CategoryId = request.Dto.CategoryId,
            UserId = request.UserId,
            Status = request.Dto.Status,
            PostType = request.Dto.PostType,
            Ref_ID = request.Dto.Ref_ID,
            MediaJson = request.Dto.MediaJson,
            IsFeatured = request.Dto.IsFeatured,
            IsPinned = request.Dto.IsPinned,
            AllowComment = request.Dto.AllowComment,
            CreatedAt = DateTime.Now,
            PostTargets = request.Dto.Targets?.Select(t => new PostTarget
            {
                SocialAccountId = t.SocialAccountId,
                ScheduledTimeUtc = t.ScheduledTimeUtc,
                Status = 0, // Pending etc
                CreatedAt = DateTime.Now
            }).ToList() ?? new List<PostTarget>()
        };

        var postRepo = _unitOfWork.Repository<Post>();
        await postRepo.AddAsync(post);
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
            IsFeatured = post.IsFeatured,
            IsPinned = post.IsPinned,
            AllowComment = post.AllowComment
        };
    }

    private static string GenerateSlug(string title)
    {
        if (string.IsNullOrWhiteSpace(title)) return $"post-{DateTime.UtcNow:yyyyMMddHHmmss}";
        var slug = RemoveVietnameseDiacritics(title.ToLowerInvariant());
        slug = System.Text.RegularExpressions.Regex.Replace(slug, @"[^a-z0-9\s-]", "");
        slug = System.Text.RegularExpressions.Regex.Replace(slug, @"\s+", "-");
        slug = System.Text.RegularExpressions.Regex.Replace(slug, @"-+", "-").Trim('-');
        return slug;
    }

    private static string RemoveVietnameseDiacritics(string text)
    {
        string[] from = [
            "àáạảãâầấậẩẫăằắặẳẵ",
            "èéẹẻẽêềếệểễ",
            "ìíịỉĩ",
            "òóọỏõôồốộổỗơờớợởỡ",
            "ùúụủũưừứựửữ",
            "ỳýỵỷỹ",
            "đ"
        ];
        string[] to = ["a", "e", "i", "o", "u", "y", "d"];
        for (int i = 0; i < from.Length; i++)
        {
            foreach (char c in from[i])
            {
                text = text.Replace(c.ToString(), to[i]);
            }
        }
        return text;
    }
}
