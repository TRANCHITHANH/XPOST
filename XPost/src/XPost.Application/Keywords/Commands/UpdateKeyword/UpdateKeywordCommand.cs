using MediatR;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;

namespace XPost.Application.Keywords.Commands.UpdateKeyword;

public class UpdateKeywordCommand : IRequest<bool>
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Language { get; set; }
    public string? GeneratedContent { get; set; }
}

public class UpdateKeywordCommandHandler : IRequestHandler<UpdateKeywordCommand, bool>
{
    private readonly IUnitOfWork _unitOfWork;

    public UpdateKeywordCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<bool> Handle(UpdateKeywordCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Keyword>();
        var keyword = await repo.GetByIdAsync(request.Id);

        if (keyword == null) return false;

        keyword.Name = request.Name;
        keyword.Description = request.Description;
        keyword.Language = request.Language;
        if (request.GeneratedContent != null)
        {
            keyword.GeneratedContent = request.GeneratedContent;
        }
        keyword.UpdatedAt = DateTime.UtcNow;

        await repo.UpdateAsync(keyword);
        await _unitOfWork.CompleteAsync();

        return true;
    }
}
