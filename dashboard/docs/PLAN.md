# TMV Owner Dashboard — Phase 0 Reconnaissance & Architecture Plan

**Repository Root:** `C:\Users\MicroZaib\Desktop\TMV Admin Dashbaoard\TMV-BOT---Google-Workspace-main`  
**Date:** 22 August 2026  
**Status:** PHASE 0 RECONNAISSANCE ONLY — Awaiting User Approval  

---

## 1. Exact Dashboard Mount Strategy & Justification

### Strategy
We will implement the dashboard as a **completely standalone Node + TypeScript Express server** located at:
```text
dashboard/server/index.ts
```
The server will run on its own dedicated port configured via `DASHBOARD_PORT` (defaulting to `3000` or `8090`), with its own `package.json`, `tsconfig.json`, build pipeline, and Vite + React SPA frontend located at `dashboard/web/`.

### Justification
1. **Critical Isolation Rule:** The existing TMV Google Chat operations bot runs in production on `PORT` (8080) with in-process state machines, queue workers, job locks, and Calendar sync throttling.
2. **Zero Blast Radius:** Running as a separate standalone Express process guarantees that dashboard HTTP traffic, heavy reporting queries, Recharts aggregations, or PDF rendering requests will **never** compete with, block, or interfere with the Google Chat webhook's request path, mutexes, or Google API quota buckets.
3. **Independent Lifecycle & Dependencies:** The dashboard maintains its own UI dependencies (`react`, `@tanstack/react-query`, `@tanstack/react-table`, `recharts`, `lucide-react`, `pdfkit`/`puppeteer`) without polluting the bot's lean production container.
4. **Proxy & Serving:** In production, Nginx reverse-proxies `/dashboard` and `/api/dashboard/*` to `127.0.0.1:DASHBOARD_PORT`, where Express serves the static Vite build from `dashboard/web/dist` and handles API requests.

---

## 2. Router Mounting Proposal & One-Line Diff

Per the specification, router mounting is **NOT** proposed or recommended. We adhere strictly to the standalone Express architecture in §1.

However, if the operator ever strictly requires mounting the dashboard as a sub-router directly inside the existing `src/server.ts`, the exact one-line diff would be:

```diff
--- a/src/server.ts
+++ b/src/server.ts
@@ -81,2 +81,3 @@
 app.use("/admin", adminRouter());
+app.use("/dashboard", dashboardRouter());
```

> **Notice:** As required by the Isolation Rule, this change is **NOT applied**. We will proceed exclusively with the standalone architecture unless explicitly directed otherwise.

---

## 3. Existing Services & Types to be Imported Read-Only

To guarantee read-only safety, the dashboard will only import immutable domain contracts and type definitions:
1. **Domain Types (`src/jobs/job.types.ts`):** `Job`, `JobStatus`, `ParsedCalendarBooking`, `DriverProfile`, `EvidenceType`, `EvidenceStatus`, `EvidenceRecord`
2. **Workflow State Constants (`src/workflow/workflow.states.ts`):** `WorkflowState`
3. **Money Utilities (`src/utils/money.ts`):** Pure penny/pound conversion functions (`toPence`, `formatGbp`, `parseMoneyGbp`)
4. **Sheet Constants (`src/google/sheets.ts`):** `SHEETS`, `SCHEMA` (for reference and verification)

*Note:* All Sheets reading, batch querying, caching, and Drive proxy streaming within the dashboard will use a dedicated read-only client in `dashboard/server/` to ensure no write methods exist on the dashboard's execution path.

---

## 4. Exact Import Paths

When referencing root types/contracts from `dashboard/server/`:
- `../../src/jobs/job.types`
- `../../src/workflow/workflow.states`
- `../../src/utils/money`
- `../../src/google/sheets`

All internal dashboard modules will use strictly internal paths:
- `../normalize/normalize`
- `../normalize/mapping`
- `../google/sheets.reader`
- `../google/drive.proxy`
- `../auth/auth`

---

## 5. Every Spreadsheet Tab Name (Verbatim from Workbook)

The actual TMV database workbook (`TMV Bot Database.xlsx`) contains exactly **22 tabs**:

1. `Dashboard`
2. `Analytics`
3. `Reports`
4. `Bookings`
5. `Customers`
6. `Drivers`
7. `WorkflowState`
8. `DriverFlow`
9. `Payments`
10. `Signatures`
11. `Evidence`
12. `Photos`
13. `ActivityLog`
14. `ProcessedEvents`
15. `ExceptionReport`
16. `Settings`
17. `StorageCheckIn`
18. `StorageCheckOut`
19. `ParkingLiability`
20. `LiabilityReport`
21. `PendingSignatures`
22. `ScenarioProgress`

---

## 6. Every Spreadsheet Header Verbatim

The exact headers extracted from Row 1 of each tab in the authoritative spreadsheet:

### 1. `Dashboard` (2 columns)
- `Metric`
- `Value`

### 2. `Analytics` (3 columns)
- `Date`
- `Metric`
- `Value`

### 3. `Reports` (3 columns)
- `Generated`
- `Report`
- `Value`

### 4. `Bookings` (33 columns)
- `Job ID`
- `Calendar Event ID`
- `Driver Initials`
- `Customer`
- `Customer Email`
- `Phone`
- `Pickup`
- `Dropoff`
- `Crew Size`
- `Base Price`
- `Paid Online`
- `Booked Start`
- `Booked Finish`
- `Actual Start`
- `Actual Finish`
- `Booked Minutes`
- `Actual Minutes`
- `Difference Minutes`
- `Delay Status`
- `Extra Charges`
- `Overtime Minutes`
- `Overtime Charge`
- `Total Charges`
- `Payment Method`
- `Payment Status`
- `Client Name/Postcode`
- `Client Confirmed By`
- `Status`
- `Current State`
- `Drive Folder ID`
- `Drive Folder URL`
- `Created`
- `Updated`

### 5. `Customers` (6 columns)
- `Customer ID`
- `Name`
- `Email`
- `Phone`
- `Address`
- `Updated`

### 6. `Drivers` (6 columns)
- `Initials`
- `Full Name`
- `Email`
- `Chat User Name`
- `Active`
- `Role`

### 7. `WorkflowState` (4 columns)
- `Job ID`
- `Driver`
- `State`
- `Updated`

### 8. `DriverFlow` (6 columns)
- `Timestamp`
- `Job ID`
- `Driver`
- `Field`
- `Value`
- `State`

### 9. `Payments` (6 columns)
- `Timestamp`
- `Job ID`
- `Driver`
- `Method`
- `Amount`
- `Status`

### 10. `Signatures` (6 columns)
- `Timestamp`
- `Job ID`
- `Driver`
- `Customer Name`
- `Mode`
- `Confirmation Text`

### 11. `Evidence` (15 columns)
- `Evidence ID`
- `Job ID`
- `Driver`
- `Evidence Type`
- `Attachment Ref`
- `Content Type`
- `File Name`
- `Status`
- `Received`
- `Processing Started`
- `Processing Completed`
- `Drive File ID`
- `Drive URL`
- `Retry Count`
- `Last Error`

### 12. `Photos` (8 columns)
- `Timestamp`
- `Job ID`
- `Driver`
- `Step`
- `File ID`
- `File URL`
- ` ` *(Note: column 7 is whitespace in workbook; corresponds to File Name)*
- `Content Type`

### 13. `ActivityLog` (7 columns)
- `Timestamp`
- `Job ID`
- `Driver`
- `Action`
- `From State`
- `To State`
- `Detail`

### 14. `ProcessedEvents` (4 columns)
- `Event Key`
- `Job ID`
- `Outcome State`
- `Processed At`

### 15. `ExceptionReport` (5 columns)
- `Timestamp`
- `Job ID`
- `Type`
- `Detail`
- `Resolved`

### 16. `Settings` (3 columns)
- `Key`
- `Value`
- `Notes`

### 17. `StorageCheckIn` (11 columns)
- `Timestamp`
- `Job ID`
- `Driver`
- `Container Number`
- `Client Name`
- `Client Phone`
- `Client Email`
- `Client Present`
- `Date`
- `Photo URLs`
- `Signature URL`

### 18. `StorageCheckOut` (10 columns)
- `Timestamp`
- `Job ID`
- `Driver`
- `Container Number`
- `Client Name`
- `Client Email`
- `Client Present At Dropoff`
- `Date`
- `Photo URLs`
- `Signature URL`

### 19. `ParkingLiability` (7 columns)
- `Timestamp`
- `Job ID`
- `Driver`
- `Address`
- `Client Full Name`
- `Photo URLs`
- `Signature URL`

### 20. `LiabilityReport` (6 columns)
- `Timestamp`
- `Job ID`
- `Driver`
- `Damage Categories`
- `Photo URLs`
- `Signature URL`

### 21. `PendingSignatures` (3 columns)
- `Job ID`
- `Message Name`
- `Updated`

### 22. `ScenarioProgress` (7 columns)
- `Key`
- `Job ID`
- `Scenario`
- `Step`
- `Fields JSON`
- `Message Name`
- `Updated`

---

## 7. Confirmed `Job ID` Format

- **Format:** `TMV-[A-F0-9]{10}` (e.g. `TMV-BCCF9EB120`, `TMV-40DB746AE7`, `TMV-5DE314E48E`).
- **Generation:** Deterministic SHA-1 hash of the Google Calendar event ID:
  ```typescript
  `TMV-${crypto.createHash("sha1").update(eventId).digest("hex").slice(0, 10).toUpperCase()}`
  ```

---

## 8. Which Tabs Contain `Job ID`

Exactly **16 tabs** contain `Job ID`:

| Tab Name | Column Position | Header Text |
|---|---|---|
| `Bookings` | Column 1 | `Job ID` |
| `WorkflowState` | Column 1 | `Job ID` |
| `PendingSignatures` | Column 1 | `Job ID` |
| `DriverFlow` | Column 2 | `Job ID` |
| `Payments` | Column 2 | `Job ID` |
| `Signatures` | Column 2 | `Job ID` |
| `Evidence` | Column 2 | `Job ID` |
| `Photos` | Column 2 | `Job ID` |
| `ActivityLog` | Column 2 | `Job ID` |
| `ProcessedEvents` | Column 2 | `Job ID` |
| `ExceptionReport` | Column 2 | `Job ID` |
| `StorageCheckIn` | Column 2 | `Job ID` |
| `StorageCheckOut` | Column 2 | `Job ID` |
| `ParkingLiability` | Column 2 | `Job ID` |
| `LiabilityReport` | Column 2 | `Job ID` |
| `ScenarioProgress` | Column 2 | `Job ID` |

*Tabs without `Job ID`: `Dashboard`, `Analytics`, `Reports`, `Customers`, `Drivers`, `Settings`.*

---

## 9. Evidence Explaining Why the Existing `/admin` Hangs on `Loading...`

Inspection of `src/admin/admin.routes.ts`, `src/admin/admin.page.ts`, and `src/google/sheets.ts` reveals the root causes:

1. **Uncached Sequential Sheets API Reads with `ttlMs = 0`:**
   In `src/admin/admin.routes.ts:71–77`, `/api/dashboard` runs:
   ```typescript
   const [bookings, checkins, checkouts, parking, liability] = await Promise.all([
     listObjects(SHEETS.BOOKINGS, 0),
     listObjects(SHEETS.STORAGE_CHECK_IN, 0),
     listObjects(SHEETS.STORAGE_CHECK_OUT, 0),
     listObjects(SHEETS.PARKING_LIABILITY, 0),
     listObjects(SHEETS.LIABILITY_REPORT, 0)
   ]);
   ```
   Passing `0` forces bypass of all caches. In `src/google/sheets.ts:218–226`, this executes synchronous `spreadsheets.values.batchGet` requests to Google Sheets API over the network on every single page load.
2. **Missing Google Credentials or API Quota / Latency Block:**
   If Google ADC / service-account credentials are unauthenticated or throttled by Google Sheets 429 rate limits, the `Promise.all` either hangs on retry loops or errors out after a long timeout.
3. **Frontend Silent Failure / Unhandled Non-OK Response:**
   In `src/admin/admin.page.ts:436`, `loadDashboard()` executes:
   ```javascript
   fetch('/admin/api/dashboard').then(function(r) { return r.json(); }).then(...).catch(showError);
   ```
   Unlike `loadTable`, `loadDashboard` lacks `if (!r.ok) throw ...`. When the server returns HTTP 500 (`{ error: "Failed to load dashboard." }`), `r.json()` resolves with that object. `data.kpis` is undefined, `kpis.map(...)` produces an empty string, but if the request hangs or rejects before response, the DOM never replaces `<div class="loading">Loading…</div>`, leaving the UI permanently hanging.

---

## 10. Existing Authentication Mechanism

1. **Old Admin Panel:** `src/admin/admin.auth.ts` implements a shared password (`env.adminPassword` / `TMV_ADMIN_PASSWORD`). On successful authentication, it issues a signed stateless cookie (`tmv_admin=<exp>.<hmac>`) signed with `TMV_SIGNATURE_LINK_SECRET`.
2. **Chat Webhook:** Verified via OIDC Bearer tokens issued by Google Chat, validated against `GOOGLE_CHAT_AUDIENCE` and `GOOGLE_CHAT_ISSUER`.
3. **Internal Workers:** Header token `x-tmv-worker-secret` validated against `TMV_WORKER_SHARED_SECRET`.
4. **Forms & Signatures:** Signed URLs with time-limited HMAC hashes (`/forms/...` and `/sign/...`).

---

## 11. Authentication Strategy for the New Dashboard

### Decision: Google OAuth 2.0 + Allowlist (`DASHBOARD_ALLOWED_EMAILS`)
- **Rationale:** The existing `/admin` shared-password approach does not identify individual operators, cannot provide individual audit attribution, and cannot revoke access per user.
- **Implementation:** 
  - Standard Google OAuth 2.0 flow verifying user emails against `DASHBOARD_ALLOWED_EMAILS`.
  - Secure, signed, `HttpOnly`, `SameSite=Lax`, encrypted session cookies.
  - Development fixture mode (`DASHBOARD_MOCK=true`) for local development without live OAuth client credentials, strictly disabled in production.

---

## 12. File-by-File Dashboard Creation Plan

All files will be created strictly inside `dashboard/`:

```text
dashboard/
├── package.json                          # Standalone dependencies, scripts, engines
├── tsconfig.json                         # Strict TypeScript configuration
├── .env.example                          # Dashboard environment template (DASHBOARD_PORT, etc.)
├── NOTES.md                              # Operational & domain notes
├── docs/
│   ├── PLAN.md                           # This Phase 0 document
│   ├── SHEET_MAPPING.md                  # Declarative spreadsheet mapping reference (Phase 7)
│   └── DEPLOY.md                         # Nginx / systemd / PM2 deployment runbook (Phase 7)
├── server/
│   ├── index.ts                          # Express server entry point (DASHBOARD_PORT)
│   ├── config/
│   │   └── env.ts                        # Typed dashboard environment validation
│   ├── auth/
│   │   ├── oauth.ts                      # Google OAuth 2.0 & allowlist verification
│   │   └── session.ts                    # Session cookie issuance & validation middleware
│   ├── google/
│   │   ├── auth.ts                       # Read-only Google Service Account / ADC client
│   │   ├── sheets.reader.ts              # Single batchGet reader with SWR caching
│   │   └── drive.proxy.ts                # Authenticated private Drive image & PDF streaming proxy
│   ├── normalize/
│   │   ├── mapping.ts                    # Declarative spreadsheet header -> domain field mapping
│   │   ├── normalize.ts                  # Pure, side-effect-free job normalization & joining
│   │   ├── timezone.ts                   # Europe/London BST/GMT conversion & validation
│   │   ├── finance.ts                    # Integer penny finance reconciliation & overtime
│   │   └── types.ts                      # NormalizedJob, Provenance, Exception types
│   ├── api/
│   │   ├── routes.ts                     # API router mounting /api/dashboard/* endpoints
│   │   ├── controllers/
│   │   │   ├── summary.controller.ts     # GET /api/dashboard/summary & charts
│   │   │   ├── jobs.controller.ts        # GET /api/dashboard/jobs & /api/dashboard/jobs/:id
│   │   │   ├── drivers.controller.ts     # GET /api/dashboard/drivers/summary
│   │   │   ├── finance.controller.ts     # GET /api/dashboard/finance/summary
│   │   │   ├── exceptions.controller.ts  # GET /api/dashboard/exceptions
│   │   │   └── pdf.controller.ts         # GET /api/dashboard/jobs/:id/report.pdf
│   │   └── middleware/
│   │       ├── auth.middleware.ts        # Route guard requiring valid session
│   │       ├── rate-limit.ts             # Express rate limiter
│   │       └── error-handler.ts          # Standardized error response formatter
│   └── pdf/
│       ├── generator.ts                  # Server-side PDF renderer from NormalizedJob
│       └── template.ts                   # 9-section A4 layout & TMV branding
├── web/
│   ├── index.html                        # HTML shell loading Archivo and IBM Plex Mono fonts
│   ├── package.json                      # Frontend dependencies (React, Vite, Tailwind, Recharts)
│   ├── vite.config.ts                    # Vite build configuration targeting dist
│   ├── tailwind.config.js                # Design tokens (--navy-900, --blue, --r, etc.)
│   ├── postcss.config.js                 # PostCSS setup
│   └── src/
│       ├── main.tsx                      # React root with TanStack Query provider
│       ├── App.tsx                       # Root layout, navigation router, command palette
│       ├── types/                        # Frontend UI & API models
│       ├── hooks/                        # useJobs, useSummary, useFinance, useKeyboardShortcut
│       ├── components/
│       │   ├── layout/                   # Sidebar, Topbar, StatusBadge, Skeleton
│       │   ├── dashboard/                # KPICards, RevenueChart, StatusDonut, DriverChart
│       │   ├── jobs/                     # JobsTable, JobFilters, Pagination, ExpandedReportRow
│       │   ├── report/                   # 9-section A4 Paper Job Report component
│       │   ├── drivers/                  # DriverPerformanceTable, Metrics
│       │   ├── finance/                  # FinanceSummaryCards, ReconciliationTable
│       │   ├── exceptions/               # ExceptionsList, Badges, Direct Links
│       │   └── common/                   # CommandPalette, DateRangePicker, EvidenceModal
│       └── utils/
│           ├── formatters.ts             # Currency (GBP), London Dates, Tabular Nums
│           └── export.ts                 # CSV / PDF export helpers
└── tests/
    ├── normalize.test.ts                 # Unit tests for normalization & joining
    ├── timezone.test.ts                  # BST/GMT boundary tests
    ├── finance.test.ts                   # Penny reconciliation & overtime tests
    ├── api.test.ts                       # API authentication & filter tests
    └── pdf.test.ts                       # PDF generation snapshot tests
```

---

## 13. Differences Between Real Spreadsheet and Specification

| Specification Expectation | Actual Spreadsheet (`TMV Bot Database.xlsx`) | Discrepancy Analysis & Handling |
|---|---|---|
| `Bookings.Driver` | `Bookings.Driver Initials` | Real sheet uses 2-letter initials (e.g. `WD`). Mapped to `driverInitials`, resolved to full name via `Drivers` tab. |
| `Bookings.Overtime` | `Bookings.Overtime Minutes` + `Bookings.Overtime Charge` | Real sheet splits overtime into minutes and monetary charge. Mapped separately with provenance. |
| `Bookings.Base Price` & `Crew Size` | Present in actual sheet (`Base Price`, `Crew Size`, `Paid Online`) | Retained in normalization; provides baseline revenue before workflow completion. |
| `Bookings.Client Name/Postcode` | `Client Name/Postcode` and `Client Confirmed By` | Combined column in sheet; parser splits name, postcode, and actor. |
| `Photos.File Name` | 7th column header is whitespace `' '` | Mapping explicitly accounts for header index/fallback to avoid missing file names. |
| Scenario Tabs (`StorageCheckIn`, `StorageCheckOut`, `ParkingLiability`, `LiabilityReport`) | Present with `Photo URLs` and `Signature URL` | Contains pipe-separated Drive links; parsed into structured evidence records. |
| `Evidence` tab vs `Photos` tab | Both exist (`Evidence` is durable queue state; `Photos` is legacy log) | Normalization joins on `Job ID`, deduplicating evidence items by Drive File ID. |

---

## 14. How Differences Will Be Mapped

Declarative mapping configuration in `dashboard/server/normalize/mapping.ts`:

```typescript
export const SHEET_FIELD_MAP = {
  bookings: {
    jobId: "Job ID",
    calendarEventId: "Calendar Event ID",
    driverInitials: "Driver Initials",
    customerName: "Customer",
    customerEmail: "Customer Email",
    customerPhone: "Phone",
    pickup: "Pickup",
    dropoff: "Dropoff",
    crewSize: "Crew Size",
    basePrice: "Base Price",
    paidOnline: "Paid Online",
    bookedStart: "Booked Start",
    bookedFinish: "Booked Finish",
    actualStart: "Actual Start",
    actualFinish: "Actual Finish",
    bookedMinutes: "Booked Minutes",
    actualMinutes: "Actual Minutes",
    diffMinutes: "Difference Minutes",
    delayStatus: "Delay Status",
    extraCharges: "Extra Charges",
    overtimeMinutes: "Overtime Minutes",
    overtimeCharge: "Overtime Charge",
    totalCharges: "Total Charges",
    paymentMethod: "Payment Method",
    paymentStatus: "Payment Status",
    clientConfirmation: "Client Name/Postcode",
    clientConfirmedBy: "Client Confirmed By",
    status: "Status",
    currentState: "Current State",
    driveFolderId: "Drive Folder ID",
    driveFolderUrl: "Drive Folder URL",
    created: "Created",
    updated: "Updated"
  }
} as const;
```

Every normalized property will attach a provenance marker:
```typescript
interface ProvenancedValue<T> {
  value: T;
  provenance: "recorded" | "derived";
  sourceTab?: string;
  sourceField?: string;
}
```

---

## 15. Open Questions & Edge Cases

1. **Authentication Mode for Local Dev vs Production:**
   - In production, Google OAuth with `DASHBOARD_ALLOWED_EMAILS` is enforced.
   - For local development without OAuth client IDs, should `DASHBOARD_MOCK=true` supply a mock admin user (`admin@themanvan.co.uk`)? *(Proposed: Yes, with hard failure if enabled in production)*.
2. **Drive Proxy Image Cache Strategy:**
   - Private Drive thumbnails will be proxied server-side via `GET /api/dashboard/jobs/:id/photos/:fileId`. We will enforce `Cache-Control: private, max-age=3600` and verify the file belongs to the job before streaming.
3. **Handling Untrustworthy Timestamps:**
   - As discovered in previous audit notes, any non-London offset (e.g. `+05:00`) will be explicitly flagged as `timingTrustworthy: false` and surfaced with the badge `"Source record inconsistent"` rather than fabricating adjusted start times.

---

## Phase 0 Completion Status

Phase 0 Reconnaissance is **COMPLETE**.  
No production files outside `dashboard/docs/PLAN.md` have been created or modified.

**Awaiting user review and approval before proceeding to Phase 1 (Data Layer).**
