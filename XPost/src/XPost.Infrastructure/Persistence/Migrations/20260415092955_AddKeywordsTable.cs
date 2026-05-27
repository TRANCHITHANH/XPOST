using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace XPost.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddKeywordsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Safely drop UpdatedAtUtc from PostLogs
            migrationBuilder.Sql(@"IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PostLogs]') AND name = N'UpdatedAtUtc')
                ALTER TABLE [PostLogs] DROP COLUMN [UpdatedAtUtc];");

            // Safely add AvatarUrl to SocialAccounts
            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SocialAccounts]') AND name = N'AvatarUrl')
                ALTER TABLE [SocialAccounts] ADD [AvatarUrl] nvarchar(max) NULL;");

            // Keywords Table
            migrationBuilder.Sql(@"IF OBJECT_ID(N'[Keywords]') IS NULL
            CREATE TABLE [Keywords] (
                [Id] uniqueidentifier NOT NULL DEFAULT (newid()),
                [TenantId] uniqueidentifier NULL,
                [Name] nvarchar(max) NOT NULL,
                [Description] nvarchar(max) NULL,
                [Status] int NOT NULL,
                [GeneratedContent] nvarchar(max) NULL,
                [LastErrorMessage] nvarchar(max) NULL,
                [LastGeneratedAtUtc] datetime2 NULL,
                [Language] nvarchar(max) NULL,
                [LastPostId] uniqueidentifier NULL,
                [CreatedAtUtc] datetime2 NOT NULL DEFAULT (sysutcdatetime()),
                [UpdatedAtUtc] datetime2 NULL,
                CONSTRAINT [PK_Keywords] PRIMARY KEY ([Id]),
                CONSTRAINT [FK_Keywords_Posts_LastPostId] FOREIGN KEY ([LastPostId]) REFERENCES [Posts] ([Id]) ON DELETE SET NULL
            );");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_Keywords_LastPostId' AND object_id = OBJECT_ID(N'[Keywords]'))
                CREATE INDEX [IX_Keywords_LastPostId] ON [Keywords] ([LastPostId]);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Keywords");

            migrationBuilder.DropColumn(
                name: "AvatarUrl",
                table: "SocialAccounts");

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAtUtc",
                table: "PostLogs",
                type: "datetime2",
                nullable: true);
        }
    }
}
