# ☁️ MANDATORY RULE: CLOUD DATABASE PERSISTENCE FOR ALL FEATURES

Whenever the user asks to build, add, modify, or extend ANY feature, workflow, or entity in the Gurukul Sports Academy CRM / ERP:

## 1. The Cloud Database Invariant (Strict Rule)
- **NO LOCALSTORAGE-ONLY SCENES**: Under NO circumstances should `localStorage` ever be used as the primary data store for business features, contacts, teams, messages, fees, students, or system records.
- **Mandatory Cloud Database Storage**: Every single entity and data model MUST be backed by a persistent Cloud Database table in Supabase / PostgreSQL.
- **Cross-Device & Cross-Browser Synchronization**: Any data created or edited by the admin on one device/browser must instantly be persisted to the database and accessible on all other devices/browsers.

## 2. Permitted Uses of localStorage
`localStorage` is strictly restricted to:
1. Secondary caching for offline resilience (with immediate background database sync).
2. Ephemeral UI states (e.g. sidebar toggle open/closed, temporary draft input before saving).
3. Session tokens (`gurukul_access_token`, `gurukul_user_profile`) for persistent login.

## 3. Standard Implementation Workflow for Any New Feature
Whenever any new feature is requested:
1. **Schema Definition**: Ensure a corresponding table exists in Supabase PostgreSQL (with proper columns, primary key, timestamps `created_at`, `updated_at`, and RLS policies).
2. **Backend Service & API Routes**: Implement robust backend controllers, services, and Express routes (`/api/v1/...`).
3. **Frontend Integration**: Call the backend API via `apiClient()` or standard authorized fetch. State must update from the API response.
4. **End-to-End Verification**: Verify via database query (`execute_sql`) and frontend build that records persist permanently.
5. **No Technical Jargon in UI**: Never show raw technical database terms ("Supabase", "PostgreSQL") in user-facing UI; use clean academy ERP terms ("Cloud Database", "Academy Server", "Synchronized").
