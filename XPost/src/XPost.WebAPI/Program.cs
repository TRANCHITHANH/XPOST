// Removed OpenApi
using XPost.Application;
using XPost.Infrastructure;
using FluentValidation;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// Allow large file uploads (100 MB for videos)
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 100 * 1024 * 1024; // 100 MB
});

// Add services to the container.
builder.Services.AddApplicationServices();
builder.Services.AddInfrastructureServices(builder.Configuration);

// Swagger services for API documentation
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddValidatorsFromAssemblyContaining<XPost.Application.DTOs.Validators.LoginDtoValidator>();
builder.Services.AddFluentValidationAutoValidation();

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});
builder.Services.AddSignalR();

builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("FixedPolicy", opt =>
    {
        opt.PermitLimit = 100;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 0;
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            policy.WithOrigins(
                    "http://local.xpost.com", 
                    "http://local.xpost.com:5173",
                    "http://localhost:5173", // Local development
                    "https://post.mangxuyenviet.vn", // Production Frontend
                    "https://xpost-tau.vercel.app", // Vercel Deployment
                    "https://extent-epidermis-compactly.ngrok-free.dev" // Ngrok Tunnel
                  )
                  .SetIsOriginAllowed(origin => 
                  {
                      if (string.IsNullOrEmpty(origin)) return false;
                      try
                      {
                          var host = new Uri(origin).Host;
                          return host.Equals("localhost", StringComparison.OrdinalIgnoreCase) || 
                                 host.EndsWith(".vercel.app", StringComparison.OrdinalIgnoreCase) ||
                                 host.EndsWith(".ngrok-free.dev", StringComparison.OrdinalIgnoreCase) || // Allow ngrok domains
                                 host.Equals("post.mangxuyenviet.vn", StringComparison.OrdinalIgnoreCase) ||
                                 host.Equals("local.xpost.com", StringComparison.OrdinalIgnoreCase);
                      }
                      catch
                      {
                          return false;
                      }
                  })
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var userManager = services.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<XPost.Domain.Entities.ApplicationUser>>();
        var roleManager = services.GetRequiredService<Microsoft.AspNetCore.Identity.RoleManager<Microsoft.AspNetCore.Identity.IdentityRole>>();
        await XPost.Infrastructure.Identity.DatabaseSeeder.SeedAsync(userManager, roleManager);
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while seeding the database.");
    }
}

app.UseMiddleware<XPost.WebAPI.Middlewares.GlobalExceptionMiddleware>();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "XPost API v1"));
}

// Ensure wwwroot exists so StaticFiles can serve it
var wwwrootPath = builder.Environment.WebRootPath ?? Path.Combine(builder.Environment.ContentRootPath, "wwwroot");
if (!Directory.Exists(wwwrootPath))
{
    Directory.CreateDirectory(wwwrootPath);
}

app.UseCors("AllowFrontend");

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(wwwrootPath),
    RequestPath = "",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers.Append("Access-Control-Allow-Origin", "*");
        ctx.Context.Response.Headers.Append("Access-Control-Allow-Headers", "*");
        ctx.Context.Response.Headers.Append("Access-Control-Allow-Methods", "*");
    }
}); // Serve uploaded files from wwwroot

app.UseHttpsRedirection();

// Security Headers Middleware
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");

    var path = context.Request.Path.Value ?? "";
    
    // Only apply CSP to non-API routes (HTML pages)
    if (path.StartsWith("/api/social/callback/", StringComparison.OrdinalIgnoreCase))
    {
        // Allow inline scripts for OAuth callback pages
        context.Response.Headers.Append("Content-Security-Policy", "default-src 'self'; script-src 'unsafe-inline'; frame-ancestors 'none';");
    }
    else if (!path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
    {
        // Apply CSP only for non-API routes (static files, HTML pages)
        context.Response.Headers.Append("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none';");
    }
    // Skip CSP for API endpoints - they return JSON, not HTML

    await next();
});

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.UseMiddleware<XPost.WebAPI.Middlewares.TenantSecurityMiddleware>();

app.MapControllers().RequireRateLimiting("FixedPolicy");

app.MapHub<XPost.WebAPI.Hubs.InstagramHub>("/hubs/instagram");
app.MapHub<XPost.WebAPI.Hubs.ZaloHub>("/hubs/zalo");
app.MapHub<XPost.WebAPI.Hubs.TikTokHub>("/hubs/tiktok");

app.Run();
