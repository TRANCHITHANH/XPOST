using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace XPost.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSocialInteractions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "Tenants",
                newName: "CreatedAtUtc");

            migrationBuilder.CreateTable(
                name: "SocialComments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "newid()"),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SocialAccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ExternalPostId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ExternalCommentId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ParentCommentId = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Text = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    OriginalText = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SenderId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SenderName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TimestampUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsSensitive = table.Column<bool>(type: "bit", nullable: false),
                    SensitiveType = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsHidden = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "sysutcdatetime()"),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SocialComments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SocialComments_SocialAccounts_SocialAccountId",
                        column: x => x.SocialAccountId,
                        principalTable: "SocialAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SocialMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "newid()"),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SocialAccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ExternalConversationId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ExternalMessageId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Message = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    OriginalMessage = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SenderId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SenderName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TimestampUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsSensitive = table.Column<bool>(type: "bit", nullable: false),
                    SensitiveType = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "sysutcdatetime()"),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SocialMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SocialMessages_SocialAccounts_SocialAccountId",
                        column: x => x.SocialAccountId,
                        principalTable: "SocialAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SocialComments_ExternalCommentId",
                table: "SocialComments",
                column: "ExternalCommentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SocialComments_SocialAccountId",
                table: "SocialComments",
                column: "SocialAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_SocialMessages_ExternalMessageId",
                table: "SocialMessages",
                column: "ExternalMessageId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SocialMessages_SocialAccountId",
                table: "SocialMessages",
                column: "SocialAccountId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SocialComments");

            migrationBuilder.DropTable(
                name: "SocialMessages");

            migrationBuilder.RenameColumn(
                name: "CreatedAtUtc",
                table: "Tenants",
                newName: "CreatedAt");
        }
    }
}
