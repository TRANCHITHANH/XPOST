namespace XPost.Application.Interfaces;

public interface IAuthService
{
    Task<(bool Succeeded, string Token, string ErrorMessage)> LoginAsync(string email, string password);
    Task<(bool Succeeded, string ErrorMessage)> RegisterAsync(string email, string password, string fullName, string firstName, string lastName);
    Task<DTOs.ProfileDto?> GetProfileAsync(string userId);
    Task<(bool Succeeded, string ErrorMessage)> UpdateProfileAsync(string userId, string fullName, string firstName, string lastName, string phoneNumber, string countryCode, string? avatarUrl);
    Task<(bool Succeeded, string ErrorMessage)> ChangePasswordAsync(string userId, string currentPassword, string newPassword);
}
