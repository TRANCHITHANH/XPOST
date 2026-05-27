using MediatR;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;

namespace XPost.Application.Keywords.Commands.DeleteKeyword;

public class DeleteKeywordCommand : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class DeleteKeywordCommandHandler : IRequestHandler<DeleteKeywordCommand, bool>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeleteKeywordCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<bool> Handle(DeleteKeywordCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Keyword>();
        var keyword = await repo.GetByIdAsync(request.Id);

        if (keyword == null) return false;

        await repo.DeleteAsync(keyword);
        await _unitOfWork.CompleteAsync();

        return true;
    }
}
