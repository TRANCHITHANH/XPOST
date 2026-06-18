using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace XPost.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddChatbotLinkUrls : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SecurityAlerts");

            migrationBuilder.DropColumn(
                name: "HasWarning",
                table: "PostTargets");

            migrationBuilder.DropColumn(
                name: "WarningMessage",
                table: "PostTargets");

            migrationBuilder.AddColumn<string>(
                name: "MaintenanceUrl",
                table: "Chatbots",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PriceListUrl",
                table: "Chatbots",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MaintenanceUrl",
                table: "Chatbots");

            migrationBuilder.DropColumn(
                name: "PriceListUrl",
                table: "Chatbots");

            migrationBuilder.AddColumn<bool>(
                name: "HasWarning",
                table: "PostTargets",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "WarningMessage",
                table: "PostTargets",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SecurityAlerts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "newid()"),
                    ActionType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "sysutcdatetime()"),
                    EntityName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    EntityType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsRead = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Message = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SecurityAlerts", x => x.Id);
                });
        }
    }
}
