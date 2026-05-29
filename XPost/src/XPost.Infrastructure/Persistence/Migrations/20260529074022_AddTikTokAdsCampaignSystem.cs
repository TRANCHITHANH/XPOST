using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace XPost.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTikTokAdsCampaignSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TikTokAdAccounts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "newid()"),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    AdvertiserId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    AccountName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    AccessToken = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "sysutcdatetime()"),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TikTokAdAccounts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TikTokCampaigns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "newid()"),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    TikTokAdAccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TikTokCampaignId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ObjectiveType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false, defaultValue: "DRAFT"),
                    Budget = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    BudgetMode = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    StartTimeUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndTimeUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "sysutcdatetime()"),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TikTokCampaigns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TikTokCampaigns_TikTokAdAccounts_TikTokAdAccountId",
                        column: x => x.TikTokAdAccountId,
                        principalTable: "TikTokAdAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TikTokAdGroups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "newid()"),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    TikTokCampaignId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TikTokAdGroupId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PlacementType = table.Column<string>(type: "nvarchar(max)", nullable: false, defaultValue: "PLACEMENT_MODE_DEFAULT"),
                    DailyBudget = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    TargetingAgeMin = table.Column<int>(type: "int", nullable: false, defaultValue: 18),
                    TargetingAgeMax = table.Column<int>(type: "int", nullable: false, defaultValue: 65),
                    TargetingGenders = table.Column<string>(type: "nvarchar(max)", nullable: false, defaultValue: "ALL"),
                    TargetingLocations = table.Column<string>(type: "nvarchar(max)", nullable: false, defaultValue: "VN"),
                    TargetingInterests = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "sysutcdatetime()"),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TikTokAdGroups", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TikTokAdGroups_TikTokCampaigns_TikTokCampaignId",
                        column: x => x.TikTokCampaignId,
                        principalTable: "TikTokCampaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TikTokAds",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "newid()"),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    TikTokAdGroupId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TikTokAdId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    BodyText = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    MediaUrl = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DestinationUrl = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CallToAction = table.Column<string>(type: "nvarchar(max)", nullable: false, defaultValue: "LEARN_MORE"),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false, defaultValue: "ACTIVE"),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "sysutcdatetime()"),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TikTokAds", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TikTokAds_TikTokAdGroups_TikTokAdGroupId",
                        column: x => x.TikTokAdGroupId,
                        principalTable: "TikTokAdGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TikTokAdInsights",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "newid()"),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    TikTokAdId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Impressions = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    Reach = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    Clicks = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    Spend = table.Column<decimal>(type: "decimal(18,2)", nullable: false, defaultValue: 0m),
                    Date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "sysutcdatetime()"),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TikTokAdInsights", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TikTokAdInsights_TikTokAds_TikTokAdId",
                        column: x => x.TikTokAdId,
                        principalTable: "TikTokAds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TikTokAdGroups_TikTokCampaignId",
                table: "TikTokAdGroups",
                column: "TikTokCampaignId");

            migrationBuilder.CreateIndex(
                name: "IX_TikTokAdInsights_TikTokAdId",
                table: "TikTokAdInsights",
                column: "TikTokAdId");

            migrationBuilder.CreateIndex(
                name: "IX_TikTokAds_TikTokAdGroupId",
                table: "TikTokAds",
                column: "TikTokAdGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_TikTokCampaigns_TikTokAdAccountId",
                table: "TikTokCampaigns",
                column: "TikTokAdAccountId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TikTokAdInsights");

            migrationBuilder.DropTable(
                name: "TikTokAds");

            migrationBuilder.DropTable(
                name: "TikTokAdGroups");

            migrationBuilder.DropTable(
                name: "TikTokCampaigns");

            migrationBuilder.DropTable(
                name: "TikTokAdAccounts");
        }
    }
}
