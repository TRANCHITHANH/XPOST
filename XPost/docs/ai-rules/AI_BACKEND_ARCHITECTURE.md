# AI Backend Architecture Rules

Stack: .NET 10 Web API
Database: SQL Server
Architecture: Clean Architecture + Modular Monolith

AI must follow this architecture when generating backend code.

---

# 1. Architecture Layers

The backend must follow this structure:

API Layer
Application Layer
Domain Layer
Infrastructure Layer

Structure example:

/src
/API
/Application
/Domain
/Infrastructure

Rules:

Controllers → Services → Repositories → Database

Controllers must never contain business logic.

---

# 2. Controller Rules

Controllers must:

* handle HTTP requests
* validate request DTO
* call Application Services
* return standardized responses

Controllers must NOT:

* access database
* contain business logic
* perform heavy processing

---

# 3. Service Layer

Services contain business logic.

Examples:

UserService
PostSchedulerService
SocialPublishService

Rules:

Services must:

* validate business rules
* call repositories
* orchestrate workflows

---

# 4. Repository Layer

Repositories manage database access.

Rules:

* Only repositories access the database
* Services must not write SQL directly
* All queries must support TenantId filtering

---

# 5. Background Job Processing

Heavy tasks must run in background jobs.

Examples:

Publishing scheduled posts
Webhook processing
Social API synchronization

Jobs must be queued instead of blocking API requests.

---

# 6. API Response Format

All APIs must return standardized responses.

Example concept:

{
success: true,
data: {},
error: null
}

---

# 7. Dependency Injection

All services must be injected using dependency injection.

Do not instantiate services manually.

---

# 8. Async Programming

All database and network operations must use async/await.

Blocking operations are forbidden.

---

# 9. DTO Usage

DTOs must be used for:

API request models
API response models

Entities must never be returned directly.

---

# 10. Feature Modules

Each major feature must be a module.

Example modules:

Auth
Users
Posts
SocialIntegrations
Billing

Modules must be loosely coupled.

---

# 11. Scalability Rules

Backend must support scaling to:

100k+ users
millions of API requests

Rules:

Use caching
Avoid heavy synchronous operations
Paginate large queries
