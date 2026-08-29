/**
 * The modern dashboard, mounted at /admin (its only mount point -- see src/server.ts;
 * it used to also be mounted API-only at /ops, which is gone now). Covers what
 * verify/admin.js used to cover for the classic server-rendered panel, plus the
 * write-side endpoints this dashboard didn't have until this session: real
 * login/auth gating, Add Job (a real Calendar event, synced back in), Add/Edit/
 * Deactivate Driver (a real Drivers-sheet upsert the bot itself reads), Settings
 * save/read-back, and real (not fabricated) Notifications delivery status.
 */
process.env.GOOGLE_SHEETS_SPREADSHEET_ID = "sheet-test";
process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = "root-test";
process.env.GOOGLE_CALENDAR_ID = "calendar-test";
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "svc@test.iam.gserviceaccount.com";
process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nFAKE\\n-----END PRIVATE KEY-----\\n";
process.env.GOOGLE_WORKSPACE_IMPERSONATED_USER = "ops@tmv.test";
process.env.TMV_SIGNATURE_LINK_SECRET = "test-ops-session-secret";
process.env.TMV_ADMIN_PASSWORD = "test-ops-password";
process.env.LOG_LEVEL = "error";
process.env.BOOTSTRAP_ON_START = "false";
process.env.TMV_SHEET_CACHE_TTL_MS = "0";
process.env.TMV_DASHBOARD_CACHE_TTL_MS = "0";
// getDriverByInitials()/getSetting() have their own longer-lived caches independent of
// TMV_SHEET_CACHE_TTL_MS -- without zeroing these too, the "the bot's own lookup sees
// the write" checks below would read a stale pre-write snapshot within the same run.
process.env.TMV_DRIVER_CACHE_TTL_MS = "0";
process.env.FIRETEXT_API_KEY = "";
process.env.FIRETEXT_SENDER_ID = "";

const path = require("node:path");
const BOT = path.join(__dirname, "..", "dist");
const DASHBOARD_DIST = path.join(__dirname, "..", "dashboard", "dist", "dashboard", "server");

const HEADERS = {
  Bookings: ["Job ID","Calendar Event ID","Driver Initials","Customer","Customer Email","Phone","Pickup","Dropoff","Crew Size","Base Price","Paid Online","Booked Start","Booked Finish","Actual Start","Actual Finish","Booked Minutes","Actual Minutes","Difference Minutes","Delay Status","Extra Charges","Overtime Minutes","Overtime Charge","Total Charges","Payment Method","Payment Status","Client Name/Postcode","Client Confirmed By","Status","Current State","Drive Folder ID","Drive Folder URL","Created","Updated"],
  Drivers: ["Initials","Full Name","Email","Chat User Name","Active","Role","Phone","Van Registration"],
  WorkflowState: ["Job ID","Driver","State","Updated"],
  DriverFlow: ["Timestamp","Job ID","Driver","Field","Value","State"],
  Payments: ["Timestamp","Job ID","Driver","Method","Amount","Status"],
  Signatures: ["Timestamp","Job ID","Driver","Customer Name","Mode","Confirmation Text"],
  Evidence: ["Evidence ID","Job ID","Driver","Evidence Type","Attachment Ref","Content Type","File Name","Status","Received","Processing Started","Processing Completed","Drive File ID","Drive URL","Retry Count","Last Error"],
  Photos: ["Timestamp","Job ID","Driver","Step","File ID","File URL"," ","Content Type"],
  ActivityLog: ["Timestamp","Job ID","Driver","Action","From State","To State","Detail"],
  ProcessedEvents: ["Event Key","Job ID","Outcome State","Processed At"],
  ExceptionReport: ["Timestamp","Job ID","Type","Detail","Resolved"],
  Settings: ["Key","Value","Notes"],
  StorageCheckIn: ["Timestamp","Job ID","Driver","Container Number","Client Name","Client Phone","Client Email","Client Present","Date","Photo URLs","Signature URL"],
  StorageCheckOut: ["Timestamp","Job ID","Driver","Container Number","Client Name","Client Email","Client Present At Dropoff","Date","Photo URLs","Signature URL"],
  ParkingLiability: ["Timestamp","Job ID","Driver","Address","Client Full Name","Photo URLs","Signature URL"],
  LiabilityReport: ["Timestamp","Job ID","Driver","Damage Categories","Photo URLs","Signature URL"],
  PendingSignatures: ["Job ID","Message Name","Updated"],
  ScenarioProgress: ["Key","Job ID","Scenario","Step","Fields JSON","Message Name","Started","Updated"]
};
const tabs = {};
for (const [n, h] of Object.entries(HEADERS)) tabs[n] = [h.slice()];

function addRow(tab, values) {
  const row = new Array(HEADERS[tab].length).fill("");
  const set = (c, v) => { row[HEADERS[tab].indexOf(c)] = String(v); };
  Object.entries(values).forEach(([c, v]) => set(c, v));
  tabs[tab].push(row);
}

addRow("Bookings", {
  "Job ID": "TMV-OPS0001", "Driver Initials": "WD", "Customer": "Barry Thompson",
  "Pickup": "10 Example Street", "Dropoff": "74 Ferndale Road, N15 6UQ",
  "Actual Start": "2026-08-15T09:02:00.000Z", "Actual Finish": "2026-08-15T10:15:00.000Z",
  "Total Charges": "350", "Status": "COMPLETED", "Current State": "COMPLETED"
});
addRow("Drivers", { "Initials": "WD", "Full Name": "William Driver", "Email": "driver@tmv.test", "Active": "TRUE", "Phone": "07900111222", "Van Registration": "AB12 CDE" });

// Notification-delivery-status fixtures -- same shape verify/admin.js used for the
// classic panel, since notifications.route.ts is a verbatim port of the same logic.
addRow("Bookings", {
  "Job ID": "TMV-OPS-NOTIFY-SENT", "Driver Initials": "WD", "Customer": "Carla Sent",
  "Customer Email": "carla@example.test", "Phone": "07111111111", "Actual Start": "2026-08-16T09:00:00.000Z",
  "Status": "IN_PROGRESS", "Current State": "IN_PROGRESS"
});
addRow("Bookings", {
  "Job ID": "TMV-OPS-NOTIFY-FAILED", "Driver Initials": "WD", "Customer": "Fred Failed",
  "Customer Email": "fred@example.test", "Phone": "07222222222", "Actual Start": "2026-08-16T09:05:00.000Z",
  "Status": "IN_PROGRESS", "Current State": "IN_PROGRESS"
});
addRow("ActivityLog", { "Job ID": "TMV-OPS-NOTIFY-SENT", "Action": "CLIENT_START_EMAIL_SENT", "Timestamp": "2026-08-16T09:00:05.000Z", "Detail": "carla@example.test" });
addRow("ActivityLog", { "Job ID": "TMV-OPS-NOTIFY-FAILED", "Action": "CLIENT_START_EMAIL_FAILED", "Timestamp": "2026-08-16T09:05:05.000Z", "Detail": "Invalid recipient address" });

const idToTab = {}; Object.keys(HEADERS).forEach((n, i) => { idToTab[i + 1] = n; });
function colIndex(l) { let n = 0; for (const c of l) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; }
function slice(range) {
  const m = range.match(/^'((?:[^']|'')+)'!(.+)$/);
  const tab = m[1].replace(/''/g, "'"); const spec = m[2]; const rows = tabs[tab] || [];
  if (/^\d+:\d+$/.test(spec)) { const [a, b] = spec.split(":").map(Number); return rows.slice(a - 1, b); }
  const r = spec.match(/^([A-Z]+)(\d*):([A-Z]+)(\d*)$/);
  const c1 = colIndex(r[1]), c2 = colIndex(r[3]);
  const r1 = r[2] ? Number(r[2]) : 1, r2 = r[4] ? Number(r[4]) : rows.length;
  return rows.slice(r1 - 1, r2).map(x => x.slice(c1, c2 + 1));
}
const cellText = c => {
  const v = c && c.userEnteredValue; if (!v) return "";
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.numberValue !== undefined) return String(v.numberValue);
  if (v.boolValue !== undefined) return v.boolValue ? "TRUE" : "FALSE";
  return "";
};

const googleapis = require(require.resolve("googleapis", { paths: [BOT + "/.."] }));
googleapis.google.sheets = () => ({ spreadsheets: {
  get: async () => ({ data: { sheets: Object.keys(HEADERS).map((title, i) => ({ properties: { title, sheetId: i + 1, gridProperties: { columnCount: 40 } } })) } }),
  values: {
    batchGet: async ({ ranges }) => ({ data: { valueRanges: ranges.map(r => ({ values: slice(r) })) } }),
    batchUpdate: async () => ({ data: {} })
  },
  batchUpdate: async ({ requestBody }) => {
    for (const rq of requestBody.requests || []) {
      if (rq.appendCells) tabs[idToTab[rq.appendCells.sheetId]].push(rq.appendCells.rows[0].values.map(cellText));
      else if (rq.updateCells) tabs[idToTab[rq.updateCells.start.sheetId]][rq.updateCells.start.rowIndex] = rq.updateCells.rows[0].values.map(cellText);
    }
    return { data: {} };
  }
} });
googleapis.google.drive = () => ({ files: {
  get: async ({ fileId }, opts) => {
    if (opts && opts.responseType === "arraybuffer") {
      const bytes = Buffer.from("fake-bytes");
      return { data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), headers: { "content-type": "image/jpeg" } };
    }
    return { data: { id: fileId, mimeType: "image/jpeg" } };
  }
} });

// Stateful Calendar fake: an inserted event is what the sync's own subsequent list
// call reads back -- this is what actually proves the Add Job round trip end to end,
// not just that the endpoint returns 200.
const calendarEvents = [];
let nextEventId = 1;
googleapis.google.calendar = () => ({ events: {
  list: async () => ({ data: { items: calendarEvents.slice() } }),
  insert: async ({ requestBody }) => {
    const event = { ...requestBody, id: `evt-ops-${nextEventId++}`, status: "confirmed" };
    calendarEvents.push(event);
    return { data: event };
  }
} });

const gal = require(require.resolve("google-auth-library", { paths: [BOT + "/.."] }));
gal.JWT.prototype.getAccessToken = async () => ({ token: "fake" });

const express = require("express");
const { dashboardRouter } = require(path.join(DASHBOARD_DIST, "router"));
const app = express();
app.use(express.json({ limit: "2mb" }));
app.use("/admin", dashboardRouter());
const server = app.listen(0);

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(62)} ${ok ? JSON.stringify(actual) : `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
}

(async () => {
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  console.log("=".repeat(72));
  console.log("Auth: login is real now (not the old branch's client-side mock), and");
  console.log("the auth gate actually runs (it was commented out on the merged branch)");
  console.log("=".repeat(72));

  const noAuthRes = await fetch(`${base}/admin/api/jobs`);
  check("no session -> 401 on API routes", noAuthRes.status, 401);

  const badLoginRes = await fetch(`${base}/admin/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "wrong" })
  });
  check("wrong password -> 401", badLoginRes.status, 401);

  const loginRes = await fetch(`${base}/admin/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "test-ops-password" })
  });
  check("correct password -> 200", loginRes.status, 200);
  const cookie = (loginRes.headers.get("set-cookie") || "").split(";")[0];
  check("session cookie issued", cookie.startsWith("tmv_ops_session="), true);
  const authed = { headers: { Cookie: cookie } };

  const statusRes = await fetch(`${base}/admin/api/auth/status`, authed);
  const statusBody = await statusRes.json();
  check("auth status reflects the session", statusBody.authenticated, true);

  console.log("\n" + "=".repeat(72));
  console.log("/admin now serves the new dashboard shell, not the old server-rendered panel");
  console.log("=".repeat(72));

  const shellRes = await fetch(`${base}/admin`, authed);
  check("dashboard shell status", shellRes.status, 200);
  const shellHtml = await shellRes.text();
  check("shell is the built SPA (has a script bundle reference), not the old inline-script page",
    shellHtml.includes("<script") && !shellHtml.includes("TMV Admin</h2>"), true);

  console.log("\n" + "=".repeat(72));
  console.log("Add Job: creates a real Calendar event and syncs it back into Bookings");
  console.log("=".repeat(72));

  const badJobRes = await fetch(`${base}/admin/api/jobs`, {
    method: "POST", headers: { "Content-Type": "application/json", ...authed.headers }, body: JSON.stringify({})
  });
  check("add job without required fields -> 400", badJobRes.status, 400);

  const start = "2026-09-01T09:00";
  const finish = "2026-09-01T10:30";
  const addJobRes = await fetch(`${base}/admin/api/jobs`, {
    method: "POST", headers: { "Content-Type": "application/json", ...authed.headers },
    body: JSON.stringify({
      customerName: "Nina Newjob", customerEmail: "nina@example.test", customerPhone: "07123456789",
      pickup: "1 New Street", dropoff: "2 New Road", crewSize: 2, price: 275, paidOnline: true,
      driverInitials: "WD", start, finish
    })
  });
  const addJobBody = await addJobRes.json();
  check("add job with valid data -> 200", addJobRes.status, 200);
  check("add job response ok", addJobBody.ok, true);
  check("a real Calendar event was inserted", calendarEvents.length, 1);
  const newBookingRow = tabs.Bookings.slice(1).find(r => r[HEADERS.Bookings.indexOf("Customer")] === "Nina Newjob");
  check("new job synced into the Bookings sheet", Boolean(newBookingRow), true);
  check("synced job carries the driver initials", newBookingRow && newBookingRow[HEADERS.Bookings.indexOf("Driver Initials")], "WD");

  const unknownDriverJobRes = await fetch(`${base}/admin/api/jobs`, {
    method: "POST", headers: { "Content-Type": "application/json", ...authed.headers },
    body: JSON.stringify({
      customerName: "Bad Driver Job", pickup: "1 St", dropoff: "2 St", crewSize: 1, price: 100,
      driverInitials: "ZZ", start, finish
    })
  });
  check("add job with an unknown driver's initials -> 400", unknownDriverJobRes.status, 400);
  check("no second Calendar event was inserted for the rejected job", calendarEvents.length, 1);

  console.log("\n" + "=".repeat(72));
  console.log("Add/Edit/Deactivate Driver: a real Drivers-sheet upsert, the same one");
  console.log("the bot's own getDriverByInitials() reads");
  console.log("=".repeat(72));

  const { getDriverByInitials } = require(BOT + "/google/sheets");

  const addDriverRes = await fetch(`${base}/admin/api/drivers`, {
    method: "POST", headers: { "Content-Type": "application/json", ...authed.headers },
    body: JSON.stringify({
      initials: "NJ", fullName: "New Joiner", email: "newjoiner@tmv.test", role: "Driver",
      active: true, phone: "07999888777", vanRegistration: "NJ21 OIN"
    })
  });
  check("add driver -> 200", addDriverRes.status, 200);
  const addedDriver = await getDriverByInitials("NJ");
  check("the bot's own driver lookup sees the new driver", addedDriver && addedDriver.fullName, "New Joiner");
  check("phone/van registration round-tripped", addedDriver && [addedDriver.phone, addedDriver.vanRegistration], ["07999888777", "NJ21 OIN"]);

  // Resubmitting with the same email upserts (edit), not a duplicate row.
  const editDriverRes = await fetch(`${base}/admin/api/drivers`, {
    method: "POST", headers: { "Content-Type": "application/json", ...authed.headers },
    body: JSON.stringify({
      initials: "NJ", fullName: "New Joiner (Updated)", email: "newjoiner@tmv.test", role: "Driver",
      active: true, phone: "07999888777", vanRegistration: "NJ21 OIN"
    })
  });
  check("edit driver (same email) -> 200", editDriverRes.status, 200);
  check("exactly one Drivers row for this email (upsert, not duplicate)",
    tabs.Drivers.slice(1).filter(r => r[HEADERS.Drivers.indexOf("Email")] === "newjoiner@tmv.test").length, 1);
  const editedDriver = await getDriverByInitials("NJ");
  check("edit took effect", editedDriver && editedDriver.fullName, "New Joiner (Updated)");

  const deactivateRes = await fetch(`${base}/admin/api/drivers`, {
    method: "POST", headers: { "Content-Type": "application/json", ...authed.headers },
    body: JSON.stringify({ initials: "NJ", fullName: "New Joiner (Updated)", email: "newjoiner@tmv.test", active: false })
  });
  check("deactivate driver -> 200", deactivateRes.status, 200);
  // resolveDriver()-style lookups treat an inactive driver as unusable; getDriverByInitials
  // itself just reports what's on the row -- confirm the Active flag actually flipped.
  const deactivated = await getDriverByInitials("NJ");
  check("driver record now reads inactive, not deleted", deactivated && deactivated.active, false);

  console.log("\n" + "=".repeat(72));
  console.log("Settings: save + read-back, the same Settings sheet the bot's own");
  console.log("getSetting() reads for the driver-facing on-my-way card");
  console.log("=".repeat(72));

  const { getSetting } = require(BOT + "/google/sheets");

  const settingsRes = await fetch(`${base}/admin/api/settings`, authed);
  check("settings list -> 200", settingsRes.status, 200);
  const settingsBody = await settingsRes.json();
  check("all 3 real templates are present", settingsBody.settings.map(s => s.key).sort(),
    ["confirmationText", "jobStartedMessage", "reviewRequestEmail"]);

  const saveRes = await fetch(`${base}/admin/api/settings`, {
    method: "POST", headers: { "Content-Type": "application/json", ...authed.headers },
    body: JSON.stringify({ key: "jobStartedMessage", value: "Custom on-my-way text {driverPhone}" })
  });
  check("save setting -> 200", saveRes.status, 200);
  const readBack = await getSetting("JOB_STARTED_MESSAGE_TEXT", "should not see this fallback");
  check("the bot's own getSetting() sees the saved value", readBack, "Custom on-my-way text {driverPhone}");

  console.log("\n" + "=".repeat(72));
  console.log("Notifications: real ActivityLog-backed delivery status, not a fabricated hash");
  console.log("=".repeat(72));

  const notifyRes = await fetch(`${base}/admin/api/notifications`, authed);
  check("notifications -> 200", notifyRes.status, 200);
  const notifyBody = await notifyRes.json();
  const sentRow = notifyBody.rows.find(r => r.jobId === "TMV-OPS-NOTIFY-SENT");
  const failedRow = notifyBody.rows.find(r => r.jobId === "TMV-OPS-NOTIFY-FAILED");
  check("email shows sent with the recorded address", sentRow && sentRow.email, { state: "sent", detail: "carla@example.test", at: "2026-08-16T09:00:05.000Z" });
  check("email shows failed with the failure reason", failedRow && failedRow.email, { state: "failed", detail: "Invalid recipient address", at: "2026-08-16T09:05:05.000Z" });
  check("SMS reads disabled (Firetext not configured), not a fake status", sentRow && sentRow.sms.state, "disabled");

  console.log("\n" + "=".repeat(72));
  console.log("Read-only endpoints still work under the new auth gate");
  console.log("=".repeat(72));

  const jobsRes = await fetch(`${base}/admin/api/jobs`, authed);
  check("jobs list -> 200", jobsRes.status, 200);
  const summaryRes = await fetch(`${base}/admin/api/summary`, authed);
  check("summary -> 200", summaryRes.status, 200);
  const driversSummaryRes = await fetch(`${base}/admin/api/drivers/summary`, authed);
  check("drivers summary -> 200", driversSummaryRes.status, 200);

  await new Promise((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
  server.closeAllConnections?.();

  console.log("\n" + "=".repeat(72));
  console.log(`${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
  setTimeout(() => process.exit(process.exitCode), 300).unref();
})();
