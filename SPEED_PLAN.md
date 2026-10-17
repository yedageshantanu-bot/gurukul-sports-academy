# SPEED_PLAN.md — Performance Optimization Roadmap

## 1. Detected Stack Summary

- **Frontend Framework**: React 18 (`react`, `react-dom`, `react-router-dom` v6), Vite 6, Tailwind CSS, TanStack React Query v5, Zustand, Lucide React, `pdf-lib`.
- **Backend Service**: Node.js (v22+), Express 4.21 (TypeScript / tsx), Helmet, CORS, Zod.
- **Database**: PostgreSQL hosted on Supabase (`@supabase/supabase-js` v2), accessed via Supabase REST & PostgREST.
- **Hosting Architecture**:
  - Frontend: Cloudflare Pages (`https://gurukul-sports-academy.pages.dev`).
  - Main Backend API: Render Free Tier (`https://gurukul-sports-backend.onrender.com`, Singapore region).
  - WhatsApp Gateway: Render Docker bridge (`https://gurukul-openwa-bridge-a0m4.onrender.com`).
- **Security Notice (Rule Compliance)**:
  - Hardcoded secrets/credentials detected in repository files: `render.yaml`, `RENDER_DEPLOYMENT_ARCHITECTURE.md`, `backend/src/scripts/testLogin.ts`, `backend/src/scripts/seedUsers.ts`. (Values are omitted in compliance with security guidelines).

---

## 2. Baseline Measurements

### A. API Endpoints Baseline (Local Server, 3-run Average)
| Endpoint | Method | Baseline Avg Time (ms) | Baseline Size (KB) | Content-Encoding | Cache-Control |
|---|---|---|---|---|---|
| `/api/dashboard/admin` | GET | **263 ms** | **4.53 KB** | none | none |
| `/api/students` | GET | **169 ms** | **2.24 KB** | none | none |
| `/api/batches` | GET | **96 ms** | **2.45 KB** | none | none |
| `/api/fees` | GET | **92 ms** | **1.12 KB** | none | none |
| `/api/settings` | GET | **223 ms** | **0.49 KB** | none | none |

### B. Frontend Page Load Baseline (Production Bundle Preview)
| Page | Route | FCP (First Contentful Paint) | DOMContentLoaded | Load Event Complete | Transferred JS Size | Decoded JS Size |
|---|---|---|---|---|---|---|
| Login Page | `/login` | **784 ms** | **465 ms** | **580 ms** | **272.7 KB** | **1,194.1 KB** |
| Admin Dashboard | `/admin/dashboard` | **531 ms** | **543 ms** | **667 ms** | (SPA shared bundle) | **1,194.1 KB** |
| Students Directory | `/admin/students` | **155 ms** | **395 ms** | **404 ms** | (SPA shared bundle) | **1,194.1 KB** |

### C. Build & Bundle Baseline
- Initial monolithic JavaScript chunk: **1,194.12 kB** (`dist/assets/index-C-vik_65.js`)
- CSS bundle: **133.09 kB** (`dist/assets/index-DP9G1e4Q.css`)
- Vite build warning: `(!) Some chunks are larger than 500 kB after minification.`

---

## 3. Audited Issues Mapped to the 5 Causes

### Cause 1: Uncompressed or Bloated API Responses
- **Missing Compression Middleware**:
  - `backend/src/app.ts`: No compression middleware (gzip/brotli) is mounted. All JSON payloads are transmitted over the wire uncompressed in plaintext.
- **Unbounded Collections & Missing Pagination**:
  - `backend/src/services/student.service.ts` (`listStudents`): Returns all student records unbounded without `limit`/`page` pagination or field filtering.
  - `backend/src/services/fee.service.ts` (`listStudentFees`): Returns full student fee records joining full student profile and fee plan objects with no pagination limit.
  - `backend/src/services/batch.service.ts` (`listBatches`): Returns all batches with all active student arrays unbounded.
- **Accidental Bloat**:
  - `backend/src/services/dashboard.service.ts`: Pulls deep nested objects (`students!inner(batch_students(batches(...)))`) without row constraints.

### Cause 2: Saving Data One Row at a Time
- **Sequential Single-Row Database Calls**:
  - `backend/src/scripts/seedGurukulDemo.ts`:
    - Lines 52–61: `for (const c of coachData)` performs individual `select().maybeSingle()` followed by `insert().single()` for every coach.
    - Lines 109–122: `for (const bDef of batchDefinitions)` performs individual queries and inserts row-by-row.
    - Lines 124–135: `for (const b of batches)` assigns coaches one-by-one.
    - Lines 204–226: `for (let i = 0; i < athletes.length; i++)` queries and inserts athletes row-by-row, then awaits batch assignments row-by-row.
    - Lines 233–260: `for (let i = 0; i < studentRecords.length; i++)` checks and inserts student fees row-by-row.
  - `backend/src/services/attendance.service.ts`:
    - Lines 295–320: Sequential loop for background notifications.

### Cause 3: One Slow Call Eats the Whole Request
- **Redundant Expensive Database Round-Trips**:
  - `backend/src/services/dashboard.service.ts` (`getAdminKPIs`): Executes 12 separate Supabase queries concurrently, plus a secondary historical query for follow-ups, every time any user visits the dashboard. Over WAN to Supabase, this adds 250–350ms of network latency on every hit. There is zero in-memory caching for aggregated KPIs.
  - `backend/src/services/settings.service.ts` (`getSettings`): Fetches academy settings from Supabase on every single page load via `SettingsContext` (~223 ms avg). The settings record changes once in months, yet consumes a full database round-trip every time.
- **Missing Database Indexes**:
  - Queries on `student_fees` filtering by `(student_id, billing_period)` and `(billing_period, status)`.
  - Queries on `attendance` filtering by `(batch_id, date)`.

### Cause 4: UI Waits for the Backend Before Showing Anything
- **Zero Query Cache Freshness (`staleTime: 0`)**:
  - `frontend/src/App.tsx`: `new QueryClient()` instantiated without configuration. Every route navigation or window focus marks data stale immediately, causing visual flickers and redundant background refetches.
- **Monolithic Frontend Bundle & No Code-Splitting**:
  - `frontend/src/App.tsx`: All admin, teacher, and auth pages, plus `pdf-lib` and all icon sets, are imported synchronously at the top level. The browser must download and parse 1.2 MB of JS before rendering the first pixel.
- **Full-Screen Loading Spinners**:
  - `frontend/src/pages/admin/AdminDashboard.tsx`, `StudentsPage.tsx`, `BatchesPage.tsx`: Display blocking spinners instead of skeleton layouts during query resolution.

### Cause 5: Pages Regenerated for Every Visitor / Missing Cache Headers
- **Missing Cloudflare Edge & Static Asset Cache Headers**:
  - `frontend/public/_headers`: Contains security headers (`X-Frame-Options`, `nosniff`), but completely lacks `Cache-Control` headers for `/assets/*` (hashed immutable JS/CSS) and `/*` (HTML freshness).
- **No Vite Manual Chunking**:
  - `frontend/vite.config.ts`: Lacks Rollup `manualChunks` optimization, forcing vendor dependencies (`react`, `react-dom`, `@tanstack/react-query`, `lucide-react`, `pdf-lib`, `@supabase/supabase-js`) into the single monolithic app bundle.

---

## 4. Fix Phases

### Phase 1: Enable Compression & Optimize API Payloads (Cause 1)
- **Files to Change**:
  - `backend/package.json`: Add `compression` and `@types/compression`.
  - `backend/src/app.ts`: Register `compression()` middleware.
  - `backend/src/services/student.service.ts`: Add optional pagination support (`limit`, `page`/`offset`) with safe defaults while preserving complete backward compatibility.
  - `backend/src/services/fee.service.ts`: Add pagination and projection optimizations to `listStudentFees`.
- **Expected Effect**:
  - Response payloads compressed with gzip/brotli (`Content-Encoding: gzip`).
  - Wire transfer size reduced by 60%–85% on JSON responses.
- **Verification**:
  - Verify `Content-Encoding: gzip` in HTTP response headers.
  - Measure response size in KB before vs after using `measureBaseline.ts`.
  - Run `npm run test:crm` and `npm run test:auth` to ensure 100% backward compatibility.

### Phase 2: Batching & Bulk Operations (Cause 2)
- **Files to Change**:
  - `backend/src/scripts/seedGurukulDemo.ts`: Replace row-by-row `select` and `insert` loops with batched lookups (`.in(...)`) and bulk operations (`insertMany` / multi-row `.upsert(...)`).
- **Expected Effect**:
  - Seeding / batch write time reduced by 5x–10x.
- **Verification**:
  - Time the operation before and after with a benchmark script.
  - Verify all seeded data matches expected counts.

### Phase 3: In-Memory TTL Caching & Query Optimization (Cause 3)
- **Files to Change**:
  - `backend/src/services/cache.service.ts`: Create a lightweight in-memory TTL cache with tag-based invalidation.
  - `backend/src/services/settings.service.ts`: Cache `academy_settings` with a 5-minute TTL, invalidating on `updateSettings`.
  - `backend/src/services/dashboard.service.ts`: Cache `getAdminKPIs` with a 30-second TTL, invalidating on fee/attendance/student modifications.
- **Expected Effect**:
  - Response time for repeated `/api/settings` drops from ~223ms to < 5ms.
  - Response time for repeated `/api/dashboard/admin` drops from ~263ms to < 10ms.
- **Verification**:
  - Measure endpoint latency before vs after with `measureBaseline.ts`.
  - Confirm dashboard immediately reflects data changes when cache is invalidated.

### Phase 4: UI Non-Blocking Optimization & Client-Side Caching (Cause 4)
- **Files to Change**:
  - `frontend/src/App.tsx`:
    - Configure `QueryClient` with sensible `defaultOptions` (`staleTime: 60 * 1000`, `gcTime: 10 * 60 * 1000`, `refetchOnWindowFocus: false`).
    - Implement route-based code-splitting using `React.lazy` and `Suspense` with `SkeletonLoader` for all major pages (`AdminDashboard`, `StudentsPage`, `BatchesPage`, `AttendancePage`, `FeesPage`, `SettingsPage`, etc.).
  - `frontend/src/components/common/SkeletonLoader.tsx`: Ensure clean skeleton layouts.
- **Expected Effect**:
  - Initial JS bundle downloaded on first load reduced from 1,194 KB down to < 200 KB.
  - Navigating between visited pages is instantaneous with zero flash or spinner due to TanStack Query client caching.
- **Verification**:
  - Measure FCP and bundle transfer size on `/login` and `/admin/dashboard` using Puppeteer.
  - Confirm all routes load seamlessly without broken layouts.

### Phase 5: Static Asset Caching, Chunk Splitting & Edge Headers (Cause 5)
- **Files to Change**:
  - `frontend/vite.config.ts`: Configure `manualChunks` in Rollup build options to split vendor dependencies (`vendor-react`, `vendor-query`, `vendor-supabase`, `vendor-pdflib`, `vendor-icons`).
  - `frontend/public/_headers`: Add explicit Cloudflare Pages caching rules:
    - `/assets/*`: `Cache-Control: public, max-age=31536000, immutable`
    - `/*`: `Cache-Control: public, max-age=0, must-revalidate`
- **Expected Effect**:
  - Browser and Cloudflare edge cache immutable JS/CSS chunks indefinitely.
  - Subsequent page navigations and repeat visits load instantly from disk/memory cache.
- **Verification**:
  - Run `npm run build` and verify chunk sizes.
  - Check HTTP response headers of static assets for `Cache-Control: public, max-age=31536000, immutable`.
  - Measure repeat-visit load times.

---

## 5. Results Table (Updated After Each Phase)

| Phase | Metric / Description | Before | After | Status |
|---|---|---|---|---|
| **Phase 1** | `/api/dashboard/admin` size & encoding | 4.53 KB (none) | **1.21 KB (br/gzip)** (-73%) | **COMPLETED** |
| | `/api/students` size & encoding | 2.24 KB (none) | **0.78 KB (br/gzip)** (-65%) | **COMPLETED** |
| | `/api/batches` size & encoding | 2.45 KB (none) | **0.82 KB (br/gzip)** (-66%) | **COMPLETED** |
| | `/api/fees` size & encoding | 1.12 KB (none) | **0.41 KB (br/gzip)** (-63%) | **COMPLETED** |
| | `/api/settings` size & encoding | 0.49 KB (none) | **0.28 KB (br/gzip)** (-43%) | **COMPLETED** |
| **Phase 2** | Batch data operation (500 items benchmark) | 15,703 ms (row-by-row awaits) | **179 ms (batched bulk)** (87.6x faster) | **COMPLETED** |
| **Phase 3** | `/api/settings` response time | 223 ms | **66 ms avg (cached 3 ms)** (-70%) | **COMPLETED** |
| | `/api/dashboard/admin` response time | 263 ms | **93 ms avg (cached 10 ms)** (-65%) | **COMPLETED** |
| **Phase 4** | Initial JS App Bundle size | 1,194.1 KB (272.7 KB gzip) | **101.5 KB (29.3 KB gzip)** (-91.5%) | **COMPLETED** |
| | Total Initial Transfer on `/login` | 1,067.7 KB | **178.9 KB** (-83.2%) | **COMPLETED** |
| | Login Page FCP | 784 ms | **220 ms** (-72.0%) | **COMPLETED** |
| | DOMContentLoaded | 465 ms | **148 ms** (-68.2%) | **COMPLETED** |
| | Route transition time | Blank/spinner flash | **Instant (< 50ms, Query Cache)** | **COMPLETED** |
| **Phase 5** | Static Asset Cache-Control Header | None / default | **`public, max-age=31536000, immutable`** | **COMPLETED** |
| | HTML Document Cache-Control | None / default | **`public, max-age=0, must-revalidate`** | **COMPLETED** |
| | Max chunk size warning (>500KB) | FAILED (1,194 KB monolithic chunk) | **PASSED: 0 chunks > 500KB** (clean build) | **COMPLETED** |
| | Repeat-visit Load Complete | 580 ms | **76 ms** (-86.9%) | **COMPLETED** |

---

## 6. Files Changed Per Phase

### Phase 1: Enable Compression & Optimize API Payloads
- `backend/package.json` & `backend/package-lock.json`: Added `compression` middleware and `@types/compression`.
- `backend/src/app.ts`: Mounted `compression({ threshold: 256 })` middleware.
- `backend/src/controllers/student.controller.ts`: Added optional `limit` and `page` query parameters.
- `backend/src/services/student.service.ts`: Implemented database range pagination.
- `backend/src/controllers/fee.controller.ts`: Added optional `limit` and `page` query parameters.
- `backend/src/types/fee.types.ts`: Added pagination fields to `StudentFeeFilterQuery`.
- `backend/src/services/fee.service.ts`: Implemented database range pagination.

### Phase 2: Batching & Bulk Operations
- `backend/src/scripts/seedGurukulDemo.ts`: Replaced sequential row-by-row queries and inserts with batched lookups (`.in()`) and multi-row inserts/upserts.
- `backend/src/scripts/benchmarkBatchWrite.ts`: Automated reproducible benchmark script measuring 500 records before vs after.

### Phase 3: In-Memory TTL Caching & Slow Call Remediation
- `backend/src/utils/cache.ts`: Created lightweight, thread-safe in-memory TTL cache with tag-based invalidation.
- `backend/src/services/settings.service.ts`: Cached `academy_settings` with 5-minute TTL, invalidating on `updateSettings`.
- `backend/src/services/dashboard.service.ts`: Cached `getAdminKPIs` with 30-second TTL, reducing 12 simultaneous database round-trips to in-memory lookup.
- `backend/src/services/student.service.ts`: Invalidate `'dashboard'` cache tag on student creation, modification, or deletion.
- `backend/src/services/attendance.service.ts`: Invalidate `'dashboard'` cache tag on bulk attendance marking.
- `backend/src/services/fee.service.ts`: Invalidate `'dashboard'` cache tag on fee assignment or update.

### Phase 4: UI Non-Blocking Optimization & Client-Side Caching
- `frontend/src/App.tsx`:
  - Configured `QueryClient` with `staleTime: 60_000` (60s) and `gcTime: 600_000` (10m) to eliminate unnecessary refetches and spinner flickers.
  - Implemented route-based code-splitting with `React.lazy()` for all 20+ admin, teacher, and dashboard pages.
- `frontend/src/components/layout/AppLayout.tsx`:
  - Wrapped router `<Outlet />` in `React.Suspense` with `TableSkeleton` for instant structural rendering during chunk transitions.

### Phase 5: Static Asset Caching, Chunk Splitting & Edge Headers
- `frontend/vite.config.ts`:
  - Configured Rollup `manualChunks` to split vendor dependencies into granular bundles (`vendor-react`, `vendor-query`, `vendor-supabase`, `vendor-icons`, `vendor-pdflib`).
  - Added preview proxy configuration for local verification.
- `frontend/public/_headers`:
  - Defined explicit Cloudflare Pages edge cache rules:
    - `/assets/*`: `Cache-Control: public, max-age=31536000, immutable` (1 year cache).
    - `/*`: `Cache-Control: public, max-age=0, must-revalidate` (instant update freshness).

---

## 7. Items Not Modifiable or Requiring User Decision

1. **Database Geographic Latency (Render Singapore to Supabase Singapore)**:
   - Supabase database is hosted in Singapore (`litnduotmypvhnorjnwa.supabase.co`) and Render is hosted in Singapore. When tested from local machine in India, baseline round-trip WAN latency adds ~60-80ms per un-cached network request. In production on Render Singapore, this will run in < 15ms.
   - *Recommendation*: Keep existing free-tier regional alignment.
2. **Hardcoded Secrets Identified (Action Item for User)**:
   - Credentials detected in `render.yaml`, `RENDER_DEPLOYMENT_ARCHITECTURE.md`, `backend/src/scripts/testLogin.ts`.
   - *Recommendation*: Migrate hardcoded credentials to environment variables (`.env`) in deployment settings. No changes to paid plans or infrastructure were made.

---

## 8. Live Cloudflare Pages Deployment Verification

- **Target URL**: [https://gurukul-sports-academy.pages.dev](https://gurukul-sports-academy.pages.dev)
- **Deployment Hash**: `https://243e6698.gurukul-sports-academy.pages.dev`
- **Deployment Tool**: Wrangler CLI (`wrangler pages deploy dist --project-name gurukul-sports-academy`)
- **Status**: **LIVE & VERIFIED (HTTP 200)**
- **Edge Cache Validation**:
  - `curl -I https://gurukul-sports-academy.pages.dev` -> `Cache-Control: public, max-age=0, must-revalidate` (HTML is fresh on every reload)
  - `curl -I https://gurukul-sports-academy.pages.dev/assets/index-DyCI0wm0.js` -> `Cache-Control: public, max-age=31536000, immutable` (Cloudflare edge & browser disk cache 1 year)



