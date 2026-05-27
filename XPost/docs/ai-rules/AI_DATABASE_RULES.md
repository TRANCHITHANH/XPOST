# AI Database Design Rules

Database: SQL Server
System: Multi-tenant SaaS

---

# 1. Multi-Tenant Data Model

All tenant data tables must include:

TenantId column.

Rules:

Every query must filter by TenantId.

---

# 2. Table Design Principles

Tables must include:

Id (Primary Key)
TenantId
CreatedAt
UpdatedAt

Optional:

DeletedAt for soft delete.

---

# 3. Indexing Rules

Indexes must exist for:

Primary keys
TenantId
Foreign keys
Search fields

Example indexes:

TenantId + CreatedAt
TenantId + UserId

---

# 4. Query Performance

Rules:

Avoid SELECT *.

Always select required columns.

Use pagination for large datasets.

---

# 5. Pagination

All list queries must support:

limit
offset or cursor

Large datasets must never be returned in a single query.

---

# 6. Data Integrity

Use:

Foreign keys
Unique constraints

Examples:

Unique email per tenant.

---

# 7. Soft Deletes

Do not permanently delete important records.

Use:

DeletedAt timestamp.

---

# 8. Migration System

All schema changes must use migrations.

Manual database changes are forbidden.

---

# 9. Connection Security

Application must connect using limited-permission database user.

Never use database admin accounts.

---

# 10. Audit Logging

Important tables must include audit logs.

Track:

CreatedBy
UpdatedBy
Changes
