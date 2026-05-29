using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace XPost.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFacebookAdsCampaignSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FacebookAdAccounts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "newid()"),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    AdAccountId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    AccountName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    AccessToken = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "sysutcdatetime()"),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FacebookAdAccounts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FacebookCampaigns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "newid()"),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    FacebookAdAccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MetaCampaignId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Objective = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false, defaultValue: "DRAFT"),
                    Budget = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    StartTimeUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndTimeUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "sysutcdatetime()"),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FacebookCampaigns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FacebookCampaigns_FacebookAdAccounts_FacebookAdAccountId",
                        column: x => x.FacebookAdAccountId,
                        principalTable: "FacebookAdAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FacebookAdSets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "newid()"),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    FacebookCampaignId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MetaAdSetId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    BillingEvent = table.Column<string>(type: "nvarchar(max)", nullable: false, defaultValue: "IMPRESSIONS"),
                    DailyBudget = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    LifetimeBudget = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    TargetingAgeMin = table.Column<int>(type: "int", nullable: false, defaultValue: 18),
                    TargetingAgeMax = table.Column<int>(type: "int", nullable: false, defaultValue: 65),
                    TargetingGenders = table.Column<string>(type: "nvarchar(max)", nullable: false, defaultValue: "ALL"),
                    TargetingLocations = table.Column<string>(type: "nvarchar(max)", nullable: false, defaultValue: "VN"),
                    TargetingInterests = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Placements = table.Column<string>(type: "nvarchar(max)", nullable: false, defaultValue: "AUTOMATIC"),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "sysutcdatetime()"),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FacebookAdSets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FacebookAdSets_FacebookCampaigns_FacebookCampaignId",
                        column: x => x.FacebookCampaignId,
                        principalTable: "FacebookCampaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FacebookAds",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "newid()"),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    FacebookAdSetId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MetaAdId = table.Column<string>(type: "nvarchar(max)", nullable: false),
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
                    table.PrimaryKey("PK_FacebookAds", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FacebookAds_FacebookAdSets_FacebookAdSetId",
                        column: x => x.FacebookAdSetId,
                        principalTable: "FacebookAdSets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FacebookAdInsights",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "newid()"),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    FacebookAdId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
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
                    table.PrimaryKey("PK_FacebookAdInsights", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FacebookAdInsights_FacebookAds_FacebookAdId",
                        column: x => x.FacebookAdId,
                        principalTable: "FacebookAds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FacebookAdInsights_FacebookAdId",
                table: "FacebookAdInsights",
                column: "FacebookAdId");

            migrationBuilder.CreateIndex(
                name: "IX_FacebookAds_FacebookAdSetId",
                table: "FacebookAds",
                column: "FacebookAdSetId");

            migrationBuilder.CreateIndex(
                name: "IX_FacebookAdSets_FacebookCampaignId",
                table: "FacebookAdSets",
                column: "FacebookCampaignId");

            migrationBuilder.CreateIndex(
                name: "IX_FacebookCampaigns_FacebookAdAccountId",
                table: "FacebookCampaigns",
                column: "FacebookAdAccountId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FacebookAdInsights");

            migrationBuilder.DropTable(
                name: "FacebookAds");

            migrationBuilder.DropTable(
                name: "FacebookAdSets");

            migrationBuilder.DropTable(
                name: "FacebookCampaigns");

            migrationBuilder.DropTable(
                name: "FacebookAdAccounts");
        }
    }
}
