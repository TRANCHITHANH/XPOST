using MediatR;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;

namespace XPost.Application.Keywords.Commands.CreateKeyword;

public class CreateKeywordCommand : IRequest<Guid>
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Language { get; set; } = "vi";
}

public class CreateKeywordCommandHandler : IRequestHandler<CreateKeywordCommand, Guid>
{
    private readonly IUnitOfWork _unitOfWork;

    public CreateKeywordCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Guid> Handle(CreateKeywordCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Keyword>();
        
        var keyword = new Keyword
        {
            Name = request.Name,
            Description = request.Description,
            Language = request.Language,
            Status = Domain.Enums.KeywordStatus.Pending
        };

        await repo.AddAsync(keyword);
        await _unitOfWork.CompleteAsync();

        return keyword.Id;
    }
}
