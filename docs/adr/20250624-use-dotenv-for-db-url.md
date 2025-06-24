---
created: 2025-06-24T00:55:00Z
updated: 2025-06-24T00:55:00Z
updatedBy: o3-pro
version: 1.0.0
---

# ADR 20250624: Load `DATABASE_URL` from Environment Variables

## Status

Accepted

## Context

The Business Intelligence API previously hard-coded its PostgreSQL connection string in `src/index-database.ts`, including plain-text credentials. This caused authentication failures when database passwords changed (e.g., `password` vs `password123`) and violated security best-practices.

## Decision

1. Use `dotenv` to load environment variables at application start-up.
2. Expect `DATABASE_URL` to be provided via an `.env` file or the runtime environment.
3. Throw an explicit error if `DATABASE_URL` is undefined to provide fast feedback during startup.

## Consequences

- Credentials are no longer committed to source control.
- Deployments can provide environment-specific connection strings without code changes.
- Local developers must create/update `business-intelligence-api/.env`.

## Migration Steps

1. Add/modify `.env`:
   ```bash
   DATABASE_URL=postgresql://qudag_executive:password123@localhost:5433/qudag_business
   ```
2. Restart the API (`npm run dev`).

---

> **Update 2025-06-24 00:55 UTC by o3-pro**: Initial creation.
