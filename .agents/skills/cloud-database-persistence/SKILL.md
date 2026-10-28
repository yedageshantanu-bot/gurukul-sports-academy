---
name: cloud-database-persistence
description: Enforces cloud database persistence in Supabase PostgreSQL for all CRM/ERP features, forbidding localStorage as a primary store.
---

# Cloud Database Persistence Runtime

This skill guarantees that every feature, entity, and business record created in Gurukul Sports Academy is persisted permanently in the cloud database (Supabase PostgreSQL) and served via backend APIs, preventing data loss across browsers and sessions.

## Mandatory Rules

1. **Cloud Database First**:
   - Always persist new features to PostgreSQL tables in Supabase (`execute_sql` / Supabase MCP).
   - Expose endpoints via backend Express routes under `/api/v1/...`.
   - Never store business contacts, teams, rosters, messages, fees, or students exclusively in `localStorage`.

2. **Full CRUD Support**:
   - Create (`POST`): Inserts row into cloud database table and returns generated record.
   - Read (`GET`): Queries rows with proper order and filters.
   - Update (`PATCH`/`PUT`): Updates row in database and refreshes state.
   - Delete (`DELETE`): Removes row from database.

3. **Superpowers Integration**:
   - Use `systematic-debugging` and `verification-before-completion` from `obra/superpowers` to ensure all database writes and reads are tested and verified before marking tasks complete.
