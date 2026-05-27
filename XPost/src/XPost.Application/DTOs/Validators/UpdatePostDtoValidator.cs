using FluentValidation;

namespace XPost.Application.DTOs.Validators;

public class UpdatePostDtoValidator : AbstractValidator<UpdatePostDto>
{
    public UpdatePostDtoValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Post Id is required.");
            
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Title is required.")
            .MaximumLength(500).WithMessage("Title must not exceed 500 characters.");

        RuleFor(x => x.Content)
            .NotEmpty().WithMessage("Post content is required.");
    }
}
