namespace XPost.Application.Interfaces;

public interface IEmailService
{
    Task SendEmailAsync(string toEmail, string subject, string body, bool isHtml = true);
    Task SendEmailTemplateAsync<T>(string toEmail, string subject, string templateName, T model);
}
