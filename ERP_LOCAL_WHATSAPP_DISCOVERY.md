# 🥋 Gurukul Sports Academy — ERP & Local WhatsApp Integration Discovery Report
*Document: ERP_LOCAL_WHATSAPP_DISCOVERY.md*  
*Timestamp: 2026-10-22*  
*Inspection Mode: Strict Read-Only Discovery (Zero Modifications)*

---

## 1. Executive Summary

This technical discovery report documents the exact architecture, code pathways, runtime deployment, and operational lifecycle of the **Gurukul Sports Academy Management ERP** and its **WhatsApp integration**.

### Key Findings
1. **ERP Core:** The ERP is a full-featured Academy Management System built with a **Node.js/Express (TypeScript)** backend, a **React 18 / Vite / Tailwind** frontend, and a **Supabase PostgreSQL 17** dedicated database.
2. **Current WhatsApp Provider:** The system does **not** use the official WhatsApp Business Cloud API. It uses **OpenWA**, a self-hosted gateway utilizing the **Baileys multi-device WebSocket engine** (`@whiskeysockets/baileys`).
3. **Deployment Location:** The WhatsApp gateway is **not currently running as a local background process on this Windows PC**. It is deployed on **Render Cloud** as a Dockerized NestJS service (`https://gurukul-openwa-bridge-a0m4.onrender.com`). The ERP backend communicates with it over private HTTPS REST endpoints.
4. **Current Connection State:** The remote OpenWA bridge is **ONLINE and RESPONDING**, but the active WhatsApp session (`gurukul-session`) is in **`QR_READY`** state (`phoneNumber: null`). It is currently awaiting pairing via QR scan.
5. **Session Durability Risk:** The OpenWA bridge is configured with `STORAGE_TYPE: local` and SQLite (`sqlite.db`) inside a Render free/ephemeral container. Container sleep cycles or redeployments wipe local session files, forcing a re-scan.
6. **Inbound Messaging:** **Completely missing.** The ERP is purely an **outbound notification system**. No webhook route, incoming event parser, sender matcher, or AI reply handler exists in the backend.

---

## 2. Verified System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Cloudflare Pages Frontend                       │
│                 https://gurukul-sports-academy.pages.dev               │
│                  (React 18 + Vite + Tailwind + PWA)                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / JWT Auth
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 Account 1: Render Backend Web Service                  │
│                https://gurukul-sports-backend.onrender.com             │
│                       (Node.js 22 + TypeScript)                        │
└──────────────┬──────────────────────────────────────────┬──────────────┘
               │                                          │
               │ PostgreSQL Connection                    │ HTTPS REST (API Key / Bearer)
               ▼                                          ▼
┌──────────────────────────────┐ ┌───────────────────────────────────────┐
│     Supabase PostgreSQL      │ │  Account 2: Render WhatsApp Bridge    │
│  litnduotmypvhnorjnwa.co     │ │  gurukul-openwa-bridge-a0m4.onrender  │
│ (Tables: students, batches,  │ │      (Docker + NestJS + Baileys)      │
│  student_fees, attendance,   │ └──────────────────┬────────────────────┘
│  whatsapp_queue, settings)   │                    │
└──────────────────────────────┘                    │ WebSocket (Noise Protocol)
                                                    ▼
                                 ┌───────────────────────────────────────┐
                                 │       WhatsApp Linked Device          │
                                 │      (Academy Smartphone App)         │
                                 └───────────────────────────────────────┘
```

---

## 3. ERP and WhatsApp Service Map

| Service Name | Technology / Runtime | Hosting / Port | Primary Role | Source Reference |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide | Cloudflare Pages (`https://gurukul-sports-academy.pages.dev`) | Admin & Teacher Portal UI, WhatsApp QR display, attendance, billing | `frontend/src/` |
| **ERP Backend** | Node.js 22, Express 4.21, TypeScript 5.7 | Render (`srv-daravid9fdbs73foear0`), Port `10000` | Core CRM logic, RBAC, PDF generation, transactional queue | `backend/src/app.ts` |
| **Database** | PostgreSQL 17 (Supabase) | Supabase Cloud (`litnduotmypvhnorjnwa.supabase.co`) | Schema storage, RLS enforcement, settings, message logs | `backend/migrations/` |
| **WhatsApp Gateway** | Docker, NestJS, Baileys Engine | Render (`srv-darc5pou01pc73bbema0`), Port `2785` | Manages WhatsApp Web multi-device socket, generates QR codes | `RENDER_DEPLOYMENT_ARCHITECTURE.md` |
| **Local Workspace** | Windows 11 PC (`desktop-sds6p90`) | Local Path (`GURUKUL SPORTS ACADEMY`) | Code repository, developer CLI, agent workspace | Active Workspace |

---

## 4. Local WhatsApp Provider Identification

Inspection of [backend/src/services/whatsapp/whatsappProvider.factory.ts](file:///c:/Users/ADMIN/OneDrive/Desktop/GURUKUL%20SPORTS%20ACADEMY/backend/src/services/whatsapp/whatsappProvider.factory.ts) and [backend/.env](file:///c:/Users/ADMIN/OneDrive/Desktop/GURUKUL%20SPORTS%20ACADEMY/backend/.env) reveals a factory pattern supporting four provider types:

1. **`openwa` (ACTIVE):**
   * **Implementation:** [backend/src/services/whatsapp/openWaProvider.ts](file:///c:/Users/ADMIN/OneDrive/Desktop/GURUKUL%20SPORTS%20ACADEMY/backend/src/services/whatsapp/openWaProvider.ts)
   * **Active Setting:** `WHATSAPP_PROVIDER=openwa` in `backend/.env`.
   * **Mechanism:** HTTP client connecting to an OpenWA REST API gateway running Baileys.
   * **Endpoints Called by ERP:**
     * `GET /api/sessions`: List active sessions on the bridge.
     * `POST /api/sessions`: Initialize session `gurukul-session`.
     * `GET /api/sessions/:id/qr`: Fetch current base64 QR code.
     * `POST /api/sessions/:id/start`: Boot session engine.
     * `POST /api/sessions/:id/chats/send-state`: Anti-ban presence simulation (typing indicator for 0.8s–1.4s).
     * `POST /api/sessions/:id/messages/send-text`: Dispatch text message.
     * `POST /api/sessions/:id/messages/send-document`: Dispatch base64 PDF receipt/report.
     * `POST /api/sessions/:id/logout`: Unlink phone and terminate session.
     * `POST /api/sessions/:id/stop`: Stop WebSocket.

2. **`prototype_linked_device` (STANDBY / ALTERNATIVE):**
   * **Implementation:** [backend/src/services/whatsapp/prototypeLinkedDeviceSender.ts](file:///c:/Users/ADMIN/OneDrive/Desktop/GURUKUL%20SPORTS%20ACADEMY/backend/src/services/whatsapp/prototypeLinkedDeviceSender.ts)
   * **Mechanism:** Designed for a lightweight custom bridge running either locally on `http://127.0.0.1:3001` or via `WHATSAPP_LINKED_DEVICE_URL`.
   * **Endpoints:** `GET /status`, `POST /connect`, `POST /disconnect`, `POST /send`.

3. **`mock` (DEVELOPMENT / DEMO):**
   * **Implementation:** `backend/src/services/whatsapp/mockWhatsAppProvider.ts`
   * **Mechanism:** In-memory fake logger used when WhatsApp is disabled or in demo mode.

4. **`meta` (UNCONFIGURED):**
   * **Implementation:** `backend/src/services/whatsapp/metaWhatsAppProvider.ts`
   * **Status:** Fallback stub for official Cloud API (currently inactive).

---

## 5. Session Storage and Connection Lifecycle

### Where Session State Lives
* The WhatsApp authentication keys and cryptographic secrets live **inside the OpenWA Docker container on Render** at `/app/sqlite.db`.
* The ERP backend does **not** store WhatsApp cryptographic keys. It only caches the session ID string (`gurukul-session`) in memory and device metadata (`device_status`, `device_phone_number`) in the Supabase table `whatsapp_settings`.

### Session Durability & Restart Behavior
* **ERP Backend Restart:** Completely safe. The ERP backend holds no socket state; restarting it does not disconnect WhatsApp.
* **OpenWA Container Sleep / Restart:** **HIGH RISK.** Because Render free web services shut down after 15 minutes of inactivity and possess ephemeral filesystems:
  * When the OpenWA container stops, all files written to local disk (including `sqlite.db`) are destroyed.
  * When awakened by HTTP traffic, OpenWA starts fresh with an empty database.
  * Because `AUTO_START_SESSIONS=true`, it immediately initializes a new session named `gurukul-session` and generates a **new QR code**, shifting to `QR_READY`.
  * **Result:** The previous linked phone is unlinked, and an admin must scan a new QR code.

### Connection Health Monitoring
* Monitored on-demand by the ERP backend via `openWaProvider.getStatus()`.
* Features a **3-second in-memory throttle cache** to prevent flooding the gateway.
* Monitored in the frontend via periodic polling in [frontend/src/pages/admin/WhatsAppPage.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/GURUKUL%20SPORTS%20ACADEMY/frontend/src/pages/admin/WhatsAppPage.tsx) (every 3.5 seconds when in `QR_READY` or `CONNECTING`).

---

## 6. Outbound Messaging Workflows

All outbound messaging flows through the transactional queue system implemented in [backend/src/services/whatsapp/queue.service.ts](file:///c:/Users/ADMIN/OneDrive/Desktop/GURUKUL%20SPORTS%20ACADEMY/backend/src/services/whatsapp/queue.service.ts) and [automation.service.ts](file:///c:/Users/ADMIN/OneDrive/Desktop/GURUKUL%20SPORTS%20ACADEMY/backend/src/services/whatsapp/automation.service.ts).

```
[ ERP Action / Service ]
          │
          ▼
[ automation.service.ts ] ──► Renders Template & Dynamic UPI Links
          │
          ▼
[ queue.service.ts ]      ──► Deduplication (SHA-256 Idempotency Key)
          │                   Persists to Supabase `whatsapp_queue`
          │
          ▼
  10 Safety Checks Passed? ──► (Opt-in, Daily Limit, Sender Connected, Emergency Stop)
          │
          ▼
[ Anti-Ban Throttle ]     ──► 2.5s–4.0s Randomized Jitter Delay
          │
          ▼
[ openWaProvider.ts ]     ──► Simulates Typing Presence (0.8s-1.4s)
          │
          ▼
[ OpenWA Gateway ]        ──► Dispatches to WhatsApp Phone Network
```

### The 10 Mandatory Safety Checks (in `queue.service.ts`):
1. `global_automation_enabled === true`
2. `emergency_stop === false`
3. `isOptedIn(student)` (Checks `students.whatsapp_opt_in`)
4. Recipient phone number validation (E.164 normalization, +91 handling)
5. Message status check (`CANCELLED` / `SENT` bypass)
6. Concurrency lock per recipient (Prevents duplicate messages to the same phone)
7. Anti-ban minimum spacing (2.5s to 4.0s randomized delay)
8. Daily limit enforcement (`daily_limit` in `whatsapp_settings`, default: 40–100)
9. Sender connection verification (`deviceStatus.status === 'CONNECTED'`)
10. Provider healthcheck verification

---

## 7. Inbound Messaging Workflows

### Comprehensive Assessment: MISSING (0% Implemented)

| Feature | Verified Status | Technical Reason |
| :--- | :--- | :--- |
| **Receive Inbound Message** | **NOT SUPPORTED** | No HTTP webhook endpoint exists on the ERP backend to receive incoming events. |
| **Sender Identification** | **NOT SUPPORTED** | No incoming webhook listener or parser exists. |
| **Parent/Student Matching** | **NOT SUPPORTED** | Phone lookup logic exists for outbound queries only, not inbound webhooks. |
| **Spam / Unauthorized Filter** | **NOT SUPPORTED** | No webhook ingress gateway. |
| **Workflow Routing** | **NOT SUPPORTED** | No intent parser or command dispatcher. |
| **AI-Generated Reply** | **NOT SUPPORTED** | No LLM interaction loop or prompt pipeline configured for WhatsApp. |
| **Media Handling (Inbound)** | **NOT SUPPORTED** | Outbound PDF only; inbound media downloading is not implemented. |

### How Inbound Could Be Added Without Replacing OpenWA:
OpenWA has native webhook support (`WEBHOOK_URL`). To implement inbound messaging:
1. Expose a public route in the ERP backend: `POST /api/whatsapp/webhook`.
2. Secure it using an shared HMAC signature or secret header (`x-api-key`).
3. Parse incoming Baileys messages (`messages.upsert` event).
4. Extract sender phone, normalize with `normalizePhoneNumber()`, and query `students` / `teachers` tables.
5. Store the incoming message in an audit table `whatsapp_inbox`.
6. Dispatch to an AI agent (Gemini) or automated rule engine for context-aware responses.

---

## 8. ERP Feature Integration Status

| Workflow | Triggering Action / Event | Handling Backend Service & Function | Data Sources | Delivery Endpoint | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Absent Attendance** | Teacher marks student ABSENT in daily roll call | `attendance.service.ts` -> `triggerAbsentAttendanceAutomation()` | `students`, `batches`, `attendance` | `POST /messages/send-text` | **Fully Operational** (when connected) |
| **Attendance Correction** | Teacher corrects ABSENT status to PRESENT | `attendance.service.ts` -> `triggerAttendanceCorrectionAutomation()` | `students`, `batches` | `POST /messages/send-text` | **Fully Operational** (when connected) |
| **Payment Confirmation** | Payment recorded via Cash/UPI in Fees tab | `payment.service.ts` -> `triggerPaymentSuccessAutomation()` | `students`, `payments`, `student_fees` | `POST /messages/send-text` | **Fully Operational** (when connected) |
| **Fee Receipt PDF** | Admin clicks "Send Receipt" on fee record | `receipt.controller.ts` -> `sendFeeReceiptPdf()` | `receipts`, `pdfReport.service.ts` | `POST /messages/send-document` | **Fully Operational** (when connected) |
| **Monthly Fee Reminders** | Admin clicks "Trigger Monthly Reminders" | `whatsapp.controller.ts` -> `triggerMonthly5thFeeDueAutomation()` | `students`, `student_fees`, `academy_settings` | `POST /messages/send-text` | **Fully Operational** (Manual trigger) |
| **Multi-Stage Fee Cadence** | Admin clicks "Trigger Cadence" | `whatsapp.controller.ts` -> `triggerMultiStageFeeCadenceAutomation()` | `student_fees` (Due, Overdue, Urgent) | `POST /messages/send-text` | **Fully Operational** (Manual trigger) |
| **Student Welcome** | New student admission registered | `student.service.ts` -> `triggerStudentWelcomeAutomation()` | `students`, `academy_settings` | `POST /messages/send-text` | **Fully Operational** (when connected) |
| **Batch Enrollment** | Student enrolled into a training batch | `batch.service.ts` -> `triggerBatchStudentEnrolledAutomation()` | `students`, `batches` | `POST /messages/send-text` | **Fully Operational** (when connected) |
| **Teacher Welcome** | New Sensei/Coach profile created | `teacher.service.ts` -> `triggerTeacherWelcomeAutomation()` | `teachers`, `profiles` | `POST /messages/send-text` | **Fully Operational** (when connected) |
| **Monthly PDF Report** | Admin clicks "Send Monthly Report" | `whatsapp.controller.ts` -> `sendStudentMonthlyReport()` | `attendance`, `ranks`, `pdfReport.service.ts` | `POST /messages/send-document` | **Fully Operational** (when connected) |
| **Student Portal Invite** | Admin triggers portal invite | `studentPortal.service.ts` -> `triggerStudentInvite()` | `students`, `student_pins` | `POST /messages/send-text` | **Fully Operational** (when connected) |
| **Parent Inbound Replies** | Parent replies on WhatsApp | None | None | None | **Missing (0%)** |
| **AI Inbound Agent** | Customer asks questions on WhatsApp | None | None | None | **Missing (0%)** |
| **Automated Daily Cron** | Scheduled timer for fee reminders | None (No `node-cron` or background daemon running in container) | None | None | **Missing (Manual UI trigger only)** |

---

## 9. Runtime and Deployment Health

Diagnostic execution on 2026-10-22 verified the live status of all endpoints:

```
[LIVE RUNTIME DIAGNOSTIC OUTPUT]
Backend Target URL : https://gurukul-sports-backend.onrender.com/api/health
HTTP Status        : 200 OK (Status: ok, Environment: production)

Bridge Target URL  : https://gurukul-openwa-bridge-a0m4.onrender.com/health
HTTP Status        : 200 OK (OpenWA Gateway active)

Active Adapter     : OPENWA
Adapter Result     : {
  status           : "QR_READY",
  isConfigured     : true,
  phoneNumber      : "none",
  hasQrCode        : true,
  sessionStatus    : "Session gurukul-session is qr_ready",
  details          : "Active on https://gurukul-openwa-bridge-a0m4.onrender.com via WhatsApp"
}
```

### Risk Assessment of Current Runtime:
1. **Render Free Tier Spin-Down:** If no HTTP requests hit the bridge for 15 minutes, Render suspends the container.
2. **Loss of Session State:** When the container suspends, Render destroys the container filesystem. The bridge reboots with an unauthenticated session, regenerating a QR code.
3. **No Active Message Loss:** Outbound messages sent while WhatsApp is disconnected remain safe in `whatsapp_queue` with status `PENDING` due to Safety Check 9.

---

## 10. Exact Connection and Recovery Procedure

### A. Initial Setup (Already Complete)
* Backend environment variables in Account 1 are properly configured:
  * `WHATSAPP_PROVIDER=openwa`
  * `OPENWA_API_URL=https://gurukul-openwa-bridge-a0m4.onrender.com`
  * `OPENWA_API_KEY=[CONFIGURED]`
* OpenWA Docker service on Account 2 is properly deployed and operational.

### B. Normal Daily Operation
1. The OpenWA bridge maintains an active WebSocket session with WhatsApp servers.
2. When an attendance or fee event occurs, the ERP calls OpenWA over HTTPS to dispatch messages.

### C. How to Check Connection Status
* **In the ERP UI:** Open `/admin/whatsapp`.
  * **Green Badge (`CONNECTED`):** Device linked and operational. Displays connected phone number.
  * **Yellow Badge (`QR_READY`):** Session active, waiting for phone pairing. Displays QR code.
  * **Red Badge (`DISCONNECTED`):** Bridge offline or session stopped.
* **Via Backend Diagnostic:** Run `npm run wa:check` inside the `backend` folder.

### D. Which Machine Must Remain Running
* **Current Cloud Setup:** No local computer needs to remain on. Both services reside on Render. However, keeping the Render free instance awake requires periodic keep-alive traffic (e.g., via [scripts/keepAlive.mjs](file:///c:/Users/ADMIN/OneDrive/Desktop/GURUKUL%20SPORTS%20ACADEMY/scripts/keepAlive.mjs) or an external uptime monitor like UptimeRobot).
* **If Moved to Local PC:** If the bridge were run locally on `127.0.0.1:3001` or `127.0.0.1:2785`, the local PC would have to remain powered on 24/7.

### E. What Happens When ERP Server Restarts
* The ERP backend does not hold the WhatsApp socket. Restarting the ERP server causes zero downtime for the WhatsApp session.

### F. What Happens When WhatsApp Disconnects
* If the smartphone unlinks the device or goes offline for >14 days:
  1. Bridge shifts to `DISCONNECTED` or `QR_READY`.
  2. ERP queue halts dispatch; pending notifications remain safely queued in Supabase (`status: 'PENDING'`).
  3. No spam or crashes occur.

### G. How to Recover a Failed Connection Safely
1. Navigate to `/admin/whatsapp` in the ERP frontend.
2. If status is `QR_READY`, the live QR code is displayed on screen.
3. Open WhatsApp on your smartphone -> **Settings** -> **Linked Devices** -> **Link a Device**.
4. Scan the QR code displayed on the screen.
5. The frontend polls `/api/whatsapp/status` every 3.5 seconds; once scanned, the UI automatically updates to **`CONNECTED`**.
6. Once connected, open the Queue tab and click **Process Queue** to release held notifications.

### H. How to Verify Outbound Without Contacting Real Customers
* Use the **Send Test Message** form on `/admin/whatsapp`. Enter the developer or academy owner's personal test mobile number.
* Alternatively, switch `provider_type` to `'mock'` in `whatsapp_settings` to log messages without physical dispatch.

### I. How to Verify Inbound Processing Safely
* When inbound processing is implemented, simulate inbound Baileys events by POSTing synthetic JSON payloads to `/api/whatsapp/webhook` using Postman or `curl`.

---

## 11. Missing Features and Risks

1. **Session Volatility (Render Ephemeral Disk):**  
   *Render free web services lack persistent volumes.* Every container restart wipes `/app/sqlite.db`, breaking the WhatsApp session.
2. **Missing Inbound Webhook:**  
   The ERP cannot receive incoming parent messages or student replies.
3. **No Automatic Background Cron:**  
   Fee reminders (5th of month due, 10th overdue) currently require an admin to manually click buttons in the UI. There is no automated cron runner executing inside the container.
4. **WhatsApp Ban Risk (Meta Policy):**  
   Using Baileys on a high-volume personal WhatsApp number violates Meta Terms of Service. While the ERP includes typing simulation and 2.5s–4.0s jitter delays, keeping volume under 50–100 messages/day is essential.

---

## 12. Recommended Next Steps

1. **Fix Session Persistence on Render (Zero-Cost Option):**
   * *Option A (Keep-Alive Cron):* Set up a free external uptime monitor (e.g., UptimeRobot, cron-job.org) pinging `https://gurukul-openwa-bridge-a0m4.onrender.com/health` every 4 minutes to prevent Render from sleeping.
   * *Option B (Supabase Auth State Storage):* Mirror the Baileys session storage into Supabase PostgreSQL (as prototyped in `amit_academy_crm/wa-bridge/src/supabaseAuthState.ts`). This allows credentials to survive any container reboot.
2. **Initial Pairing:**
   * Open `/admin/whatsapp` and scan the active `QR_READY` QR code once to link the academy phone.
3. **Implement Inbound Webhook Route:**
   * Create `POST /api/whatsapp/webhook` to capture parent questions, payment screenshots, and absent excuses.
4. **Automated Scheduled Cron:**
   * Implement a lightweight scheduler (or Supabase pg_cron / GitHub Actions cron) to automatically call `/api/whatsapp/remind/fee-cadence` on the 5th, 10th, and 15th of each month.

---

## 13. Safe Testing Plan

To test without breaking existing functionality, scan-locking, or sending unwanted customer messages:

1. **Verify Live Bridge Connectivity:**  
   Execute `npm run wa:check` in `backend/`. (Confirmed passing: Bridge is online and responsive).
2. **Verify Frontend Status Display:**  
   Open the ERP Admin dashboard at `/admin/whatsapp` and verify the QR code renders cleanly.
3. **Test Pairing (Manual Owner Action):**  
   Academy admin scans QR code via WhatsApp Linked Devices on their smartphone.
4. **Isolated Test Message:**  
   Use `/admin/whatsapp` test message tool to send a test message exclusively to the admin's verified phone number.
5. **Verify Safety Cutoffs:**  
   Toggle `emergency_stop: true` in `whatsapp_settings` and verify that test messages remain safely queued and are blocked from transmission.

---

## 14. Verified Facts vs. Unverified Assumptions

| Item | Status | Evidence / Verification Method |
| :--- | :--- | :--- |
| **Active WhatsApp Provider** | **Verified Fact** | Explicitly configured as `openwa` in `backend/.env` and loaded by `whatsappProvider.factory.ts`. |
| **Bridge Location** | **Verified Fact** | `https://gurukul-openwa-bridge-a0m4.onrender.com` responded with HTTP 200 to live probe. |
| **Current Device State** | **Verified Fact** | Adapter returned live state: `status: 'QR_READY'`, `hasQrCode: true`, `phoneNumber: 'none'`. |
| **Local Machine Role** | **Verified Fact** | Windows PC runs no background WhatsApp or Node daemons (no listening ports on 2785, 3000, 3001, 10000). |
| **Inbound Webhook Support** | **Verified Fact** | Full code search across `backend/src/routes/` confirms zero WhatsApp webhook routes exist. |
| **Transactional Safety Checks** | **Verified Fact** | Verified in `queue.service.ts` (10 checks: opt-in, daily limits, anti-ban jitter, emergency stop). |
| **Session Ephemerality Cause** | **Verified Fact** | `RENDER_DEPLOYMENT_ARCHITECTURE.md` defines `STORAGE_TYPE: local` and `DATABASE_TYPE: sqlite` on Render free tier. |
