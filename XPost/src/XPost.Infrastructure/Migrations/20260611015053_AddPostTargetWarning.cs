using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace XPost.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPostTargetWarning : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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

            migrationBuilder.AddColumn<string>(
                name: "ImageUrl",
                table: "Keywords",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IceBreakersJson",
                table: "Chatbots",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HasWarning",
                table: "PostTargets");

            migrationBuilder.DropColumn(
                name: "WarningMessage",
                table: "PostTargets");

            migrationBuilder.DropColumn(
                name: "ImageUrl",
                table: "Keywords");

            migrationBuilder.DropColumn(
                name: "IceBreakersJson",
                table: "Chatbots");
        }
    }
}
