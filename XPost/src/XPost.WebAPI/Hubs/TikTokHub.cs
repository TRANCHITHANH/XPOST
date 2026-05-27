using Microsoft.AspNetCore.SignalR;

namespace XPost.WebAPI.Hubs
{
    /// <summary>
    /// SignalR hub for pushing real-time TikTok Business events to connected Frontend clients.
    /// Events include: new messages, comment updates, and conversation updates.
    /// </summary>
    public class TikTokHub : Hub
    {
        public override async Task OnConnectedAsync()
        {
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            await base.OnDisconnectedAsync(exception);
        }
    }
}
