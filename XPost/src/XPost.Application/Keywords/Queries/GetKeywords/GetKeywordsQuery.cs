using MediatR;
using XPost.Application.DTOs;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;

namespace XPost.Application.Keywords.Queries.GetKeywords;

public class GetKeywordsQuery : IRequest<List<KeywordDto>>
{
}

public class GetKeywordsQueryHandler : IRequestHandler<GetKeywordsQuery, List<KeywordDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetKeywordsQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<List<KeywordDto>> Handle(GetKeywordsQuery request, CancellationToken cancellationToken)
    {
        var keywords = await _unitOfWork.Repository<Keyword>().GetAllAsync();
        
        return keywords.Select(k => new KeywordDto
        {
            Id = k.Id,
            Name = k.Name,
            Description = k.Description,
            Status = k.Status,
            GeneratedContent = k.GeneratedContent,
            LastErrorMessage = k.LastErrorMessage,
            LastGeneratedAtUtc = k.LastGeneratedAtUtc,
            Language = k.Language,
            LastPostId = k.LastPostId,
            CreatedAt = k.CreatedAt
        })
        .OrderByDescending(k => k.CreatedAt)
        .ToList();
    }
}
