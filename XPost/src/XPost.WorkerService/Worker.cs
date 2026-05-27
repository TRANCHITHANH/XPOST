using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Enums;
using XPost.Domain.Interfaces;

namespace XPost.WorkerService;

public class Worker : BackgroundService
{
    private readonly ILogger<Worker> _logger;
    private readonly IServiceProvider _serviceProvider;
    private const int PollIntervalSeconds = 30;
    private const int MaxRetries = 3;

    public Worker(ILogger<Worker> logger, IServiceProvider serviceProvider)
    {
        _logger = logger;
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("XPost Worker Service started at: {time}. Polling every {Interval}s.", DateTimeOffset.Now, PollIntervalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessPendingTargetsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in Worker polling cycle.");
            }

            await Task.Delay(TimeSpan.FromSeconds(PollIntervalSeconds), stoppingToken);
        }
    }

    private async Task ProcessPendingTargetsAsync(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
        var publishers = scope.ServiceProvider.GetRequiredService<IEnumerable<ISocialPublisher>>();

        var targetRepo = unitOfWork.Repository<PostTarget>();
        var postRepo = unitOfWork.Repository<Post>();
        var accountRepo = unitOfWork.Repository<SocialAccount>();

        // Find all pending targets that are due
        var pendingTargets = await targetRepo.GetAsync(t =>
            t.Status == (int)PostTargetStatus.Pending
            && !t.IsProcessing
            && t.ScheduledTimeUtc <= DateTime.Now
            && t.RetryCount < MaxRetries);

        if (!pendingTargets.Any()) return;

        _logger.LogInformation("Found {Count} pending post targets to process.", pendingTargets.Count);

        foreach (var target in pendingTargets)
        {
            try
            {
                var post = await postRepo.GetByIdAsync(target.PostId);
                var account = await accountRepo.GetByIdAsync(target.SocialAccountId);

                if (post == null || account == null || !account.IsActive)
                {
                    target.Status = (int)PostTargetStatus.Failed;
                    target.LastError = "Post or social account not found or disabled.";
                    target.ProcessedAtUtc = DateTime.Now;
                    await targetRepo.UpdateAsync(target);
                    continue;
                }

                var publisher = publishers.FirstOrDefault(p => p.Platform == account.Platform);
                if (publisher == null)
                {
                    target.Status = (int)PostTargetStatus.Failed;
                    target.LastError = $"No publisher available for platform {account.Platform}.";
                    target.ProcessedAtUtc = DateTime.Now;
                    await targetRepo.UpdateAsync(target);
                    continue;
                }

                // Mark as processing
                target.IsProcessing = true;
                target.Status = (int)PostTargetStatus.Processing;
                await targetRepo.UpdateAsync(target);
                await unitOfWork.CompleteAsync();

                // Execute publish
                _logger.LogInformation("Publishing post {PostId} to {Platform} ({AccountName})...",
                    post.Id, account.Platform, account.AccountName);

                var result = await publisher.PublishAsync(account, post, ct);

                target.IsProcessing = false;
                target.ProcessedAtUtc = DateTime.Now;

                if (result.Success)
                {
                    target.Status = (int)PostTargetStatus.Published;
                    target.PublishedUrl = result.PublishedUrl;
                    target.PublishedPostId = result.PublishedPostId;
                    _logger.LogInformation("✅ Published post {PostId} to {Platform} ({AccountName})",
                        post.Id, account.Platform, account.AccountName);
                }
                else
                {
                    target.RetryCount++;
                    target.LastError = result.ErrorMessage;

                    if (target.RetryCount >= MaxRetries)
                    {
                        target.Status = (int)PostTargetStatus.Failed;
                        _logger.LogWarning("❌ Post {PostId} to {AccountName} failed permanently after {Retries} retries: {Error}",
                            post.Id, account.AccountName, target.RetryCount, result.ErrorMessage);
                    }
                    else
                    {
                        target.Status = (int)PostTargetStatus.Pending; // Will retry next cycle
                        _logger.LogWarning("⚠️ Post {PostId} to {AccountName} failed (retry {Retry}/{Max}): {Error}",
                            post.Id, account.AccountName, target.RetryCount, MaxRetries, result.ErrorMessage);
                    }
                }

                // Log the attempt
                var logRepo = unitOfWork.Repository<PostLog>();
                await logRepo.AddAsync(new PostLog
                {
                    PostTargetId = target.Id,
                    Status = target.Status == (int)PostTargetStatus.Published ? "Published" : "Failed",
                    ResponseMessage = result.PublishedUrl,
                    ErrorMessage = result.ErrorMessage,
                    RetryCount = target.RetryCount,
                    CreatedAt = DateTime.Now
                });

                await targetRepo.UpdateAsync(target);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unhandled error processing PostTarget {TargetId}", target.Id);
                target.IsProcessing = false;
                target.RetryCount++;
                target.LastError = ex.Message;
                target.Status = target.RetryCount >= MaxRetries
                    ? (int)PostTargetStatus.Failed
                    : (int)PostTargetStatus.Pending;
                await targetRepo.UpdateAsync(target);
            }
        }

        await unitOfWork.CompleteAsync();
    }
}
