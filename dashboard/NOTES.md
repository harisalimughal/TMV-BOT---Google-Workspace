# TMV Dashboard — Technical & Operational Notes

This document records operational observations, minor discrepancies, and sensible defaults chosen during development, preserving all existing bot and deployment configurations untouched.

---

## 1. Discrepancies & Sensible Defaults

1. **Spreadsheet Column Naming:**
   - The brief noted `Driver` on `Bookings`, but the live sheet contains `Driver Initials` (e.g. `WD`). We resolve driver full names by joining `Bookings.Driver Initials` to `Drivers.Initials` -> `Drivers.Full Name`.
   - The brief noted `Overtime` on `Bookings`, but the live sheet splits this into `Overtime Minutes` (integer) and `Overtime Charge` (monetary). We map both and verify calculation against `env.overtimeRatePer30Minutes`.
   - `Photos` column 7 header is whitespace (`' '`) in the live workbook; our reader gracefully falls back to column position index or alias `File Name`.

2. **Dead Schema Tabs:**
   - Tabs `Dashboard`, `Customers`, `Reports`, and `Analytics` are unpopulated legacy tabs. The dashboard reader excludes them completely from batch reads to preserve Sheets API quota.
   - Tab `ExceptionReport` contains live unhandled errors from the bot; the dashboard surfaces this directly in the Exceptions section.

3. **Rates & Configuration:**
   - Rates (overtime, congestion charge, tunnel charge) are read strictly from `src/config/env.ts` on the server and never hardcoded in the frontend.
   - `Settings` sheet only contains `CUSTOMER_CONFIRMATION_TEXT`.

4. **Authentication & Session:**
   - Coexists with `/admin` by reusing `requireAdminSession` from `src/admin/admin.auth.ts`.
   - Added rate limiting specifically for `/ops` routes to prevent request flooding.

5. **Cloud Run Concurrency Invariant:**
   - Because Cloud Run runs with `--concurrency 1`, all reads use Stale-While-Revalidate caching (default TTL 30s) so that dashboard requests return immediately from memory (<5ms) and background revalidations do not block driver Chat webhook actions.

---

## 2. Unrelated Upstream Observations (Out of Scope)
- Deployment scripts in `deploy/deploy.sh` contain known upstream environment variable mismatches for Cloud Tasks (`TMV_TASKS_SERVICE_ACCOUNT_EMAIL` vs `TMV_TASKS_SERVICE_ACCOUNT`). Preserved untouched per the isolation brief.
