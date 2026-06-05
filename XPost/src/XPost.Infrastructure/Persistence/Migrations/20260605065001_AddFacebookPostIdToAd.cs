using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace XPost.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFacebookPostIdToAd : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FacebookPostId",
                table: "FacebookAds",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FacebookPostId",
                table: "FacebookAds");
        }
    }
}
