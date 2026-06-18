using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;
using XPost.Infrastructure.BackgroundServices;
using XPost.Infrastructure.Identity;
using XPost.Infrastructure.Persistence;
using XPost.Infrastructure.Persistence.Repositories;
using XPost.Infrastructure.Services;
using XPost.Infrastructure.Social;

namespace XPost.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddHttpClient();
        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseSqlServer(configuration.GetConnectionString("DefaultConnection"),
                builder => builder.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName)));

        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        services.AddMemoryCache();

        services.AddIdentityCore<ApplicationUser>()
            .AddRoles<IdentityRole>()
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddSignInManager<SignInManager<ApplicationUser>>()
            .AddDefaultTokenProviders();

        services.AddScoped<IAuthService, Identity.AuthService>();
        
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, Services.CurrentUserService>();
        services.AddScoped<IFileService, Services.FileService>();

        services.Configure<Services.EmailSettings>(configuration.GetSection("EmailSettings"));
        services.AddTransient<IEmailService, Services.EmailService>();

        // Content detection
        services.AddSingleton<ISensitiveContentDetector, SensitiveContentDetector>();

        // AI Service
        services.AddHttpClient<IAIService, OpenAIService>();

        // Social Publishers
        services.Configure<FacebookSettings>(configuration.GetSection("Facebook"));
        services.Configure<ZaloSettings>(configuration.GetSection("Zalo"));
        services.Configure<TwitterSettings>(configuration.GetSection("Twitter"));
        services.Configure<LinkedInSettings>(configuration.GetSection("LinkedIn"));
        services.Configure<BloggerSettings>(configuration.GetSection("Blogger"));
        services.Configure<ThreadsSettings>(configuration.GetSection("Threads"));
        services.Configure<TikTokSettings>(configuration.GetSection("TikTok"));
        services.AddScoped<ISocialPublisher, FacebookPublisher>();
        services.AddScoped<ISocialPublisher, LinkedInPublisher>();
        services.AddScoped<ISocialPublisher, TelegramPublisher>();
        services.AddScoped<ISocialPublisher, ZaloPublisher>();
        services.AddScoped<ISocialPublisher, TwitterPublisher>();
        services.AddScoped<ISocialPublisher, WordPressPublisher>();
        services.AddScoped<ISocialPublisher, MediumPublisher>();
        services.AddScoped<ISocialPublisher, DevToPublisher>();
        services.AddScoped<ISocialPublisher, BloggerPublisher>();
        services.AddScoped<ISocialPublisher, InstagramPublisher>();
        services.AddScoped<ISocialPublisher, ThreadsPublisher>();
        services.AddScoped<ISocialPublisher, TikTokPublisher>();

        services.AddScoped<IFacebookAdsService, FacebookAdsService>();
        services.AddScoped<ITikTokAdsService, TikTokAdsService>();

        // Messenger Chatbot AI
        services.AddSingleton<Services.SignatureValidator>();
        services.AddHttpClient<IMessengerService, Services.MessengerService>();

        // Background Services
        services.AddHostedService<PostPublisherService>();
        services.AddHostedService<KeywordGeneratorService>();

        var jwtKey = configuration["Jwt:Key"];
        if (!string.IsNullOrEmpty(jwtKey))
        {
            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                    ValidateIssuer = true,
                    ValidIssuer = configuration["Jwt:Issuer"],
                    ValidateAudience = true,
                    ValidAudience = configuration["Jwt:Audience"],
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero
                };
            });
        }

        return services;
    }
}
