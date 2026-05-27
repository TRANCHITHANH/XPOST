using Microsoft.AspNetCore.Mvc;
using XPost.Domain.Entities;
using XPost.Infrastructure.Persistence;

namespace XPost.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TestDBController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public TestDBController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> Test()
    {
        try
        {
            var tenant = new Tenant
            {
                Name = "Test Company",
                Domain = "test.domain",
                IsActive = true
            };
            
            _db.Tenants.Add(tenant);
            await _db.SaveChangesAsync();

            // Cleanup
            _db.Tenants.Remove(tenant);
            await _db.SaveChangesAsync();

            return Ok("Success");
        }
        catch (Exception ex)
        {
            return Ok(new {
                Message = ex.InnerException?.Message ?? ex.Message,
                FullException = ex.ToString()
            });
        }
    }
}
