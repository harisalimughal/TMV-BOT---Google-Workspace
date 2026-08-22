# TMV Owner Dashboard (/ops) — Architecture Plan & Implementation Blueprint

**Repository:** `TMV-BOT---Google-Workspace-main`  
**Author:** AI Pair Programmer  
**Date:** 22 August 2026  
**Target Specification:** `TMV-DASHBOARD-V3-CLAUDE-CODE-PROMPT.md`  

---

## 1. Verbatim Allowlisted File Diffs

### 1.1 `src/server.ts` (Exact 2-Line Addition)
```diff
--- a/src/server.ts
+++ b/src/server.ts
@@ -17,2 +17,3 @@
 import { adminRouter } from "./admin/admin.routes";
+import { dashboardRouter } from "../dashboard/server/router";
 
@@ -137,2 +138,4 @@
 });
+
+app.use("/ops", dashboardRouter());
 
```

### 1.2 `package.json` (Additive Scripts & DevDependencies)
```diff
--- a/package.json
+++ b/package.json
@@ -16,2 +16,4 @@
     "test:watch": "vitest",
+    "dashboard:build": "npm run build --prefix dashboard/web",
+    "dashboard:test": "vitest run dashboard/server",
     "ci": "npm run typecheck && npm run test && npm run verify"
```

### 1.3 `Dockerfile` (Additive Frontend Build Stage & COPY)
```diff
--- a/Dockerfile
+++ b/Dockerfile
@@ -10,2 +10,9 @@
 
+# ---- dashboard-web build ----
+FROM node:22-slim AS web-build
+WORKDIR /app/dashboard/web
+COPY dashboard/web/package*.json ./
+RUN npm ci
+COPY dashboard/web ./
+RUN npm run build
+
 # ---- runtime ----
@@ -16,2 +23,3 @@
 COPY --from=build /app/dist ./dist
+COPY --from=web-build /app/dashboard/web/dist ./dashboard/web/dist
 COPY package.json ./
```

### 1.4 `.env.example` (Appended Configuration)
```diff
--- a/.env.example
+++ b/.env.example
@@ -103,2 +103,7 @@
 TMV_DRIVER_CACHE_TTL_MS=300000
+
+# --- TMV Operations Dashboard (/ops) ---
+TMV_DASHBOARD_CACHE_TTL_MS=30000
+TMV_DASHBOARD_RATE_LIMIT_WINDOW_MS=60000
+TMV_DASHBOARD_RATE_LIMIT_MAX=120
```

---

## 2. Verbatim Live Spreadsheet Headers (Extracted from Workbook)

1. **`Bookings` (33 columns):**
   `Job ID`, `Calendar Event ID`, `Driver Initials`, `Customer`, `Customer Email`, `Phone`, `Pickup`, `Dropoff`, `Crew Size`, `Base Price`, `Paid Online`, `Booked Start`, `Booked Finish`, `Actual Start`, `Actual Finish`, `Booked Minutes`, `Actual Minutes`, `Difference Minutes`, `Delay Status`, `Extra Charges`, `Overtime Minutes`, `Overtime Charge`, `Total Charges`, `Payment Method`, `Payment Status`, `Client Name/Postcode`, `Client Confirmed By`, `Status`, `Current State`, `Drive Folder ID`, `Drive Folder URL`, `Created`, `Updated`

2. **`Drivers` (6 columns):**
   `Initials`, `Full Name`, `Email`, `Chat User Name`, `Active`, `Role`

3. **`WorkflowState` (4 columns):**
   `Job ID`, `Driver`, `State`, `Updated`

4. **`DriverFlow` (6 columns):**
   `Timestamp`, `Job ID`, `Driver`, `Field`, `Value`, `State`

5. **`Payments` (6 columns):**
   `Timestamp`, `Job ID`, `Driver`, `Method`, `Amount`, `Status`

6. **`Signatures` (6 columns):**
   `Timestamp`, `Job ID`, `Driver`, `Customer Name`, `Mode`, `Confirmation Text`

7. **`Evidence` (15 columns):**
   `Evidence ID`, `Job ID`, `Driver`, `Evidence Type`, `Attachment Ref`, `Content Type`, `File Name`, `Status`, `Received`, `Processing Started`, `Processing Completed`, `Drive File ID`, `Drive URL`, `Retry Count`, `Last Error`

8. **`Photos` (8 columns):**
   `Timestamp`, `Job ID`, `Driver`, `Step`, `File ID`, `File URL`, ` ` *(File Name)*, `Content Type`

9. **`ActivityLog` (7 columns):**
   `Timestamp`, `Job ID`, `Driver`, `Action`, `From State`, `To State`, `Detail`

10. **`ProcessedEvents` (4 columns):**
    `Event Key`, `Job ID`, `Outcome State`, `Processed At`

11. **`ExceptionReport` (5 columns):**
    `Timestamp`, `Job ID`, `Type`, `Detail`, `Resolved`

12. **`Settings` (3 columns):**
    `Key`, `Value`, `Notes`

13. **`StorageCheckIn` (11 columns):**
    `Timestamp`, `Job ID`, `Driver`, `Container Number`, `Client Name`, `Client Phone`, `Client Email`, `Client Present`, `Date`, `Photo URLs`, `Signature URL`

14. **`StorageCheckOut` (10 columns):**
    `Timestamp`, `Job ID`, `Driver`, `Container Number`, `Client Name`, `Client Email`, `Client Present At Dropoff`, `Date`, `Photo URLs`, `Signature URL`

15. **`ParkingLiability` (7 columns):**
    `Timestamp`, `Job ID`, `Driver`, `Address`, `Client Full Name`, `Photo URLs`, `Signature URL`

16. **`LiabilityReport` (6 columns):**
    `Timestamp`, `Job ID`, `Driver`, `Damage Categories`, `Photo URLs`, `Signature URL`

17. **`PendingSignatures` (3 columns):**
    `Job ID`, `Message Name`, `Updated`

18. **`ScenarioProgress` (7 columns):**
    `Key`, `Job ID`, `Scenario`, `Step`, `Fields JSON`, `Message Name`, `Updated`

*(Dead Schema Tabs explicitly excluded: `Dashboard`, `Analytics`, `Reports`, `Customers`)*

---

## 3. Proposed `NormalizedJob` Interface & Field Mapping

```typescript
import { Pence } from "../../src/utils/money";
import { JobStatus } from "../../src/jobs/job.types";
import { WorkflowState } from "../../src/workflow/workflow.states";

export type Provenance = "recorded" | "derived";

export type EvidenceCategory = "Arrival" | "VanLoaded" | "EmptyVan" | "Organized" | "Signature" | "Documents";
export type EvidenceState = "MISSING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface NormalizedEvidenceItem {
  id: string;
  category: EvidenceCategory;
  state: EvidenceState;
  fileId?: string;
  driveUrl?: string;
  thumbProxyUrl?: string;
  fileName?: string;
  receivedAt?: string;
  completedAt?: string;
  error?: string;
  provenance: Provenance;
}

export interface NormalizedJob {
  jobId: string; // Bookings["Job ID"]
  calendarEventId: string; // Bookings["Calendar Event ID"]
  
  // Timing & Schedule
  bookedStart: string; // Bookings["Booked Start"] (ISO UTC)
  bookedFinish: string; // Bookings["Booked Finish"] (ISO UTC)
  actualStart?: string; // Bookings["Actual Start"]
  actualFinish?: string; // Bookings["Actual Finish"]
  bookedMinutes: number; // Bookings["Booked Minutes"]
  actualMinutes?: number; // Bookings["Actual Minutes"]
  delayMinutes: number; // Bookings["Difference Minutes"] or derived
  delayBand: "EARLY" | "ON_TIME" | "LATE_5_15" | "LATE_15_30" | "LATE_OVER_30";
  timingTrustworthy: boolean;
  
  // Customer & Route
  customerName: string; // Bookings["Customer"]
  customerEmail?: string; // Bookings["Customer Email"]
  customerPhone?: string; // Bookings["Phone"]
  pickup: string; // Bookings["Pickup"]
  dropoff: string; // Bookings["Dropoff"]
  crewSize: number; // Bookings["Crew Size"]
  
  // Driver
  driverInitials: string; // Bookings["Driver Initials"]
  driverName: string; // Drivers["Full Name"] joined on Initials
  driverEmail?: string; // Drivers["Email"]
  
  // Status & Workflow
  status: JobStatus; // Bookings["Status"]
  currentState: WorkflowState | string; // Bookings["Current State"] or WorkflowState["State"]
  workflowCompletionPct: number; // Derived from completed workflow steps
  
  // Financials (All through branded Pence type)
  basePrice: Pence; // Bookings["Base Price"]
  extraCharges: Pence; // Bookings["Extra Charges"]
  overtimeMinutes: number; // Bookings["Overtime Minutes"]
  overtimeCharge: Pence; // Bookings["Overtime Charge"]
  totalCharges: Pence; // Bookings["Total Charges"]
  reconciled: boolean; // base + extras + overtime == total
  
  // Payments
  paymentMethod: string; // Bookings["Payment Method"]
  paymentStatus: string; // Bookings["Payment Status"]
  paidOnline: boolean; // Bookings["Paid Online"]
  
  // Evidence & Signatures
  evidenceCompleteness: {
    arrival: EvidenceState;
    vanLoaded: EvidenceState;
    emptyVan: EvidenceState;
    organized: EvidenceState;
    signature: EvidenceState;
  };
  evidenceItems: NormalizedEvidenceItem[];
  
  // Confirmation & Drive
  clientConfirmedName?: string; // Signatures / Bookings
  signatureUrl?: string; // Signatures["Confirmation Text"] / Drive proxy
  driveFolderUrl?: string; // Bookings["Drive Folder URL"]
  
  // Audit Trail
  activity: Array<{
    timestamp: string;
    driver: string;
    action: string;
    fromState?: string;
    toState?: string;
    detail?: string;
  }>;
  
  exceptions: Array<{
    type: string;
    detail: string;
    timestamp: string;
  }>;
  
  created: string;
  updated: string;
}
```

---

## 4. Evidence Three-Way Classification Strategy

Mirroring `assertCompletionGate` in `src/workflow/workflow.engine.ts`:
1. Check `Evidence` rows for the `Job ID` and matching `Evidence Type`.
2. Classification:
   - **`COMPLETED`**: Row status is `COMPLETED` and `Drive File ID` exists. (Green)
   - **`PROCESSING`**: Row status is `RECEIVED` or `PROCESSING` (or pending in queue). (Amber + spinner)
   - **`FAILED`**: Row status is `FAILED` or retry count exceeded. (Red with failure tooltip)
   - **`MISSING`**: No evidence row exists for this mandatory step. (Pink / Purple)

---

## 5. Caching & Concurrency Budget

- **Target:** Under Cloud Run's single-instance concurrency=1, the dashboard MUST NOT delay Google Chat webhooks.
- **Strategy:** In-memory Stale-While-Revalidate (SWR) cache in `dashboard/server/read/cache.ts`.
- **TTL:** `TMV_DASHBOARD_CACHE_TTL_MS` (default `30,000ms`).
- **Background Refresh:** When cache is stale, immediately return stale data to dashboard callers while kicking off an asynchronous background `batchGet` fetch.
- **Worst-Case Added Latency:** ~0ms on cache hit / SWR; single `spreadsheets.values.batchGet` on forced revalidate (100–350ms amortized across 30s intervals).

---

## 6. Execution Roadmap

- **Phase 1 (Read Layer):** `dashboard/server/read/` batched reader with SWR cache and error guards.
- **Phase 2 (Normalization Layer):** `dashboard/server/normalize/` pure functions, declarative mappings, and Vitest suite.
- **Phase 3 (API Layer):** `dashboard/server/routes/` and `dashboard/server/router.ts` mounted at `/ops`.
- **Phase 4 (Frontend UI):** `dashboard/web/` React + Vite + Tailwind application with exact design tokens.
- **Phase 5 (Dashboard Sections):** Overview, Jobs, Finished Jobs, Scenarios, Drivers, Finance, Exceptions, Activity Log, Settings.
- **Phase 6 (Job Report):** Expandable 9-section A4 paper-shadow report with CSS grid transitions.
- **Phase 7 (PDF Generation):** Server-side PDF renderer from `NormalizedJob`.
- **Phase 8 (Documentation & Ship):** `SHEET_MAPPING.md`, `DEPLOY.md`, `NOTES.md`, and verification proofs.
