using MediatR;
using Microsoft.Extensions.Logging;
using XPost.Application.Interfaces;
using XPost.Application.Posts.Commands.PublishPost;
using XPost.Domain.Entities;
using XPost.Domain.Enums;
using XPost.Domain.Interfaces;
using XPost.Application.Common.Helpers;

namespace XPost.Application.Keywords.Commands.Syndicate;

public class KeywordSyndicationCommand : IRequest<PublishPostResult>
{
    public Guid KeywordId { get; set; }
    public List<Guid> SocialAccountIds { get; set; } = new();
    public string UserId { get; set; } = string.Empty;
}

public class KeywordSyndicationCommandHandler : IRequestHandler<KeywordSyndicationCommand, PublishPostResult>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMediator _mediator;
    private readonly ILogger<KeywordSyndicationCommandHandler> _logger;

    public KeywordSyndicationCommandHandler(
        IUnitOfWork unitOfWork,
        IMediator mediator,
        ILogger<KeywordSyndicationCommandHandler> logger)
    {
        _unitOfWork = unitOfWork;
        _mediator = mediator;
        _logger = logger;
    }

    public async Task<PublishPostResult> Handle(KeywordSyndicationCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var keywordRepo = _unitOfWork.Repository<Keyword>();
            var postRepo = _unitOfWork.Repository<Post>();

            var keyword = await keywordRepo.GetByIdAsync(request.KeywordId);
            if (keyword == null)
            {
                _logger.LogWarning("Syndication failed: Keyword {KeywordId} not found.", request.KeywordId);
                return new PublishPostResult { Success = false, Message = "Từ khóa không tồn tại." };
            }

            _logger.LogInformation("Syndicating keyword {KeywordName} (Id: {KeywordId}) for User {UserId}", keyword.Name, keyword.Id, request.UserId);

            if (string.IsNullOrEmpty(keyword.GeneratedContent))
            {
                _logger.LogWarning("Syndication failed: Keyword {KeywordId} has no generated content.", request.KeywordId);
                return new PublishPostResult { Success = false, Message = "Từ khóa chưa có nội dung được sinh để đăng." };
            }

            Guid? postId = keyword.LastPostId;

            if (postId == null || postId == Guid.Empty)
            {
                // Create a new Post from Keyword content
                var post = new Post
                {
                    TenantId = keyword.TenantId,
                    UserId = request.UserId,
                    Title = keyword.Name,
                    Slug = StringHelper.GenerateSlug(keyword.Name) + "-" + DateTime.UtcNow.Ticks.ToString().Substring(10),
                    Content = keyword.GeneratedContent,
                    Description = keyword.Description ?? $"Bài đăng tự động từ từ khóa: {keyword.Name}",
                    FeaturedImageUrl = keyword.ImageUrl,
                    Status = (int)PostStatus.Published,
                    CreatedAt = DateTime.UtcNow
                };

                await postRepo.AddAsync(post);
                await _unitOfWork.CompleteAsync();

                keyword.LastPostId = post.Id;
                await keywordRepo.UpdateAsync(keyword);
                await _unitOfWork.CompleteAsync();

                postId = post.Id;
            }

            // Reuse PublishPostCommand for the actual syndication
            var publishCommand = new PublishPostCommand
            {
                PostId = postId.Value,
                SocialAccountIds = request.SocialAccountIds,
                UserId = request.UserId
            };

            _logger.LogInformation("Sending PublishPostCommand for Post {PostId} with {AccountCount} accounts", postId.Value, request.SocialAccountIds.Count);
            var publishResult = await _mediator.Send(publishCommand, cancellationToken);

            if (!publishResult.Success)
            {
                _logger.LogWarning("PublishPostCommand failed for Keyword {KeywordId}. Error: {Message}. Errors: {Errors}", 
                    request.KeywordId, publishResult.Message, string.Join(", ", publishResult.Errors));
            }
            else
            {
                _logger.LogInformation("Syndication successful for Keyword {KeywordId}. Published: {Count}", 
                    request.KeywordId, publishResult.PublishedImmediately);
            }

            return publishResult;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi xử lý syndication cho từ khóa {KeywordId}", request.KeywordId);
            return new PublishPostResult 
            { 
                Success = false, 
                Message = $"Lỗi hệ thống: {ex.Message}",
                Errors = new List<string> { ex.InnerException?.Message ?? ex.Message }
            };
        }
    }
}
