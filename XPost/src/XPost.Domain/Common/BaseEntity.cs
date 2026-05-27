using System.ComponentModel.DataAnnotations.Schema;

namespace XPost.Domain.Common;

public abstract class BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("CreatedAtUtc")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("UpdatedAtUtc")]
    public DateTime? UpdatedAt { get; set; }
}
