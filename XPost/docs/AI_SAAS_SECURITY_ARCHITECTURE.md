# AI Secure SaaS Architecture Rules

Version: 1.0
Stack: .NET 10 + SQL Server + React
System Type: Multi-Tenant SaaS Platform

This document defines **mandatory architecture and security rules** that the AI must follow when generating code.

Security, scalability, and data isolation take priority over development speed.

---

# 1. SaaS Architecture Model

The platform must be designed as **multi-tenant SaaS**.

Tenant = one customer / organization.

Rules:

* Each tenant must only access its own data.
* All database queries must include TenantId filtering.
* No cross-tenant data access is allowed.

Example concept:

TenantId column must exist in all tenant data tables.

---

# 2. Multi-Tenant Isolation

AI must enforce tenant isolation in:

Database queries
API access
Background jobs
Caching

Rules:

* All queries must filter by TenantId.
* TenantId must come from authenticated context.
* TenantId must never be accepted directly from user input.

Example rule:

Users cannot request data for another tenant.

---

# 3. API Gateway Security

All external requests must pass through an API gateway or middleware.

Security layers:

Authentication
Authorization
Rate limiting
Request validation
Logging

The gateway must protect internal services.

---

# 4. Authentication System

Authentication must support:

JWT access tokens
Refresh tokens
Token expiration
Token revocation

Security requirements:

Access token lifetime: short (15–60 minutes)

Refresh tokens must be stored securely.

Authentication must support:

User login
Admin login
API clients

---

# 5. OAuth Integration Security

Because this SaaS connects to social platforms, OAuth must be implemented securely.

Rules:

Never store raw OAuth tokens in plaintext.

Tokens must be encrypted before storing in database.

OAuth tokens must be refreshed automatically.

Scopes must be minimal.

---

# 6. Webhook Security

External services may send webhooks.

Rules:

* Verify webhook signatures
* Validate payload format
* Reject unknown sources
* Implement replay attack protection

Webhook endpoints must never execute actions without verification.

---

# 7. Queue and Background Job Security

Background workers must process jobs from queues.

Rules:

Jobs must include tenant context.

Workers must validate tenant permissions before executing jobs.

Queue messages must never contain secrets.

---

# 8. SQL Injection Protection

All database access must prevent SQL injection.

Forbidden:

String concatenated SQL.

Allowed:

ORM queries
Parameterized SQL queries

User input must never be injected directly into queries.

---

# 9. Input Validation

All user input must be validated.

Validation includes:

Length limits
Format validation
Allowed characters
Business rule validation

All validation must occur before database access.

---

# 10. Rate Limiting

To prevent abuse:

Login endpoint rate limit
API request rate limit
Webhook rate limit

Example limits:

100 API requests per minute per user.

---

# 11. Brute Force Protection

Login endpoints must include:

Attempt limits
Temporary account lockouts
IP throttling

Optional:

Captcha after multiple failures.

---

# 12. Data Encryption

Sensitive data must be encrypted.

Examples:

OAuth tokens
API keys
Integration secrets

Encryption must use strong cryptography.

Encryption keys must not be stored in source code.

---

# 13. Secret Management

Secrets must be stored using secure configuration.

Allowed:

Environment variables
Secret manager systems

Forbidden:

Secrets in source code
Secrets in frontend code

---

# 14. Logging and Monitoring

The system must log:

Authentication attempts
Authorization failures
API errors
Suspicious activities

Logs must be centralized.

Logs must never include:

Passwords
Tokens
Private keys

---

# 15. Error Handling

Error responses must never expose internal system details.

Safe error response example concept:

Generic error message returned to client.

Detailed error stored only in logs.

---

# 16. File Upload Security

Rules:

Restrict file types
Limit file size
Validate MIME types
Rename uploaded files

Uploaded files must be stored outside the web root.

---

# 17. API Design Rules

All APIs must follow these principles:

Authentication required
Pagination for list endpoints
Filtering support
Rate limiting

Large datasets must never be returned in a single request.

---

# 18. Background Job Isolation

Background jobs must enforce tenant isolation.

Rules:

Jobs must include TenantId.

Workers must verify tenant permissions before executing tasks.

---

# 19. Dependency Security

AI must only use trusted libraries.

Rules:

Avoid unmaintained packages.

Prefer official libraries.

Dependencies must be regularly updated.

---

# 20. Frontend Security (React)

Frontend must follow:

Centralized API client
Secure token handling
No secrets in frontend code

User input must be validated before sending to backend.

However, backend must always re-validate.

---

# 21. Performance & Scalability

The system must be designed for high concurrency.

Rules:

Use async I/O operations.

Avoid blocking calls.

Implement caching where appropriate.

Large operations must run in background jobs.

---

# 22. Security Checklist Before Generating Code

Before completing any feature, AI must confirm:

Authentication implemented
Authorization implemented
Tenant isolation implemented
SQL injection prevented
Input validation implemented
Secrets protected
Logging implemented
Error handling implemented

If any requirement is missing, AI must implement it before finishing the feature.

---

# 23. Final Mandatory Rule

Security and tenant isolation must never be compromised for convenience.

If a requested feature violates security principles, the AI must:

Explain the security risk
Provide a secure alternative
Refuse to generate insecure code
