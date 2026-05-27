# AI API Design Rules

System: SaaS Platform
API Style: REST

---

# 1. REST Principles

Endpoints must follow REST naming.

Examples:

GET /api/posts
POST /api/posts
GET /api/posts/{id}
PUT /api/posts/{id}
DELETE /api/posts/{id}

---

# 2. API Versioning

APIs must support versioning.

Example:

/api/v1/posts

---

# 3. Pagination

List endpoints must support pagination.

Example parameters:

page
pageSize

---

# 4. Filtering

APIs must support filtering.

Example:

/api/posts?status=scheduled

---

# 5. Sorting

APIs must allow sorting.

Example:

/api/posts?sort=createdAt_desc

---

# 6. HTTP Status Codes

Use correct HTTP codes.

200 OK
201 Created
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
500 Internal Error

---

# 7. Rate Limiting

APIs must enforce rate limiting.

Example:

100 requests per minute per user.

---

# 8. Idempotency

POST endpoints that create resources should support idempotency keys to prevent duplicate operations.

---

# 9. Security Headers

All responses must include security headers.

Examples:

X-Content-Type-Options
X-Frame-Options
Content-Security-Policy

---

# 10. API Documentation

All APIs must be documented.

OpenAPI / Swagger documentation must be generated automatically.
