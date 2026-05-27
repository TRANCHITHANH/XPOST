using Microsoft.AspNetCore.Identity;
using XPost.Domain.Entities;

namespace XPost.Infrastructure.Identity;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(UserManager<ApplicationUser> userManager, RoleManager<IdentityRole> roleManager)
    {
        // 1. Khởi tạo các Roles mặc định
        string[] roleNames = { "SuperAdmin", "TenantAdmin", "User" };
        foreach (var roleName in roleNames)
        {
            if (!await roleManager.RoleExistsAsync(roleName))
            {
                await roleManager.CreateAsync(new IdentityRole(roleName));
            }
        }

        // 2. Tạo tài khoản SuperAdmin mặc định nếu chưa có
        string superAdminEmail = "admin@xpost.vn";
        var superAdmin = await userManager.FindByEmailAsync(superAdminEmail);

        if (superAdmin == null)
        {
            var newSuperAdmin = new ApplicationUser
            {
                UserName = superAdminEmail,
                Email = superAdminEmail,
                EmailConfirmed = true,
                FirstName = "Super",
                LastName = "Admin",
                IsActive = true
            };

            var createResult = await userManager.CreateAsync(newSuperAdmin, "Admin@123!");
            if (createResult.Succeeded)
            {
                await userManager.AddToRoleAsync(newSuperAdmin, "SuperAdmin");
            }
            else
            {
                Console.WriteLine("Failed to create SuperAdmin: " + string.Join(", ", createResult.Errors.Select(e => e.Description)));
            }
        }
        else
        {
            Console.WriteLine("SuperAdmin already exists in the database.");
        }
    }
}
