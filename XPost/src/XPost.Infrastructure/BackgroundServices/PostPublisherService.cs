using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Enums;
using XPost.Domain.Interfaces;

namespace XPost.Infrastructure.BackgroundServices;

/// <summary>
/// Background service that polls for scheduled PostTargets and publishes them.
/// Runs every 30 seconds, picks up pending targets whose ScheduledTimeUtc has passed,
/// and dispatches to the appropriate ISocialPublisher.
/// Retries up to 3 times on failure.
/// </summary>
public class PostPublisherService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<PostPublisherService> _logger;
    private const int PollIntervalSeconds = 30;
    private const int MaxRetries = 3;

    public PostPublisherService(IServiceProvider serviceProvider, ILogger<PostPublisherService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("PostPublisherService started. Polling every {Interval}s.", PollIntervalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessPendingTargetsAsync(stoppingToken);
                await Task.Delay(TimeSpan.FromSeconds(PollIntervalSeconds), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                // Graceful exit on cancellation
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in PostPublisherService polling cycle.");
                try { await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken); } catch { break; }
            }
        }
    }

    private async Task ProcessPendingTargetsAsync(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
        var targetRepo = unitOfWork.Repository<PostTarget>();

        // Find all pending targets that are due (Limit to 20 per cycle)
        var pendingTargets = await targetRepo.GetAsync(t =>
            t.Status == (int)PostTargetStatus.Pending
            && !t.IsProcessing
            && t.ScheduledTimeUtc <= DateTime.UtcNow
            && t.RetryCount < MaxRetries);

        if (!pendingTargets.Any()) return;

        _logger.LogInformation("Found {Count} pending post targets to process in parallel.", pendingTargets.Count);

        // [RACE CONDITION FIX]: Mark all targets as processing immediately in the main scope
        foreach (var target in pendingTargets)
        {
            target.IsProcessing = true;
            target.Status = (int)PostTargetStatus.Processing;
            await targetRepo.UpdateAsync(target);
        }
        await unitOfWork.CompleteAsync();

        // Process targets in parallel with a concurrency limit
        using var semaphore = new SemaphoreSlim(10);
        var tasks = pendingTargets.Select(async target => 
        {
            await semaphore.WaitAsync(ct);
            try
            {
                await ProcessSingleTargetAsync(target.Id, ct);
            }
            finally
            {
                semaphore.Release();
            }
        });

        await Task.WhenAll(tasks);
    }

    private async Task ProcessSingleTargetAsync(Guid targetId, CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
        var publishers = scope.ServiceProvider.GetRequiredService<IEnumerable<ISocialPublisher>>();

        var targetRepo = unitOfWork.Repository<PostTarget>();
        var postRepo = unitOfWork.Repository<Post>();
        var accountRepo = unitOfWork.Repository<SocialAccount>();

        var target = await targetRepo.GetByIdAsync(targetId);
        if (target == null) return;

        try
        {
            var post = await postRepo.GetByIdAsync(target.PostId);
            var account = await accountRepo.GetByIdAsync(target.SocialAccountId);

            if (post == null || account == null || !account.IsActive)
            {
                target.IsProcessing = false;
                target.Status = (int)PostTargetStatus.Failed;
                target.LastError = "Post or social account not found or disabled.";
                target.ProcessedAtUtc = DateTime.UtcNow;
                await targetRepo.UpdateAsync(target);
                await unitOfWork.CompleteAsync();
                return;
            }

            var publisher = publishers.FirstOrDefault(p => p.Platform == account.Platform);
            if (publisher == null)
            {
                target.IsProcessing = false;
                target.Status = (int)PostTargetStatus.Failed;
                target.LastError = $"No publisher available for platform {account.Platform}.";
                target.ProcessedAtUtc = DateTime.UtcNow;
                await targetRepo.UpdateAsync(target);
                await unitOfWork.CompleteAsync();
                return;
            }

            _logger.LogInformation("🚀 [Parallel] Publishing target {TargetId} for platform {Platform} ({AccountName})", 
                target.Id, account.Platform, account.AccountName);

            // Execute publish
            var result = await publisher.PublishAsync(account, post, ct);

            target.IsProcessing = false;
            target.ProcessedAtUtc = DateTime.UtcNow;

            if (result.Success)
            {
                target.Status = (int)PostTargetStatus.Published;
                target.PublishedUrl = result.PublishedUrl;
                target.PublishedPostId = result.PublishedPostId;
                _logger.LogInformation("✅ [Parallel] Published post {PostId} to {Platform} ({AccountName})",
                    post.Id, account.Platform, account.AccountName);
            }
            else
            {
                target.RetryCount++;
                target.LastError = result.ErrorMessage;

                if (target.RetryCount >= MaxRetries)
                {
                    target.Status = (int)PostTargetStatus.Failed;
                    _logger.LogWarning("❌ [Parallel] Post {PostId} to {AccountName} failed permanently after {Retries} retries: {Error}",
                        post.Id, account.AccountName, target.RetryCount, result.ErrorMessage);
                }
                else
                {
                    target.Status = (int)PostTargetStatus.Pending; // Will retry next cycle
                    _logger.LogWarning("⚠️ [Parallel] Post {PostId} to {AccountName} failed (retry {Retry}/{Max}): {Error}",
                        post.Id, account.AccountName, target.RetryCount, MaxRetries, result.ErrorMessage);
                }
            }

            // Log the attempt
            try
            {
                var logRepo = unitOfWork.Repository<PostLog>();
                await logRepo.AddAsync(new PostLog
                {
                    PostTargetId = target.Id,
                    Status = target.Status == (int)PostTargetStatus.Published ? "Published" : "Failed",
                    ResponseMessage = result.PublishedUrl,
                    ErrorMessage = result.ErrorMessage,
                    RetryCount = target.RetryCount,
                    CreatedAt = DateTime.UtcNow
                });

                await targetRepo.UpdateAsync(target);
                await unitOfWork.CompleteAsync();
            }
            catch (Exception logEx)
            {
                _logger.LogWarning(logEx, "Failed to save PostLog for target {TargetId}, skipping log entry.", target.Id);
                try
                {
                    await targetRepo.UpdateAsync(target);
                    await unitOfWork.CompleteAsync();
                }
                catch { /* Ignore */ }
            }
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
            try
            {
                await targetRepo.UpdateAsync(target);
                await unitOfWork.CompleteAsync();
            }
            catch (Exception saveEx)
            {
                _logger.LogError(saveEx, "Failed to save error state for PostTarget {TargetId}", target.Id);
            }
        }
    }


}
