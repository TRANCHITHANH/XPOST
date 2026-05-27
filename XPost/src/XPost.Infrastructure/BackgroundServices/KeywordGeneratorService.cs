using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MediatR;
using XPost.Application.Keywords.Commands.GenerateContent;
using XPost.Domain.Entities;
using XPost.Domain.Enums;
using XPost.Domain.Interfaces;

namespace XPost.Infrastructure.BackgroundServices;

public class KeywordGeneratorService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<KeywordGeneratorService> _logger;
    private const int PollIntervalSeconds = 60; // Poll every minute

    public KeywordGeneratorService(IServiceProvider serviceProvider, ILogger<KeywordGeneratorService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("KeywordGeneratorService started. Polling every {Interval}s.", PollIntervalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessPendingKeywordsAsync(stoppingToken);
                await Task.Delay(TimeSpan.FromSeconds(PollIntervalSeconds), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                // Graceful exit on cancellation
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in KeywordGeneratorService polling cycle.");
                try { await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken); } catch { break; }
            }
        }
    }

    private async Task ProcessPendingKeywordsAsync(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
        var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();

        var repo = unitOfWork.Repository<Keyword>();

        // Find keywords with Pending status
        var pendingKeywords = await repo.GetAsync(k => k.Status == KeywordStatus.Pending);

        if (!pendingKeywords.Any()) return;

        _logger.LogInformation("Found {Count} pending keywords for content generation.", pendingKeywords.Count);

        foreach (var keyword in pendingKeywords)
        {
            if (ct.IsCancellationRequested) break;

            _logger.LogInformation("Processing keyword: {KeywordName}", keyword.Name);
            
            try 
            {
                await mediator.Send(new GenerateContentFromKeywordCommand { KeywordId = keyword.Id }, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to generate content for keyword {KeywordId}", keyword.Id);
            }
        }
    }
}
