using MediatR;
using XPost.Application.DTOs;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;

namespace XPost.Application.SocialAccounts.Queries.GetActiveSocialAccounts;

public class GetActiveSocialAccountsQuery : IRequest<List<SocialAccountDto>>
{
    public string UserId { get; set; } = string.Empty;
}

public class GetActiveSocialAccountsQueryHandler : IRequestHandler<GetActiveSocialAccountsQuery, List<SocialAccountDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetActiveSocialAccountsQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<List<SocialAccountDto>> Handle(GetActiveSocialAccountsQuery request, CancellationToken cancellationToken)
    {
        var accounts = await _unitOfWork.Repository<SocialAccount>().GetAsync(a => a.UserId == request.UserId && a.IsActive);

        return accounts
            .OrderBy(a => a.Platform)
            .Select(a => new SocialAccountDto
            {
                Id = a.Id,
                UserId = a.UserId,
                Platform = a.Platform,
                AccountName = a.AccountName,
                AccountIdentifier = a.AccountIdentifier,
                IsActive = a.IsActive,
                CreatedAtUtc = a.CreatedAt
            })
            .ToList();
    }
}
