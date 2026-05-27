-- 0. Tạo bảng Tenants (Công ty/Khách thuê)
CREATE TABLE [Tenants] (
    [Id] uniqueidentifier NOT NULL,
    
    -- Thông tin cơ bản
    [Name] nvarchar(max) NOT NULL,
    [Description] nvarchar(max) NULL,
    [LogoUrl] nvarchar(max) NULL,
    [Domain] nvarchar(max) NULL,
    
    -- Thông tin pháp lý & Liên hệ
    [TaxCode] nvarchar(100) NULL,
    [Representative] nvarchar(max) NULL,
    [Email] nvarchar(256) NULL,
    [PhoneNumber] nvarchar(100) NULL,
    
    -- Thông tin địa chỉ
    [Address] nvarchar(max) NULL,
    [PostCode] nvarchar(50) NULL,
    
    -- Thông tin hệ thống
    [IsActive] bit NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedBy] nvarchar(max) NULL,
    [LastModifiedAt] datetime2 NULL,
    [LastModifiedBy] nvarchar(max) NULL,
    [IsDeleted] bit NOT NULL,
    CONSTRAINT [PK_Tenants] PRIMARY KEY ([Id])
);

GO

-- 1. Bổ sung TenantId vào các bảng lõi để hỗ trợ Công ty/Doanh nghiệp (Multi-tenant)
ALTER TABLE [AspNetUsers] ADD [TenantId] uniqueidentifier NULL;
ALTER TABLE [SocialAccounts] ADD [TenantId] uniqueidentifier NULL;
ALTER TABLE [Posts] ADD [TenantId] uniqueidentifier NULL;
ALTER TABLE [Categories] ADD [TenantId] uniqueidentifier NULL;

GO

-- 2. Bổ sung các cột phục vụ việc Đồng bộ Danh mục từ Nền tảng bên ngoài (WordPress, Blogger...)
ALTER TABLE [Categories] ADD [SocialAccountId] uniqueidentifier NULL;
ALTER TABLE [Categories] ADD [ExternalId] nvarchar(max) NULL;

GO
