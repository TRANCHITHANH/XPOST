using FluentValidation;

namespace XPost.Application.DTOs.Validators;

public class RegisterDtoValidator : AbstractValidator<RegisterDto>
{
    public RegisterDtoValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("A valid email is required.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required.")
            .MinimumLength(6).WithMessage("Password must be at least 6 characters long.");

        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Full name is required.")
            .MaximumLength(100).WithMessage("Full name must not exceed 100 characters.");

        RuleFor(x => x.FirstName)
            .MaximumLength(250).WithMessage("First name must not exceed 250 characters.");

        RuleFor(x => x.LastName)
            .MaximumLength(250).WithMessage("Last name must not exceed 250 characters.");
    }
}
