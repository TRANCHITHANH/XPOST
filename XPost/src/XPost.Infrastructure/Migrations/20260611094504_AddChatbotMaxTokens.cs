using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace XPost.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddChatbotMaxTokens : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MaxTokens",
                table: "Chatbots",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MaxTokens",
                table: "Chatbots");
        }
    }
}
