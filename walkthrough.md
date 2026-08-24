# TMV Operations Dashboard (/ops) — End-to-End Implementation Walkthrough

## Executive Summary

The **TMV Operations Dashboard** has been built end-to-end (Phase 0 through Phase 8) strictly adhering to `TMV-DASHBOARD-V3-CLAUDE-CODE-PROMPT.md`.

All code resides entirely inside the isolated [dashboard/](file:///C:/Users/MicroZaib/Desktop/TMV%20Admin%20Dashbaoard/TMV-BOT---Google-Workspace-main/dashboard) directory, with exactly four allowlisted root file edits. The dashboard coexists alongside the existing production bot and `/admin` panel on Cloud Run (`PORT=8080`, concurrency pinned to 1).

---

## 1. Verbatim Diffs for the 4 Allowlisted Files

### 1.1 `src/server.ts`
```diff
diff --git a/src/server.ts b/src/server.ts
--- a/src/server.ts
+++ b/src/server.ts
@@ -15,6 +15,8 @@ import { drainInlineQueue, registerInlineDispatcher } from "./queue/queue.servic
 import { scenarioRouter } from "./chat/scenario.routes";
 import { signatureRouter } from "./chat/signature.routes";
 import { adminRouter } from "./admin/admin.routes";
+// Dashboard router mounted from isolated dashboard directory
+const dashboardRouter: () => express.Router = require("../dashboard/server/router").dashboardRouter;
 
 const app = express();
 app.disable("x-powered-by");
@@ -136,6 +138,8 @@ app.post("/internal/sync", async (req, res) => {
   });
 });
 
+app.use("/ops", dashboardRouter());
+
 app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
   log.error("unhandled express error", error);
   res.status(500).json({ error: "Internal server error" });
```

### 1.2 `package.json`
```diff
diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -14,6 +14,8 @@
     "sweep": "curl -s -X POST -H 'Content-Type: application/json' -H \"x-tmv-worker-secret: $TMV_WORKER_SHARED_SECRET\" -d '{\"type\":\"SWEEP_STALE_EVIDENCE\"}' http://localhost:8080/internal/tasks/sweep-evidence",
     "test": "vitest run",
     "test:watch": "vitest",
+    "dashboard:build": "npm run build --prefix dashboard/web",
+    "dashboard:test": "vitest run --config dashboard/vitest.config.ts",
     "ci": "npm run typecheck && npm run test && npm run verify"
   },
   "engines": {
```

### 1.3 `Dockerfile`
```diff
diff --git a/Dockerfile b/Dockerfile
--- a/Dockerfile
+++ b/Dockerfile
@@ -8,12 +8,21 @@ COPY tsconfig.json ./
 COPY src ./src
 RUN npm run build && npm prune --omit=dev
 
+# ---- dashboard-web build ----
+FROM node:22-slim AS web-build
+WORKDIR /app/dashboard/web
+COPY dashboard/web/package*.json ./
+RUN npm ci
+COPY dashboard/web ./
+RUN npm run build
+
 # ---- runtime ----
 FROM node:22-slim
 WORKDIR /app
 ENV NODE_ENV=production
 COPY --from=build /app/node_modules ./node_modules
 COPY --from=build /app/dist ./dist
+COPY --from=web-build /app/dashboard/web/dist ./dashboard/web/dist
 COPY package.json ./
 # Drop root.
 USER node
```

### 1.4 `.env.example`
```diff
diff --git a/.env.example b/.env.example
--- a/.env.example
+++ b/.env.example
@@ -100,3 +100,10 @@ BOOTSTRAP_ON_START=true
 TMV_CALENDAR_SYNC_TTL_MS=120000
 TMV_SHEET_CACHE_TTL_MS=10000
 TMV_DRIVER_CACHE_TTL_MS=300000
+
+# --- TMV Operations Dashboard (/ops) ---
+# In-memory Stale-While-Revalidate cache TTL for dashboard batch reads (default: 30000ms / 30s)
+TMV_DASHBOARD_CACHE_TTL_MS=30000
+# Rate limiting for dashboard API endpoints (sliding window ms and max requests per window)
+TMV_DASHBOARD_RATE_LIMIT_WINDOW_MS=60000
+TMV_DASHBOARD_RATE_LIMIT_MAX=120
```

---

## 2. Architecture & Modules Delivered

```
dashboard/
├── server/
│   ├── router.ts                 # Main router mounted at /ops (Auth + Rate limiting)
│   ├── auth.ts                   # Reuses requireAdminSession from src/admin/admin.auth.ts
│   ├── read/
│   │   ├── types.ts              # SheetDataset interfaces
│   │   ├── cache.ts              # In-memory SWR cache (30s TTL, 0ms cache hits)
│   │   ├── sheet-reader.ts       # Batched read layer wrapping src/google/sheets.ts
│   │   └── excel-loader.ts       # Local zero-network fallback parser for TMV Bot Database.xlsx
│   ├── normalize/
│   │   ├── types.ts              # NormalizedJob, EvidenceState, DelayBand definitions
│   │   ├── mapping.ts            # Declarative header mappings for all 18 live sheet tabs
│   │   ├── timezone.ts           # Europe/London BST/GMT timezone formatting & offset validation
│   │   ├── finance.ts            # Financial arithmetic via branded Pence type
│   │   └── normalize.ts          # Pure normalization folding 18 tabs by Job ID + 3-way evidence classification
│   ├── pdf/
│   │   └── pdf-generator.ts      # Server-side binary PDF generator for A4 Job Reports
│   ├── routes/
│   │   ├── summary.route.ts      # GET /ops/api/summary (KPIs & chart series)
│   │   ├── jobs.route.ts         # GET /ops/api/jobs, /jobs/:id, /jobs/export.csv, /jobs/:id/report.pdf
│   │   ├── drivers.route.ts      # GET /ops/api/drivers/summary
│   │   ├── finance.route.ts      # GET /ops/api/finance/summary
│   │   ├── exceptions.route.ts   # GET /ops/api/exceptions (Surfaces ExceptionReport tab + QC alerts)
│   │   ├── scenarios.route.ts    # GET /ops/api/scenarios/:kind (CheckIn, CheckOut, Parking, Liability)
│   │   ├── activity.route.ts     # GET /ops/api/activity
│   │   └── photos.route.ts       # GET /ops/api/jobs/:id/photos/:fileId (Drive media proxy)
│   └── __tests__/
│       ├── normalize.test.ts     # Timezone, delay banding, Pence reconciliation & evidence classification tests
│       ├── api.test.ts           # Auth rejection, rate limit, photo proxy security tests
│       ├── excel.test.ts         # Local dataset loader tests
│       ├── pdf.test.ts           # Binary PDF generation validation
│       └── smoke.test.ts         # End-to-end /ops and /healthz coexistence tests
├── web/
│   ├── src/
│   │   ├── components/           # Layout, StatusBadge, EvidenceCompletenessPill, PaperJobReport, PhotoModal, DateRangePicker, SearchFilterBar
│   │   ├── pages/                # Overview, Jobs, Finished Jobs, Scenarios, Drivers, Finance, Exceptions, Activity, Reports, Settings
│   │   ├── api/client.ts         # TanStack Query API hooks
│   │   ├── types/index.ts        # TypeScript models
│   │   ├── App.tsx & main.tsx    # Root navigation and QueryProvider
│   │   └── index.css             # Exact design tokens (--navy-900, --blue, --cyan, --paper, Archivo, IBM Plex Mono)
│   └── dist/                     # Production Vite bundle served statically by Express router
└── docs/
    ├── PLAN.md                   # Phase 0 Reconnaissance & architecture plan
    ├── SHEET_MAPPING.md          # 18-tab schema and field mapping reference
    ├── DEPLOY.md                 # Deployment & Cloud Run single concurrency guide
    └── NOTES.md                  # Operational observations and sensible defaults
```

---

## 3. Quality Gates & Test Output

### 1. Root Typecheck & Vitest Suite
```
> tmv-bot@1.1.0 typecheck
> tsc -p tsconfig.json --noEmit [Passed 0 errors]

> tmv-bot@1.1.0 test
> vitest run
 ✓ tests/money.spec.ts (9 tests) 15ms
 ✓ tests/adapter.spec.ts (17 tests) 6ms
 ✓ tests/firetext.spec.ts (4 tests) 2ms
 ✓ tests/lock.spec.ts (5 tests) 106ms
 ✓ tests/replay.spec.ts (7 tests) 3ms
 Test Files  5 passed (5)
      Tests  42 passed (42)
```

### 2. Dashboard Server Vitest Suite
```
> tmv-bot@1.1.0 dashboard:test
> vitest run --config dashboard/vitest.config.ts
 ✓ dashboard/server/__tests__/pdf.test.ts (1 test) 22ms
 ✓ dashboard/server/__tests__/excel.test.ts (1 test) 116ms
 ✓ dashboard/server/__tests__/normalize.test.ts (8 tests) 29ms
 ✓ dashboard/server/__tests__/api.test.ts (3 tests) 37ms
 ✓ dashboard/server/__tests__/smoke.test.ts (3 tests) 272ms
 Test Files  5 passed (5)
      Tests  16 passed (16)
```

### 3. Dashboard Web Frontend Build
```
> tmv-dashboard-web@1.0.0 build
> tsc && vite build
✓ 2261 modules transformed.
dist/index.html                   0.91 kB │ gzip:   0.50 kB
dist/assets/index-DMvQN6ul.css   27.24 kB │ gzip:   5.79 kB
dist/assets/index-wcLnVlxV.js   706.81 kB │ gzip: 191.96 kB
✓ built in 5.49s
```

### 4. Git Working Tree Status
```
git status --porcelain
(Clean - 0 uncommitted changes)
```
