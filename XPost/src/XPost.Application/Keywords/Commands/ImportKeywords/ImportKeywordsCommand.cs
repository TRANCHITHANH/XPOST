using MediatR;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;

namespace XPost.Application.Keywords.Commands.ImportKeywords;

public class ImportKeywordsCommand : IRequest<int>
{
    public string KeywordsText { get; set; } = string.Empty; // Bulks string separated by newline
    public string? Language { get; set; } = "vi";
}

public class ImportKeywordsCommandHandler : IRequestHandler<ImportKeywordsCommand, int>
{
    private readonly IUnitOfWork _unitOfWork;

    public ImportKeywordsCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<int> Handle(ImportKeywordsCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.KeywordsText)) return 0;

        var keywordNames = request.KeywordsText
            .Split(new[] { '\n', '\r', ',' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(k => k.Trim())
            .Where(k => !string.IsNullOrEmpty(k))
            .Distinct()
            .ToList();

        int count = 0;
        var repo = _unitOfWork.Repository<Keyword>();

        foreach (var name in keywordNames)
        {
            // Simple check if already exists for this tenant (handled by query filter usually)
            // But for safety:
            var existing = await repo.GetAsync(k => k.Name == name);
            if (existing.Any()) continue;

            var keyword = new Keyword
            {
                Name = name,
                Language = request.Language,
                Status = Domain.Enums.KeywordStatus.Pending
            };

            await repo.AddAsync(keyword);
            count++;
        }

        if (count > 0)
        {
            await _unitOfWork.CompleteAsync();
        }

        return count;
    }
}
