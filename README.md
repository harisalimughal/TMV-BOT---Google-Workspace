# TMV Bot — Node.js + TypeScript Backend

Deterministic Google Chat operations backend for The Man Van.

## What this backend implements

- Google Calendar as booking source.
- Calendar title parsing for the documented pattern such as `2 men 141£/Y-WD`.
- Google Sheets as the operational database.
- Google Chat as the driver interface.
- Server-side start and finish timestamps.
- Sequential workflow with resume support.
- Arrival, loaded-van, empty-van and organized-van photo steps.
- Google Chat attachment acceptance in under a second, with Google Drive evidence
  storage completed by a durable Cloud Tasks background worker.
- Extra charges, overtime, total charges and payment capture.
- Typed customer confirmation/signature inside Google Chat.
- Gmail start notification, queued rather than blocking the driver.
- Activity log, workflow state, evidence, payment, signature and photo logs.
- Cloud Run-ready Express server and Dockerfile.

No LLM/AI decision-making is used.

## Workflow implemented

`READY -> Arrival Photo -> Loaded Photo -> Move -> Extra Charges -> Overtime -> Total -> Payment -> Empty Van Photo -> Client Details -> Client Confirmation -> Organized Van Photo -> Complete`

The active job is resumed instead of issuing a second job.

## 1. Install

```bash
npm install
cp .env.example .env
npm run dev
```

Set `TMV_CHAT_ACTION_URL` before starting. It is the public HTTPS endpoint Google
Chat calls back for card button actions (normally the same URL as
`GOOGLE_CHAT_AUDIENCE`). The server refuses to start without it.

Run `npm run verify` to exercise the full driver workflow and print the Google API
round-trip cost of each interaction. It stubs the Google transport, so it needs no
credentials and makes no network calls.

Run `npm run preflight` against a real `.env` to validate the live Google Workspace
setup: auth per scope, spreadsheet tab/header/grid drift, driver roster, Drive
permissions and Shared Drive placement, and how today's Calendar events parse. It is
read-only. Add `-- --write` to also test writing (one sentinel row in `ActivityLog`,
deleted again immediately). Exit code 1 means there is a blocker.

## 2. Google Cloud / Workspace setup

Enable these APIs in the same Google Cloud project:

- Google Chat API
- Google Sheets API
- Google Calendar API
- Google Drive API
- Gmail API

Create a service account for the backend.

### Sheets and Drive

For the simplest least-privilege setup, share the master Google Sheet and the TMV Drive root folder directly with the service account email as Editor. Domain-wide delegation is not required just to work with explicitly shared Sheets/Drive files.

### Calendar

Either share the booking calendar with the service account with read permission, or use domain-wide delegation if the application must read a user's private Calendar on their behalf.

### Gmail

To send mail as a real Workspace mailbox using Gmail API, configure domain-wide delegation for the service account and authorize the `https://www.googleapis.com/auth/gmail.send` scope. Set `GOOGLE_WORKSPACE_IMPERSONATED_USER` to the mailbox that should send the client notification.

## 3. Spreadsheet

Create one Google Spreadsheet. Put its ID in `GOOGLE_SHEETS_SPREADSHEET_ID`.

On startup, `BOOTSTRAP_ON_START=true` creates these tabs if missing:

- Dashboard
- Bookings
- DriverFlow
- Photos
- Signatures
- Payments
- Drivers
- Customers
- ActivityLog
- WorkflowState
- Evidence
- Settings
- Reports
- ExceptionReport
- Analytics

Then add drivers manually to the `Drivers` tab using:

| Initials | Full Name | Email | Chat User Name | Active | Role |
|---|---|---|---|---|---|
| WD | Example Driver | driver@example.com |  | TRUE | Driver |

The initials must match the Calendar title assignment code.

## 4. Calendar booking format

The parser supports the documented title convention:

```text
2 men 141£/Y-WD
```

Meaning:

- `2 men` -> crew size
- `141£` -> base price
- `Y` -> paid online (`N` means not paid online)
- `WD` -> assigned driver initials

The event description should preferably use labelled lines:

```text
Client name: Barry
Email: barry@example.com
Phone: 07123456789
Pickup: 10 Example Street, London
Drop-off: 74 Ferndale Road, London, N15 6UQ
```

## 5. Configure Google Chat

Create/configure a Google Chat app in the Google Chat API configuration page.

Use an HTTP endpoint and point it to:

```text
https://YOUR-CLOUD-RUN-URL/chat
```

The backend handles `MESSAGE`, `CARD_CLICKED`, `APP_COMMAND`, `ADDED_TO_SPACE`, and `REMOVED_FROM_SPACE` interaction events.

For request verification, either rely on Cloud Run IAM with `chat@system.gserviceaccount.com` as an authorized invoker, or enable application-level OIDC verification:

```env
VERIFY_CHAT_REQUESTS=true
GOOGLE_CHAT_AUDIENCE=https://YOUR-CLOUD-RUN-URL/chat
```

## 6. Driver usage

Driver types:

```text
jobs
```

The bot returns the active job, otherwise the earliest eligible unfinished job for the driver.

The driver then follows the cards and photo prompts until `FINISH JOB`.

## 7. Photo behavior (asynchronous)

A photo upload is split into a fast acceptance and a durable background job.

**On the Chat request (target < 1s, no Drive calls):**

1. Resolve the driver and the active job, authorize, validate the workflow state.
2. Validate attachment *metadata* — content type and the presence of a Chat media
   resource. A non-image or a Drive-link attachment is rejected here, immediately.
3. Write one `Evidence` row per photo with status `RECEIVED`, advance the workflow state,
   and write the activity row — all in a single `spreadsheets.batchUpdate`.
4. Enqueue one `PROCESS_JOB_IMAGE` Cloud Task per photo.
5. Reply with "photo received ✓ — we're storing them now" plus the next workflow card.

**In the background worker:**

1. Claim the evidence (`RECEIVED` → `PROCESSING`). Already `COMPLETED` → no-op.
2. Download the media from the Chat Media API, verify magic bytes and size.
3. Create/reuse the job's Drive step folder, upload with a deterministic file name.
4. Write the Drive URL to the `Evidence` row, append the audit `Photos` row, log activity.
5. Mark `COMPLETED`.

The response never claims the photo is saved, because it is not. Only `COMPLETED`
evidence satisfies the completion gate.

### Evidence states

```text
RECEIVED ──► PROCESSING ──► COMPLETED
    ▲             │
    └─── retry ───┴──► FAILED   (permanent error, or attempts exhausted)
```

### Why this is durable

Durability comes from the `Evidence` row, not from the queue. The row is written
synchronously, before the driver gets a response, so no accepted photo can be lost.
Cloud Tasks provides *timely* retry; `SWEEP_STALE_EVIDENCE` provides the *eventual*
guarantee by re-driving anything still `RECEIVED`/`PROCESSING` past
`TMV_EVIDENCE_STALE_MS` — covering a failed enqueue, a queue outage, or a worker killed
mid-upload by a Cloud Run scale-down.

### Idempotency

| Layer | Mechanism |
|---|---|
| Enqueue | Cloud Tasks task name `image-<evidenceId>`; a duplicate returns 409 and is treated as success |
| Worker | `claimEvidence()` returns null when the record is already `COMPLETED` |
| Drive | Deterministic file name; an existing file is adopted rather than re-uploaded |
| Email | `CLIENT_START_EMAIL_SENT` in `ActivityLog` is checked before sending |

### Retry classification

`PermanentTaskError` → HTTP 200, evidence `FAILED`, no further retries. Raised for a
non-image attachment, a Chat media 404/403 (message deleted, reference expired), an
oversized file, or bytes that fail the magic-byte check.

Anything else → HTTP 500, Cloud Tasks retries with exponential backoff. Attempts are
counted on the `Evidence` row, not taken from the queue, so Cloud Tasks retries and
reaper re-drives share one budget (`TMV_EVIDENCE_MAX_ATTEMPTS`).

### Failure UX

```text
We couldn't save your arrival photo.

[ RETRY UPLOAD ]   [ TAKE NEW PHOTO ]
```

`RETRY UPLOAD` resets the attempt budget and re-queues. `TAKE NEW PHOTO` sends the
driver back to that photo step; the failed records stay on the sheet as an audit record.

Drive structure:

```text
TMV root/
  Jobs/
    YYYY/
      MM/
        DD/
          Job_TMV-XXXXXXXXXX/
            Arrival/
            VanLoaded/
            EmptyVan/
            Organized/
            Signature/
            Documents/
```

## 8. Signature limitation

Native Google Chat cards do not provide a hand-drawn signature canvas. This backend therefore implements the fully in-Chat option: the customer types their name, checks the confirmation statement, and submits it. The confirmation text and server timestamp are written to the `Signatures` sheet.

If the client requires a hand-drawn signature, add a separate secure one-tap mobile form and store the resulting signature file in the job's `Signature` Drive folder.

## 9. Overtime rule

Defaults:

```env
TMV_OVERTIME_RATE_PER_30_MINUTES=55
TMV_OVERTIME_GRACE_MINUTES=0
```

Overtime is rounded up to 30-minute blocks after the configured grace period.

## 10. Cloud Run deployment

```bash
gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT_ID/REPOSITORY/tmv-bot:1.0.0

gcloud run deploy tmv-bot \
  --image REGION-docker.pkg.dev/PROJECT_ID/REPOSITORY/tmv-bot:1.0.0 \
  --region REGION \
  --service-account YOUR_RUNTIME_SERVICE_ACCOUNT \
  --set-env-vars NODE_ENV=production,PORT=8080
```

Use Secret Manager for service-account private keys and other secrets rather than putting them directly in deployment commands.

If Cloud Run is private and Google Chat is configured to authenticate to it, grant the Google Chat service account invoker permission:

```bash
gcloud run services add-iam-policy-binding tmv-bot \
  --region REGION \
  --member='serviceAccount:chat@system.gserviceaccount.com' \
  --role='roles/run.invoker'
```

## 10a. Cloud Tasks setup

```bash
gcloud services enable cloudtasks.googleapis.com

gcloud tasks queues create tmv-bot-tasks \
  --location=europe-west2 \
  --max-attempts=5 \
  --min-backoff=5s \
  --max-backoff=300s \
  --max-concurrent-dispatches=10 \
  --max-dispatches-per-second=20

# Service account Cloud Tasks uses to authenticate to the worker endpoints.
gcloud iam service-accounts create tmv-tasks

# Allow it to invoke the Cloud Run service.
gcloud run services add-iam-policy-binding tmv-bot \
  --region REGION \
  --member='serviceAccount:tmv-tasks@PROJECT_ID.iam.gserviceaccount.com' \
  --role='roles/run.invoker'

# Allow the runtime service account to enqueue.
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member='serviceAccount:RUNTIME_SA@PROJECT_ID.iam.gserviceaccount.com' \
  --role='roles/cloudtasks.enqueuer'
```

Cloud Scheduler drives the reaper:

```bash
gcloud scheduler jobs create http tmv-evidence-sweep \
  --location=REGION \
  --schedule='*/5 * * * *' \
  --uri='https://YOUR-CLOUD-RUN-URL/internal/tasks/sweep-evidence' \
  --http-method=POST \
  --message-body='{"type":"SWEEP_STALE_EVIDENCE"}' \
  --headers=Content-Type=application/json \
  --oidc-service-account-email=tmv-tasks@PROJECT_ID.iam.gserviceaccount.com \
  --oidc-token-audience='https://YOUR-CLOUD-RUN-URL/internal/tasks/sweep-evidence'
```

Deploy with concurrency pinned until job state moves out of Sheets:

```bash
gcloud run deploy tmv-bot \
  --image REGION-docker.pkg.dev/PROJECT_ID/REPOSITORY/tmv-bot:1.1.0 \
  --region REGION \
  --service-account RUNTIME_SA@PROJECT_ID.iam.gserviceaccount.com \
  --concurrency 1 --max-instances 1 --min-instances 1 \
  --cpu-boost --memory 512Mi \
  --set-env-vars NODE_ENV=production,PORT=8080,TMV_QUEUE_DRIVER=cloud-tasks
```

## 11. Calendar synchronization

The `jobs` command performs a same-day Calendar sync before selecting a job.

There is also a protected endpoint for Cloud Scheduler:

```text
POST /internal/sync
X-TMV-Sync-Secret: <SYNC_SECRET>
```

## 12. Important production notes

- Protect the spreadsheet structure from normal driver editing.
- Keep the evidence folder private to authorized Workspace users.
- Prefer a Shared Drive or controlled operations account for evidence ownership.
- Avoid broad domain-wide delegation unless it is required.
- Put secrets in Google Secret Manager.
- Retries (jittered backoff on 429/5xx) and in-process write serialisation are in place.
  Cross-instance locking still requires a real transactional store; keep Cloud Run at
  low concurrency until then.
- Add a dedicated admin/reporting layer after the core driver flow is proven in UAT.


## 13. Performance notes

Google API round trips per driver interaction, measured by `npm run verify`:

| Interaction | Before | After (warm) |
|---|---|---|
| `jobs` | ~12 calls + ~12 token exchanges | 0–3 calls, 0 token exchanges |
| Card button click | ~6 calls + ~6 token exchanges | 2 calls |
| Photo upload | ~40 calls + ~35 token exchanges | 5 calls |

What makes the difference:

- **Auth clients are cached** per (scopes, subject). Previously every Google call
  built a new JWT and paid for a fresh token exchange.
- **Writes are batched.** One workflow step is a single `spreadsheets.batchUpdate`
  carrying the booking row, workflow row, activity row and any step-specific rows.
- **Calendar sync is throttled** (`TMV_CALENDAR_SYNC_TTL_MS`) and only runs on the
  `jobs` entry point. Cloud Scheduler hitting `/internal/sync` remains the primary
  sync trigger. Mid-workflow steps never touch Calendar.
- **Drive folders are cached and created lazily.** The date chain is shared across
  every job on a day; step subfolders are created on first use; a started job reuses
  its stored `Drive Folder ID`.
- **Append-only tabs are never read in full.** The completion gate reads two narrow
  column slices in one batched call.

Caching is tuned by `TMV_SHEET_CACHE_TTL_MS`, `TMV_DRIVER_CACHE_TTL_MS` and
`TMV_CALENDAR_SYNC_TTL_MS`. Set them to `0` to disable caching entirely.

### Known ceiling

`Bookings` is still read in full to select a job. That is fine for hundreds of rows
but grows over time; archiving completed jobs to a separate tab, or moving hot job
state out of Sheets, is the next step.


## Tier 3 — code-review remediation

### Fixed

| Ref | Issue | Fix |
|---|---|---|
| P0-1 | Classic Chat event payloads silently mangled | `workspace-adapter.ts` handles both formats; `UnrecognisedChatEventError` names the offending keys. 17 fixture tests. |
| P0-2 | Photo uploads had no idempotency key | `replay.guard.ts` + `ProcessedEvents` tab, keyed on `message.name` with an attachment-`resourceName` fallback. A replay returns the original card. |
| P0-3 | `START_JOB` double-tap sent duplicate emails | `utils/lock.ts` per-job mutex; the whole read/decide/write runs inside it with a cache-bypassing read. |
| P0-4 | `VERIFY_CHAT_REQUESTS` defaulted false | Defaults true; production refuses to boot without verification, without an audience, or with a default `SYNC_SECRET`. |
| P0-5 | Money as floats | `utils/money.ts` with branded `Pence`. All rendering and comparison go through it. **Storage is still pounds — see Outstanding.** |
| P1-5 | Cancellations never reconciled | `showDeleted: true`; unstarted bookings that vanish are cancelled, started ones raise an exception. Commercial fields freeze at `actualStart`. Window widened to −1/+2 days. |
| P2-5 | Unassigned jobs startable by anyone | First-claim-wins inside the job lock; a driver with no initials is rejected. |
| P2-7 | Overtime asked unconditionally | Skipped unless `Extra time / Charges` is selected. |
| P3-1 | `A:ZZ` full-width reads | Bounded to the schema width. |
| P3-3 | `START JOB` did ~10 Drive calls | Folder creation deferred to the image worker. |
| P3-5 | `RESUME_JOB` triggered a Calendar sync | Sync only on `jobs` and `APP_COMMAND`. |
| P4-1 | No tests | vitest, 38 tests. `npm run ci` = typecheck + test + verify. |
| P4-3 | Dockerfile | `npm ci`, multi-stage, `USER node`, source maps, tightened `.dockerignore`. |

Two bugs were found while fixing the above:

- `return runOnce(...)` inside `try` does not route rejections to `catch`. A
  `ValidationError` escaped `handleChatEvent` and crashed the request instead of
  rendering an error card.
- `readRanges` treated `ttlMs = 0` as `now - at > 0`, which is false within the same
  millisecond. A deliberate cache-bypassing read could be served stale — which would
  have silently defeated the P0-3 double-tap guard.

### API round trips per interaction

| Interaction | Calls | Notes |
|---|---|---|
| `jobs` (warm) | 0 | caches plus the sync throttle |
| Card click | 2 | one batched read, one batched write |
| Photo upload | 4 | 2 for the workflow step, 2 for replay protection |

No Drive call and no OAuth token exchange happens on the critical path. The image
transfer runs in the worker.

### Outstanding

Not done, in review priority order:

- **P1-2** row-index writes can land on the wrong row if someone inserts, deletes or
  sorts rows mid-write. Proper fix is `developerMetadata` addressing. Zero-code
  mitigation available today: protect the `Bookings` range so only the service account
  can edit it.
- **P0-5 storage.** `Job` still carries pounds as `number`. Converting the columns to
  pence is a schema migration and deserves its own pass. Rendering and comparison are
  already exact, so nothing is visibly wrong today.
- **P2-1** `Settings` sheet is still created and never read; business rules live in env.
- **P2-2** `Dashboard`, `Customers`, `Reports`, `Analytics` are provisioned and unwritten.
- **P2-3** job IDs are hashes, not `TMV-20260813-001`.
- **P2-4** the driver can still type any total.
- **P2-6** no `ISSUE_REPORTED` path.
- **P3-2** completion-gate evidence reads are not denormalised onto the job row.
- **P3-4** photo buffers are still fully in memory rather than streamed.

## Deploying

```bash
export GCP_PROJECT=your-project
export RUNTIME_SA=tmv-bot@your-project.iam.gserviceaccount.com
export GOOGLE_SHEETS_SPREADSHEET_ID=... GOOGLE_CALENDAR_ID=... GOOGLE_DRIVE_ROOT_FOLDER_ID=...

./deploy/setup-iam.sh     # service account, roles, generated secrets, manual checklist
./deploy/deploy.sh        # Cloud Run + Cloud Tasks queue + Scheduler jobs + IAM bindings
npm run preflight         # validate the live setup before pointing drivers at it
```

`deploy.sh` pins `--concurrency 1 --max-instances 1 --min-instances 1
--no-cpu-throttling`. **These are correctness settings, not tuning.** The write mutex,
the job lock, the read caches, the Drive folder cache and the sync throttle are all
in-process. Raising them requires moving job state to a transactional store first.
#   T M V - B O T - - - G o o g l e - W o r k s p a c e  
 