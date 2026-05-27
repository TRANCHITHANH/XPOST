IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
CREATE TABLE [AspNetRoles] (
    [Id] nvarchar(450) NOT NULL,
    [Name] nvarchar(256) NULL,
    [NormalizedName] nvarchar(256) NULL,
    [ConcurrencyStamp] nvarchar(max) NULL,
    CONSTRAINT [PK_AspNetRoles] PRIMARY KEY ([Id])
);

CREATE TABLE [AspNetUsers] (
    [Id] nvarchar(450) NOT NULL,
    [FullName] nvarchar(200) NULL,
    [FisrtName] nvarchar(250) NULL,
    [LastName] nvarchar(250) NULL,
    [IsActive] bit NOT NULL DEFAULT CAST(1 AS bit),
    [CreatedAtUtc] datetime2 NOT NULL DEFAULT (sysutcdatetime()),
    [UpdatedAtUtc] datetime2 NULL,
    [UserName] nvarchar(256) NULL,
    [NormalizedUserName] nvarchar(256) NULL,
    [Email] nvarchar(256) NULL,
    [NormalizedEmail] nvarchar(256) NULL,
    [EmailConfirmed] bit NOT NULL DEFAULT CAST(0 AS bit),
    [PasswordHash] nvarchar(max) NULL,
    [SecurityStamp] nvarchar(max) NULL,
    [ConcurrencyStamp] nvarchar(max) NULL,
    [PhoneNumber] nvarchar(max) NULL,
    [PhoneNumberConfirmed] bit NOT NULL DEFAULT CAST(0 AS bit),
    [TwoFactorEnabled] bit NOT NULL DEFAULT CAST(0 AS bit),
    [LockoutEnd] datetimeoffset NULL,
    [LockoutEnabled] bit NOT NULL DEFAULT CAST(1 AS bit),
    [AccessFailedCount] int NOT NULL DEFAULT 0,
    CONSTRAINT [PK_AspNetUsers] PRIMARY KEY ([Id])
);

CREATE TABLE [Categories] (
    [Id] uniqueidentifier NOT NULL DEFAULT (newid()),
    [Name] nvarchar(max) NOT NULL,
    [Slug] nvarchar(max) NOT NULL,
    [ParentId] uniqueidentifier NULL,
    [Description] nvarchar(max) NULL,
    [IsActive] bit NOT NULL DEFAULT CAST(1 AS bit),
    [SortOrder] int NOT NULL DEFAULT 0,
    [CreatedAt] datetime2 NOT NULL DEFAULT (sysutcdatetime()),
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_Categories] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Categories_Categories_ParentId] FOREIGN KEY ([ParentId]) REFERENCES [Categories] ([Id])
);

CREATE TABLE [Tags] (
    [Id] uniqueidentifier NOT NULL DEFAULT (newid()),
    [Name] nvarchar(max) NOT NULL,
    [Slug] nvarchar(max) NOT NULL,
    [IsActive] bit NOT NULL DEFAULT CAST(1 AS bit),
    [CreatedAt] datetime2 NOT NULL DEFAULT (sysutcdatetime()),
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_Tags] PRIMARY KEY ([Id])
);

CREATE TABLE [AspNetRoleClaims] (
    [Id] int NOT NULL IDENTITY,
    [RoleId] nvarchar(450) NOT NULL,
    [ClaimType] nvarchar(max) NULL,
    [ClaimValue] nvarchar(max) NULL,
    CONSTRAINT [PK_AspNetRoleClaims] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_AspNetRoleClaims_AspNetRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [AspNetRoles] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [AspNetUserClaims] (
    [Id] int NOT NULL IDENTITY,
    [UserId] nvarchar(450) NOT NULL,
    [ClaimType] nvarchar(max) NULL,
    [ClaimValue] nvarchar(max) NULL,
    CONSTRAINT [PK_AspNetUserClaims] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_AspNetUserClaims_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [AspNetUserLogins] (
    [LoginProvider] nvarchar(450) NOT NULL,
    [ProviderKey] nvarchar(450) NOT NULL,
    [ProviderDisplayName] nvarchar(max) NULL,
    [UserId] nvarchar(450) NOT NULL,
    CONSTRAINT [PK_AspNetUserLogins] PRIMARY KEY ([LoginProvider], [ProviderKey]),
    CONSTRAINT [FK_AspNetUserLogins_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [AspNetUserRoles] (
    [UserId] nvarchar(450) NOT NULL,
    [RoleId] nvarchar(450) NOT NULL,
    CONSTRAINT [PK_AspNetUserRoles] PRIMARY KEY ([UserId], [RoleId]),
    CONSTRAINT [FK_AspNetUserRoles_AspNetRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [AspNetRoles] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_AspNetUserRoles_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [AspNetUserTokens] (
    [UserId] nvarchar(450) NOT NULL,
    [LoginProvider] nvarchar(450) NOT NULL,
    [Name] nvarchar(450) NOT NULL,
    [Value] nvarchar(max) NULL,
    CONSTRAINT [PK_AspNetUserTokens] PRIMARY KEY ([UserId], [LoginProvider], [Name]),
    CONSTRAINT [FK_AspNetUserTokens_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [SocialAccounts] (
    [Id] uniqueidentifier NOT NULL DEFAULT (newid()),
    [UserId] nvarchar(450) NOT NULL,
    [Platform] int NOT NULL,
    [AccountName] nvarchar(max) NOT NULL,
    [AccountIdentifier] nvarchar(max) NULL,
    [ApiBaseUrl] nvarchar(max) NULL,
    [ApiPostEndpoint] nvarchar(max) NULL,
    [ApiMethod] nvarchar(max) NULL,
    [AuthType] int NULL,
    [ApiKey] nvarchar(max) NULL,
    [ApiSecret] nvarchar(max) NULL,
    [AccessToken] nvarchar(max) NULL,
    [RefreshToken] nvarchar(max) NULL,
    [TokenExpiredAtUtc] datetime2 NULL,
    [CustomHeadersJson] nvarchar(max) NULL,
    [FieldMappingJson] nvarchar(max) NULL,
    [IsActive] bit NOT NULL DEFAULT CAST(1 AS bit),
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_SocialAccounts] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_SocialAccounts_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [Posts] (
    [Id] uniqueidentifier NOT NULL DEFAULT (newid()),
    [UserId] nvarchar(450) NOT NULL,
    [Ref_ID] int NULL DEFAULT 0,
    [PostType] int NOT NULL DEFAULT 0,
    [Title] nvarchar(max) NOT NULL,
    [Slug] nvarchar(max) NOT NULL,
    [Description] nvarchar(max) NULL,
    [Content] nvarchar(max) NULL,
    [MetaTitle] nvarchar(max) NULL,
    [MetaDescription] nvarchar(max) NULL,
    [MetaKeywords] nvarchar(max) NULL,
    [CategoryId] uniqueidentifier NULL,
    [Tags] nvarchar(max) NULL,
    [FeaturedImageUrl] nvarchar(max) NULL,
    [FeaturedImageAlt] nvarchar(max) NULL,
    [MediaJson] nvarchar(max) NULL,
    [DisplayStartUtc] datetime2 NULL,
    [DisplayEndUtc] datetime2 NULL,
    [IsFeatured] bit NOT NULL DEFAULT CAST(0 AS bit),
    [IsPinned] bit NOT NULL DEFAULT CAST(0 AS bit),
    [AllowComment] bit NOT NULL DEFAULT CAST(1 AS bit),
    [Status] int NOT NULL,
    [ViewCount] int NOT NULL DEFAULT 0,
    [ShareCount] int NOT NULL DEFAULT 0,
    [Str1] nvarchar(max) NULL,
    [Str2] nvarchar(max) NULL,
    [Str3] nvarchar(max) NULL,
    [Int1] int NULL,
    [Int2] int NULL,
    [Decimal1] decimal(18,2) NULL,
    [PublishedAtUtc] datetime2 NULL,
    [CreatedBy] nvarchar(max) NULL,
    [UpdatedBy] nvarchar(max) NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_Posts] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Posts_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_Posts_Categories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [Categories] ([Id])
);

CREATE TABLE [PostMedias] (
    [Id] uniqueidentifier NOT NULL DEFAULT (newid()),
    [PostId] uniqueidentifier NOT NULL,
    [MediaType] nvarchar(max) NOT NULL,
    [Url] nvarchar(max) NOT NULL,
    [ThumbnailUrl] nvarchar(max) NULL,
    [Title] nvarchar(max) NULL,
    [AltText] nvarchar(max) NULL,
    [SortOrder] int NOT NULL DEFAULT 0,
    [IsMain] bit NOT NULL DEFAULT CAST(0 AS bit),
    [CreatedAt] datetime2 NOT NULL DEFAULT (sysutcdatetime()),
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_PostMedias] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_PostMedias_Posts_PostId] FOREIGN KEY ([PostId]) REFERENCES [Posts] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [PostProducts] (
    [Id] uniqueidentifier NOT NULL DEFAULT (newid()),
    [PostId] uniqueidentifier NOT NULL,
    [SKU] nvarchar(max) NOT NULL,
    [Barcode] nvarchar(max) NULL,
    [Brand] nvarchar(max) NULL,
    [Model] nvarchar(max) NULL,
    [Price] decimal(18,2) NOT NULL,
    [Price_Text] nvarchar(max) NOT NULL,
    [SalePrice] decimal(18,2) NULL,
    [CostPrice] decimal(18,2) NULL,
    [TaxPercent] decimal(18,2) NULL,
    [Quantity] int NOT NULL,
    [ProductMetaTitle] nvarchar(max) NULL,
    [ProductMetaDescription] nvarchar(max) NULL,
    [Str1] nvarchar(max) NULL,
    [Str2] nvarchar(max) NULL,
    [Int1] int NULL,
    [Decimal1] decimal(18,2) NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_PostProducts] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_PostProducts_Posts_PostId] FOREIGN KEY ([PostId]) REFERENCES [Posts] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [PostTags] (
    [PostId] uniqueidentifier NOT NULL,
    [TagId] uniqueidentifier NOT NULL,
    CONSTRAINT [PK_PostTags] PRIMARY KEY ([PostId], [TagId]),
    CONSTRAINT [FK_PostTags_Posts_PostId] FOREIGN KEY ([PostId]) REFERENCES [Posts] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_PostTags_Tags_TagId] FOREIGN KEY ([TagId]) REFERENCES [Tags] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [PostTargets] (
    [Id] uniqueidentifier NOT NULL DEFAULT (newid()),
    [PostId] uniqueidentifier NOT NULL,
    [SocialAccountId] uniqueidentifier NOT NULL,
    [Status] int NOT NULL,
    [RetryCount] int NOT NULL DEFAULT 0,
    [LastError] nvarchar(max) NULL,
    [PublishedUrl] nvarchar(max) NULL,
    [PublishedPostId] nvarchar(max) NULL,
    [IsProcessing] bit NOT NULL DEFAULT CAST(0 AS bit),
    [ScheduledTimeUtc] datetime2 NOT NULL,
    [ProcessedAtUtc] datetime2 NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_PostTargets] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_PostTargets_Posts_PostId] FOREIGN KEY ([PostId]) REFERENCES [Posts] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_PostTargets_SocialAccounts_SocialAccountId] FOREIGN KEY ([SocialAccountId]) REFERENCES [SocialAccounts] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [PostLogs] (
    [Id] uniqueidentifier NOT NULL DEFAULT (newid()),
    [PostTargetId] uniqueidentifier NOT NULL,
    [Status] nvarchar(max) NOT NULL,
    [ResponseMessage] nvarchar(max) NULL,
    [ErrorMessage] nvarchar(max) NULL,
    [RetryCount] int NOT NULL DEFAULT 0,
    [CreatedAt] datetime2 NOT NULL DEFAULT (sysutcdatetime()),
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_PostLogs] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_PostLogs_PostTargets_PostTargetId] FOREIGN KEY ([PostTargetId]) REFERENCES [PostTargets] ([Id]) ON DELETE CASCADE
);

CREATE INDEX [IX_AspNetRoleClaims_RoleId] ON [AspNetRoleClaims] ([RoleId]);

CREATE UNIQUE INDEX [RoleNameIndex] ON [AspNetRoles] ([NormalizedName]) WHERE [NormalizedName] IS NOT NULL;

CREATE INDEX [IX_AspNetUserClaims_UserId] ON [AspNetUserClaims] ([UserId]);

CREATE INDEX [IX_AspNetUserLogins_UserId] ON [AspNetUserLogins] ([UserId]);

CREATE INDEX [IX_AspNetUserRoles_RoleId] ON [AspNetUserRoles] ([RoleId]);

CREATE INDEX [EmailIndex] ON [AspNetUsers] ([NormalizedEmail]);

CREATE UNIQUE INDEX [UserNameIndex] ON [AspNetUsers] ([NormalizedUserName]) WHERE [NormalizedUserName] IS NOT NULL;

CREATE INDEX [IX_Categories_ParentId] ON [Categories] ([ParentId]);

CREATE INDEX [IX_PostLogs_PostTargetId] ON [PostLogs] ([PostTargetId]);

CREATE INDEX [IX_PostMedias_PostId] ON [PostMedias] ([PostId]);

CREATE INDEX [IX_PostProducts_PostId] ON [PostProducts] ([PostId]);

CREATE INDEX [IX_Posts_CategoryId] ON [Posts] ([CategoryId]);

CREATE INDEX [IX_Posts_UserId] ON [Posts] ([UserId]);

CREATE INDEX [IX_PostTags_TagId] ON [PostTags] ([TagId]);

CREATE INDEX [IX_PostTargets_PostId] ON [PostTargets] ([PostId]);

CREATE INDEX [IX_PostTargets_SocialAccountId] ON [PostTargets] ([SocialAccountId]);

CREATE INDEX [IX_SocialAccounts_UserId] ON [SocialAccounts] ([UserId]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260306085846_InitialCreate', N'10.0.3');

COMMIT;
GO

BEGIN TRANSACTION;
DECLARE @var nvarchar(max);
SELECT @var = QUOTENAME([d].[name])
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Posts]') AND [c].[name] = N'CreatedAtUtc');
IF @var IS NOT NULL EXEC(N'ALTER TABLE [Posts] DROP CONSTRAINT ' + @var + ';');
ALTER TABLE [Posts] ADD DEFAULT (sysutcdatetime()) FOR [CreatedAtUtc];

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260313100127_AddPostSEOAndMediaFields', N'10.0.3');

COMMIT;
GO

