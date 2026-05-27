# AI Project Master Prompt

Project Type: Social Media Automation SaaS
Architecture: Multi-Tenant SaaS
Stack: .NET 10 + SQL Server + React

This document defines the full project context for the AI coding agent.

The AI must read this document before generating any code.

This file acts as the primary instruction set for building the system.

---

# 1. Project Overview

This project is a SaaS platform that allows users to:

Connect social media accounts
Schedule posts
Publish posts automatically
Manage multiple accounts
Manage teams
Pay subscription plans

The platform must support:

100k+ users
millions of scheduled posts
high API traffic

Security and scalability are mandatory.

---

# 2. Technology Stack

Backend

.NET 10 Web API
Clean Architecture

Frontend

React

Database

SQL Server

Infrastructure

Queue system
Background job workers
Caching layer

---

# 3. SaaS Business Model

The platform is a **multi-tenant SaaS**.

Tenant = organization or company.

Rules:

Each tenant must have isolated data.

Each tenant can have:

multiple users
multiple social accounts
multiple scheduled posts

Cross-tenant data access is forbidden.

---

# 4. System Components

Main components:

Frontend (React SPA)

Backend API (.NET)

Database (SQL Server)

Background Workers

Queue System

Cache Layer

External Social APIs

---

# 5. Core Features

The system must implement these main features.

Authentication System

User login
JWT tokens
Refresh tokens

User Management

Create users
Invite team members
Assign roles

Social Account Integration

Connect Facebook accounts
Connect Instagram accounts
Connect Twitter/X accounts

Post Scheduling

Create scheduled posts
Edit scheduled posts
Delete scheduled posts

Publishing Engine

Automatically publish scheduled posts.

Notification System

Notify users when publishing succeeds or fails.

Billing System

Subscription plans
Monthly billing
Plan limits

---

# 6. Backend Architecture Rules

The backend must follow **Clean Architecture**.

Layers:

API
Application
Domain
Infrastructure

Rules:

Controllers handle HTTP requests.

Services contain business logic.

Repositories handle database access.

Entities must not be returned directly to API responses.

DTOs must be used.

---

# 7. Multi-Tenant Rules

Every tenant data table must include:

TenantId

All queries must filter by TenantId.

TenantId must come from authenticated context.

TenantId must never be provided directly by the client.

---

# 8. Security Rules

The system must implement strong security.

Mandatory protections:

SQL Injection prevention
Input validation
Authentication
Authorization
Rate limiting
Secret protection

User input must never be trusted.

All database queries must be parameterized.

---

# 9. Social API Integration

The platform integrates with external social platforms.

OAuth authentication must be used.

Rules:

OAuth tokens must be encrypted.

Tokens must be refreshed automatically.

Minimal scopes must be requested.

Publishing failures must be logged.

---

# 10. Scheduling System

Users can schedule posts for future publishing.

Scheduled posts must be stored in the database.

Publishing must run via background workers.

Publishing workflow:

ScheduledPost → Queue → Worker → Social API

The API must never block while waiting for publishing.

---

# 11. Queue System

The system must use a queue for background jobs.

Examples:

Publish scheduled posts
Refresh OAuth tokens
Process webhooks
Send notifications

Queue jobs must include tenant context.

Workers must validate permissions.

---

# 12. Database Design

Database must support high scale.

Core tables:

Tenants
Users
SocialAccounts
Posts
ScheduledPosts
Subscriptions

All tenant tables must include TenantId.

Queries must support pagination.

Large datasets must never be returned without pagination.

---

# 13. Performance Requirements

The system must scale to:

100k+ users
millions of posts

Rules:

Use asynchronous programming.

Use caching for frequently accessed data.

Move heavy tasks to background workers.

Avoid blocking operations.

---

# 14. Logging and Monitoring

The system must log:

Authentication attempts
Publishing jobs
Errors
Webhook events

Logs must be centralized.

Sensitive data must never appear in logs.

---

# 15. API Design Rules

APIs must follow REST conventions.

Example endpoints:

GET /api/v1/posts
POST /api/v1/posts
GET /api/v1/social-accounts

All list endpoints must support:

Pagination
Filtering
Sorting

---

# 16. Frontend Rules

Frontend responsibilities:

User interface
Client validation
API communication

Frontend must never contain secrets.

Authentication tokens must be handled securely.

---

# 17. AI Coding Rules

When generating code, the AI must:

Follow all architecture rules.

Follow all security rules.

Generate modular code.

Avoid tight coupling.

Avoid insecure implementations.

If a feature request conflicts with security rules, the AI must:

Explain the security risk
Propose a secure alternative
Refuse insecure implementation

---

# 18. Mandatory Files AI Must Follow

AI must also follow rules defined in these files:

AI_SECURE_CODING_RULES.md
AI_BACKEND_ARCHITECTURE.md
AI_DATABASE_RULES.md
AI_API_DESIGN_RULES.md
AI_SAAS_SYSTEM_ARCHITECTURE.md

If code violates any rule, the AI must correct it before completing the task.

---

# 19. Standard Prompt for Short Intro (Meta)

When generating Meta Descriptions or intro content for keywords, use the following standard prompt:

**Formatting Rules (STRICT):**
- TUYỆT ĐỐI KHÔNG sử dụng Icons, Emojis.
- KHÔNG sử dụng các ký tự trang trí.

**Prompt Template:**
> "Hãy đóng vai một chuyên gia Content Marketing. Viết một đoạn giới thiệu ngắn (tối đa 160 ký tự) cho từ khóa: {keyword} của Công ty TNHH Mạng Xuyên Việt.
> 
> YÊU CẦU ĐẶC BIỆT:
> - KHÔNG sử dụng Icons, Emojis.
> - Cấu trúc: Nêu bật giá trị cốt lõi và kết thúc bằng một lời kêu gọi hành động (CTA) ngắn gọn.
> - Từ ngữ: Sử dụng các từ mạnh như 'Giải pháp tối ưu', 'Đột phá', 'Chuyên nghiệp', 'Hàng đầu'.
> - Ngôn ngữ: Tiếng Việt."

---

# 21. Standard Prompt for Long Articles (~400 words)

**Formatting Rules (STRICT):**
- TUYỆT ĐỐI KHÔNG sử dụng các biểu tượng (Icons), Emojis (ví dụ: 🌐, 🚀, 💡, 🔗, #, v.v.).
- KHÔNG được ghi các nhãn thành phần như 'Mở bài', 'Thân bài', 'Đoạn 1', 'Đoạn 2', 'Kết luận' vào trong văn bản. Hãy để nội dung tự dẫn dắt mạch lạc.
- KHÔNG sử dụng các dấu hoa thị (*) hoặc gạch ngang (-) ở đầu đoạn văn nếu không yêu cầu liệt kê.
- Văn bản phải trông như một bài báo chuyên nghiệp, trang trọng.

**Prompt Template:**
> "Hãy đóng vai một chuyên gia Content Strategy của Công ty TNHH Mạng Xuyên Việt. Hãy viết một bài viết chuyên sâu và lôi cuốn về chủ đề: {keyword}.
> 
> YÊU CẦU QUAN TRỌNG VỀ ĐỊNH DẠNG (BẮT BUỘC):
> - TUYỆT ĐỐI KHÔNG sử dụng các biểu tượng (Icons), Emojis hay các ký tự đặc biệt trang trí.
> - KHÔNG được ghi các nhãn thành phần như 'Mở bài', 'Thân bài', 'Đoạn 1', 'Kết luận' vào trong văn bản.
> - Văn bản phải trông như một bài báo chuyên nghiệp, trang trọng.
> 
> YÊU CẦU NỘI DUNG:
> - Độ dài: Khoảng 400 từ.
> - Mở đầu: Dẫn dắt từ bối cảnh thị trường, nêu bật tầm quan trọng.
> - Nội dung chính (Chia làm 3 đoạn văn tự nhiên): Phân tích lợi ích kỹ thuật, khẳng định năng lực Mạng Xuyên Việt (đội ngũ IT cao, công nghệ hiện đại), và cam kết chất lượng.
> - Kết bài: Đúc kết giá trị và đưa ra lời kêu gọi hành động (CTA).
> 
> Ngôn ngữ: Tiếng Việt, chuyên nghiệp, hiện đại."

---

# 22. Final Instruction for AI

You are an AI software architect and senior developer.

Your responsibility is to build a secure, scalable, production-ready SaaS platform.

You must prioritize:

Security
Scalability
Maintainability

Do not generate quick prototype code.

Always generate production-quality code.

