# TMV Owner Dashboard — Build Brief (v3, audit-grounded)

You are Claude Code, running in the TMV bot repository. The full technical audit (`TMV-Bot-Audit.md`) is complete. **Everything in §1 below is confirmed fact from that audit — do not re-derive it, do not re-audit the repo to "check." Verify only the specific items §2 asks you to verify.**

Your job is one thing: **replace the admin dashboard UI with a state-of-the-art operations dashboard, built in a new isolated folder, without breaking or modifying the bot.**

---

## §1 — GROUND TRUTH (confirmed, from the audit)

### The shape of the system

Single Express process. `src/server.ts` is the bootstrap. No frontend build, no bundler, no ORM, no `frontend/` directory, no `nginx/`, no `docker-compose.yml`. Google Sheets is the database (`src/google/sheets.ts`, 1,230 lines, the entire data-access layer). Calendar is the booking source. Drive is the evidence store. Google Chat is the driver interface.

**Deployment is Google Cloud Run** — not a VPS. Multi-stage `Dockerfile`, `node dist/server.js`, pinned `--concurrency 1 --max-instances 1 --min-instances 1` **deliberately**, because job-state locking and caching are entirely in-process.

> **This is the single most important engineering constraint in this brief.** With concurrency 1, a slow dashboard request does not merely "compete with" the Chat webhook — it *blocks* it. A driver tapping "Start Job" waits behind your full-table sheet read. Design accordingly: cached-by-default, background refresh, never a synchronous fan-out read on the request path.

### The existing admin dashboard — exactly what's there

| Piece | File | Notes |
|---|---|---|
| Auth | `src/admin/admin.auth.ts` | Single shared password `TMV_ADMIN_PASSWORD`, `crypto.timingSafeEqual`, plaintext (not hashed). Signed self-contained cookie `exp.HMAC(admin-session.exp)`, 12h TTL, HttpOnly, SameSite=Lax, Secure in prod. No server-side session store, no per-user accounts, no MFA, no rate limit on `POST /admin/login`. |
| Routes/API | `src/admin/admin.routes.ts` | All JSON endpoints. `requireAdminSession` is the only gate — one privilege level, no RBAC. |
| UI | `src/admin/admin.page.ts` | **671 lines of hand-written vanilla JS in one inline `<script>`.** No framework, no bundler, no TS on the client, no component model. Hand-drawn SVG donut + line charts, no charting library. |

**Cookie signing secret is `TMV_SIGNATURE_LINK_SECRET`, shared with the scenario/signature HMAC links.** Rotating it logs out admin *and* invalidates every in-flight signed form link. Do not change this; just be aware.

**Existing endpoints (all session-gated, all under `/admin/api/`):**

```
GET  /admin/api/dashboard              KPIs, derived from Bookings + 4 scenario tabs
GET  /admin/api/table/:tab             generic read, :tab through a fixed TAB_SHEETS allowlist
GET  /admin/api/finished-jobs          joins Bookings + Drivers + Evidence + Signatures
GET  /admin/api/drive-file/:fileId     photo/signature proxy, strict fileId regex
POST /admin/api/drivers                create/upsert only
POST /admin/api/jobs                   creates a Calendar event (not a Bookings row) — round-trips
                                       through the production parser and rejects anything the bot
                                       couldn't read back. Genuinely well-designed.
GET/POST /admin/api/settings           one allowlisted key only
```

**Known weaknesses of the current UI, all confirmed:**

- **No pagination anywhere.** Every table endpoint does `listObjects(sheet, 0)` — full sheet, TTL 0, always fresh. Search, sort and filter are entirely client-side over the full payload. Documented scaling ceiling.
- **No virtualization** — the whole dataset renders into the DOM at once.
- **CSV/PDF export is client-side only** — Blob download and `window.print()`.
- **Zero accessibility work** — no ARIA, no keyboard handling beyond native semantics, no `alt` text on thumbnails.
- **`ExceptionReport` has data and no surface.** The bot *writes* to it (booking disappearance, evidence failure). There is no UI and no API. Nothing shows it to the owner.
- Loading and error states *do* exist consistently and there is no mock data — credit where due, don't regress this.
- Output escaping via `escapeHtml()` is consistent across all surfaces; no XSS found. Match this discipline.

### The data — what's real and what isn't

**Live tabs:** `Bookings` `DriverFlow` `Photos` `Signatures` `Payments` `Drivers` `ActivityLog` `WorkflowState` `Evidence` `ProcessedEvents` `StorageCheckIn` `StorageCheckOut` `ParkingLiability` `LiabilityReport` `PendingSignatures` `ScenarioProgress` `ExceptionReport` `Settings`

**Dead schema — provisioned at bootstrap, never read or written anywhere:** `Dashboard` (the *tab* — not the same thing as the admin dashboard view), `Customers`, `Reports`, `Analytics`. **Do not read these. Do not build a section that pretends they have data.**

**`Settings` holds exactly one live key: `CUSTOMER_CONFIRMATION_TEXT`.** Every business rule — overtime rate, congestion charge, tunnel charge, timeouts, TTLs — lives in **environment variables** via `src/config/env.ts`. If the dashboard needs a rate, it comes from `env`, server-side. Never from the `Settings` sheet, never hardcoded in the client.

**Keys:** upsert-by-column-value (`Job ID`, `Email`, `Evidence ID`) via a row-index lookup. No real unique constraints, no FKs. Join on `Job ID`, never on row position.

**Money:** stored in Sheets as plain float pounds, parsed with `Number()` and currency-symbol stripping. All comparison and rendering goes through the branded `Pence` type in `src/utils/money.ts`, which forbids fractional pence at the type level. **Use `Pence` for every comparison and every rendered figure.** Do not recalculate historical charges.

**Timestamps:** written as UTC ISO-8601 (`new Date().toISOString()`), displayed via Luxon with `env.timezone` (default `Europe/London`). Follow this exactly — no new date library, no local-time storage.

**Evidence lifecycle is four states, not two: `RECEIVED` → `PROCESSING` → `COMPLETED` | `FAILED`.**

> This matters more than anything else in the report UI. `assertCompletionGate` does a **three-way** classification — missing / still-processing / permanently-failed. Your evidence-completeness indicator must do the same. "No photo yet" and "upload failed" and "still uploading" are three different operational situations and the owner needs to tell them apart at a glance.

### Testing and CI

Vitest. `npm run ci` = `typecheck && test && verify`, gated on every push/PR via `.github/workflows/ci.yml` — a real gate. `verify/admin.js` already tests the admin session gate and the finished-jobs join over real HTTP against a locally started server. **`npm run ci` must still pass when you're done.**

### Out of scope — do not touch

The three confirmed `deploy/deploy.sh` bugs (Cloud Tasks env var name mismatch, unregistered SMS route, unauthenticated calendar-sync scheduler). They are real and serious. **They are not this ticket.** Note anything you notice in `dashboard/NOTES.md` and move on.

---

## §2 — THE ISOLATION CONTRACT

> **All new code lives in a new top-level `dashboard/` folder. You may not modify any existing file except the four on the allowlist below, and only with the diffs I have approved.**

### Permitted edits — exactly four files, minimal diffs, approval required

Because this is a single Cloud Run container on a single port, a genuinely zero-touch second service is **not** possible. Don't pretend otherwise. These four, and nothing else:

| File | Permitted change |
|---|---|
| `src/server.ts` | **Two lines** — one import, one `app.use('/ops', dashboardRouter)`, mounted **after** every existing route so nothing is shadowed. |
| `package.json` | Additive scripts (`dashboard:build`, `dashboard:test`) and devDependencies. Do not alter existing scripts. |
| `Dockerfile` | Additive build step for the frontend bundle + a `COPY` of its dist. Do not restructure the existing stages. |
| `.env.example` | Append new variables at the end, commented. |

Every other file in the repo is read-only to you. **Reading and importing existing modules is encouraged.** Writing to them is not.

**Specifically: do not modify `src/google/sheets.ts`.** Wrap it. If you need batched or differently-cached reads, build that in `dashboard/server/` on top of the exported API.

### Reuse, don't reinvent

- **Auth:** import `requireAdminSession` from `src/admin/admin.auth.ts`. Same cookie, same login page. The owner logs in once at `/admin/login` and `/ops` just works. **Do not build a second auth system.**
- **Sheets/Drive/Calendar:** import the existing clients from `src/google/*`.
- **Money:** import `Pence` from `src/utils/money.ts`.
- **Types:** import from `src/jobs/job.types.ts`.
- **Logging:** import `src/utils/logger.ts` — structured JSON, Cloud Logging-compatible.

### Coexistence

The new dashboard mounts at **`/ops`**. The existing `/admin` stays live and untouched throughout. Both work side by side. When you're happy with `/ops`, I decide whether to redirect `/admin` — you don't.

### Folder layout

```
dashboard/
├── server/
│   ├── router.ts            # the mountable Express router
│   ├── auth.ts              # thin re-export/wrapper of requireAdminSession + rate limit
│   ├── read/                # cached, batched sheet reads (wraps src/google/sheets.ts)
│   ├── normalize/           # sheet rows → NormalizedJob
│   ├── routes/              # one file per resource
│   └── __tests__/
├── web/
│   ├── src/                 # React + TS
│   └── dist/                # built assets, served by router.ts
├── docs/
│   ├── PLAN.md
│   ├── SHEET_MAPPING.md
│   └── DEPLOY.md
├── NOTES.md
├── package.json
└── tsconfig.json
```

---

## §3 — PHASES

Work strictly in order. After each: run `npm run typecheck && npm test`, then give me a **short** summary — what changed, files touched, what's next. No full file dumps unless I ask. Commit per phase, `dashboard/` only. Never `git push`.

### Phase 0 — Verify & plan (then STOP)

Do not re-audit. Verify only these, quickly:

```bash
rg -n "app.use|app.listen" src/server.ts          # exact mount point + ordering
rg -n "export" src/admin/admin.auth.ts             # requireAdminSession signature
rg -n "export (async )?function|export const" src/google/sheets.ts | head -40
rg -n "listObjects|readRanges|SCHEMA" src/google/sheets.ts | head -30
rg -n "export" src/utils/money.ts src/jobs/job.types.ts
rg -n "overtime|congestion|tunnel|timezone" src/config/env.ts
cat Dockerfile package.json
```

Then dump the **live header row of every tab you intend to read**, verbatim, using the existing Sheets client via a temporary script you delete afterwards. Do not guess headers. Do not assume the audit's tab list implies column names.

**Write `dashboard/docs/PLAN.md`** — the only file you create in Phase 0:

- The exact two-line `src/server.ts` diff, verbatim, for my approval.
- The exact `Dockerfile` and `package.json` diffs, verbatim.
- Every tab name + every header string, verbatim, per tab.
- The `NormalizedJob` type you propose, with each field's source tab and source header.
- How you'll get evidence status three-ways from the `Evidence` tab.
- Your caching design, with the numbers: TTL, refresh strategy, and your estimated worst-case added latency to a concurrent Chat webhook.
- Anything the live sheet contradicts in this brief.
- Open questions.

**Stop. Wait for my approval.** No feature code.

### Phase 1 — Read layer

- A cached, batched reader in `dashboard/server/read/` wrapping the existing Sheets client. **One `spreadsheets.values.batchGet`-equivalent per refresh cycle for all needed tabs.** Never one call per job, never a full fan-out on the request path.
- Stale-while-revalidate with a TTL from env (`TMV_DASHBOARD_CACHE_TTL_MS`, default 30s). Serve stale instantly, refresh behind. The refresh button forces a revalidate.
- A hard latency budget: log a structured warning if any dashboard handler exceeds it. Because concurrency is 1, this is a bot-health metric, not a vanity one.
- Reads are **read-only, always**. No dashboard code path writes to Sheets, Drive or Calendar in v1. Not one.

### Phase 2 — Normalization

- Pure functions folding `Bookings` + `DriverFlow` + `WorkflowState` + `Evidence` + `Photos` + `Signatures` + `Payments` + `ActivityLog` into one `NormalizedJob`, joined **only on `Job ID`**.
- Header→field mapping in **one declarative file**, so a renamed column is a one-line fix.
- Every derived field carries provenance (`recorded` | `derived`) so the UI can mark computed values.
- Validation: duplicate Job IDs, unparseable dates, negative durations, totals that don't reconcile against their components, evidence rows orphaned from any job.
- Evidence completeness resolves three-ways per required category, mirroring `assertCompletionGate`.
- Unit tests: normalization, delay banding, BST/GMT boundary dates, `Pence` reconciliation, the three-way evidence classifier.

### Phase 3 — API (`/ops/api/*`)

```
GET /ops/api/summary                 ?from&to
GET /ops/api/jobs                    ?from&to&q&status&driver&payMethod&payStatus&evidence&sort&page&pageSize
GET /ops/api/jobs/:jobId
GET /ops/api/drivers/summary         ?from&to
GET /ops/api/finance/summary         ?from&to&groupBy=day|week|month
GET /ops/api/exceptions              ?from&to&type      # the ExceptionReport tab, finally surfaced
GET /ops/api/scenarios/:kind         ?from&to&page      # checkin|checkout|parking|liability
GET /ops/api/activity                ?from&to&page
GET /ops/api/jobs/:jobId/photos/:fileId                 # proxy — mirror the existing regex allowlist
GET /ops/api/jobs/:jobId/report.pdf
```

- **Real server-side pagination and filtering.** This is the headline fix over the current panel — never ship the full sheet to the browser again.
- Every route behind `requireAdminSession`. Add a simple in-memory rate limit on the `/ops` router (the existing login has none — don't fix that here, but don't inherit the gap).
- Validate every query param. Structured errors `{ error: { code, message } }`. Never leak stacks, tokens, or service-account details. Don't log customer PII.
- Mirror the existing `fileId` regex allowlist exactly on the photo proxy. Drive files stay private — no signed public URLs, no sharing changes.
- API tests: unauthenticated → 401 on every route; each filter and sort demonstrably works; pagination boundaries; a malformed `fileId` is rejected.

### Phase 4 — The UI

React + Vite + TypeScript + Tailwind + TanStack Query + TanStack Table + Recharts + Lucide. Builds to `dashboard/web/dist`, served statically by the router.

**Tokens — use exactly these:**

```css
--navy-900:#0A1A2F; --navy-800:#12263F; --navy-700:#1B3355; --navy-600:#25436B;
--blue:#1B75BC;     --blue-dark:#155E97; --cyan:#29ABE2;     --cyan-light:#5EC8F0;
--paper:#FFFFFF;    --surface:#F1F4F8;   --surface-2:#E7ECF3;
--line:#DCE3EC;     --line-strong:#C3CEDC;
--ink:#0F1D2E;      --ink-2:#3B4E63;     --muted:#677C93;
--green:#17804A / #E4F3EA    --orange:#B4600A / #FBEEDD    --red:#BF3025 / #FBE7E5
--purple:#6B46A8 / #EFE9F8   --pink:#B32568 / #FBE6EF      --grey:#7B8CA0 / #EDF1F5
--r:10px; --r-sm:6px; --sidebar-w:236px; --dur:240ms; --ease:cubic-bezier(.22,.61,.36,1);
```

Type: **Archivo** for UI, **IBM Plex Mono** for Job IDs, timestamps and money. `tabular-nums` wherever figures align in a column.

**Status semantics:** green = on time / completed · blue = early / scheduled · orange = 5–15 min late · red = >15 min late · dark red = >30 min late · purple = missing signature · pink = missing photos · amber+spinner = evidence still processing · grey = waiting / not applicable.

Craft rules, non-negotiable:

- **Colour is never the only signal.** Every status renders colour + icon + text label. The current panel has no ARIA at all; this one is keyboard-complete and screen-reader-sane from the first commit, not retrofitted.
- Skeleton loaders, never blank panes. Every empty state explains in one sentence what would fill it. Every error state offers retry. Nothing spins forever.
- 3px cyan `:focus-visible` ring on everything interactive. Full keyboard path: sidebar → filters → row → expanded report → close.
- `prefers-reduced-motion` collapses all durations to 1ms.
- `alt` text on every thumbnail, describing the evidence category and job.
- Desktop-first, genuinely responsive: sidebar → icon rail on tablet → drawer on mobile. Below 768px the jobs table becomes stacked cards, not a horizontal scrollbar.
- WCAG AA contrast on every text/background pair.
- Density over decoration. Hairline dividers, tight vertical rhythm, one accent per screen. No gradients, no glassmorphism, no emoji in the chrome.
- Escape all interpolated output, matching the discipline already in `admin.page.ts`.

### Phase 5 — Sections

Preserve the taxonomy the owner already knows, and add what's missing:

`Overview · Jobs · Finished Jobs · Check In · Check Out · Parking Liability · Liability Report · Drivers · Finance · Exceptions · Activity Log · Reports · Settings`

**Overview** — opens on today. KPIs: total / scheduled / in-progress / completed / late / incomplete / cancelled · revenue · cash collected · card+bank+link · outstanding · total extra charges · photos missing vs. **still processing** vs. failed · missing signatures · drivers working · avg duration · avg delay. Controls: date picker, prev/next, **Today**, range, manual refresh, last-synced timestamp. Range-reactive charts (Recharts, replacing the hand-drawn SVG): jobs by status · revenue over time · payment-method split · jobs by driver · scheduled vs actual duration · overtime & extras trend.

**Jobs / Finished Jobs** — one table component, two presets. Columns: Job ID · scheduled time · customer · job type · pickup · destination · driver · crew · status · scheduled duration · actual duration · delay · total · payment method · payment status · evidence completeness · last updated. Server-side search across Job ID, customer, postcode, address, driver. Server-side filters, sorting, pagination. Clear-all. CSV export of the **filtered** set — server-generated, not a client Blob.

**Check In / Check Out / Parking Liability / Liability Report** — one scenario-table component over the four scenario tabs, with the same filter/sort/paginate treatment and evidence thumbnails.

**Drivers** — name · status · assigned · completed · completion rate · avg delay · avg duration · revenue handled · cash collected · missing-evidence count · overtime count. Click deep-links to that driver's filtered jobs. Read-only in v1 — driver create/upsert stays on the old panel.

**Finance** — revenue by day/week/month · base vs extras vs overtime · collected vs outstanding · payment-method breakdown · invoice jobs · cash reconciliation · records where the components don't reconcile against the total. All figures through `Pence`.

**Exceptions** — **the genuinely new capability.** Surface the `ExceptionReport` tab plus derived exceptions: late starts, late finishes, each missing evidence category, permanently-failed uploads, missing signature, missing payment, outstanding balance, incomplete workflow, duplicate Job IDs, unparseable records. Every row links straight to that job's report. Badge the sidebar with the live count.

**Activity Log** — paginated, filterable, server-side. It's append-only and grows unboundedly; never full-table read it.

**Reports** — daily / weekly / monthly ops, driver performance, revenue, payment, exceptions, individual job. Server-generated PDF and CSV.

**Settings** — display the one live key read-only, and clearly show which business rules come from environment variables instead. Don't build an editor for values that live in env.

### Phase 6 — The job report

Clicking a job row **does not navigate.** A full-width report panel expands directly beneath that row, pushing subsequent rows down — `grid-template-rows: 0fr → 1fr`, ~240ms, `cubic-bezier(.22,.61,.36,1)`. One open at a time. Reduced-motion respected. The row is a real `role="button"` with `aria-expanded` and `aria-controls`. Job detail is lazy-loaded on open, never prefetched for the whole page.

Inside, it reads as an **A4 document on a paper-shadowed sheet** — not a modal, not a stack of cards. Controls: close · full-screen · print · download PDF · open Drive folder.

1. **Header** — TMV logo + business name, "Job Completion Report", Job ID, job type, booking date, final status, evidence-completeness badge.
2. **Customer & booking** — contact, crew size, van, instructions, scheduled date/time.
3. **Route** — pickup, delivery, postcodes, additional stops, notes.
4. **Scheduled vs actual** — side by side: start · arrival · loading · delivery · completion · duration · delay/early, with the delay band shown as colour + icon + words.
5. **Workflow timeline** — vertical, chronological, one node per state from `WorkflowState` / `DriverFlow` / `ActivityLog`: step · status · exact timestamp (London) · actor · driver response · linked evidence · an explicit warning where a step has no record. Facts only — *"Driver arrived at 09:42 on 15 August 2026. Two arrival photographs uploaded."* Never narrate anything the data doesn't support. Show location **only** where coordinates were actually captured; otherwise "Location not captured". No IP geolocation, ever.
6. **Evidence gallery** — grouped Arrival / Van Loaded / Empty Van / Organized / Signature / Documents. Per item: thumbnail (lazy, through the authenticated proxy), category, `RECEIVED`/`PROCESSING`/`COMPLETED`/`FAILED` state, upload timestamp, uploaded by, open-full action, and for `FAILED` the recorded failure reason.
7. **Charges & payment** — itemised: base · congestion · tunnel · overtime · other extras · discount · total · collected · outstanding · method · status · reference. Recorded values only. Rates shown for context come from `env`.
8. **Customer confirmation** — confirmed name, confirmed postcode, signature image, confirmation timestamp, the `CUSTOMER_CONFIRMATION_TEXT` that was actually shown, notes.
9. **Audit** — workflow completion %, missing required steps, final status, completed by, completion timestamp, last synced, Drive folder reference, related `ActivityLog` entries.

Component tests: opening a row renders the report; opening a second closes the first; Escape closes and returns focus to the row; a closed row renders no report DOM.

### Phase 7 — PDF

Server-rendered from the **same normalized job object** as the screen report — one source, two renderers. TMV logo, all nine sections, correct page breaks (never split a table row or an image card), page numbers, generation timestamp. Filename `TMV-Job-{JOB_ID}-{YYYY-MM-DD}.pdf`. Embed optimised images; link the authorised originals. Watch the bundle size — this runs in the same container as the bot.

### Phase 8 — Ship

Deliver inside `dashboard/`: `docs/SHEET_MAPPING.md` (every tab, every header, every mapped and derived field with its formula), `docs/DEPLOY.md` (Cloud Run build + deploy for the added frontend stage, env vars, rollback), `NOTES.md` (anything you noticed and correctly didn't fix).

Done means all of these pass and you paste the output:

```bash
npm run typecheck
npm test
npm run ci                    # the existing gate must still be green
cd dashboard && npm run lint && npm run typecheck && npm test && npm run build
```

Plus the isolation proof:

```bash
git status --porcelain        # nothing outside dashboard/ except the 4 approved files
git diff --stat               # the four diffs are exactly the size you showed me in Phase 0
```

Plus a smoke list you have actually run:

- `/ops` loads with real data on first paint, no infinite spinner.
- `/admin` still works, unchanged.
- Every `/ops/api/*` route returns 401 when unauthenticated.
- A Drive file URL opened in a logged-out browser is refused.
- A jobs query with 500+ rows returns one page, not the whole sheet.
- **The Chat bot still answers `jobs` and completes a full run — with the dashboard open and polling in another tab.** This is the test that matters most, because of concurrency 1.

---

## §4 — MISSING DATA: exact wording

Never blank, never guessed:

`Not recorded` · `Location not captured` · `Photograph missing` · `Photograph still processing` · `Photograph upload failed` · `Signature missing` · `Payment not confirmed` · `Workflow incomplete` · `Source record inconsistent`

A job whose status says **Completed** but which lacks mandatory evidence appears in Exceptions anyway, and says so on its own report.

---

## §5 — RULES OF ENGAGEMENT

- Phase by phase. Stop at the end of Phase 0 for approval. Don't run ahead.
- Before every commit, confirm nothing outside `dashboard/` and the four approved files has changed. If something has, revert it.
- Ask before any dependency over ~100KB, anything touching auth, and anything that would alter driver-facing behaviour or container startup.
- If the live sheet contradicts this brief, **the sheet wins** — adapt the mapping, record it in `SHEET_MAPPING.md`, tell me.
- Genuine ambiguity → one focused question. Small gaps → sensible default, proceed, flag it.
- No phase is complete while any part of it is a stub, a `TODO`, or placeholder data. This codebase has zero `TODO` markers today. Don't be the one who adds the first.

Begin with Phase 0.
