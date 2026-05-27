using MediatR;
using Microsoft.Extensions.Logging;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Enums;
using XPost.Domain.Interfaces;

namespace XPost.Application.Posts.Commands.PublishPost;

/// <summary>
/// Command to publish a post to selected social accounts.
/// If ScheduledTimeUtc is null or in the past, publishes immediately.
/// Otherwise, creates pending PostTargets for the background service.
/// </summary>
public class PublishPostCommand : IRequest<PublishPostResult>
{
    public Guid PostId { get; set; }
    public List<Guid> SocialAccountIds { get; set; } = new();
    public DateTime? ScheduledTimeUtc { get; set; }
    public string UserId { get; set; } = string.Empty;
}

public class PublishPostResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int TargetsCreated { get; set; }
    public int PublishedImmediately { get; set; }
    public List<string> Errors { get; set; } = new();
}

public class PublishPostCommandHandler : IRequestHandler<PublishPostCommand, PublishPostResult>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IEnumerable<ISocialPublisher> _publishers;
    private readonly ILogger<PublishPostCommandHandler> _logger;

    public PublishPostCommandHandler(
        IUnitOfWork unitOfWork,
        IEnumerable<ISocialPublisher> publishers,
        ILogger<PublishPostCommandHandler> logger)
    {
        _unitOfWork = unitOfWork;
        _publishers = publishers;
        _logger = logger;
    }

    public async Task<PublishPostResult> Handle(PublishPostCommand request, CancellationToken cancellationToken)
    {
        var postRepo = _unitOfWork.Repository<Post>();
        var accountRepo = _unitOfWork.Repository<SocialAccount>();
        var targetRepo = _unitOfWork.Repository<PostTarget>();

        var post = await postRepo.GetByIdAsync(request.PostId);
        if (post == null)
            return new PublishPostResult { Success = false, Message = "Bài viết không tồn tại." };

        if (post.UserId != request.UserId)
            return new PublishPostResult { Success = false, Message = "Không có quyền truy cập bài viết này." };

        if (!request.SocialAccountIds.Any())
            return new PublishPostResult { Success = false, Message = "Chưa chọn tài khoản mạng xã hội nào." };

        var result = new PublishPostResult { Success = true };
        var shouldPublishNow = request.ScheduledTimeUtc == null || request.ScheduledTimeUtc <= DateTime.UtcNow;
        var scheduledTime = request.ScheduledTimeUtc ?? DateTime.UtcNow;

        foreach (var accountId in request.SocialAccountIds)
        {
            var account = await accountRepo.GetByIdAsync(accountId);
            if (account == null || !account.IsActive)
            {
                result.Errors.Add($"Tài khoản {accountId} không tồn tại hoặc bị vô hiệu.");
                continue;
            }

            // Check if target already exists
            var existingTargets = await targetRepo.GetAsync(t =>
                t.PostId == request.PostId && t.SocialAccountId == accountId);

            if (existingTargets.Any())
            {
                result.Errors.Add($"Bài viết đã được gán cho tài khoản \"{account.AccountName}\".");
                continue;
            }

            var target = new PostTarget
            {
                PostId = request.PostId,
                SocialAccountId = accountId,
                Status = (int)PostTargetStatus.Pending,
                ScheduledTimeUtc = scheduledTime,
                CreatedAt = DateTime.UtcNow
            };

            await targetRepo.AddAsync(target);
            result.TargetsCreated++;

            // Publish immediately if scheduled time is now or past
            if (shouldPublishNow)
            {
                var publisher = _publishers.FirstOrDefault(p => p.Platform == account.Platform);
                if (publisher == null)
                {
                    target.Status = (int)PostTargetStatus.Failed;
                    target.LastError = "Publisher chưa được hỗ trợ cho nền tảng này.";
                    await targetRepo.UpdateAsync(target);
                    result.Errors.Add($"Nền tảng \"{account.AccountName}\" chưa hỗ trợ đăng tự động.");
                    continue;
                }

                target.Status = (int)PostTargetStatus.Processing;
                target.IsProcessing = true;
                await targetRepo.UpdateAsync(target);

                var publishResult = await publisher.PublishAsync(account, post, cancellationToken);

                target.IsProcessing = false;
                target.ProcessedAtUtc = DateTime.UtcNow;

                if (publishResult.Success)
                {
                    target.Status = (int)PostTargetStatus.Published;
                    target.PublishedUrl = publishResult.PublishedUrl;
                    target.PublishedPostId = publishResult.PublishedPostId;
                    result.PublishedImmediately++;
                }
                else
                {
                    target.Status = (int)PostTargetStatus.Failed;
                    target.LastError = publishResult.ErrorMessage;
                    target.RetryCount = 1;
                    result.Errors.Add($"Lỗi đăng lên \"{account.AccountName}\": {publishResult.ErrorMessage}");
                }

                await targetRepo.UpdateAsync(target);
            }
        }

        await _unitOfWork.CompleteAsync();

        if (shouldPublishNow)
        {
            result.Message = result.PublishedImmediately > 0
                ? $"Đã đăng thành công lên {result.PublishedImmediately} nền tảng."
                : "Không đăng được bài lên bất kỳ nền tảng nào.";
        }
        else
        {
            result.Message = $"Đã lên lịch {result.TargetsCreated} bài viết cho {scheduledTime:dd/MM/yyyy HH:mm} UTC.";
        }

        result.Success = result.TargetsCreated > 0;
        return result;
    }
}
