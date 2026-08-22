/**
 * TMV preflight — validates a live Google Workspace setup against the assumptions
 * this build makes. Read-only by default.
 *
 *   npx tsx verify/preflight.ts            # read-only checks
 *   npx tsx verify/preflight.ts --write    # adds a write round-trip to ActivityLog
 *                                          # (writes one sentinel row, then deletes it)
 *
 * Exit code 1 if any BLOCKER is found.
 */
import { google } from "googleapis";
import { DateTime } from "luxon";
import { createGoogleAuth, env, SCOPES } from "../src/config/env";
import { SCHEMA, SHEETS } from "../src/google/sheets";
import { parseCalendarEvent } from "../src/jobs/booking.service";

const WRITE_TEST = process.argv.includes("--write");

const blockers: string[] = [];
const warnings: string[] = [];
const timings: { op: string; ms: number }[] = [];

const blocker = (m: string) => { blockers.push(m); console.log(`  BLOCKER  ${m}`); };
const warn = (m: string) => { warnings.push(m); console.log(`  WARN     ${m}`); };
const ok = (m: string) => console.log(`  ok       ${m}`);
const info = (m: string) => console.log(`           ${m}`);

function heading(text: string): void {
  console.log("\n" + "=".repeat(78));
  console.log(text);
  console.log("=".repeat(78));
}

async function time<T>(op: string, fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    return await fn();
  } finally {
    timings.push({ op, ms: Date.now() - started });
  }
}

function columnLetter(index: number): string {
  let n = index;
  let letters = "";
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
}

function redact(value: string): string {
  if (!value) return "(empty)";
  return value.length <= 10 ? value : `${value.slice(0, 6)}…${value.slice(-4)}`;
}

// ---------------------------------------------------------------------------

async function checkConfig(): Promise<void> {
  heading("1. Configuration");
  info(`spreadsheetId        ${redact(env.spreadsheetId)}`);
  info(`calendarId           ${redact(env.calendarId)}`);
  info(`driveRootFolderId    ${redact(env.driveRootFolderId)}`);
  info(`timezone             ${env.timezone}`);
  info(`impersonatedUser     ${env.impersonatedUser || "(none — no domain-wide delegation)"}`);

  if (!env.chatActionUrl) {
    blocker("TMV_CHAT_ACTION_URL is not set. Card buttons will not work and the server will refuse to start.");
  } else if (!/^https:\/\//i.test(env.chatActionUrl)) {
    blocker(`TMV_CHAT_ACTION_URL must be https. Got: ${env.chatActionUrl}`);
  } else if (/YOUR-CLOUD-RUN-URL|example\.(test|com)/i.test(env.chatActionUrl)) {
    blocker(`TMV_CHAT_ACTION_URL is still the placeholder from .env.example: ${env.chatActionUrl}`);
  } else if (/ngrok|localhost|127\.0\.0\.1/i.test(env.chatActionUrl)) {
    warn(`TMV_CHAT_ACTION_URL points at a dev tunnel (${env.chatActionUrl}). Fine locally, wrong for production.`);
  } else {
    ok(`chat action URL ${env.chatActionUrl}`);
  }

  if (env.serviceAccountEmail && env.serviceAccountPrivateKey) {
    if (!env.serviceAccountPrivateKey.includes("BEGIN PRIVATE KEY")) {
      blocker("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY does not look like a PEM key (placeholder still in .env?).");
    } else {
      ok(`service account ${env.serviceAccountEmail}`);
    }
  } else {
    info("No service-account key set; falling back to Application Default Credentials.");
  }

  if (!env.verifyChatRequests) {
    warn("VERIFY_CHAT_REQUESTS=false. Acceptable only if Cloud Run IAM restricts the invoker to chat@system.gserviceaccount.com.");
  }
  if (env.syncSecret === "change-me") warn("SYNC_SECRET is still the default value.");
}

async function checkAuth(): Promise<void> {
  heading("2. Authentication (one token exchange per scope set)");
  for (const [name, scopes] of Object.entries(SCOPES)) {
    try {
      const client = await time(`auth:${name}`, async () => {
        const c = await createGoogleAuth(scopes);
        await c.getAccessToken();
        return c;
      });
      void client;
      ok(`${name.padEnd(9)} token acquired`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (name === "GMAIL" && !env.impersonatedUser) {
        warn(`GMAIL      ${message} (expected without domain-wide delegation; start emails will be skipped)`);
      } else {
        blocker(`${name.padEnd(9)} ${message}`);
      }
    }
  }
}

async function checkSpreadsheet(): Promise<void> {
  heading("3. Spreadsheet structure");
  const auth = await createGoogleAuth(SCOPES.SHEETS);
  const sheets = google.sheets({ version: "v4", auth });

  const meta = await time("sheets.spreadsheets.get", () =>
    sheets.spreadsheets.get({
      spreadsheetId: env.spreadsheetId,
      fields: "properties.title,sheets.properties(sheetId,title,gridProperties(columnCount,rowCount))"
    })
  );
  info(`workbook: "${meta.data.properties?.title}"`);

  const live = new Map(
    (meta.data.sheets ?? []).map(s => [
      s.properties?.title ?? "",
      {
        columnCount: s.properties?.gridProperties?.columnCount ?? 0,
        rowCount: s.properties?.gridProperties?.rowCount ?? 0
      }
    ])
  );

  const names = Object.keys(SCHEMA);
  const missing = names.filter(n => !live.has(n));
  if (missing.length) {
    warn(`Missing tabs: ${missing.join(", ")}. BOOTSTRAP_ON_START=true will create them on next boot.`);
  }

  const present = names.filter(n => live.has(n));
  const headerRows = await time("sheets.values.batchGet (headers)", () =>
    sheets.spreadsheets.values.batchGet({
      spreadsheetId: env.spreadsheetId,
      ranges: present.map(n => `'${n.replace(/'/g, "''")}'!1:1`)
    })
  );

  console.log("");
  console.log(`  ${"Tab".padEnd(16)} ${"Rows".padStart(7)} ${"Cols".padStart(5)}  Header row`);
  console.log(`  ${"-".repeat(16)} ${"-".repeat(7)} ${"-".repeat(5)}  ${"-".repeat(30)}`);

  present.forEach((name, index) => {
    const expected = SCHEMA[name];
    const actual = ((headerRows.data.valueRanges?.[index]?.values?.[0] ?? []) as string[])
      .map(String)
      .filter(h => h.trim() !== "");
    const grid = live.get(name)!;
    const dataRows = Math.max(0, actual.length ? grid.rowCount : 0);

    let verdict = "matches schema";
    if (!actual.length) {
      verdict = "EMPTY — will be written on boot";
    } else if (actual.length !== expected.length || actual.some((h, i) => h !== expected[i])) {
      verdict = "DRIFT";
    }
    console.log(
      `  ${name.padEnd(16)} ${String(grid.rowCount).padStart(7)} ${String(grid.columnCount).padStart(5)}  ${verdict}`
    );
    void dataRows;

    // The critical check: this build writes rows positionally from SCHEMA.
    if (verdict === "DRIFT") {
      const detail = expected
        .map((h, i) => (actual[i] === h ? null : `col ${columnLetter(i)}: expected "${h}", found "${actual[i] ?? "(blank)"}"`))
        .filter(Boolean)
        .slice(0, 4);
      blocker(
        `"${name}" header row differs from SCHEMA. Rows are written positionally, so this must be reconciled ` +
          `before writes. ${detail.join("; ")}`
      );
    }

    // appendCells does not auto-expand the grid the way the values API did.
    if (grid.columnCount < expected.length) {
      warn(
        `"${name}" grid is ${grid.columnCount} columns but the schema needs ${expected.length}. ` +
          "Boot with BOOTSTRAP_ON_START=true to widen it, or appendCells will fail."
      );
    }
  });

  // Size of the read that still happens on the request path.
  const bookings = live.get(SHEETS.BOOKINGS);
  if (bookings) {
    const values = await time("sheets.values.get (Bookings A:A)", () =>
      sheets.spreadsheets.values.get({
        spreadsheetId: env.spreadsheetId,
        range: `'${SHEETS.BOOKINGS}'!A2:A`
      })
    );
    const count = (values.data.values ?? []).filter(r => String(r[0] ?? "").trim()).length;
    console.log("");
    info(`Bookings holds ${count} job rows. This tab is still read in full to select a job.`);
    if (count > 2000) {
      warn(`${count} booking rows is past the comfortable range for a full read. Archive completed jobs, or move to Tier 2.`);
    } else {
      ok(`${count} booking rows — full read is cheap at this size`);
    }
  }
}

async function checkDrivers(): Promise<void> {
  heading("4. Drivers");
  const auth = await createGoogleAuth(SCOPES.SHEETS);
  const sheets = google.sheets({ version: "v4", auth });
  const res = await time("sheets.values.get (Drivers)", () =>
    sheets.spreadsheets.values.get({ spreadsheetId: env.spreadsheetId, range: `'${SHEETS.DRIVERS}'!A:F` })
  );
  const rows = (res.data.values ?? []).slice(1).filter(r => r.some(v => String(v ?? "").trim()));
  if (!rows.length) {
    blocker("Drivers tab is empty. Every driver will be rejected with 'Driver is not registered'.");
    return;
  }
  const seen = new Set<string>();
  for (const row of rows) {
    const [initials, name, email, chatName, active, role] = row.map(v => String(v ?? "").trim());
    const identity = email || chatName;
    const flags: string[] = [];
    if (!initials) flags.push("no initials (cannot be matched to a Calendar booking)");
    if (!identity) flags.push("no email or Chat user name (cannot be identified)");
    if (initials && seen.has(initials)) flags.push(`duplicate initials "${initials}"`);
    if (initials) seen.add(initials);
    const isActive = ["TRUE", "true", "1", "yes", "Y"].includes(active || "TRUE");
    const label = `${initials || "??"}  ${(name || "(no name)").padEnd(20)} ${identity || "(no identity)"}`;
    if (flags.length) warn(`${label} — ${flags.join("; ")}`);
    else if (!isActive) info(`${label} — inactive`);
    else ok(`${label} [${role || "Driver"}]`);
  }
}

async function checkDrive(): Promise<void> {
  heading("5. Drive");
  const auth = await createGoogleAuth(SCOPES.DRIVE);
  const drive = google.drive({ version: "v3", auth });

  try {
    const folder = await time("drive.files.get (root)", () =>
      drive.files.get({
        fileId: env.driveRootFolderId,
        fields: "id,name,mimeType,driveId,capabilities(canAddChildren)",
        supportsAllDrives: true
      })
    );
    ok(`root folder "${folder.data.name}"`);

    if (!folder.data.capabilities?.canAddChildren) {
      blocker("The service account cannot create children in the Drive root folder. Share it as Editor/Content manager.");
    }

    // Service accounts have no My Drive storage quota, so uploads into a personal
    // folder fail with storageQuotaExceeded even when sharing looks correct.
    if (!folder.data.driveId) {
      warn(
        "Drive root is in a personal My Drive, not a Shared Drive. Service accounts have no My Drive quota, " +
          "so photo uploads can fail with storageQuotaExceeded. Move the folder into a Shared Drive."
      );
    } else {
      ok(`root folder lives in Shared Drive ${redact(folder.data.driveId)}`);
    }

    const jobs = await time("drive.files.list (Jobs)", () =>
      drive.files.list({
        q: `'${env.driveRootFolderId}' in parents and name='Jobs' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id,name)",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      })
    );
    if (jobs.data.files?.length) ok("Jobs/ folder exists");
    else info("Jobs/ folder does not exist yet; it is created on the first START JOB.");
  } catch (error) {
    blocker(`Drive root folder unreachable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function checkCalendar(): Promise<void> {
  heading("6. Calendar — today's bookings and how they parse");
  const auth = await createGoogleAuth(SCOPES.CALENDAR);
  const calendar = google.calendar({ version: "v3", auth });
  const now = DateTime.now().setZone(env.timezone);

  try {
    const res = await time("calendar.events.list", () =>
      calendar.events.list({
        calendarId: env.calendarId,
        timeMin: now.startOf("day").toUTC().toISO()!,
        timeMax: now.endOf("day").toUTC().toISO()!,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 250
      })
    );
    const events = res.data.items ?? [];
    info(`${events.length} event(s) today (${now.toFormat("dd LLL yyyy")})`);
    if (!events.length) {
      info("No events to parse. Re-run on a day with bookings to validate the title/description convention.");
      return;
    }

    for (const event of events.slice(0, 8)) {
      const parsed = parseCalendarEvent(event);
      console.log("");
      info(`"${event.summary ?? "(no title)"}"`);
      if (!parsed) {
        warn("  -> skipped (cancelled, or missing start/end time)");
        continue;
      }
      const gaps: string[] = [];
      if (!parsed.driverInitials) gaps.push("driver initials");
      if (!parsed.price) gaps.push("price");
      if (!parsed.crewSize) gaps.push("crew size");
      if (!parsed.customerName) gaps.push("customer name");
      if (!parsed.pickup) gaps.push("pickup");
      if (!parsed.dropoff) gaps.push("drop-off");
      info(
        `  -> driver=${parsed.driverInitials || "?"} crew=${parsed.crewSize || "?"} ` +
          `price=£${parsed.price || "?"} paidOnline=${parsed.paidOnline} customer=${parsed.customerName || "?"}`
      );
      if (gaps.length) {
        warn(`  missing: ${gaps.join(", ")} — the job will sync but these fields stay blank`);
      } else {
        ok("  all booking fields parsed");
      }
    }
  } catch (error) {
    blocker(`Calendar unreadable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function checkWrite(): Promise<void> {
  heading("7. Write round trip (ActivityLog sentinel)");
  const auth = await createGoogleAuth(SCOPES.SHEETS);
  const sheets = google.sheets({ version: "v4", auth });
  const sentinel = `PREFLIGHT-${Date.now()}`;

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: env.spreadsheetId,
    fields: "sheets.properties(sheetId,title)"
  });
  const sheetId = (meta.data.sheets ?? []).find(s => s.properties?.title === SHEETS.ACTIVITY)?.properties?.sheetId;
  if (sheetId == null) {
    blocker("ActivityLog tab not found; cannot run the write test.");
    return;
  }

  const headers = SCHEMA[SHEETS.ACTIVITY];
  const values = headers.map(h =>
    h === "Job ID" ? sentinel : h === "Action" ? "PREFLIGHT_WRITE_TEST" : h === "Timestamp" ? new Date().toISOString() : ""
  );

  try {
    // Exactly the mechanism the patched code uses: appendCells via batchUpdate.
    await time("sheets.batchUpdate (appendCells)", () =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId: env.spreadsheetId,
        requestBody: {
          requests: [
            {
              appendCells: {
                sheetId,
                rows: [{ values: values.map(v => ({ userEnteredValue: { stringValue: v } })) }],
                fields: "userEnteredValue"
              }
            }
          ]
        }
      })
    );
    ok("appendCells accepted");

    const readBack = await time("sheets.values.get (read back)", () =>
      sheets.spreadsheets.values.get({ spreadsheetId: env.spreadsheetId, range: `'${SHEETS.ACTIVITY}'!B2:B` })
    );
    const rows = (readBack.data.values ?? []) as string[][];
    const rowIndex = rows.findIndex(r => String(r[0] ?? "") === sentinel);
    if (rowIndex < 0) {
      blocker("Sentinel row was written but could not be read back.");
      return;
    }
    ok(`sentinel found at row ${rowIndex + 2}`);

    await time("sheets.batchUpdate (deleteDimension)", () =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId: env.spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: { sheetId, dimension: "ROWS", startIndex: rowIndex + 1, endIndex: rowIndex + 2 }
              }
            }
          ]
        }
      })
    );
    ok("sentinel row deleted — spreadsheet left unchanged");
  } catch (error) {
    blocker(`Write test failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ---------------------------------------------------------------------------

(async () => {
  console.log("TMV preflight — validating the live Google Workspace setup");
  console.log(WRITE_TEST ? "Mode: read-only checks + write round trip" : "Mode: read-only (pass --write to test writing)");

  await checkConfig();
  await checkAuth();
  if (!blockers.length || blockers.every(b => b.includes("VERIFY_CHAT"))) {
    await checkSpreadsheet();
    await checkDrivers();
    await checkDrive();
    await checkCalendar();
    if (WRITE_TEST) await checkWrite();
  } else {
    console.log("\nSkipping remaining checks: authentication or configuration failed.");
  }

  heading("Latency on your infrastructure");
  for (const { op, ms } of timings) console.log(`  ${String(ms).padStart(6)} ms  ${op}`);
  const authMs = timings.filter(t => t.op.startsWith("auth:")).reduce((a, b) => a + b.ms, 0);
  const callMs = timings.filter(t => !t.op.startsWith("auth:")).reduce((a, b) => a + b.ms, 0);
  const apiCalls = timings.filter(t => !t.op.startsWith("auth:")).length;
  console.log("");
  console.log(`  token exchanges : ${timings.filter(t => t.op.startsWith("auth:")).length} totalling ${authMs} ms`);
  console.log(`  API calls       : ${apiCalls} totalling ${callMs} ms (avg ${Math.round(callMs / Math.max(1, apiCalls))} ms)`);
  if (apiCalls >= 3) {
    const avg = Math.round(callMs / apiCalls);
    console.log("");
    console.log("  Projected warm interaction cost with this build:");
    console.log(`    button click  ~${avg * 2} ms   (2 calls)`);
    console.log(`    photo upload  ~${avg * 5} ms   (5 calls, excluding image transfer)`);
  }

  heading(`Verdict: ${blockers.length} blocker(s), ${warnings.length} warning(s)`);
  if (!blockers.length && !warnings.length) console.log("  Clean. Safe to deploy this build.");
  blockers.forEach(b => console.log(`  BLOCKER  ${b}`));
  warnings.forEach(w => console.log(`  WARN     ${w}`));
  process.exit(blockers.length ? 1 : 0);
})().catch(error => {
  console.error("\nPreflight crashed:", error);
  process.exit(1);
});
