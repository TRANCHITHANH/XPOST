using XPost.Domain.Common;

namespace XPost.Domain.Entities;

public class PostProduct : BaseEntity
{
    public Guid PostId { get; set; }
    public string SKU { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public string? Brand { get; set; }
    public string? Model { get; set; }
    public decimal Price { get; set; }
    public string Price_Text { get; set; } = string.Empty;
    public decimal? SalePrice { get; set; }
    public decimal? CostPrice { get; set; }
    public decimal? TaxPercent { get; set; }
    public int Quantity { get; set; } = 0;
    public string? ProductMetaTitle { get; set; }
    public string? ProductMetaDescription { get; set; }
    public string? Str1 { get; set; }
    public string? Str2 { get; set; }
    public int? Int1 { get; set; }
    public decimal? Decimal1 { get; set; }

    // Navigation properties
    public Post Post { get; set; } = null!;
}
