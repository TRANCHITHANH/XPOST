/****** Object:  Table [dbo].[__EFMigrationsHistory]    Script Date: 4/15/2026 10:04:26 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[__EFMigrationsHistory](
	[MigrationId] [nvarchar](150) NOT NULL,
	[ProductVersion] [nvarchar](32) NOT NULL,
 CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY CLUSTERED 
(
	[MigrationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AspNetRoleClaims]    Script Date: 4/15/2026 10:04:26 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AspNetRoleClaims](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RoleId] [nvarchar](450) NOT NULL,
	[ClaimType] [nvarchar](max) NULL,
	[ClaimValue] [nvarchar](max) NULL,
 CONSTRAINT [PK_AspNetRoleClaims] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AspNetRoles]    Script Date: 4/15/2026 10:04:26 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AspNetRoles](
	[Id] [nvarchar](450) NOT NULL,
	[Name] [nvarchar](256) NULL,
	[NormalizedName] [nvarchar](256) NULL,
	[ConcurrencyStamp] [nvarchar](max) NULL,
 CONSTRAINT [PK_AspNetRoles] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AspNetUserClaims]    Script Date: 4/15/2026 10:04:26 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AspNetUserClaims](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [nvarchar](450) NOT NULL,
	[ClaimType] [nvarchar](max) NULL,
	[ClaimValue] [nvarchar](max) NULL,
 CONSTRAINT [PK_AspNetUserClaims] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AspNetUserLogins]    Script Date: 4/15/2026 10:04:26 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AspNetUserLogins](
	[LoginProvider] [nvarchar](128) NOT NULL,
	[ProviderKey] [nvarchar](128) NOT NULL,
	[ProviderDisplayName] [nvarchar](max) NULL,
	[UserId] [nvarchar](450) NOT NULL,
 CONSTRAINT [PK_AspNetUserLogins] PRIMARY KEY CLUSTERED 
(
	[LoginProvider] ASC,
	[ProviderKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AspNetUserRoles]    Script Date: 4/15/2026 10:04:26 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AspNetUserRoles](
	[UserId] [nvarchar](450) NOT NULL,
	[RoleId] [nvarchar](450) NOT NULL,
 CONSTRAINT [PK_AspNetUserRoles] PRIMARY KEY CLUSTERED 
(
	[UserId] ASC,
	[RoleId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AspNetUsers]    Script Date: 4/15/2026 10:04:26 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AspNetUsers](
	[Id] [nvarchar](450) NOT NULL,
	[UserName] [nvarchar](256) NULL,
	[NormalizedUserName] [nvarchar](256) NULL,
	[Email] [nvarchar](256) NULL,
	[NormalizedEmail] [nvarchar](256) NULL,
	[EmailConfirmed] [bit] NOT NULL,
	[PasswordHash] [nvarchar](max) NULL,
	[SecurityStamp] [nvarchar](max) NULL,
	[ConcurrencyStamp] [nvarchar](max) NULL,
	[PhoneNumber] [nvarchar](max) NULL,
	[PhoneNumberConfirmed] [bit] NOT NULL,
	[TwoFactorEnabled] [bit] NOT NULL,
	[LockoutEnd] [datetimeoffset](7) NULL,
	[LockoutEnabled] [bit] NOT NULL,
	[AccessFailedCount] [int] NOT NULL,
	[FullName] [nvarchar](200) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAtUtc] [datetime2](3) NOT NULL,
	[UpdatedAtUtc] [datetime2](3) NULL,
	[FisrtName] [nvarchar](250) NULL,
	[LastName] [nvarchar](250) NULL,
	[CountryCode] [nvarchar](max) NULL,
	[AvatarUrl] [nvarchar](max) NULL,
	[TenantId] [uniqueidentifier] NULL,
 CONSTRAINT [PK_AspNetUsers] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AspNetUserTokens]    Script Date: 4/15/2026 10:04:26 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AspNetUserTokens](
	[UserId] [nvarchar](450) NOT NULL,
	[LoginProvider] [nvarchar](128) NOT NULL,
	[Name] [nvarchar](128) NOT NULL,
	[Value] [nvarchar](max) NULL,
 CONSTRAINT [PK_AspNetUserTokens] PRIMARY KEY CLUSTERED 
(
	[UserId] ASC,
	[LoginProvider] ASC,
	[Name] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Categories]    Script Date: 4/15/2026 10:04:26 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Categories](
	[Id] [uniqueidentifier] NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Slug] [nvarchar](250) NOT NULL,
	[ParentId] [uniqueidentifier] NULL,
	[Description] [nvarchar](500) NULL,
	[IsActive] [bit] NOT NULL,
	[SortOrder] [int] NOT NULL,
	[CreatedAtUtc] [datetime2](3) NOT NULL,
	[UpdatedAtUtc] [datetime2](3) NULL,
	[TenantId] [uniqueidentifier] NULL,
	[SocialAccountId] [uniqueidentifier] NULL,
	[ExternalId] [nvarchar](max) NULL,
 CONSTRAINT [PK_Categories] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Keywords]    Script Date: 4/15/2026 10:04:26 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Keywords](
	[Id] [uniqueidentifier] NOT NULL,
	[TenantId] [uniqueidentifier] NULL,
	[Name] [nvarchar](250) NOT NULL,
	[Description] [nvarchar](1000) NULL,
	[Status] [int] NOT NULL,
	[GeneratedContent] [nvarchar](max) NULL,
	[LastErrorMessage] [nvarchar](max) NULL,
	[LastGeneratedAtUtc] [datetime2](3) NULL,
	[Language] [nvarchar](50) NULL,
	[LastPostId] [uniqueidentifier] NULL,
	[CreatedAtUtc] [datetime2](3) NOT NULL,
	[UpdatedAtUtc] [datetime2](3) NULL,
 CONSTRAINT [PK_Keywords] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PostProducts]    Script Date: 4/15/2026 10:04:26 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PostProducts](
	[Id] [uniqueidentifier] NOT NULL,
	[PostId] [uniqueidentifier] NOT NULL,
	[SKU] [nvarchar](100) NOT NULL,
	[Barcode] [nvarchar](100) NULL,
	[Brand] [nvarchar](200) NULL,
	[Model] [nvarchar](200) NULL,
	[Price] [decimal](18, 2) NOT NULL,
	[Price_Text] [nvarchar](200) NOT NULL,
	[SalePrice] [decimal](18, 2) NULL,
	[CostPrice] [decimal](18, 2) NULL,
	[TaxPercent] [decimal](5, 2) NULL,
	[Quantity] [int] NOT NULL,
	[ProductMetaTitle] [nvarchar](500) NULL,
	[ProductMetaDescription] [nvarchar](1000) NULL,
	[Str1] [nvarchar](500) NULL,
	[Str2] [nvarchar](500) NULL,
	[Int1] [int] NULL,
	[Decimal1] [decimal](18, 2) NULL,
	[CreatedAtUtc] [datetime2](3) NOT NULL,
	[UpdatedAtUtc] [datetime2](3) NULL,
 CONSTRAINT [PK_PostProducts] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PostLogs]    Script Date: 4/15/2026 10:04:26 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PostLogs](
	[Id] [uniqueidentifier] NOT NULL,
	[PostTargetId] [uniqueidentifier] NOT NULL,
	[Status] [varchar](50) NOT NULL,
	[ResponseMessage] [nvarchar](max) NULL,
	[ErrorMessage] [nvarchar](max) NULL,
	[RetryCount] [int] NOT NULL,
	[CreatedAtUtc] [datetime2](3) NOT NULL,
 CONSTRAINT [PK_PostLogs] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PostMedias]    Script Date: 4/15/2026 10:04:26 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PostMedias](
	[Id] [uniqueidentifier] NOT NULL,
	[PostId] [uniqueidentifier] NOT NULL,
	[MediaType] [varchar](50) NOT NULL,
	[Url] [nvarchar](1000) NOT NULL,
	[ThumbnailUrl] [nvarchar](1000) NULL,
	[Title] [nvarchar](300) NULL,
	[AltText] [nvarchar](300) NULL,
	[SortOrder] [int] NOT NULL,
	[IsMain] [bit] NOT NULL,
	[CreatedAtUtc] [datetime2](3) NOT NULL,
 CONSTRAINT [PK_PostMedias] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Posts]    Script Date: 4/15/2026 10:04:26 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Posts](
	[Id] [uniqueidentifier] NOT NULL,
	[UserId] [nvarchar](450) NOT NULL,
	[Ref_ID] [int] NULL,
	[PostType] [int] NOT NULL,
	[Title] [nvarchar](500) NOT NULL,
	[Slug] [nvarchar](500) NOT NULL,
	[Description] [nvarchar](1000) NULL,
	[Content] [nvarchar](max) NULL,
	[MetaTitle] [nvarchar](500) NULL,
	[MetaDescription] [nvarchar](1000) NULL,
	[MetaKeywords] [nvarchar](1000) NULL,
	[CategoryId] [uniqueidentifier] NULL,
	[Tags] [nvarchar](1000) NULL,
	[FeaturedImageUrl] [nvarchar](1000) NULL,
	[FeaturedImageAlt] [nvarchar](500) NULL,
	[MediaJson] [nvarchar](max) NULL,
	[DisplayStartUtc] [datetime2](3) NULL,
	[DisplayEndUtc] [datetime2](3) NULL,
	[IsFeatured] [bit] NOT NULL,
	[IsPinned] [bit] NOT NULL,
	[AllowComment] [bit] NOT NULL,
	[Status] [int] NOT NULL,
	[ViewCount] [int] NOT NULL,
	[ShareCount] [int] NOT NULL,
	[Str1] [nvarchar](500) NULL,
	[Str2] [nvarchar](500) NULL,
	[Str3] [nvarchar](500) NULL,
	[Int1] [int] NULL,
	[Int2] [int] NULL,
	[Decimal1] [decimal](18, 2) NULL,
	[CreatedAtUtc] [datetime2](3) NOT NULL,
	[UpdatedAtUtc] [datetime2](3) NULL,
	[PublishedAtUtc] [datetime2](3) NULL,
	[CreatedBy] [nvarchar](450) NULL,
	[UpdatedBy] [nvarchar](450) NULL,
	[TenantId] [uniqueidentifier] NULL,
 CONSTRAINT [PK_Posts] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PostTags]    Script Date: 4/15/2026 10:04:26 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PostTags](
	[PostId] [uniqueidentifier] NOT NULL,
	[TagId] [uniqueidentifier] NOT NULL,
 CONSTRAINT [PK_PostTags] PRIMARY KEY CLUSTERED 
(
	[PostId] ASC,
	[TagId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PostTargets]    Script Date: 4/15/2026 10:04:26 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PostTargets](
	[Id] [uniqueidentifier] NOT NULL,
	[PostId] [uniqueidentifier] NOT NULL,
	[SocialAccountId] [uniqueidentifier] NOT NULL,
	[Status] [int] NOT NULL,
	[RetryCount] [int] NOT NULL,
	[LastError] [nvarchar](2000) NULL,
	[PublishedUrl] [nvarchar](1000) NULL,
	[PublishedPostId] [nvarchar](200) NULL,
	[IsProcessing] [bit] NOT NULL,
	[ScheduledTimeUtc] [datetime2](3) NOT NULL,
	[ProcessedAtUtc] [datetime2](3) NULL,
	[CreatedAtUtc] [datetime2](3) NOT NULL,
	[UpdatedAtUtc] [datetime2](3) NULL,
 CONSTRAINT [PK_PostTargets] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SocialAccounts]    Script Date: 4/15/2026 10:04:26 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SocialAccounts](
	[Id] [uniqueidentifier] NOT NULL,
	[UserId] [nvarchar](450) NOT NULL,
	[Platform] [int] NOT NULL,
	[AccountName] [nvarchar](200) NOT NULL,
	[AccountIdentifier] [nvarchar](300) NULL,
	[ApiBaseUrl] [nvarchar](1000) NULL,
	[ApiPostEndpoint] [nvarchar](500) NULL,
	[ApiMethod] [nvarchar](10) NULL,
	[AuthType] [int] NULL,
	[ApiKey] [nvarchar](1000) NULL,
	[ApiSecret] [nvarchar](1000) NULL,
	[AccessToken] [nvarchar](max) NULL,
	[RefreshToken] [nvarchar](max) NULL,
	[TokenExpiredAtUtc] [datetime2](3) NULL,
	[CustomHeadersJson] [nvarchar](max) NULL,
	[FieldMappingJson] [nvarchar](max) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAtUtc] [datetime2](3) NOT NULL,
	[UpdatedAtUtc] [datetime2](3) NULL,
	[TenantId] [uniqueidentifier] NULL,
	[AvatarUrl] [nvarchar](max) NULL,
 CONSTRAINT [PK_SocialAccounts] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Tags]    Script Date: 4/15/2026 10:04:26 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Tags](
	[Id] [uniqueidentifier] NOT NULL,
	[Name] [nvarchar](150) NOT NULL,
	[Slug] [nvarchar](200) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAtUtc] [datetime2](3) NOT NULL,
 CONSTRAINT [PK_Tags] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Tenants]    Script Date: 4/15/2026 10:04:26 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Tenants](
	[Id] [uniqueidentifier] NOT NULL,
	[Name] [nvarchar](max) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[LogoUrl] [nvarchar](max) NULL,
	[Domain] [nvarchar](max) NULL,
	[TaxCode] [nvarchar](100) NULL,
	[Representative] [nvarchar](max) NULL,
	[Email] [nvarchar](256) NULL,
	[PhoneNumber] [nvarchar](100) NULL,
	[Address] [nvarchar](max) NULL,
	[PostCode] [nvarchar](50) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [nvarchar](max) NULL,
	[LastModifiedAt] [datetime2](7) NULL,
	[LastModifiedBy] [nvarchar](max) NULL,
	[IsDeleted] [bit] NOT NULL,
 CONSTRAINT [PK_Tenants] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260306085846_InitialCreate', N'9.0.0')
GO
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260313100127_AddPostSEOAndMediaFields', N'9.0.0')
GO
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260331065305_AddUserProfileAndCountryCode', N'10.0.3')
GO
INSERT [dbo].[AspNetRoles] ([Id], [Name], [NormalizedName], [ConcurrencyStamp]) VALUES (N'8feddc0c-a46d-4523-ab2b-8648d2496fc5', N'User', N'USER', N'9ac2766c-e0a1-4424-86fa-81594cb39820')
GO
INSERT [dbo].[AspNetRoles] ([Id], [Name], [NormalizedName], [ConcurrencyStamp]) VALUES (N'8ff36eab-1fdf-4027-b7c7-3e03018e91af', N'SuperAdmin', N'SUPERADMIN', N'00d5293b-9c37-4af4-8d0b-6d16c03c8ffd')
GO
INSERT [dbo].[AspNetRoles] ([Id], [Name], [NormalizedName], [ConcurrencyStamp]) VALUES (N'963cac3b-4a64-4be9-bb75-aa079b2ca170', N'TenantAdmin', N'TENANTADMIN', N'65fc1cc4-466c-4356-828c-bbfe6cd10d5c')
GO
INSERT [dbo].[AspNetUserRoles] ([UserId], [RoleId]) VALUES (N'7aebfda0-ca51-451f-afcc-57b6dcae74b5', N'8feddc0c-a46d-4523-ab2b-8648d2496fc5')
GO
INSERT [dbo].[AspNetUserRoles] ([UserId], [RoleId]) VALUES (N'a4f8455b-c78d-4587-9a03-575560a78b04', N'963cac3b-4a64-4be9-bb75-aa079b2ca170')
GO
INSERT [dbo].[AspNetUserRoles] ([UserId], [RoleId]) VALUES (N'e3bb213a-bc6c-49c5-a24f-6acf7a523b10', N'8ff36eab-1fdf-4027-b7c7-3e03018e91af')
GO
INSERT [dbo].[AspNetUsers] ([Id], [UserName], [NormalizedUserName], [Email], [NormalizedEmail], [EmailConfirmed], [PasswordHash], [SecurityStamp], [ConcurrencyStamp], [PhoneNumber], [PhoneNumberConfirmed], [TwoFactorEnabled], [LockoutEnd], [LockoutEnabled], [AccessFailedCount], [FullName], [IsActive], [CreatedAtUtc], [UpdatedAtUtc], [FisrtName], [LastName], [CountryCode], [AvatarUrl], [TenantId]) VALUES (N'5456f2cc-2da1-47d0-8569-9a6ee039eab9', N'admin@xpost.com', N'ADMIN@XPOST.COM', N'admin@xpost.com', N'ADMIN@XPOST.COM', 0, N'AQAAAAIAAYagAAAAEDrg0Lsg7w0eXKtawucHG7o8Jep6mExCRX6vhuGeacmCxR9lOKG2q10kutrBPH7GzA==', N'534G2YXEZXPRZXBQ4QG5XEZZERAYR35H', N'25ed0b71-6399-4cbb-82d3-27e4965cebb5', NULL, 0, 0, NULL, 1, 0, N'Admin User', 1, CAST(N'2026-04-03T04:33:08.9960000' AS DateTime2), NULL, N'Admin', N'User', NULL, NULL, NULL)
GO
INSERT [dbo].[AspNetUsers] ([Id], [UserName], [NormalizedUserName], [Email], [NormalizedEmail], [EmailConfirmed], [PasswordHash], [SecurityStamp], [ConcurrencyStamp], [PhoneNumber], [PhoneNumberConfirmed], [TwoFactorEnabled], [LockoutEnd], [LockoutEnabled], [AccessFailedCount], [FullName], [IsActive], [CreatedAtUtc], [UpdatedAtUtc], [FisrtName], [LastName], [CountryCode], [AvatarUrl], [TenantId]) VALUES (N'7aebfda0-ca51-451f-afcc-57b6dcae74b5', N'duythanh.bridgetech@gmail.com', N'DUYTHANH.BRIDGETECH@GMAIL.COM', N'duythanh.bridgetech@gmail.com', N'DUYTHANH.BRIDGETECH@GMAIL.COM', 1, N'AQAAAAIAAYagAAAAEMbEFgzvYPYmU6fPhPCaIC9AU2AwMEvUCI/mPWyjVT8dMrlggKP6AYzUyDMf929c7w==', N'7POU3AHTKR6HUFMVO3CEK23BZABXBBYR', N'ea3e806b-558f-409a-9254-2ae7b4e4827d', N'038891283738278', 0, 0, NULL, 1, 0, N'Thanh Duy', 1, CAST(N'2026-04-02T09:40:42.2560000' AS DateTime2), NULL, N'Duy', N'Thanh', NULL, NULL, N'a9f04468-451a-4967-8851-02cb426bee77')
GO
INSERT [dbo].[AspNetUsers] ([Id], [UserName], [NormalizedUserName], [Email], [NormalizedEmail], [EmailConfirmed], [PasswordHash], [SecurityStamp], [ConcurrencyStamp], [PhoneNumber], [PhoneNumberConfirmed], [TwoFactorEnabled], [LockoutEnd], [LockoutEnabled], [AccessFailedCount], [FullName], [IsActive], [CreatedAtUtc], [UpdatedAtUtc], [FisrtName], [LastName], [CountryCode], [AvatarUrl], [TenantId]) VALUES (N'a4f8455b-c78d-4587-9a03-575560a78b04', N'nam260394pc22@gmail.com', N'NAM260394PC22@GMAIL.COM', N'nam260394pc22@gmail.com', N'NAM260394PC22@GMAIL.COM', 1, N'AQAAAAIAAYagAAAAEP1GlVmCjxjtI0j3dK6F2z+u9i1B/7xbwheg3TjUZ6CfvHirR5vNUYuztR2l1tua2A==', N'QKHKV3BYDNHSVDM5HG7A5BNSTPTVG2SF', N'31661a97-9c62-4c3e-a55d-21998566a793', N'', 0, 0, NULL, 1, 0, N'Phạm Quyết Tiến', 1, CAST(N'2026-04-02T07:35:41.3340000' AS DateTime2), NULL, N'Tien', N'Pham', N'', N'/uploads/avatars/cc2304e6-03dc-4e42-b6e4-83f4e64fc31a_avatar.jpg', N'a9f04468-451a-4967-8851-02cb426bee77')
GO
INSERT [dbo].[AspNetUsers] ([Id], [UserName], [NormalizedUserName], [Email], [NormalizedEmail], [EmailConfirmed], [PasswordHash], [SecurityStamp], [ConcurrencyStamp], [PhoneNumber], [PhoneNumberConfirmed], [TwoFactorEnabled], [LockoutEnd], [LockoutEnabled], [AccessFailedCount], [FullName], [IsActive], [CreatedAtUtc], [UpdatedAtUtc], [FisrtName], [LastName], [CountryCode], [AvatarUrl], [TenantId]) VALUES (N'b3edc00a-d474-450c-822e-a5cfec0b5b01', N'tongnguyen@xvnet.vn', N'TONGNGUYEN@XVNET.VN', N'tongnguyen@xvnet.vn', N'TONGNGUYEN@XVNET.VN', 0, N'AQAAAAIAAYagAAAAEKyss/ZpAVfCwXv8EEc3lXN789A2B90lGDmuWOj538oofrjQGEm5MmZo5pYZfBYfyg==', N'7CIZHBYZTP7Y5OT5UPDJCMILHOH2EQPK', N'8abadd39-ce1a-433d-a3b9-de4095e5035f', NULL, 0, 0, NULL, 1, 0, N'Tong Nguyen', 1, CAST(N'2026-03-06T09:17:19.6550000' AS DateTime2), NULL, N'Tong', N'Nguyen', NULL, N'http://local-api.xpost.com:5243/uploads/avatars/a048553d-7aa2-4f22-8463-6281f4626838_avatar.jpg', NULL)
GO
INSERT [dbo].[AspNetUsers] ([Id], [UserName], [NormalizedUserName], [Email], [NormalizedEmail], [EmailConfirmed], [PasswordHash], [SecurityStamp], [ConcurrencyStamp], [PhoneNumber], [PhoneNumberConfirmed], [TwoFactorEnabled], [LockoutEnd], [LockoutEnabled], [AccessFailedCount], [FullName], [IsActive], [CreatedAtUtc], [UpdatedAtUtc], [FisrtName], [LastName], [CountryCode], [AvatarUrl], [TenantId]) VALUES (N'e3bb213a-bc6c-49c5-a24f-6acf7a523b10', N'admin@xpost.vn', N'ADMIN@XPOST.VN', N'admin@xpost.vn', N'ADMIN@XPOST.VN', 1, N'AQAAAAIAAYagAAAAEIksGdTecao0VOvU59jB8BUTERqXuuaV5h4Kqa47dmsrTDPXCqCs7lEVjQ2U7Ar5tg==', N'OPSKQTRQBGKLVOZU2ENWO7WOSO7RWCII', N'0672569f-4062-41e9-b64a-5feaa3842912', N'', 0, 0, NULL, 1, 0, N'Tong Nguyen', 1, CAST(N'2026-04-01T03:14:18.9380000' AS DateTime2), NULL, N'Super', N'Admin', N'', N'/uploads/avatars/91321de3-bc51-48aa-991a-79386eeaef5c_avatar.jpg', NULL)
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'919697ed-0017-4327-a882-05ffc70916b2', N'f6d02d18-5486-432d-86a7-78690fd3ade2', N'Failed', NULL, N'Telegram: Bad Request: wrong type of the web page content', 2, CAST(N'2026-04-10T18:39:16.5590000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'5e1c6bbc-2956-4385-8904-1fea092f514f', N'fc2428e5-0538-4b77-bad9-dadf6f24a4b0', N'Failed', NULL, N'Telegram: Bad Request: wrong type of the web page content', 3, CAST(N'2026-04-10T18:39:37.9290000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'166d2c25-71de-4ee2-be11-27cc49e6dc96', N'6ef3d19d-67b9-46b1-bcd2-4fe9225d9c0a', N'Failed', NULL, N'Zalo: photo_url bW-B4Tk0qoMO1OyTtOhFCfWKcGxVcCKlYXUB6CoRroMN1OyAsfkBSzbNb4I1n9vxsng05StLc3NN6fCLqCwGRCXSXW3RZiHxmXsUH8IInNd56Pj2XvV6UyKVdK63Z90fm56TG83KnNZ5KCWMXTh2Bi5VW4d6XCuvTxni3PgHrZuis invalid', 3, CAST(N'2026-04-14T19:21:36.0630000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'bf02dc6b-ddc7-4fde-b787-37725dff4e2e', N'fc2428e5-0538-4b77-bad9-dadf6f24a4b0', N'Failed', NULL, N'Telegram: Bad Request: wrong type of the web page content', 3, CAST(N'2026-04-10T18:39:38.1370000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'557b4821-3b67-45aa-bc05-38b827fb81f8', N'3dade61f-bfd6-4ff8-9ab1-f2c24d5176c8', N'Published', N'https://t.me/c/-1003971850461/9', NULL, 0, CAST(N'2026-04-13T18:32:45.1460000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'988c4da6-880c-439e-98b0-3fa3eaa2f4ca', N'6ef3d19d-67b9-46b1-bcd2-4fe9225d9c0a', N'Failed', NULL, N'Zalo: photo_url FqvvPXIxDqCnH7rh4xGhLJ1GQtWHfY588bDvRWAbCq8_GNry5ALl574JPZ9F-dvSFLrtD07sVayzG6myMEauMYXBB6XFutb5QH0nRKpbVabf5Z5XIU9-J60GAs90us19DHCeR17cOKTZ5dzfH-8tMpnKAcLz4SPw75MgCbWis invalid', 1, CAST(N'2026-04-14T19:21:05.7580000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'f8ab64d4-a9a8-44c8-808d-465e9a097913', N'6ef3d19d-67b9-46b1-bcd2-4fe9225d9c0a', N'Failed', NULL, N'Zalo: photo_url 7lSqMuHp2sKG_J1MYNiNSnlk9aMBQHrk2UqqKvXg3sGK_p11ZcfJCbgjAm_LDKOwME0_NfaaG7HKu2nUX3z8BKkcEKkFVnmwGUSY3j5Y6Jn4xIiCt6qOEKhf9GpVSHzf6Q8ZLjfm4M53eIrVW2SKQ1ZrCGN89HX_eBSB1yLY3duis invalid', 2, CAST(N'2026-04-14T19:21:22.4440000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'b9de8ffa-f59f-453b-ad6a-50f027f1fef2', N'fc2428e5-0538-4b77-bad9-dadf6f24a4b0', N'Failed', NULL, N'Telegram: Bad Request: wrong type of the web page content', 1, CAST(N'2026-04-10T18:39:07.4920000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'5566dca1-fd68-4dd9-9097-55eb52843297', N'8eee3e43-c1f1-427d-9430-06b0a5870de9', N'Published', N'https://t.me/c/-1003803018516/4', NULL, 1, CAST(N'2026-04-10T16:51:22.1380000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'e5b310b1-f6d5-4e16-ba9b-5aaf458b68b0', N'e431f304-f05f-4269-ae1b-feeeb1e61dd0', N'Published', N'https://t.me/c/-1003803018516/11', NULL, 0, CAST(N'2026-04-13T18:32:45.5880000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'4594323c-579f-4240-9019-5bf98663cb86', N'e431f304-f05f-4269-ae1b-feeeb1e61dd0', N'Published', N'https://t.me/c/-1003803018516/10', NULL, 0, CAST(N'2026-04-13T18:32:45.1670000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'bee04eec-f0de-4072-beb2-6b60bed02f26', N'fc2428e5-0538-4b77-bad9-dadf6f24a4b0', N'Failed', NULL, N'Telegram: Bad Request: wrong type of the web page content', 2, CAST(N'2026-04-10T18:39:16.9750000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'a6d8e799-dea3-4857-8c53-7c714c2572ee', N'6ef3d19d-67b9-46b1-bcd2-4fe9225d9c0a', N'Failed', NULL, N'Zalo: photo_url y0Gz9kYQto7-3Zagxf73DluUBpdiWyahx1qzB_-0so7n3pazwO27TxzT8dEotvO_ynCpTVpJbYpp3YXzfSpGEUO5Q2conf4WeLDr9hREbIYYMtCYiy6MBgDRRoNZnOak-5XiSkl0Y7dnNJrtuiJOPwePQNjz8gtMFgcBsZeis invalid', 3, CAST(N'2026-04-14T19:21:36.0580000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'98aa73a7-5169-4a97-92d2-86ef7273d520', N'fc2428e5-0538-4b77-bad9-dadf6f24a4b0', N'Failed', NULL, N'Telegram: Bad Request: wrong type of the web page content', 1, CAST(N'2026-04-10T18:39:07.2950000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'f772dfbf-7ade-4c7f-bc4f-8d80683f686c', N'8eee3e43-c1f1-427d-9430-06b0a5870de9', N'Failed', NULL, N'Telegram: Bad Request: invalid file HTTP URL specified: URL host is empty', 1, CAST(N'2026-04-10T16:51:13.6930000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'0e6631b0-0caa-4887-88e0-8d9afd8f507e', N'89694751-3aae-40bc-acb1-728801155aca', N'Published', N'https://www.facebook.com/1739346266334677_1412405780686574', NULL, 0, CAST(N'2026-04-07T18:00:35.6630000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'93ec1056-f406-4532-9065-95aa05c1d3b6', N'792465a1-f66d-4c36-93cc-57b704d7cebc', N'Failed', NULL, N'Telegram: Bad Request: invalid file HTTP URL specified: URL host is empty', 1, CAST(N'2026-04-10T16:51:44.1670000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'7383fb4f-4af3-4938-a9e8-a94ac23ed5c1', N'792465a1-f66d-4c36-93cc-57b704d7cebc', N'Published', N'https://t.me/c/-1003803018516/5', NULL, 1, CAST(N'2026-04-10T16:52:05.0480000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'abb972d1-af10-424b-aa31-b05574bb838b', N'f6d02d18-5486-432d-86a7-78690fd3ade2', N'Failed', NULL, N'Telegram: Bad Request: wrong type of the web page content', 3, CAST(N'2026-04-10T18:39:37.7260000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'bbcf90e9-5eb1-4c51-b390-c1a9bc18bde8', N'f6d02d18-5486-432d-86a7-78690fd3ade2', N'Failed', NULL, N'Telegram: Bad Request: wrong type of the web page content', 1, CAST(N'2026-04-10T18:39:06.4210000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'37424488-8c4c-453f-9c71-d703b267b1f7', N'515ee274-19ec-44b4-9de8-96e0b4bb981a', N'Published', N'https://www.facebook.com/1739346266334677_1412427357351083', NULL, 0, CAST(N'2026-04-07T18:39:18.8160000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'49331b41-0d36-4a22-b131-df81a2b79034', N'8eee3e43-c1f1-427d-9430-06b0a5870de9', N'Failed', NULL, N'Telegram: Bad Request: invalid file HTTP URL specified: URL host is empty', 1, CAST(N'2026-04-10T16:51:13.7010000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'c5d10b21-58c3-4f4a-8001-f1e443fe230b', N'792465a1-f66d-4c36-93cc-57b704d7cebc', N'Failed', NULL, N'Telegram: Bad Request: invalid file HTTP URL specified: URL host is empty', 1, CAST(N'2026-04-10T16:51:44.1730000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'07cf5da7-3f75-4c4c-9d8a-fd75db8a6ab3', N'f6d02d18-5486-432d-86a7-78690fd3ade2', N'Failed', NULL, N'Telegram: Bad Request: wrong type of the web page content', 1, CAST(N'2026-04-10T18:39:06.8230000' AS DateTime2))
GO
INSERT [dbo].[PostLogs] ([Id], [PostTargetId], [Status], [ResponseMessage], [ErrorMessage], [RetryCount], [CreatedAtUtc]) VALUES (N'284cc56d-0935-426a-83d5-ff764953c798', N'6ef3d19d-67b9-46b1-bcd2-4fe9225d9c0a', N'Failed', NULL, N'Zalo: photo_url ZlVqSBByvaM0_V1zjV3wKu7gvcwtul1Ea-dqUAJXuaIE-_1gik6-4i2fwoJflgiQmkJ_TQMlhLJEvEnrkBIb3T6Y-M2pzF4Qs-Fa8ENezXdKuEKWuU3t5TFhw2_Z_FaRqwNj9E2ag4hMfBnqvQgj6jAhfNoazA4D1ZWc3FFjuruis invalid', 1, CAST(N'2026-04-14T19:21:05.7580000' AS DateTime2))
GO
INSERT [dbo].[Posts] ([Id], [UserId], [Ref_ID], [PostType], [Title], [Slug], [Description], [Content], [MetaTitle], [MetaDescription], [MetaKeywords], [CategoryId], [Tags], [FeaturedImageUrl], [FeaturedImageAlt], [MediaJson], [DisplayStartUtc], [DisplayEndUtc], [IsFeatured], [IsPinned], [AllowComment], [Status], [ViewCount], [ShareCount], [Str1], [Str2], [Str3], [Int1], [Int2], [Decimal1], [CreatedAtUtc], [UpdatedAtUtc], [PublishedAtUtc], [CreatedBy], [UpdatedBy], [TenantId]) VALUES (N'ada946e9-46ef-400e-bfee-1eae82bee83e', N'7aebfda0-ca51-451f-afcc-57b6dcae74b5', NULL, 0, N'Test ABPI bot telee chuẩn luôn', N'test-abpi-bot-telee-chuan-luon', N'', N'đây là bot đc tạo từ tongnguyen xem demo ', N'', N'', N'', NULL, N'', N'/uploads/images/2026/04/766de00e-61a8-4511-98bf-3615e7fe70ed.jpg', N'', N'', NULL, NULL, 0, 0, 1, 2, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, CAST(N'2026-04-10T15:08:22.0090000' AS DateTime2), CAST(N'2026-04-10T16:51:38.5830000' AS DateTime2), NULL, NULL, NULL, N'a9f04468-451a-4967-8851-02cb426bee77')
GO
INSERT [dbo].[Posts] ([Id], [UserId], [Ref_ID], [PostType], [Title], [Slug], [Description], [Content], [MetaTitle], [MetaDescription], [MetaKeywords], [CategoryId], [Tags], [FeaturedImageUrl], [FeaturedImageAlt], [MediaJson], [DisplayStartUtc], [DisplayEndUtc], [IsFeatured], [IsPinned], [AllowComment], [Status], [ViewCount], [ShareCount], [Str1], [Str2], [Str3], [Int1], [Int2], [Decimal1], [CreatedAtUtc], [UpdatedAtUtc], [PublishedAtUtc], [CreatedBy], [UpdatedBy], [TenantId]) VALUES (N'46a0630f-f14a-4835-a978-418af9111f65', N'7aebfda0-ca51-451f-afcc-57b6dcae74b5', NULL, 0, N'tesst 011 bài viết', N'tesst-011-bai-viet', N'', N'Đây là nội dung đc  đăng tải từ XPOST by Tong Nguyen', N'', N'', N'', NULL, N'', N'/uploads/images/2026/04/ec21ffac-f876-41fa-8247-7bffc6ad4bb4.jpeg', N'', N'', NULL, NULL, 0, 0, 1, 2, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, CAST(N'2026-04-10T16:08:16.7500000' AS DateTime2), CAST(N'2026-04-10T16:49:49.1770000' AS DateTime2), NULL, NULL, NULL, N'a9f04468-451a-4967-8851-02cb426bee77')
GO
INSERT [dbo].[Posts] ([Id], [UserId], [Ref_ID], [PostType], [Title], [Slug], [Description], [Content], [MetaTitle], [MetaDescription], [MetaKeywords], [CategoryId], [Tags], [FeaturedImageUrl], [FeaturedImageAlt], [MediaJson], [DisplayStartUtc], [DisplayEndUtc], [IsFeatured], [IsPinned], [AllowComment], [Status], [ViewCount], [ShareCount], [Str1], [Str2], [Str3], [Int1], [Int2], [Decimal1], [CreatedAtUtc], [UpdatedAtUtc], [PublishedAtUtc], [CreatedBy], [UpdatedBy], [TenantId]) VALUES (N'5df4497a-5bab-4761-8684-45757a92209f', N'7aebfda0-ca51-451f-afcc-57b6dcae74b5', 0, 0, N'Test XPOST', N'test-xpost', N'Được tạo tự động từ tiêu đề. Bạn có thể chỉnh sửa thủ công.', N'Được tạo tự động từ tiêu đề. Bạn có thể chỉnh sửa thủ công.', N'', N'', N'', NULL, N'', N'/uploads/images/2026/04/c8cda859-4610-4fe6-9ad9-cf032d721d4e.jpg', N'', N'[{"url":"/uploads/videos/2026/04/8f8af52a-8b27-4f62-8fe9-eec529f4fb2d.mp4","mediaType":"video","title":"Video thespaforyou.mp4"},{"url":"/uploads/images/2026/04/b4024378-daa0-4234-a009-db38abb5cf95.png","mediaType":"image","title":"sp1.png"},{"url":"/uploads/images/2026/04/ee695e20-f6fa-4f5a-ae15-c06dc9288c11.png","mediaType":"image","title":"sp2.png"},{"url":"/uploads/images/2026/04/1e01a242-4c96-4667-8b11-d4174ef6f8d8.png","mediaType":"image","title":"sp3.png"}]', CAST(N'2026-04-07T18:39:00.0000000' AS DateTime2), NULL, 0, 0, 1, 2, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, CAST(N'2026-04-07T18:36:45.2370000' AS DateTime2), NULL, NULL, NULL, NULL, N'a9f04468-451a-4967-8851-02cb426bee77')
GO
INSERT [dbo].[Posts] ([Id], [UserId], [Ref_ID], [PostType], [Title], [Slug], [Description], [Content], [MetaTitle], [MetaDescription], [MetaKeywords], [CategoryId], [Tags], [FeaturedImageUrl], [FeaturedImageAlt], [MediaJson], [DisplayStartUtc], [DisplayEndUtc], [IsFeatured], [IsPinned], [AllowComment], [Status], [ViewCount], [ShareCount], [Str1], [Str2], [Str3], [Int1], [Int2], [Decimal1], [CreatedAtUtc], [UpdatedAtUtc], [PublishedAtUtc], [CreatedBy], [UpdatedBy], [TenantId]) VALUES (N'7ee21307-c5a7-4021-b888-619931fdc930', N'7aebfda0-ca51-451f-afcc-57b6dcae74b5', NULL, 0, N'Đây là nội dung Test â', N'day-la-noi-dung-test-a', N'', N'<p><u>Nội dung</u> này đăng từ XPOS<em>T by Tong N</em>guyen <strong>111111</strong></p><p><strong>🇧🇱 🏴🇦🇨🏳️‍🌈🏴󠁧󠁢󠁳󠁣󠁴󠁿</strong></p>', N'', N'', N'', NULL, N'', N'/uploads/images/2026/04/30d34cf6-f9a9-46e1-97b6-0a2d0b1c18f1.png', N'', N'', NULL, NULL, 0, 0, 1, 2, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, CAST(N'2026-04-10T18:50:25.8410000' AS DateTime2), CAST(N'2026-04-13T18:32:27.8870000' AS DateTime2), NULL, NULL, NULL, N'a9f04468-451a-4967-8851-02cb426bee77')
GO
INSERT [dbo].[Posts] ([Id], [UserId], [Ref_ID], [PostType], [Title], [Slug], [Description], [Content], [MetaTitle], [MetaDescription], [MetaKeywords], [CategoryId], [Tags], [FeaturedImageUrl], [FeaturedImageAlt], [MediaJson], [DisplayStartUtc], [DisplayEndUtc], [IsFeatured], [IsPinned], [AllowComment], [Status], [ViewCount], [ShareCount], [Str1], [Str2], [Str3], [Int1], [Int2], [Decimal1], [CreatedAtUtc], [UpdatedAtUtc], [PublishedAtUtc], [CreatedBy], [UpdatedBy], [TenantId]) VALUES (N'88146981-2f37-4bbc-aafc-69dbc11327e0', N'b3edc00a-d474-450c-822e-a5cfec0b5b01', 0, 0, N'tesst accxsd dsdfrgâ ', N'tesst-accxsd-dsdfrga-', N'', N'test acvxcccvcvdsfdfdf', N'', N'', N'', NULL, N'', N'', N'', N'', NULL, NULL, 0, 0, 1, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, CAST(N'2026-03-16T04:30:48.2980000' AS DateTime2), NULL, NULL, NULL, NULL, NULL)
GO
INSERT [dbo].[Posts] ([Id], [UserId], [Ref_ID], [PostType], [Title], [Slug], [Description], [Content], [MetaTitle], [MetaDescription], [MetaKeywords], [CategoryId], [Tags], [FeaturedImageUrl], [FeaturedImageAlt], [MediaJson], [DisplayStartUtc], [DisplayEndUtc], [IsFeatured], [IsPinned], [AllowComment], [Status], [ViewCount], [ShareCount], [Str1], [Str2], [Str3], [Int1], [Int2], [Decimal1], [CreatedAtUtc], [UpdatedAtUtc], [PublishedAtUtc], [CreatedBy], [UpdatedBy], [TenantId]) VALUES (N'a2c17c7d-e9c3-4232-a379-86ca3a386999', N'7aebfda0-ca51-451f-afcc-57b6dcae74b5', NULL, 0, N'đẩy bài từ hệ thống XPOST', N'day-bai-tu-he-thong-xpost', N'', N'Đây là nội dung đc đẩy từ XPOST by TongNguyen', N'', N'', N'', NULL, N'', N'/uploads/images/2026/04/4a44f417-952c-4fd4-b465-44d4604d1c8c.png', N'', N'', NULL, NULL, 0, 0, 1, 2, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, CAST(N'2026-04-10T15:22:34.9730000' AS DateTime2), CAST(N'2026-04-10T18:37:19.6910000' AS DateTime2), NULL, NULL, NULL, N'a9f04468-451a-4967-8851-02cb426bee77')
GO
INSERT [dbo].[Posts] ([Id], [UserId], [Ref_ID], [PostType], [Title], [Slug], [Description], [Content], [MetaTitle], [MetaDescription], [MetaKeywords], [CategoryId], [Tags], [FeaturedImageUrl], [FeaturedImageAlt], [MediaJson], [DisplayStartUtc], [DisplayEndUtc], [IsFeatured], [IsPinned], [AllowComment], [Status], [ViewCount], [ShareCount], [Str1], [Str2], [Str3], [Int1], [Int2], [Decimal1], [CreatedAtUtc], [UpdatedAtUtc], [PublishedAtUtc], [CreatedBy], [UpdatedBy], [TenantId]) VALUES (N'80dc70bf-24d2-403d-8d9b-9946ec7a7611', N'b3edc00a-d474-450c-822e-a5cfec0b5b01', NULL, 0, N'Bộ máy quyền lực Iran sau loạt đòn tập kích của Mỹ, Israel', N'bo-may-quyen-luc-iran-sau-loat-don-tap-kich-cua-my-israel', N'', N'Các đòn tập kích của Mỹ và Israel đã hạ sát nhiều lãnh đạo cấp cao, thậm chí cả Lãnh tụ Tối cao, nhưng bộ máy quyền lực Iran vẫn vận hành và nhanh chóng đáp trả.

Mỹ và Israel trong tuần qua đã liên tiếp tiến hành các cuộc không kích chính xác nhắm vào hàng ngũ lãnh đạo chính trị và quân sự cấp cao nhất của Iran, đồng thời phá hủy hạ tầng chỉ huy cùng nhiều năng lực tác chiến. Một trong những mục tiêu mà Washington và Tel Aviv nhắm tới là thay đổi chế độ tại Iran.

Tại Tehran, xung đột lan rộng dường như đang làm gián đoạn quá trình kế vị Lãnh tụ Tối cao Ali Khamenei, người bị hạ sát cuối tuần trước. Lễ tang của ông Khamenei đã bị hoãn lại sau khi nhóm chịu trách nhiệm lựa chọn người kế nhiệm bị Israel nhắm mục tiêu trong các cuộc tập kích.

"Các lãnh đạo cấp cao của Iran đã chết. Hội đồng cầm quyền, lẽ ra chịu trách nhiệm chọn người kế vị, cũng đã thiệt mạng, mất tích hoặc đang ẩn náu trong các hầm ngầm", Bộ trưởng Quốc phòng Mỹ Pete Hegseth nói trong cuộc họp báo ngày 4/3.

Tổng thống Donald Trump ngày 3/3 cho hay các cuộc không kích đã tiêu diệt "hầu hết những người" có thể thay thế các thành viên ban lãnh đạo Iran vừa bị hạ sát.

Truyền thông Mỹ ngày 6/3 dẫn lời hai quan chức Iran giấu tên cho biết ông Mojtaba Khamenei, con trai ông Ali Khamenei, là ứng viên hàng đầu cho vai trò quyền lực nhất đất nước. Tuy nhiên, Iran có thể đang trì hoãn công bố tân Lãnh tụ Tối cao, do lo ngại về đòn tập kích của Mỹ, Israel.', N'', N'', N'', NULL, N'', N'/uploads/images/2026/03/743bfb46-6ff8-403b-8218-3b68678eb528.jpg', N'', N'[{"url":"/uploads/images/2026/03/a2bd2e92-51d0-4b03-af5d-7f25a18dbda5.webp","mediaType":"image","title":"liquorbar2.webp"},{"url":"/uploads/images/2026/03/6aac6451-84fd-4d41-a80d-05c46beb5e13.png","mediaType":"image","title":"sp1.png"},{"url":"/uploads/videos/2026/03/a96af471-bfd3-4774-a4bc-ca6c5c808c2f.mp4","mediaType":"video","title":"Video thespaforyou.mp4"}]', NULL, NULL, 0, 0, 1, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, CAST(N'2026-03-06T10:40:23.9810000' AS DateTime2), CAST(N'2026-03-13T09:45:24.8630000' AS DateTime2), NULL, NULL, NULL, NULL)
GO
INSERT [dbo].[Posts] ([Id], [UserId], [Ref_ID], [PostType], [Title], [Slug], [Description], [Content], [MetaTitle], [MetaDescription], [MetaKeywords], [CategoryId], [Tags], [FeaturedImageUrl], [FeaturedImageAlt], [MediaJson], [DisplayStartUtc], [DisplayEndUtc], [IsFeatured], [IsPinned], [AllowComment], [Status], [ViewCount], [ShareCount], [Str1], [Str2], [Str3], [Int1], [Int2], [Decimal1], [CreatedAtUtc], [UpdatedAtUtc], [PublishedAtUtc], [CreatedBy], [UpdatedBy], [TenantId]) VALUES (N'baf9c9a7-f8f0-462e-aa8d-b8a1e87ed941', N'7aebfda0-ca51-451f-afcc-57b6dcae74b5', NULL, 0, N'Đăng tải tự động', N'dang-tai-tu-dong', N'', N'<p>Đây là nội dung đc đăng tải từ XPOST by Mạng Xuyên Việt 👋</p>', N'', N'', N'', NULL, N'', N'/uploads/images/2026/04/fadf5743-cb6b-4c98-bfd8-07c749f2dedb.jpg', N'', N'', NULL, NULL, 0, 0, 1, 2, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, CAST(N'2026-04-14T17:10:08.2930000' AS DateTime2), CAST(N'2026-04-14T19:19:14.4850000' AS DateTime2), NULL, NULL, NULL, N'a9f04468-451a-4967-8851-02cb426bee77')
GO
INSERT [dbo].[Posts] ([Id], [UserId], [Ref_ID], [PostType], [Title], [Slug], [Description], [Content], [MetaTitle], [MetaDescription], [MetaKeywords], [CategoryId], [Tags], [FeaturedImageUrl], [FeaturedImageAlt], [MediaJson], [DisplayStartUtc], [DisplayEndUtc], [IsFeatured], [IsPinned], [AllowComment], [Status], [ViewCount], [ShareCount], [Str1], [Str2], [Str3], [Int1], [Int2], [Decimal1], [CreatedAtUtc], [UpdatedAtUtc], [PublishedAtUtc], [CreatedBy], [UpdatedBy], [TenantId]) VALUES (N'059c7a0d-74d6-4f33-9de2-c60032a15270', N'7aebfda0-ca51-451f-afcc-57b6dcae74b5', NULL, 0, N'Nội dung test từ XPOST', N'noi-dung-test-tu-xpost', N'', N'<p>Đây là nội dung được đăng tải từ XPOST by Mạng Xuyên Việt 👋</p>', N'', N'', N'', NULL, N'', N'/uploads/images/2026/04/51f1d431-ef66-47d3-99bc-a625d8c71f99.jpg', N'', N'', NULL, NULL, 0, 0, 1, 2, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, CAST(N'2026-04-14T15:28:42.2230000' AS DateTime2), CAST(N'2026-04-14T17:03:28.7960000' AS DateTime2), NULL, NULL, NULL, N'a9f04468-451a-4967-8851-02cb426bee77')
GO
INSERT [dbo].[Posts] ([Id], [UserId], [Ref_ID], [PostType], [Title], [Slug], [Description], [Content], [MetaTitle], [MetaDescription], [MetaKeywords], [CategoryId], [Tags], [FeaturedImageUrl], [FeaturedImageAlt], [MediaJson], [DisplayStartUtc], [DisplayEndUtc], [IsFeatured], [IsPinned], [AllowComment], [Status], [ViewCount], [ShareCount], [Str1], [Str2], [Str3], [Int1], [Int2], [Decimal1], [CreatedAtUtc], [UpdatedAtUtc], [PublishedAtUtc], [CreatedBy], [UpdatedBy], [TenantId]) VALUES (N'dba45c64-c0cb-4bc2-ab68-cbea4ec8d3a6', N'7aebfda0-ca51-451f-afcc-57b6dcae74b5', NULL, 0, N'test àdfd', N'test-adfd', N'', N'test bài viết XPOST', N'', N'', N'', NULL, N'', N'', N'', N'', NULL, NULL, 0, 0, 1, 2, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, CAST(N'2026-04-03T11:21:53.2530000' AS DateTime2), CAST(N'2026-04-03T11:22:09.9670000' AS DateTime2), NULL, NULL, NULL, N'a9f04468-451a-4967-8851-02cb426bee77')
GO
INSERT [dbo].[Posts] ([Id], [UserId], [Ref_ID], [PostType], [Title], [Slug], [Description], [Content], [MetaTitle], [MetaDescription], [MetaKeywords], [CategoryId], [Tags], [FeaturedImageUrl], [FeaturedImageAlt], [MediaJson], [DisplayStartUtc], [DisplayEndUtc], [IsFeatured], [IsPinned], [AllowComment], [Status], [ViewCount], [ShareCount], [Str1], [Str2], [Str3], [Int1], [Int2], [Decimal1], [CreatedAtUtc], [UpdatedAtUtc], [PublishedAtUtc], [CreatedBy], [UpdatedBy], [TenantId]) VALUES (N'a95e9cd4-c5e6-4365-9be4-dd733308958e', N'7aebfda0-ca51-451f-afcc-57b6dcae74b5', NULL, 0, N'Lorem Ipsum is simply dummy text of the printing and typesetting industry', N'lorem-ipsum-is-simply-dummy-text-of-the-printing-and-typesetting-industry', N' Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum', N'Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry''s standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum', N'', N'', N'', NULL, N'', N'/uploads/images/2026/04/68aaa284-8bfb-448b-ac94-e90417c1c5f5.jpg', N'', N'[{"url":"/uploads/images/2026/04/20e8f3dd-eb5d-4ced-b39d-ef50941b5578.png","mediaType":"image","title":"Untitled-1 - 21-01-2026 09-32-33.png"},{"url":"/uploads/images/2026/04/0cf58633-344a-4ac2-b84a-9e9d410313c4.png","mediaType":"image","title":"website_qrcode.png"}]', CAST(N'2026-04-07T16:30:00.0000000' AS DateTime2), NULL, 0, 0, 1, 2, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, CAST(N'2026-04-07T03:40:12.6860000' AS DateTime2), CAST(N'2026-04-07T10:58:32.2690000' AS DateTime2), NULL, NULL, NULL, N'a9f04468-451a-4967-8851-02cb426bee77')
GO
INSERT [dbo].[PostTargets] ([Id], [PostId], [SocialAccountId], [Status], [RetryCount], [LastError], [PublishedUrl], [PublishedPostId], [IsProcessing], [ScheduledTimeUtc], [ProcessedAtUtc], [CreatedAtUtc], [UpdatedAtUtc]) VALUES (N'8eee3e43-c1f1-427d-9430-06b0a5870de9', N'46a0630f-f14a-4835-a978-418af9111f65', N'7c1dc8ea-34ce-4fcc-b7a4-b64e1182ccea', 2, 1, N'Telegram: Bad Request: invalid file HTTP URL specified: URL host is empty', N'https://t.me/c/-1003803018516/4', N'4', 0, CAST(N'2026-04-10T16:51:00.0000000' AS DateTime2), CAST(N'2026-04-10T16:51:22.1380000' AS DateTime2), CAST(N'2026-04-10T16:49:49.1780000' AS DateTime2), NULL)
GO
INSERT [dbo].[PostTargets] ([Id], [PostId], [SocialAccountId], [Status], [RetryCount], [LastError], [PublishedUrl], [PublishedPostId], [IsProcessing], [ScheduledTimeUtc], [ProcessedAtUtc], [CreatedAtUtc], [UpdatedAtUtc]) VALUES (N'13b7aad9-d97e-4177-be42-4c1eefa5abed', N'dba45c64-c0cb-4bc2-ab68-cbea4ec8d3a6', N'd72d2f37-5c11-4fdb-8c97-08d52623aff0', 1, 0, NULL, NULL, NULL, 1, CAST(N'2026-04-02T21:23:00.0000000' AS DateTime2), NULL, CAST(N'2026-04-03T11:22:09.9840000' AS DateTime2), NULL)
GO
INSERT [dbo].[PostTargets] ([Id], [PostId], [SocialAccountId], [Status], [RetryCount], [LastError], [PublishedUrl], [PublishedPostId], [IsProcessing], [ScheduledTimeUtc], [ProcessedAtUtc], [CreatedAtUtc], [UpdatedAtUtc]) VALUES (N'6ef3d19d-67b9-46b1-bcd2-4fe9225d9c0a', N'baf9c9a7-f8f0-462e-aa8d-b8a1e87ed941', N'7471b44c-a179-4077-b5e6-683e77418ca5', 3, 3, N'Zalo: photo_url bW-B4Tk0qoMO1OyTtOhFCfWKcGxVcCKlYXUB6CoRroMN1OyAsfkBSzbNb4I1n9vxsng05StLc3NN6fCLqCwGRCXSXW3RZiHxmXsUH8IInNd56Pj2XvV6UyKVdK63Z90fm56TG83KnNZ5KCWMXTh2Bi5VW4d6XCuvTxni3PgHrZuis invalid', NULL, NULL, 0, CAST(N'2026-04-14T19:21:00.0000000' AS DateTime2), CAST(N'2026-04-14T19:21:36.0630000' AS DateTime2), CAST(N'2026-04-14T19:19:14.6450000' AS DateTime2), NULL)
GO
INSERT [dbo].[PostTargets] ([Id], [PostId], [SocialAccountId], [Status], [RetryCount], [LastError], [PublishedUrl], [PublishedPostId], [IsProcessing], [ScheduledTimeUtc], [ProcessedAtUtc], [CreatedAtUtc], [UpdatedAtUtc]) VALUES (N'792465a1-f66d-4c36-93cc-57b704d7cebc', N'ada946e9-46ef-400e-bfee-1eae82bee83e', N'7c1dc8ea-34ce-4fcc-b7a4-b64e1182ccea', 2, 1, N'Telegram: Bad Request: invalid file HTTP URL specified: URL host is empty', N'https://t.me/c/-1003803018516/5', N'5', 0, CAST(N'2026-04-10T10:52:00.0000000' AS DateTime2), CAST(N'2026-04-10T16:52:05.0480000' AS DateTime2), CAST(N'2026-04-10T16:51:38.5850000' AS DateTime2), NULL)
GO
INSERT [dbo].[PostTargets] ([Id], [PostId], [SocialAccountId], [Status], [RetryCount], [LastError], [PublishedUrl], [PublishedPostId], [IsProcessing], [ScheduledTimeUtc], [ProcessedAtUtc], [CreatedAtUtc], [UpdatedAtUtc]) VALUES (N'89694751-3aae-40bc-acb1-728801155aca', N'a95e9cd4-c5e6-4365-9be4-dd733308958e', N'd72d2f37-5c11-4fdb-8c97-08d52623aff0', 2, 0, NULL, N'https://www.facebook.com/1739346266334677_1412405780686574', N'1739346266334677_1412405780686574', 0, CAST(N'2026-04-07T18:00:00.0000000' AS DateTime2), CAST(N'2026-04-07T18:00:35.6620000' AS DateTime2), CAST(N'2026-04-07T10:58:32.4320000' AS DateTime2), NULL)
GO
INSERT [dbo].[PostTargets] ([Id], [PostId], [SocialAccountId], [Status], [RetryCount], [LastError], [PublishedUrl], [PublishedPostId], [IsProcessing], [ScheduledTimeUtc], [ProcessedAtUtc], [CreatedAtUtc], [UpdatedAtUtc]) VALUES (N'f6d02d18-5486-432d-86a7-78690fd3ade2', N'a2c17c7d-e9c3-4232-a379-86ca3a386999', N'7c1dc8ea-34ce-4fcc-b7a4-b64e1182ccea', 3, 3, N'Telegram: Bad Request: wrong type of the web page content', NULL, NULL, 0, CAST(N'2026-04-10T18:39:00.0000000' AS DateTime2), CAST(N'2026-04-10T18:39:37.7260000' AS DateTime2), CAST(N'2026-04-10T18:37:19.6920000' AS DateTime2), NULL)
GO
INSERT [dbo].[PostTargets] ([Id], [PostId], [SocialAccountId], [Status], [RetryCount], [LastError], [PublishedUrl], [PublishedPostId], [IsProcessing], [ScheduledTimeUtc], [ProcessedAtUtc], [CreatedAtUtc], [UpdatedAtUtc]) VALUES (N'515ee274-19ec-44b4-9de8-96e0b4bb981a', N'5df4497a-5bab-4761-8684-45757a92209f', N'd72d2f37-5c11-4fdb-8c97-08d52623aff0', 2, 0, NULL, N'https://www.facebook.com/1739346266334677_1412427357351083', N'1739346266334677_1412427357351083', 0, CAST(N'2026-04-07T18:39:00.0000000' AS DateTime2), CAST(N'2026-04-07T18:39:18.8150000' AS DateTime2), CAST(N'2026-04-07T18:36:45.2380000' AS DateTime2), NULL)
GO
INSERT [dbo].[PostTargets] ([Id], [PostId], [SocialAccountId], [Status], [RetryCount], [LastError], [PublishedUrl], [PublishedPostId], [IsProcessing], [ScheduledTimeUtc], [ProcessedAtUtc], [CreatedAtUtc], [UpdatedAtUtc]) VALUES (N'fc2428e5-0538-4b77-bad9-dadf6f24a4b0', N'a2c17c7d-e9c3-4232-a379-86ca3a386999', N'd5d25634-36c1-4353-ae2d-b7c33a541279', 3, 3, N'Telegram: Bad Request: wrong type of the web page content', NULL, NULL, 0, CAST(N'2026-04-10T18:39:00.0000000' AS DateTime2), CAST(N'2026-04-10T18:39:38.1360000' AS DateTime2), CAST(N'2026-04-10T18:37:19.6920000' AS DateTime2), NULL)
GO
INSERT [dbo].[PostTargets] ([Id], [PostId], [SocialAccountId], [Status], [RetryCount], [LastError], [PublishedUrl], [PublishedPostId], [IsProcessing], [ScheduledTimeUtc], [ProcessedAtUtc], [CreatedAtUtc], [UpdatedAtUtc]) VALUES (N'3dade61f-bfd6-4ff8-9ab1-f2c24d5176c8', N'7ee21307-c5a7-4021-b888-619931fdc930', N'd5d25634-36c1-4353-ae2d-b7c33a541279', 2, 0, NULL, N'https://t.me/c/-1003971850461/9', N'9', 0, CAST(N'2026-04-10T18:54:00.0000000' AS DateTime2), CAST(N'2026-04-13T18:32:45.1460000' AS DateTime2), CAST(N'2026-04-13T18:32:27.8890000' AS DateTime2), NULL)
GO
INSERT [dbo].[PostTargets] ([Id], [PostId], [SocialAccountId], [Status], [RetryCount], [LastError], [PublishedUrl], [PublishedPostId], [IsProcessing], [ScheduledTimeUtc], [ProcessedAtUtc], [CreatedAtUtc], [UpdatedAtUtc]) VALUES (N'e431f304-f05f-4269-ae1b-feeeb1e61dd0', N'7ee21307-c5a7-4021-b888-619931fdc930', N'7c1dc8ea-34ce-4fcc-b7a4-b64e1182ccea', 2, 0, NULL, N'https://t.me/c/-1003803018516/11', N'11', 0, CAST(N'2026-04-10T18:54:00.0000000' AS DateTime2), CAST(N'2026-04-13T18:32:45.5880000' AS DateTime2), CAST(N'2026-04-13T18:32:27.8890000' AS DateTime2), NULL)
GO
INSERT [dbo].[SocialAccounts] ([Id], [UserId], [Platform], [AccountName], [AccountIdentifier], [ApiBaseUrl], [ApiPostEndpoint], [ApiMethod], [AuthType], [ApiKey], [ApiSecret], [AccessToken], [RefreshToken], [TokenExpiredAtUtc], [CustomHeadersJson], [FieldMappingJson], [IsActive], [CreatedAtUtc], [UpdatedAtUtc], [TenantId], [AvatarUrl]) VALUES (N'd72d2f37-5c11-4fdb-8c97-08d52623aff0', N'7aebfda0-ca51-451f-afcc-57b6dcae74b5', 1, N'XVNET_Demo', N'1739346266334677', NULL, NULL, NULL, 3, NULL, NULL, N'EAAdIGjZBJWtwBRIsllpnh5u6E9eiKfohcPDXxyc4ebNf7zxYZByTZBmDZAZAsDy69YnhjShtGRGfakZAR0mKxP9XvfIbd3QvrkjQPfoHZCFZAdN6hH2iyRvAfsvvHFRtB77IIymPLUKzW2Ik7ZB7qwko7OGSiuaNzBX0SpqLqGMGL71WHrPVO00OHuGwj4wFXI9HG9OMmVtMFOLQypK5zySk456t7', NULL, CAST(N'2026-06-09T06:56:25.2220000' AS DateTime2), NULL, NULL, 1, CAST(N'2026-04-03T11:20:40.7930000' AS DateTime2), CAST(N'2026-04-10T06:56:25.2220000' AS DateTime2), N'a9f04468-451a-4967-8851-02cb426bee77', N'https://scontent-hkg1-2.xx.fbcdn.net/v/t39.30808-1/305271555_537455768181584_4265128937467513321_n.png?stp=cp0_dst-png_s50x50&_nc_cat=103&ccb=1-7&_nc_sid=f907e8&_nc_ohc=EycrTAKEiUUQ7kNvwFiRKvH&_nc_oc=AdoEAOZLUTw5sTL1Hnxl-mk6SIkhOW4U4Q_mOjOHsT11-YBisobwKqqrfq9PhHIxqAE&_nc_zt=24&_nc_ht=scontent-hkg1-2.xx&edm=AGaHXAAEAAAA&_nc_gid=eVE0HIQIox7ZhZjjYa9d7Q&_nc_tpa=Q5bMBQG25vQKXHGTSaYCCKnnDMP-CC9ccRL56PjjiLvTGf-B54YvQrZQwptKcZLZ1Fg5by0I-qMaOlAiVA&oh=00_Af1U1TMRwo-YipWTOCgehpXM8iE9_7KWcXPiwgewTFeGhg&oe=69DE7567')
GO
INSERT [dbo].[SocialAccounts] ([Id], [UserId], [Platform], [AccountName], [AccountIdentifier], [ApiBaseUrl], [ApiPostEndpoint], [ApiMethod], [AuthType], [ApiKey], [ApiSecret], [AccessToken], [RefreshToken], [TokenExpiredAtUtc], [CustomHeadersJson], [FieldMappingJson], [IsActive], [CreatedAtUtc], [UpdatedAtUtc], [TenantId], [AvatarUrl]) VALUES (N'206cef8d-3885-4e1b-a8f4-14923b6d7786', N'7aebfda0-ca51-451f-afcc-57b6dcae74b5', 1, N'Mạng Xuyên Việt', N'276354812466236', NULL, NULL, NULL, 3, NULL, NULL, N'EAAdIGjZBJWtwBRLH6b8z8myW07cmbKd7dqeqZCMnOgZB1mTCCCISZBouZCkDghXMI59uBBxvsUyhST0Rs6oAFEogjUZCwBZCCIdkwqxe5QQWSprrrhJHRJPo4FZAkhGXGYZAKCZB4zBccsOhTJ3l1qaD7OXVWTqtLUYZAGcZA8yzXEdqHYGXAQkINiowpILIZAi9nkgrdhb1xW5eaYoWyYOZC3FDZCWVFEZD', NULL, CAST(N'2026-06-09T06:56:25.2240000' AS DateTime2), NULL, NULL, 1, CAST(N'2026-04-03T11:20:40.9210000' AS DateTime2), CAST(N'2026-04-10T06:56:25.2240000' AS DateTime2), N'a9f04468-451a-4967-8851-02cb426bee77', N'https://scontent-hkg1-2.xx.fbcdn.net/v/t39.30808-1/375670360_794987782631282_249256755200490951_n.jpg?stp=cp0_dst-jpg_s50x50_tt6&_nc_cat=102&ccb=1-7&_nc_sid=f907e8&_nc_ohc=AXNnHr0H6jcQ7kNvwFbCzQT&_nc_oc=AdqC9nucE87zdkcEoITke-BqsIT9hTXD9uqoHGrAuOV6YfGuK7jP72xrVIWqVy8BlVI&_nc_zt=24&_nc_ht=scontent-hkg1-2.xx&edm=AGaHXAAEAAAA&_nc_gid=eVE0HIQIox7ZhZjjYa9d7Q&_nc_tpa=Q5bMBQFewhnYl3XNz8rwD0gBySteXZWwPkqXXZp8P4EogmmekfgoBVG5vx4KXvcUznegTQvOUJbYhyRseg&oh=00_Af2rpchRZ5y3_LwDChQMl5CdzZBFHZJjmiJDnBoZwyxYPQ&oe=69DE7CE4')
GO
INSERT [dbo].[SocialAccounts] ([Id], [UserId], [Platform], [AccountName], [AccountIdentifier], [ApiBaseUrl], [ApiPostEndpoint], [ApiMethod], [AuthType], [ApiKey], [ApiSecret], [AccessToken], [RefreshToken], [TokenExpiredAtUtc], [CustomHeadersJson], [FieldMappingJson], [IsActive], [CreatedAtUtc], [UpdatedAtUtc], [TenantId], [AvatarUrl]) VALUES (N'7471b44c-a179-4077-b5e6-683e77418ca5', N'7aebfda0-ca51-451f-afcc-57b6dcae74b5', 9, N'Mạng Xuyên Việt', N'3827148218779734929', NULL, NULL, NULL, 3, NULL, NULL, N'wFvVS9K3hIFi_LrraGQj8ElzNt6I6QjPaPyeJRicWag_cH1dk6BbIu315ndpJvaIxz0G0VTVvYBixtTpnKVlKDRCQLUeMVvGrFzzLwjixq6mpXzaltVhOg3eU33VRD0teEzRCgXsg6U4sJfpXoki8fk6BH275DOihR0bVOH3dLERrXrkb2pfU-YJU2x15V46uBfz1vC8Z5Uoa7a6gYwMLAsJ1sUoRfOnj-qJ4hXKwHcyhtiRemxhCjtn46REVeXhwEC1Rkr3ZMUG-pzoaswNIUpLO6gGMlOujzzTR8bHrqsWoo55d6UhThgS1I2I9AyBeAKS7f4jjnwGgaL3uoUqQlVPDMNiGvLZoimJGV1KjaZvnZXruNgOMSdy5bksL8TTfD9nJ84g_KghWmS3Zp-65QM79JmmIyh2P9SQh28', N'RhbD5eXPTH5gkayJZ5nr4cswJHUFGnGMCiLxL9CX4GavprjqWIa63GYoNtMSK6445F0vP9nNP61yk1LYu297OmYX1GlkGbzAPEqQJDu28WLue1rtnG15TLRbE3RD0LDsKkHZ3k5hMmvIYHjarGX5R6YTUocC1KOjFQixAxKuQb4GkYmEymjhNK2EBr_-4609G8ifVDy3609fXdr_wIOC8W6pJtRcC7Ko1OvESQyO40KEgbnIZJSI4nAlVXNwInCGMDLBUE1I2H9fvZ5Jq6LyDrFeCaNr20uYRhHZ9l4o4o5Frbb8qNax5qJe0cBzI6WOVDGDOjXFQmPTyrfUltHgBIQL45wCAsi6EPu0Seu7K2qfl2n-l5jK9GV956oZKKqU6TPyHPzlEHG0mW13LpdGrmWmYa1q40', CAST(N'2026-04-15T12:33:41.7750000' AS DateTime2), NULL, NULL, 1, CAST(N'2026-04-14T11:33:41.7750000' AS DateTime2), NULL, N'a9f04468-451a-4967-8851-02cb426bee77', N'https://s160-ava-talk.zadn.vn/8/c/7/a/1/160/b459d548adae7ef990d4b0619cfb7cdc.jpg')
GO
INSERT [dbo].[SocialAccounts] ([Id], [UserId], [Platform], [AccountName], [AccountIdentifier], [ApiBaseUrl], [ApiPostEndpoint], [ApiMethod], [AuthType], [ApiKey], [ApiSecret], [AccessToken], [RefreshToken], [TokenExpiredAtUtc], [CustomHeadersJson], [FieldMappingJson], [IsActive], [CreatedAtUtc], [UpdatedAtUtc], [TenantId], [AvatarUrl]) VALUES (N'4ba635b4-5470-4fff-af68-779cd65c6db8', N'b3edc00a-d474-450c-822e-a5cfec0b5b01', 0, N'SOL', N'xvnet', N'', N'', N'POST', 0, N'', N'', N'', N'', NULL, N'', N'', 1, CAST(N'2026-03-13T10:29:42.9340000' AS DateTime2), NULL, NULL, NULL)
GO
INSERT [dbo].[SocialAccounts] ([Id], [UserId], [Platform], [AccountName], [AccountIdentifier], [ApiBaseUrl], [ApiPostEndpoint], [ApiMethod], [AuthType], [ApiKey], [ApiSecret], [AccessToken], [RefreshToken], [TokenExpiredAtUtc], [CustomHeadersJson], [FieldMappingJson], [IsActive], [CreatedAtUtc], [UpdatedAtUtc], [TenantId], [AvatarUrl]) VALUES (N'0da352be-92a4-44d2-963a-793fd3266a61', N'e3bb213a-bc6c-49c5-a24f-6acf7a523b10', 1, N'XVNET_Demo', N'1739346266334677', NULL, NULL, NULL, 3, NULL, NULL, N'EAAdIGjZBJWtwBRM1jXyzt43ykrLu3ZAxRKX80jA19ZBMQMjO2Lf22CgnXFttsmGXatYgbnj0ldJ0aqmzguvcMWdHZAY997CfHTAFpzvM0N5mu1NsZCyFkmofsgAg1RKmhsBDE1BE11a530fglnB1qpxHeHtZCLQkxdIXpaqmKbXymgkECrXRr958hUlxm6wSZCLDoRKZAPpfXOYPw57MaueNigFC', NULL, CAST(N'2026-06-02T10:34:30.7130000' AS DateTime2), NULL, NULL, 1, CAST(N'2026-04-03T10:34:30.7130000' AS DateTime2), NULL, NULL, NULL)
GO
INSERT [dbo].[SocialAccounts] ([Id], [UserId], [Platform], [AccountName], [AccountIdentifier], [ApiBaseUrl], [ApiPostEndpoint], [ApiMethod], [AuthType], [ApiKey], [ApiSecret], [AccessToken], [RefreshToken], [TokenExpiredAtUtc], [CustomHeadersJson], [FieldMappingJson], [IsActive], [CreatedAtUtc], [UpdatedAtUtc], [TenantId], [AvatarUrl]) VALUES (N'd3182cf4-dd88-481d-8d0c-8b92268f6054', N'7aebfda0-ca51-451f-afcc-57b6dcae74b5', 1, N'Tiệm ăn Luu My', N'271251096064891', NULL, NULL, NULL, 3, NULL, NULL, N'EAAdIGjZBJWtwBRDqxDK9aNE7Isk6ucewPSoF2SiZAlwkbdnApGia4PbDxc16uy3ZCxlD9nhn4duhzE0YjZANS9y1m5vFi70Rfz0uDL5RcNFIeYZAKEsvlBSaiBzkA1g6M7cWYSdPkREsPONtZBcSDINXgGhGr6g2ogEN0SlQritm3ZBcjZB113MVvAUp8br9RUGFiNvICiCbWBu5cAgdetjS2acZD', NULL, CAST(N'2026-06-09T06:56:25.0940000' AS DateTime2), NULL, NULL, 1, CAST(N'2026-04-07T11:48:47.7340000' AS DateTime2), CAST(N'2026-04-10T06:56:25.0940000' AS DateTime2), N'a9f04468-451a-4967-8851-02cb426bee77', N'https://scontent-hkg1-1.xx.fbcdn.net/v/t39.30808-1/423715782_122127217766239052_6031079296481636438_n.jpg?stp=cp0_dst-jpg_s50x50_tt6&_nc_cat=105&ccb=1-7&_nc_sid=f907e8&_nc_ohc=gI_3R97RGukQ7kNvwFCsRXt&_nc_oc=AdqZokxSnUs8ozeE_fbKeDZMBukXtZzF2m0BL5iIy_1Bin4VD6avH41SH0BG8ppSeus&_nc_zt=24&_nc_ht=scontent-hkg1-1.xx&edm=AGaHXAAEAAAA&_nc_gid=eVE0HIQIox7ZhZjjYa9d7Q&_nc_tpa=Q5bMBQEIHOiWyBWQc4Oca4AfG2lhcBcovHZo60h5X-Cpc0wZZhksXQKrrgoiWveVI01oD0EJ6vNPRVVngw&oh=00_Af3obznm1zSD56m63mWQ2RFya7lh6-Qy3lkW07TTaudnpw&oe=69DE63B3')
GO
INSERT [dbo].[SocialAccounts] ([Id], [UserId], [Platform], [AccountName], [AccountIdentifier], [ApiBaseUrl], [ApiPostEndpoint], [ApiMethod], [AuthType], [ApiKey], [ApiSecret], [AccessToken], [RefreshToken], [TokenExpiredAtUtc], [CustomHeadersJson], [FieldMappingJson], [IsActive], [CreatedAtUtc], [UpdatedAtUtc], [TenantId], [AvatarUrl]) VALUES (N'aadfa211-164d-44ee-9169-b5f4910bc192', N'7aebfda0-ca51-451f-afcc-57b6dcae74b5', 8, N'Group 2', N'-5130677465', NULL, NULL, NULL, 2, NULL, NULL, N'8616593659:AAFBPZBs6OFn4G53CtpJb70y3CdXVDGCIQk', NULL, NULL, NULL, NULL, 1, CAST(N'2026-04-10T08:42:05.2000000' AS DateTime2), CAST(N'2026-04-10T08:43:25.0830000' AS DateTime2), N'a9f04468-451a-4967-8851-02cb426bee77', NULL)
GO
INSERT [dbo].[SocialAccounts] ([Id], [UserId], [Platform], [AccountName], [AccountIdentifier], [ApiBaseUrl], [ApiPostEndpoint], [ApiMethod], [AuthType], [ApiKey], [ApiSecret], [AccessToken], [RefreshToken], [TokenExpiredAtUtc], [CustomHeadersJson], [FieldMappingJson], [IsActive], [CreatedAtUtc], [UpdatedAtUtc], [TenantId], [AvatarUrl]) VALUES (N'7c1dc8ea-34ce-4fcc-b7a4-b64e1182ccea', N'7aebfda0-ca51-451f-afcc-57b6dcae74b5', 8, N'Nhóm 0000', N'-1003803018516', NULL, NULL, NULL, 2, NULL, NULL, N'8616593659:AAFBPZBs6OFn4G53CtpJb70y3CdXVDGCIQk', NULL, NULL, NULL, NULL, 1, CAST(N'2026-04-10T09:28:24.7800000' AS DateTime2), NULL, N'a9f04468-451a-4967-8851-02cb426bee77', NULL)
GO
INSERT [dbo].[SocialAccounts] ([Id], [UserId], [Platform], [AccountName], [AccountIdentifier], [ApiBaseUrl], [ApiPostEndpoint], [ApiMethod], [AuthType], [ApiKey], [ApiSecret], [AccessToken], [RefreshToken], [TokenExpiredAtUtc], [CustomHeadersJson], [FieldMappingJson], [IsActive], [CreatedAtUtc], [UpdatedAtUtc], [TenantId], [AvatarUrl]) VALUES (N'd5d25634-36c1-4353-ae2d-b7c33a541279', N'7aebfda0-ca51-451f-afcc-57b6dcae74b5', 8, N'Nhóm test 001', N'-1003971850461', NULL, NULL, NULL, 2, NULL, NULL, N'8616593659:AAFBPZBs6OFn4G53CtpJb70y3CdXVDGCIQk', NULL, NULL, NULL, NULL, 1, CAST(N'2026-04-10T10:34:03.5600000' AS DateTime2), NULL, N'a9f04468-451a-4967-8851-02cb426bee77', NULL)
GO
INSERT [dbo].[SocialAccounts] ([Id], [UserId], [Platform], [AccountName], [AccountIdentifier], [ApiBaseUrl], [ApiPostEndpoint], [ApiMethod], [AuthType], [ApiKey], [ApiSecret], [AccessToken], [RefreshToken], [TokenExpiredAtUtc], [CustomHeadersJson], [FieldMappingJson], [IsActive], [CreatedAtUtc], [UpdatedAtUtc], [TenantId], [AvatarUrl]) VALUES (N'83c7b545-508d-4b4f-bc1b-fc9aa1757f32', N'e3bb213a-bc6c-49c5-a24f-6acf7a523b10', 1, N'Mạng Xuyên Việt', N'276354812466236', NULL, NULL, NULL, 3, NULL, NULL, N'EAAdIGjZBJWtwBRNCZBpSpGWrV4qVFuswBAZArUHDsfS7ZAtSTXUABUxNZBttSuHFEFfyEIaaa27FvhshmQelZA2RTxa4EA1sf29QUrkvJNZA3XRNJ5zWeuCo8wc38HEqmK1JEXz4OEIlD6fkhSaBNj9OddMvriSkRiVTB4WTaC9JWCbSq8EVjd1GZA2ZC5PxjsuwX1ssxZBa2IGRLzEEZCuVCJGc2AZD', NULL, CAST(N'2026-06-02T10:34:30.9120000' AS DateTime2), NULL, NULL, 1, CAST(N'2026-04-03T10:34:30.9120000' AS DateTime2), NULL, NULL, NULL)
GO
INSERT [dbo].[Tenants] ([Id], [Name], [Description], [LogoUrl], [Domain], [TaxCode], [Representative], [Email], [PhoneNumber], [Address], [PostCode], [IsActive], [CreatedAt], [CreatedBy], [LastModifiedAt], [LastModifiedBy], [IsDeleted]) VALUES (N'a9f04468-451a-4967-8851-02cb426bee77', N'Công Ty TNHH MTV Công Nghệ Mạng Xuyên Việt', N'', N'/uploads/images/2026/04/1c32963e-f89e-4016-9910-f992a7e061f9.jpg', N'mangxuyenviet.vn', N'20938549892923', N'Pham Quyet Tien', N'tienpq@xvnet.vn', N'0909 995 137', N'61/31 Bình Giã Phường Tân Bình. TPHCM', N'', 1, CAST(N'2026-04-02T07:35:41.3191280' AS DateTime2), NULL, NULL, NULL, 0)
GO
ALTER TABLE [dbo].[AspNetUsers] ADD  DEFAULT ((0)) FOR [EmailConfirmed]
GO
ALTER TABLE [dbo].[AspNetUsers] ADD  DEFAULT ((0)) FOR [PhoneNumberConfirmed]
GO
ALTER TABLE [dbo].[AspNetUsers] ADD  DEFAULT ((0)) FOR [TwoFactorEnabled]
GO
ALTER TABLE [dbo].[AspNetUsers] ADD  DEFAULT ((1)) FOR [LockoutEnabled]
GO
ALTER TABLE [dbo].[AspNetUsers] ADD  DEFAULT ((0)) FOR [AccessFailedCount]
GO
ALTER TABLE [dbo].[AspNetUsers] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[AspNetUsers] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAtUtc]
GO
ALTER TABLE [dbo].[Categories] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[Categories] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Categories] ADD  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[Categories] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAtUtc]
GO
ALTER TABLE [dbo].[Keywords] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[Keywords] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAtUtc]
GO
ALTER TABLE [dbo].[PostProducts] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[PostLogs] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[PostLogs] ADD  DEFAULT ((0)) FOR [RetryCount]
GO
ALTER TABLE [dbo].[PostLogs] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAtUtc]
GO
ALTER TABLE [dbo].[PostMedias] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[PostMedias] ADD  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[PostMedias] ADD  DEFAULT ((0)) FOR [IsMain]
GO
ALTER TABLE [dbo].[PostMedias] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAtUtc]
GO
ALTER TABLE [dbo].[Posts] ADD  CONSTRAINT [DF__Posts__Id__37A5467C]  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[Posts] ADD  CONSTRAINT [DF_Posts_PostType1]  DEFAULT ((0)) FOR [Ref_ID]
GO
ALTER TABLE [dbo].[Posts] ADD  CONSTRAINT [DF_Posts_PostType]  DEFAULT ((0)) FOR [PostType]
GO
ALTER TABLE [dbo].[Posts] ADD  CONSTRAINT [DF_Posts_IsFeatured]  DEFAULT ((0)) FOR [IsFeatured]
GO
ALTER TABLE [dbo].[Posts] ADD  CONSTRAINT [DF_Posts_IsPinned]  DEFAULT ((0)) FOR [IsPinned]
GO
ALTER TABLE [dbo].[Posts] ADD  CONSTRAINT [DF_Posts_AllowComment]  DEFAULT ((1)) FOR [AllowComment]
GO
ALTER TABLE [dbo].[Posts] ADD  CONSTRAINT [DF_Posts_ViewCount]  DEFAULT ((0)) FOR [ViewCount]
GO
ALTER TABLE [dbo].[Posts] ADD  CONSTRAINT [DF_Posts_ShareCount]  DEFAULT ((0)) FOR [ShareCount]
GO
ALTER TABLE [dbo].[PostTargets] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[PostTargets] ADD  CONSTRAINT [DF_PostTargets_RetryCount]  DEFAULT ((0)) FOR [RetryCount]
GO
ALTER TABLE [dbo].[PostTargets] ADD  CONSTRAINT [DF_PostTargets_IsProcessing]  DEFAULT ((0)) FOR [IsProcessing]
GO
ALTER TABLE [dbo].[SocialAccounts] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[SocialAccounts] ADD  CONSTRAINT [DF_SocialAccounts_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Tags] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[Tags] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Tags] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAtUtc]
GO
ALTER TABLE [dbo].[AspNetRoleClaims]  WITH CHECK ADD  CONSTRAINT [FK_AspNetRoleClaims_Role] FOREIGN KEY([RoleId])
REFERENCES [dbo].[AspNetRoles] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[AspNetRoleClaims] CHECK CONSTRAINT [FK_AspNetRoleClaims_Role]
GO
ALTER TABLE [dbo].[AspNetUserClaims]  WITH CHECK ADD  CONSTRAINT [FK_AspNetUserClaims_User] FOREIGN KEY([UserId])
REFERENCES [dbo].[AspNetUsers] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[AspNetUserClaims] CHECK CONSTRAINT [FK_AspNetUserClaims_User]
GO
ALTER TABLE [dbo].[AspNetUserLogins]  WITH CHECK ADD  CONSTRAINT [FK_AspNetUserLogins_User] FOREIGN KEY([UserId])
REFERENCES [dbo].[AspNetUsers] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[AspNetUserLogins] CHECK CONSTRAINT [FK_AspNetUserLogins_User]
GO
ALTER TABLE [dbo].[AspNetUserRoles]  WITH CHECK ADD  CONSTRAINT [FK_AspNetUserRoles_Role] FOREIGN KEY([RoleId])
REFERENCES [dbo].[AspNetRoles] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[AspNetUserRoles] CHECK CONSTRAINT [FK_AspNetUserRoles_Role]
GO
ALTER TABLE [dbo].[AspNetUserRoles]  WITH CHECK ADD  CONSTRAINT [FK_AspNetUserRoles_User] FOREIGN KEY([UserId])
REFERENCES [dbo].[AspNetUsers] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[AspNetUserRoles] CHECK CONSTRAINT [FK_AspNetUserRoles_User]
GO
ALTER TABLE [dbo].[AspNetUserTokens]  WITH CHECK ADD  CONSTRAINT [FK_AspNetUserTokens_User] FOREIGN KEY([UserId])
REFERENCES [dbo].[AspNetUsers] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[AspNetUserTokens] CHECK CONSTRAINT [FK_AspNetUserTokens_User]
GO
ALTER TABLE [dbo].[Categories]  WITH CHECK ADD  CONSTRAINT [FK_Categories_Parent] FOREIGN KEY([ParentId])
REFERENCES [dbo].[Categories] ([Id])
GO
ALTER TABLE [dbo].[Categories] CHECK CONSTRAINT [FK_Categories_Parent]
GO
ALTER TABLE [dbo].[Categories]  WITH CHECK ADD  CONSTRAINT [FK_Categories_SocialAccounts_SocialAccountId] FOREIGN KEY([SocialAccountId])
REFERENCES [dbo].[SocialAccounts] ([Id])
GO
ALTER TABLE [dbo].[Categories] CHECK CONSTRAINT [FK_Categories_SocialAccounts_SocialAccountId]
GO
ALTER TABLE [dbo].[PostProducts]  WITH CHECK ADD  CONSTRAINT [FK_PostProducts_Posts] FOREIGN KEY([PostId])
REFERENCES [dbo].[Posts] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[PostProducts] CHECK CONSTRAINT [FK_PostProducts_Posts]
GO
ALTER TABLE [dbo].[Keywords]  WITH CHECK ADD  CONSTRAINT [FK_Keywords_Posts_LastPostId] FOREIGN KEY([LastPostId])
REFERENCES [dbo].[Posts] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[Keywords] CHECK CONSTRAINT [FK_Keywords_Posts_LastPostId]
GO
ALTER TABLE [dbo].[PostLogs]  WITH CHECK ADD  CONSTRAINT [FK_PostLogs_PostTarget] FOREIGN KEY([PostTargetId])
REFERENCES [dbo].[PostTargets] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[PostLogs] CHECK CONSTRAINT [FK_PostLogs_PostTarget]
GO
ALTER TABLE [dbo].[PostMedias]  WITH CHECK ADD  CONSTRAINT [FK_PostMedias_Post] FOREIGN KEY([PostId])
REFERENCES [dbo].[Posts] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[PostMedias] CHECK CONSTRAINT [FK_PostMedias_Post]
GO
ALTER TABLE [dbo].[PostTags]  WITH CHECK ADD  CONSTRAINT [FK_PostTags_Post] FOREIGN KEY([PostId])
REFERENCES [dbo].[Posts] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[PostTags] CHECK CONSTRAINT [FK_PostTags_Post]
GO
ALTER TABLE [dbo].[PostTags]  WITH CHECK ADD  CONSTRAINT [FK_PostTags_Tag] FOREIGN KEY([TagId])
REFERENCES [dbo].[Tags] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[PostTags] CHECK CONSTRAINT [FK_PostTags_Tag]
GO
ALTER TABLE [dbo].[PostTargets]  WITH CHECK ADD  CONSTRAINT [FK_PostTargets_Post] FOREIGN KEY([PostId])
REFERENCES [dbo].[Posts] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[PostTargets] CHECK CONSTRAINT [FK_PostTargets_Post]
GO
ALTER TABLE [dbo].[PostTargets]  WITH CHECK ADD  CONSTRAINT [FK_PostTargets_SocialAccount] FOREIGN KEY([SocialAccountId])
REFERENCES [dbo].[SocialAccounts] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[PostTargets] CHECK CONSTRAINT [FK_PostTargets_SocialAccount]
GO
ALTER TABLE [dbo].[SocialAccounts]  WITH CHECK ADD  CONSTRAINT [FK_SocialAccounts_User] FOREIGN KEY([UserId])
REFERENCES [dbo].[AspNetUsers] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[SocialAccounts] CHECK CONSTRAINT [FK_SocialAccounts_User]
GO
