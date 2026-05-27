using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Interfaces;

namespace XPost.Infrastructure.Persistence;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser, IdentityRole, string>
{
    private readonly ICurrentUserService _currentUserService;

    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        ICurrentUserService currentUserService) : base(options)
    {
        _currentUserService = currentUserService;
    }

    public Guid? CurrentTenantId 
    {
        get 
        {
            if (Guid.TryParse(_currentUserService.TenantId, out var tenantId))
                return tenantId;
            return null;
        }
    }

    public DbSet<Category> Categories { get; set; } = null!;
    public DbSet<Tenant> Tenants { get; set; } = null!;
    public DbSet<Tag> Tags { get; set; } = null!;
    public DbSet<Post> Posts { get; set; } = null!;
    public DbSet<PostProduct> PostProducts { get; set; } = null!;
    public DbSet<PostMedia> PostMedias { get; set; } = null!;
    public DbSet<PostTag> PostTags { get; set; } = null!;
    public DbSet<SocialAccount> SocialAccounts { get; set; } = null!;
    public DbSet<PostTarget> PostTargets { get; set; } = null!;
    public DbSet<PostLog> PostLogs { get; set; } = null!;
    public DbSet<Keyword> Keywords { get; set; } = null!;
    public DbSet<ZaloConversation> ZaloConversations { get; set; } = null!;
    public DbSet<ZaloMessage> ZaloMessages { get; set; } = null!;
    public DbSet<TikTokConversation> TikTokConversations { get; set; } = null!;
    public DbSet<TikTokMessage> TikTokMessages { get; set; } = null!;


    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Global Query Filters
        builder.Entity<ApplicationUser>().HasQueryFilter(e => !CurrentTenantId.HasValue || e.TenantId == CurrentTenantId);
        builder.Entity<Category>().HasQueryFilter(e => !CurrentTenantId.HasValue || e.TenantId == CurrentTenantId);
        builder.Entity<Post>().HasQueryFilter(e => !CurrentTenantId.HasValue || e.TenantId == CurrentTenantId);
        builder.Entity<SocialAccount>().HasQueryFilter(e => !CurrentTenantId.HasValue || e.TenantId == CurrentTenantId);
        builder.Entity<Keyword>().HasQueryFilter(e => !CurrentTenantId.HasValue || e.TenantId == CurrentTenantId);
        builder.Entity<ZaloConversation>().HasQueryFilter(e => !CurrentTenantId.HasValue || e.TenantId == CurrentTenantId);
        builder.Entity<ZaloMessage>().HasQueryFilter(e => !CurrentTenantId.HasValue || e.TenantId == CurrentTenantId);
        builder.Entity<TikTokConversation>().HasQueryFilter(e => !CurrentTenantId.HasValue || e.TenantId == CurrentTenantId);
        builder.Entity<TikTokMessage>().HasQueryFilter(e => !CurrentTenantId.HasValue || e.TenantId == CurrentTenantId);


        // ApplicationUser
        builder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(e => e.EmailConfirmed).HasDefaultValue(false);
            entity.Property(e => e.PhoneNumberConfirmed).HasDefaultValue(false);
            entity.Property(e => e.TwoFactorEnabled).HasDefaultValue(false);
            entity.Property(e => e.LockoutEnabled).HasDefaultValue(true);
            entity.Property(e => e.AccessFailedCount).HasDefaultValue(0);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.CreatedAtUtc).HasDefaultValueSql("sysutcdatetime()");
            entity.Property(e => e.FirstName).HasColumnName("FisrtName").HasMaxLength(250);
            entity.Property(e => e.LastName).HasMaxLength(250);
            entity.Property(e => e.FullName).HasMaxLength(200);
        });

        // Tenant
        builder.Entity<Tenant>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UpdatedAt).HasColumnName("LastModifiedAt");
        });

        // Category
        builder.Entity<Category>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("newid()");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.SortOrder).HasDefaultValue(0);
            entity.Property(e => e.CreatedAt).HasColumnName("CreatedAtUtc").HasDefaultValueSql("sysutcdatetime()");
            entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAtUtc");
            
            entity.HasOne(e => e.Parent)
                .WithMany(e => e.Children)
                .HasForeignKey(e => e.ParentId);
        });

        // Tag
        builder.Entity<Tag>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("newid()");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.CreatedAt).HasColumnName("CreatedAtUtc").HasDefaultValueSql("sysutcdatetime()");
            entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAtUtc");
        });

        // SocialAccount
        builder.Entity<SocialAccount>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("newid()");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.CreatedAt).HasColumnName("CreatedAtUtc");
            entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAtUtc");
            
            entity.HasOne(e => e.User)
                .WithMany(u => u.SocialAccounts)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Post
        builder.Entity<Post>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("newid()");
            entity.Property(e => e.Ref_ID).HasDefaultValue(0);
            entity.Property(e => e.PostType).HasDefaultValue(0);
            entity.Property(e => e.IsFeatured).HasDefaultValue(false);
            entity.Property(e => e.IsPinned).HasDefaultValue(false);
            entity.Property(e => e.AllowComment).HasDefaultValue(true);
            entity.Property(e => e.ViewCount).HasDefaultValue(0);
            entity.Property(e => e.ShareCount).HasDefaultValue(0);
            entity.Property(e => e.CreatedAt).HasColumnName("CreatedAtUtc").HasDefaultValueSql("sysutcdatetime()");
            entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAtUtc");

            entity.HasOne(p => p.User)
                .WithMany(u => u.Posts)
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade); // Adjust if needed based on the old schema
        });

        // PostTag (Many-to-Many)
        builder.Entity<PostTag>(entity =>
        {
            entity.HasKey(pt => new { pt.PostId, pt.TagId });
            
            entity.HasOne(pt => pt.Post)
                .WithMany(p => p.PostTags)
                .HasForeignKey(pt => pt.PostId)
                .OnDelete(DeleteBehavior.Cascade);
                
            entity.HasOne(pt => pt.Tag)
                .WithMany(t => t.PostTags)
                .HasForeignKey(pt => pt.TagId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // PostProduct
        builder.Entity<PostProduct>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("newid()");
            entity.Property(e => e.CreatedAt).HasColumnName("CreatedAtUtc");
            entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAtUtc");
            
            entity.HasOne(e => e.Post)
                .WithMany(p => p.PostProducts)
                .HasForeignKey(e => e.PostId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // PostMedia
        builder.Entity<PostMedia>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("newid()");
            entity.Property(e => e.SortOrder).HasDefaultValue(0);
            entity.Property(e => e.IsMain).HasDefaultValue(false);
            entity.Property(e => e.CreatedAt).HasColumnName("CreatedAtUtc").HasDefaultValueSql("sysutcdatetime()");
            entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAtUtc");
            
            entity.HasOne(e => e.Post)
                .WithMany(p => p.PostMedias)
                .HasForeignKey(e => e.PostId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // PostTarget
        builder.Entity<PostTarget>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("newid()");
            entity.Property(e => e.RetryCount).HasDefaultValue(0);
            entity.Property(e => e.IsProcessing).HasDefaultValue(false);
            entity.Property(e => e.CreatedAt).HasColumnName("CreatedAtUtc");
            entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAtUtc");
            
            entity.HasOne(e => e.Post)
                .WithMany(p => p.PostTargets)
                .HasForeignKey(e => e.PostId)
                .OnDelete(DeleteBehavior.Cascade);
                
            entity.HasOne(e => e.SocialAccount)
                .WithMany(sa => sa.PostTargets)
                .HasForeignKey(e => e.SocialAccountId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // PostLog
        builder.Entity<PostLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("newid()");
            entity.Property(e => e.RetryCount).HasDefaultValue(0);
            entity.Property(e => e.CreatedAt).HasColumnName("CreatedAtUtc").HasDefaultValueSql("sysutcdatetime()");
            entity.Ignore(e => e.UpdatedAt); // Logs do not have an Update column
            
            entity.HasOne(e => e.PostTarget)
                .WithMany(pt => pt.PostLogs)
                .HasForeignKey(e => e.PostTargetId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Keyword
        builder.Entity<Keyword>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("newid()");
            entity.Property(e => e.CreatedAt).HasColumnName("CreatedAtUtc").HasDefaultValueSql("sysutcdatetime()");
            entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAtUtc");
            
            entity.HasOne(e => e.LastPost)
                .WithMany()
                .HasForeignKey(e => e.LastPostId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // ZaloConversation
        builder.Entity<ZaloConversation>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("newid()");
            entity.Property(e => e.ZaloUserId).HasMaxLength(100).IsRequired();
            entity.Property(e => e.UserDisplayName).HasMaxLength(250);
            entity.Property(e => e.UserAvatarUrl).HasMaxLength(1000);
            entity.Property(e => e.LastMessagePreview).HasMaxLength(500);
            entity.Property(e => e.IsRead).HasDefaultValue(true);
            entity.Property(e => e.CreatedAt).HasColumnName("CreatedAtUtc").HasDefaultValueSql("sysutcdatetime()");
            entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAtUtc");

            entity.HasOne(e => e.SocialAccount)
                .WithMany()
                .HasForeignKey(e => e.SocialAccountId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.SocialAccountId, e.ZaloUserId }).IsUnique();
        });

        // ZaloMessage
        builder.Entity<ZaloMessage>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("newid()");
            entity.Property(e => e.ZaloMessageId).HasMaxLength(200).IsRequired();
            entity.Property(e => e.SenderId).HasMaxLength(100).IsRequired();
            entity.Property(e => e.AttachmentType).HasMaxLength(50).HasDefaultValue("text");
            entity.Property(e => e.AttachmentUrl).HasMaxLength(2000);
            entity.Property(e => e.SensitiveType).HasMaxLength(100);
            entity.Property(e => e.CreatedAt).HasColumnName("CreatedAtUtc").HasDefaultValueSql("sysutcdatetime()");
            entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAtUtc");

            entity.HasOne(e => e.Conversation)
                .WithMany(c => c.Messages)
                .HasForeignKey(e => e.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.ZaloMessageId).IsUnique();
        });

        // TikTokConversation
        builder.Entity<TikTokConversation>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("newid()");
            entity.Property(e => e.TikTokUserId).HasMaxLength(200).IsRequired();
            entity.Property(e => e.UserDisplayName).HasMaxLength(250);
            entity.Property(e => e.UserAvatarUrl).HasMaxLength(1000);
            entity.Property(e => e.LastMessagePreview).HasMaxLength(500);
            entity.Property(e => e.IsRead).HasDefaultValue(true);
            entity.Property(e => e.CreatedAt).HasColumnName("CreatedAtUtc").HasDefaultValueSql("sysutcdatetime()");
            entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAtUtc");

            entity.HasOne(e => e.SocialAccount)
                .WithMany()
                .HasForeignKey(e => e.SocialAccountId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.SocialAccountId, e.TikTokUserId }).IsUnique();
        });

        // TikTokMessage
        builder.Entity<TikTokMessage>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("newid()");
            entity.Property(e => e.TikTokMessageId).HasMaxLength(200).IsRequired();
            entity.Property(e => e.SenderId).HasMaxLength(200).IsRequired();
            entity.Property(e => e.AttachmentType).HasMaxLength(50).HasDefaultValue("text");
            entity.Property(e => e.AttachmentUrl).HasMaxLength(2000);
            entity.Property(e => e.SensitiveType).HasMaxLength(100);
            entity.Property(e => e.CreatedAt).HasColumnName("CreatedAtUtc").HasDefaultValueSql("sysutcdatetime()");
            entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAtUtc");

            entity.HasOne(e => e.Conversation)
                .WithMany(c => c.Messages)
                .HasForeignKey(e => e.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.TikTokMessageId).IsUnique();
        });
    }

    public override int SaveChanges()
    {
        ApplyTenantId();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = new CancellationToken())
    {
        ApplyTenantId();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void ApplyTenantId()
    {
        foreach (var entry in ChangeTracker.Entries<IMultiTenant>())
        {
            if (entry.State == EntityState.Added && CurrentTenantId.HasValue && !entry.Entity.TenantId.HasValue)
            {
                entry.Entity.TenantId = CurrentTenantId.Value;
            }
        }
    }
}
