using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace XPost.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMultiTenantSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // SocialAccounts
            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SocialAccounts]') AND name = N'TenantId')
                ALTER TABLE [SocialAccounts] ADD [TenantId] uniqueidentifier NULL;");

            // Posts
            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Posts]') AND name = N'TenantId')
                ALTER TABLE [Posts] ADD [TenantId] uniqueidentifier NULL;");

            // Categories
            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Categories]') AND name = N'ExternalId')
                ALTER TABLE [Categories] ADD [ExternalId] nvarchar(max) NULL;");
            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Categories]') AND name = N'SocialAccountId')
                ALTER TABLE [Categories] ADD [SocialAccountId] uniqueidentifier NULL;");
            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Categories]') AND name = N'TenantId')
                ALTER TABLE [Categories] ADD [TenantId] uniqueidentifier NULL;");

            // AspNetUsers
            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[AspNetUsers]') AND name = N'AvatarUrl')
                ALTER TABLE [AspNetUsers] ADD [AvatarUrl] nvarchar(max) NULL;");
            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[AspNetUsers]') AND name = N'TenantId')
                ALTER TABLE [AspNetUsers] ADD [TenantId] uniqueidentifier NULL;");

            // Tenants Table
            migrationBuilder.Sql(@"IF OBJECT_ID(N'[Tenants]') IS NULL
            CREATE TABLE [Tenants] (
                Id uniqueidentifier NOT NULL,
                Name nvarchar(max) NOT NULL,
                Description nvarchar(max) NULL,
                LogoUrl nvarchar(max) NULL,
                Domain nvarchar(max) NULL,
                TaxCode nvarchar(max) NULL,
                Representative nvarchar(max) NULL,
                Email nvarchar(max) NULL,
                PhoneNumber nvarchar(max) NULL,
                Address nvarchar(max) NULL,
                PostCode nvarchar(max) NULL,
                IsActive bit NOT NULL,
                IsDeleted bit NOT NULL,
                CreatedBy nvarchar(max) NULL,
                LastModifiedBy nvarchar(max) NULL,
                CreatedAt datetime2 NOT NULL,
                LastModifiedAt datetime2 NULL,
                CONSTRAINT [PK_Tenants] PRIMARY KEY ([Id])
            );");

            // Indexes and Foreign Keys
            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_SocialAccounts_TenantId' AND object_id = OBJECT_ID(N'[SocialAccounts]'))
                CREATE INDEX [IX_SocialAccounts_TenantId] ON [SocialAccounts] ([TenantId]);");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_Posts_TenantId' AND object_id = OBJECT_ID(N'[Posts]'))
                CREATE INDEX [IX_Posts_TenantId] ON [Posts] ([TenantId]);");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_Categories_TenantId' AND object_id = OBJECT_ID(N'[Categories]'))
                CREATE INDEX [IX_Categories_TenantId] ON [Categories] ([TenantId]);");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_AspNetUsers_TenantId' AND object_id = OBJECT_ID(N'[AspNetUsers]'))
                CREATE INDEX [IX_AspNetUsers_TenantId] ON [AspNetUsers] ([TenantId]);");

            // Foreign Keys (Checking for FK names)
            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = N'FK_AspNetUsers_Tenants_TenantId')
                ALTER TABLE [AspNetUsers] ADD CONSTRAINT [FK_AspNetUsers_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]);");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = N'FK_Categories_Tenants_TenantId')
                ALTER TABLE [Categories] ADD CONSTRAINT [FK_Categories_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]);");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = N'FK_Posts_Tenants_TenantId')
                ALTER TABLE [Posts] ADD CONSTRAINT [FK_Posts_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]);");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = N'FK_SocialAccounts_Tenants_TenantId')
                ALTER TABLE [SocialAccounts] ADD CONSTRAINT [FK_SocialAccounts_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_Tenants_TenantId",
                table: "AspNetUsers");

            migrationBuilder.DropForeignKey(
                name: "FK_Categories_Tenants_TenantId",
                table: "Categories");

            migrationBuilder.DropForeignKey(
                name: "FK_Posts_Tenants_TenantId",
                table: "Posts");

            migrationBuilder.DropForeignKey(
                name: "FK_SocialAccounts_Tenants_TenantId",
                table: "SocialAccounts");

            migrationBuilder.DropTable(
                name: "Tenants");

            migrationBuilder.DropIndex(
                name: "IX_SocialAccounts_TenantId",
                table: "SocialAccounts");

            migrationBuilder.DropIndex(
                name: "IX_Posts_TenantId",
                table: "Posts");

            migrationBuilder.DropIndex(
                name: "IX_Categories_TenantId",
                table: "Categories");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_TenantId",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "SocialAccounts");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "ExternalId",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "SocialAccountId",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "AvatarUrl",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "AspNetUsers");
        }
    }
}
