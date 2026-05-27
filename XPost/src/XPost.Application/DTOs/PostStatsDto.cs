namespace XPost.Application.DTOs;

public class PostStatsDto
{
    public int TotalToday { get; set; }
    public int TotalThisWeek { get; set; }
    public int TotalThisMonth { get; set; }
    public int TotalAll { get; set; }

    // Breakdown by status for each period
    public StatBreakdown Today { get; set; } = new();
    public StatBreakdown ThisWeek { get; set; } = new();
    public StatBreakdown ThisMonth { get; set; } = new();
}

public class StatBreakdown
{
    public int Pending { get; set; }
    public int Published { get; set; }
    public int Failed { get; set; }
}
