using MediatR;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;
using XPost.Domain.Enums;
using XPost.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace XPost.Application.Posts.Commands.DeletePost;

public class DeletePostCommand : IRequest<bool>
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = string.Empty;
}

public class DeletePostCommandHandler : IRequestHandler<DeletePostCommand, bool>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IEnumerable<ISocialPublisher> _publishers;
    private readonly ILogger<DeletePostCommandHandler> _logger;

    public DeletePostCommandHandler(
        IUnitOfWork unitOfWork,
        IEnumerable<ISocialPublisher> publishers,
        ILogger<DeletePostCommandHandler> logger)
    {
        _unitOfWork = unitOfWork;
        _publishers = publishers;
        _logger = logger;
    }

    public async Task<bool> Handle(DeletePostCommand request, CancellationToken cancellationToken)
    {
        var postRepo = _unitOfWork.Repository<Post>();
        var post = await postRepo.GetByIdAsync(request.Id);

        if (post == null)
            throw new Exception("Post not found");

        if (post.UserId != request.UserId)
            throw new UnauthorizedAccessException("You are not authorized to delete this post");

        // 1. Fetch all targets for this post to check for published ones
        var targetRepo = _unitOfWork.Repository<PostTarget>();
        var accountRepo = _unitOfWork.Repository<SocialAccount>();
        var targets = await targetRepo.GetAsync(pt => pt.PostId == post.Id);

        foreach (var target in targets)
        {
            if (target.Status == (int)PostTargetStatus.Published && !string.IsNullOrEmpty(target.PublishedPostId))
            {
                var account = await accountRepo.GetByIdAsync(target.SocialAccountId);
                if (account != null && account.IsActive)
                {
                    var publisher = _publishers.FirstOrDefault(p => p.Platform == account.Platform);
                    if (publisher != null)
                    {
                        try
                        {
                            _logger.LogInformation("Attempting automatic deletion of post {PostId} from platform {Platform} (Account: {AccountName})",
                                post.Id, account.Platform, account.AccountName);

                            await publisher.DeletePublishedPostAsync(account, target.PublishedPostId, cancellationToken);
                        }
                        catch (Exception ex)
                        {
                            // Gracefully log publisher-specific deletion failure so local deletion still completes
                            _logger.LogError(ex, "Failed to automatically delete post {PostId} from platform {Platform} (Account: {AccountName})",
                                post.Id, account.Platform, account.AccountName);
                        }
                    }
                }
            }
        }

        // 2. Cascade delete from local DB
        await postRepo.DeleteAsync(post);
        await _unitOfWork.CompleteAsync();

        return true;
    }
}
