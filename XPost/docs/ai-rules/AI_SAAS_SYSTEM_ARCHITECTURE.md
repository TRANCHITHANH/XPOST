# AI SaaS System Architecture

Version: 1.0
System Type: Social Media Automation SaaS
Stack: .NET 10 + SQL Server + React

This document defines the full system architecture that AI must follow when generating code for this SaaS platform.

The platform allows users to:

* Connect social media accounts
* Schedule posts
* Publish posts automatically
* Manage multiple accounts
* Pay subscription plans

Security, scalability, and multi-tenant isolation are mandatory.

---

# 1. High-Level System Architecture

Main components:

Frontend (React)
Backend API (.NET Web API)
Database (SQL Server)
Background Job Workers
Queue System
Cache Layer
External Social APIs

System flow:

User → Frontend → API → Services → Database / Queue → Workers → Social APIs

---

# 2. Multi-Tenant SaaS Model

The platform is a multi-tenant SaaS.

Tenant = one customer organization.

Rules:

Every tenant must have isolated data.

Database tables must include:

TenantId

Users may belong to a tenant.

All queries must filter by TenantId.

Cross-tenant access is strictly forbidden.

---

# 3. Core System Modules

The backend must be divided into modules.

Modules:

Auth Module
User Management Module
Tenant Management Module
Social Account Integration Module
Post Scheduling Module
Publishing Engine
Webhook Processing Module
Notification Module
Billing & Subscription Module

Modules must be loosely coupled.

---

# 4. Authentication System

Authentication must support:

User login
Admin login
API authentication

Technology:

JWT access tokens
Refresh tokens

Security rules:

Access tokens must expire.

Refresh tokens must be stored securely.

Authentication endpoints must implement rate limiting.

---

# 5. User and Tenant System

Entities:

Tenant
User
Role
Permission

Rules:

Users belong to a tenant.

Tenants can have multiple users.

Users can have roles:

Admin
Editor
Viewer

Role-based authorization must be enforced.

---

# 6. Social Media Integration

The platform integrates with external APIs.

Examples:

Facebook API
Instagram API
Twitter / X API

Integration must use OAuth authentication.

Security rules:

OAuth tokens must be encrypted before storing in database.

Tokens must be refreshed automatically.

Scopes must be minimal.

---

# 7. Post Scheduling System

Users can schedule posts for future publishing.

Entities:

Post
ScheduledPost
PostContent
MediaAttachment

Features:

Schedule posts at a specific time.

Edit scheduled posts.

Cancel scheduled posts.

Rules:

Scheduling must create background jobs instead of blocking API requests.

---

# 8. Publishing Engine

The publishing engine is responsible for sending posts to social platforms.

Workflow:

ScheduledPost → Queue → Worker → Social API

Rules:

Publishing must run in background workers.

Failures must be retried.

Publishing logs must be stored.

---

# 9. Queue System

Background jobs must use a queue.

Example jobs:

Publish scheduled post
Refresh social tokens
Process webhooks
Send notifications

Queue processing must be reliable and retryable.

---

# 10. Webhook Processing

External platforms may send webhooks.

Examples:

Post published
Account disconnected
Token expired

Rules:

Webhooks must be validated.

Webhook signatures must be verified.

Replay attacks must be prevented.

---

# 11. Notification System

Users must receive notifications for:

Publishing success
Publishing failure
Account issues
Billing issues

Notification channels:

In-app notifications
Email notifications

Notifications must run in background jobs.

---

# 12. Billing System

The SaaS platform must support subscription plans.

Entities:

Plan
Subscription
Invoice
Payment

Features:

Monthly subscriptions
Plan upgrades
Usage limits

Rules:

Plan limits must be enforced by backend.

---

# 13. Database Architecture

Database must support multi-tenant SaaS.

Core tables:

Tenants
Users
SocialAccounts
Posts
ScheduledPosts
Subscriptions
Invoices

All tenant data tables must include:

TenantId

---

# 14. Caching Layer

Caching must be used to improve performance.

Examples:

User session data
API responses
Configuration settings

Cache must never store sensitive secrets.

---

# 15. Logging and Monitoring

The system must log:

Authentication events
Publishing jobs
API errors
Webhook events

Logs must be centralized.

Sensitive data must never appear in logs.

---

# 16. API Design Principles

The backend must expose REST APIs.

Examples:

GET /api/v1/posts
POST /api/v1/posts
GET /api/v1/social-accounts

APIs must support:

Pagination
Filtering
Sorting

---

# 17. Security Requirements

The system must prevent:

SQL Injection
Cross-Site Scripting (XSS)
Cross-Site Request Forgery (CSRF)
Brute force attacks

All APIs must validate input.

All database queries must use parameterized queries.

---

# 18. Performance Requirements

The system must support scaling to:

100k+ users
millions of scheduled posts

Rules:

Use background jobs for heavy tasks.

Avoid blocking API calls.

Implement pagination for large datasets.

---

# 19. Frontend Architecture

Frontend must use React.

Frontend responsibilities:

User interface
API communication
Client-side validation

Frontend must never contain secrets.

All sensitive operations must be validated by backend.

---

# 20. Final Architecture Rule

AI must generate code that strictly follows:

AI_SECURE_CODING_RULES.md
AI_BACKEND_ARCHITECTURE.md
AI_DATABASE_RULES.md
AI_API_DESIGN_RULES.md
AI_SAAS_SYSTEM_ARCHITECTURE.md

If generated code violates these rules, the AI must correct it before completing the task.
