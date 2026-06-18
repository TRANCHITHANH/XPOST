using Microsoft.AspNetCore.SignalR;

namespace XPost.WebAPI.Hubs;

/// <summary>
/// SignalR hub for pushing real-time Facebook Messenger events to the admin Frontend.
/// Events include: incoming customer messages, bot replies, session creation, and profile syncs.
/// Frontend clients connect to /hubs/messenger and listen for "ReceiveMessengerEvent".
/// </summary>
public class MessengerHub : Hub
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
