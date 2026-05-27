using XPost.Infrastructure;
using XPost.WorkerService;

var builder = Host.CreateApplicationBuilder(args);

// Add infrastructure services so we can access DbContext, ISocialPublisher, etc.
builder.Services.AddInfrastructureServices(builder.Configuration);

// Required by FacebookPublisher and TelegramPublisher (IHttpClientFactory)
builder.Services.AddHttpClient();

// Setup to run as a Windows Service
builder.Services.AddWindowsService(options =>
{
    options.ServiceName = "XPost Worker Service";
});

builder.Services.AddHostedService<Worker>();

var host = builder.Build();
host.Run();
