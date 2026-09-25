# 🥋 GURUKUL SPORTS ACADEMY — DUAL RENDER CLOUD ARCHITECTURE
*Document Version: 2.0 (Dual-Account Zero-Downtime Infrastructure)*

---

## 📌 Executive Summary
To prevent service sleep interruptions and guarantee **1,500 total free hours per month** (750 hrs + 750 hrs), the production deployment is split cleanly across **two independent Render accounts**:

```
[ Cloudflare Pages Frontend ]
https://gurukul-sports-academy.pages.dev
             │
             ▼  (HTTPS / JWT Bearer)
[ Account 1: gurukul-sports-backend ]
https://gurukul-sports-backend.onrender.com
             │
             ▼  (Private HTTPS / Master Key Auth)
[ Account 2: gurukul-openwa-bridge ]
https://gurukul-openwa-bridge-a0m4.onrender.com
```

---

## 🏛️ Account & Service Matrix

### 🟢 ACCOUNT 1 (Main Academy Backend API)
- **Account Email**: `mindpuzzeler.business@gmail.com`
- **Render Owner ID**: `tea-dar4l7h42hec73cvnjig`
- **Render API Key**: `rnd_QeMl6gY1sdSjEzNJMX3qNGlkolVH`
- **Service Name**: `gurukul-sports-backend`
- **Service ID**: `srv-daravid9fdbs73foear0`
- **Repository**: `https://github.com/yedageshantanu-bot/gurukul-sports-academy` (Branch: `main`, Root: `backend`)
- **Runtime**: Node.js 20+ (TypeScript / Express)
- **Internal Port**: `10000`
- **Public URL**: `https://gurukul-sports-backend.onrender.com`
- **Database**: Supabase PostgreSQL (`litnduotmypvhnorjnwa.supabase.co`)
- **Primary Duties**:
  - Handles all Admin and Teacher logins (RBAC, JWT)
  - Students, Courses, Batches, Attendance, Fees, Payments, Ranks, Tournaments
  - Direct Vector PDF Certificate Generation
  - Talks to Account 2 for WhatsApp dispatch
- **Monthly Free Hours**: **750 hours reserved 100% for Backend**

---

### 🟠 ACCOUNT 2 (WhatsApp Baileys Gateway Bridge)
- **Account Email**: `shantanu01231@gmail.com`
- **Render Owner ID**: `tea-darc4q142hec73a5mj6g`
- **Render API Key**: `rnd_PIO7OgsQm9eiU5i90IS7CuGmHKH8`
- **Service Name**: `gurukul-openwa-bridge`
- **Service ID**: `srv-darc5pou01pc73bbema0`
- **Repository**: `https://github.com/rmyndharis/OpenWA` (Branch: `main`, Root: `/`)
- **Runtime**: Docker (NestJS + Baileys Engine)
- **Internal Port**: `2785`
- **Public URL**: `https://gurukul-openwa-bridge-a0m4.onrender.com`
- **Session Storage**: SQLite (`sqlite.db`)
- **Primary Duties**:
  - Maintains persistent multi-device WhatsApp WebSocket link
  - Generates live base64 QR codes for device pairing
  - Dispatches automated attendance alerts, fee reminders, and parent broadcasts
- **Monthly Free Hours**: **750 hours reserved 100% for WhatsApp Gateway**

---

## 🔐 Inter-Service Authentication & Environment Variables

### Account 1 Environment Variables (`gurukul-sports-backend`):
- `OPENWA_API_URL`: `https://gurukul-openwa-bridge-a0m4.onrender.com`
- `OPENWA_API_KEY`: `gurukul_sports_openwa_bridge_secret_key_prod_2026`
- `WHATSAPP_LINKED_DEVICE_URL`: `https://gurukul-openwa-bridge-a0m4.onrender.com`
- `WHATSAPP_LINKED_DEVICE_TOKEN`: `gurukul_sports_openwa_bridge_secret_key_prod_2026`
- `WHATSAPP_PROVIDER`: `openwa`
- `APP_URL`: `https://gurukul-sports-academy.pages.dev,http://localhost:3000`

### Account 2 Environment Variables (`gurukul-openwa-bridge`):
- `PORT`: `2785`
- `ENGINE_TYPE`: `baileys`
- `DATABASE_TYPE`: `sqlite`
- `AUTO_START_SESSIONS`: `true`
- `STORAGE_TYPE`: `local`
- `API_MASTER_KEY`: `gurukul_sports_openwa_bridge_secret_key_prod_2026`
- `CORS_ORIGIN`: `*`
- `ALLOWED_ORIGINS`: `https://gurukul-sports-academy.pages.dev,http://localhost:3000`

---

## ⚡ Instructions For Future AI Agents & Developers
1. **Never combine both services back into a single free account**:
   - Running both 24/7 on 1 free account would require 1,440 hours, exceeding the 750-hour monthly limit.
   - The two-account architecture provides 1,500 total hours, allowing both services to run 24/7 without exhaustion.
2. **If redeploying or rotating keys**:
   - Backend changes are pushed to `yedageshantanu-bot/gurukul-sports-academy` (`main` branch) and auto-deploy to Account 1.
   - Bridge changes or restarts happen on Account 2 (`srv-darc5pou01pc73bbema0`).
   - If the Bridge URL changes, update `OPENWA_API_URL` and `WHATSAPP_LINKED_DEVICE_URL` on Account 1 (`srv-daravid9fdbs73foear0`).
