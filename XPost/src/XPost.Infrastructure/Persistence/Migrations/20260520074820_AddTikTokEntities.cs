using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace XPost.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTikTokEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TikTokConversations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "newid()"),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SocialAccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TikTokUserId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    UserDisplayName = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    UserAvatarUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    LastMessagePreview = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    LastMessageAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsRead = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "sysutcdatetime()"),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TikTokConversations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TikTokConversations_SocialAccounts_SocialAccountId",
                        column: x => x.SocialAccountId,
                        principalTable: "SocialAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TikTokMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "newid()"),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ConversationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TikTokMessageId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    SenderId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    IsFromBusiness = table.Column<bool>(type: "bit", nullable: false),
                    Text = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AttachmentUrl = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    AttachmentType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false, defaultValue: "text"),
                    SentAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsSensitive = table.Column<bool>(type: "bit", nullable: false),
                    SensitiveType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "sysutcdatetime()"),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TikTokMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TikTokMessages_TikTokConversations_ConversationId",
                        column: x => x.ConversationId,
                        principalTable: "TikTokConversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TikTokConversations_SocialAccountId_TikTokUserId",
                table: "TikTokConversations",
                columns: new[] { "SocialAccountId", "TikTokUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TikTokMessages_ConversationId",
                table: "TikTokMessages",
                column: "ConversationId");

            migrationBuilder.CreateIndex(
                name: "IX_TikTokMessages_TikTokMessageId",
                table: "TikTokMessages",
                column: "TikTokMessageId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TikTokMessages");

            migrationBuilder.DropTable(
                name: "TikTokConversations");
        }
    }
}
