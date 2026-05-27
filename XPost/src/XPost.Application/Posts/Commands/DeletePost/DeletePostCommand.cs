using MediatR;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;

namespace XPost.Application.Posts.Commands.DeletePost;

public class DeletePostCommand : IRequest<bool>
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = string.Empty;
}

public class DeletePostCommandHandler : IRequestHandler<DeletePostCommand, bool>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeletePostCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<bool> Handle(DeletePostCommand request, CancellationToken cancellationToken)
    {
        var postRepo = _unitOfWork.Repository<Post>();
        var post = await postRepo.GetByIdAsync(request.Id);

        if (post == null)
            throw new Exception("Post not found");

        if (post.UserId != request.UserId)
            throw new UnauthorizedAccessException("You are not authorized to delete this post");

        // Hard delete for now, or you can implement IsActive = false
        await postRepo.DeleteAsync(post);
        await _unitOfWork.CompleteAsync();

        return true;
    }
}
