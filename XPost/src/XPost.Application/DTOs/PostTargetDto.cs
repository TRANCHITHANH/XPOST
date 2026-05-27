using System;

namespace XPost.Application.DTOs;

public class PostTargetDto
{
    public Guid SocialAccountId { get; set; }
    public DateTime ScheduledTimeUtc { get; set; }
    public int Status { get; set; }
    public int Platform { get; set; }
    public string? LastError { get; set; }
    public string? PublishedUrl { get; set; }
}
