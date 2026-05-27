using Microsoft.AspNetCore.SignalR;

namespace XPost.WebAPI.Hubs
{
    public class InstagramHub : Hub
    {
        // Clients can connect to this hub and receive messages.
        // We can add specific methods if clients need to send messages to the server via SignalR,
        // but for webhooks, it's usually server -> client push.

        public override async Task OnConnectedAsync()
        {
            // Optionally, log connection or add to a specific group (e.g., TenantId)
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            await base.OnDisconnectedAsync(exception);
        }
    }
}
