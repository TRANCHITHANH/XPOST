using Microsoft.AspNetCore.SignalR;

namespace XPost.WebAPI.Hubs
{
    /// <summary>
    /// SignalR hub for pushing real-time Zalo OA events to connected Frontend clients.
    /// Events include: new messages, follow/unfollow, and conversation updates.
    /// </summary>
    public class ZaloHub : Hub
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
