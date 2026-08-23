/**
 * Admin panel: session gate + the Finished Jobs tab's data join (Bookings x Drivers x
 * Evidence x Signatures) and its Drive-photo proxy. No browser involved -- this drives
 * the same Express router the real /admin panel mounts, over a real HTTP connection to
 * a local server, the same pattern as verify/flow.js uses for the classic workflow.
 */
process.env.GOOGLE_SHEETS_SPREADSHEET_ID = "sheet-test";
process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = "root-test";
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "svc@test.iam.gserviceaccount.com";
process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nFAKE\\n-----END PRIVATE KEY-----\\n";
process.env.TMV_SIGNATURE_LINK_SECRET = "test-admin-session-secret";
process.env.TMV_ADMIN_PASSWORD = "test-admin-password";
process.env.LOG_LEVEL = "error";
process.env.BOOTSTRAP_ON_START = "false";
process.env.TMV_SHEET_CACHE_TTL_MS = "0";

const path = require("node:path");
const BOT = path.join(__dirname, "..", "dist");

const HEADERS = {
  Bookings: ["Job ID","Calendar Event ID","Driver Initials","Customer","Customer Email","Phone","Pickup","Dropoff","Crew Size","Base Price","Paid Online","Booked Start","Booked Finish","Actual Start","Actual Finish","Booked Minutes","Actual Minutes","Difference Minutes","Delay Status","Extra Charges","Overtime Minutes","Overtime Charge","Total Charges","Payment Method","Payment Status","Client Name/Postcode","Client Confirmed By","Status","Current State","Drive Folder ID","Drive Folder URL","Created","Updated"],
  Drivers: ["Initials","Full Name","Email","Chat User Name","Active","Role"],
  Evidence: ["Evidence ID","Job ID","Driver","Evidence Type","Attachment Ref","Content Type","File Name","Status","Received","Processing Started","Processing Completed","Drive File ID","Drive URL","Retry Count","Last Error"],
  Signatures: ["Timestamp","Job ID","Driver","Customer Name","Mode","Confirmation Text"],
  Settings: ["Key","Value","Notes"],
  ActivityLog: ["Timestamp","Job ID","Driver","Action","From State","To State","Detail"]
};
const tabs = {};
for (const [n, h] of Object.entries(HEADERS)) tabs[n] = [h.slice()];

function addRow(tab, values) {
  const row = new Array(HEADERS[tab].length).fill("");
  const set = (c, v) => { row[HEADERS[tab].indexOf(c)] = String(v); };
  Object.entries(values).forEach(([c, v]) => set(c, v));
  tabs[tab].push(row);
}

// One completed job with a full evidence trail (including one non-classic evidence
// type, to check it's correctly excluded) plus a signature, and one job that never
// completed (to check it's correctly excluded from Finished Jobs entirely).
addRow("Bookings", {
  "Job ID": "TMV-ADMIN0001", "Driver Initials": "WD", "Customer": "Barry Thompson",
  "Pickup": "10 Example Street", "Dropoff": "74 Ferndale Road, N15 6UQ",
  "Actual Start": "2026-08-15T09:02:00.000Z", "Actual Finish": "2026-08-15T10:15:00.000Z",
  "Total Charges": "350", "Status": "COMPLETED", "Current State": "COMPLETED",
  "Drive Folder ID": "folder123456789", "Drive Folder URL": "https://drive.google.com/drive/folders/folder123456789"
});
addRow("Bookings", {
  "Job ID": "TMV-ADMIN0002", "Driver Initials": "WD", "Customer": "Alice Example",
  "Pickup": "2 Oak Road", "Dropoff": "SW1A 1AA", "Status": "IN_PROGRESS", "Current State": "IN_PROGRESS"
});
addRow("Drivers", { "Initials": "WD", "Full Name": "William Driver", "Email": "driver@tmv.test", "Active": "TRUE" });
addRow("Evidence", { "Evidence ID": "e1", "Job ID": "TMV-ADMIN0001", "Evidence Type": "Arrival", "Status": "COMPLETED", "Drive File ID": "fileArrival123456", "Drive URL": "https://drive.test/fileArrival123456" });
addRow("Evidence", { "Evidence ID": "e2", "Job ID": "TMV-ADMIN0001", "Evidence Type": "VanLoaded", "Status": "COMPLETED", "Drive File ID": "fileLoaded123456", "Drive URL": "https://drive.test/fileLoaded123456" });
// Still RECEIVED (never finished uploading) -- must not appear as a photo.
addRow("Evidence", { "Evidence ID": "e3", "Job ID": "TMV-ADMIN0001", "Evidence Type": "EmptyVan", "Status": "RECEIVED", "Drive File ID": "", "Drive URL": "" });
// A scenario's own evidence type on the SAME job -- must not appear among the classic
// 4-step photos, even though it's COMPLETED.
addRow("Evidence", { "Evidence ID": "e4", "Job ID": "TMV-ADMIN0001", "Evidence Type": "CheckIn", "Status": "COMPLETED", "Drive File ID": "fileCheckIn123456", "Drive URL": "https://drive.test/fileCheckIn123456" });
addRow("Signatures", { "Job ID": "TMV-ADMIN0001", "Customer Name": "Barry Thompson", "Confirmation Text": "https://drive.google.com/file/d/fileSignature12345/view?usp=drivesdk" });

// Notification-delivery-status fixtures -- one job per distinct outcome, plus one
// never-started job to confirm it's excluded entirely.
addRow("Bookings", {
  "Job ID": "TMV-NOTIFY-SENT", "Driver Initials": "WD", "Customer": "Carla Sent",
  "Customer Email": "carla@example.test", "Phone": "07111111111", "Actual Start": "2026-08-16T09:00:00.000Z",
  "Status": "IN_PROGRESS", "Current State": "IN_PROGRESS"
});
addRow("Bookings", {
  "Job ID": "TMV-NOTIFY-FAILED", "Driver Initials": "WD", "Customer": "Fred Failed",
  "Customer Email": "fred@example.test", "Phone": "07222222222", "Actual Start": "2026-08-16T09:05:00.000Z",
  "Status": "IN_PROGRESS", "Current State": "IN_PROGRESS"
});
addRow("Bookings", {
  "Job ID": "TMV-NOTIFY-PENDING", "Driver Initials": "WD", "Customer": "Pat Pending",
  "Customer Email": "pat@example.test", "Phone": "07333333333", "Actual Start": "2026-08-16T09:10:00.000Z",
  "Status": "IN_PROGRESS", "Current State": "IN_PROGRESS"
});
addRow("Bookings", {
  "Job ID": "TMV-NOTIFY-SKIPPED", "Driver Initials": "WD", "Customer": "Sam Skipped",
  "Actual Start": "2026-08-16T09:15:00.000Z", "Status": "IN_PROGRESS", "Current State": "IN_PROGRESS"
  // No Customer Email, no Phone -- both channels have nothing to send to.
});
addRow("Bookings", {
  "Job ID": "TMV-NOTIFY-RETRY", "Driver Initials": "WD", "Customer": "Rita Retry",
  "Customer Email": "rita@example.test", "Actual Start": "2026-08-16T09:20:00.000Z",
  "Status": "IN_PROGRESS", "Current State": "IN_PROGRESS"
});
addRow("Bookings", {
  "Job ID": "TMV-NOTIFY-NOTSTARTED", "Driver Initials": "WD", "Customer": "Never Started",
  "Customer Email": "never@example.test", "Status": "READY", "Current State": "READY"
  // No Actual Start -- Start Job was never tapped, so this must not appear at all.
});

addRow("ActivityLog", { "Job ID": "TMV-NOTIFY-SENT", "Action": "CLIENT_START_EMAIL_SENT", "Timestamp": "2026-08-16T09:00:05.000Z", "Detail": "carla@example.test" });
addRow("ActivityLog", { "Job ID": "TMV-NOTIFY-SENT", "Action": "CLIENT_START_SMS_SENT", "Timestamp": "2026-08-16T09:00:06.000Z", "Detail": "447111111111" });
addRow("ActivityLog", { "Job ID": "TMV-NOTIFY-FAILED", "Action": "CLIENT_START_EMAIL_FAILED", "Timestamp": "2026-08-16T09:05:05.000Z", "Detail": "Invalid recipient address" });
addRow("ActivityLog", { "Job ID": "TMV-NOTIFY-FAILED", "Action": "CLIENT_START_SMS_FAILED", "Timestamp": "2026-08-16T09:05:06.000Z", "Detail": "Firetext send failed: 2:0 Invalid destination number" });
// TMV-NOTIFY-PENDING gets no ActivityLog rows at all -- the task hasn't run/completed yet.
// A failure followed by a successful retry -- SENT must win even though FAILED happened first.
addRow("ActivityLog", { "Job ID": "TMV-NOTIFY-RETRY", "Action": "CLIENT_START_EMAIL_FAILED", "Timestamp": "2026-08-16T09:20:05.000Z", "Detail": "Timeout" });
addRow("ActivityLog", { "Job ID": "TMV-NOTIFY-RETRY", "Action": "CLIENT_START_EMAIL_SENT", "Timestamp": "2026-08-16T09:25:00.000Z", "Detail": "rita@example.test" });

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

const googleapis = require(require.resolve("googleapis", { paths: [BOT + "/.."] }));
googleapis.google.sheets = () => ({ spreadsheets: {
  get: async () => ({ data: { sheets: Object.keys(HEADERS).map((title, i) => ({ properties: { title, sheetId: i + 1, gridProperties: { columnCount: 40 } } })) } }),
  values: { batchGet: async ({ ranges }) => ({ data: { valueRanges: ranges.map(r => ({ values: slice(r) })) } }), batchUpdate: async () => ({ data: {} }) },
  batchUpdate: async () => ({ data: {} })
} });
const DRIVE_FILES = {
  fileArrival123456: { bytes: Buffer.from("arrival-photo-bytes"), contentType: "image/jpeg" },
  fileLoaded123456: { bytes: Buffer.from("loaded-photo-bytes"), contentType: "image/jpeg" },
  fileSignature12345: { bytes: Buffer.from("signature-png-bytes"), contentType: "image/png" }
};
googleapis.google.drive = () => ({ files: {
  get: async ({ fileId }, opts) => {
    const file = DRIVE_FILES[fileId];
    if (!file) { const err = new Error("File not found"); err.code = 404; throw err; }
    if (opts && opts.responseType === "arraybuffer") {
      return { data: file.bytes.buffer.slice(file.bytes.byteOffset, file.bytes.byteOffset + file.bytes.length), headers: { "content-type": file.contentType } };
    }
    return { data: { id: fileId, mimeType: file.contentType } };
  }
} });
const gal = require(require.resolve("google-auth-library", { paths: [BOT + "/.."] }));
gal.JWT.prototype.getAccessToken = async () => ({ token: "fake" });

const express = require("express");
const { adminRouter } = require(BOT + "/admin/admin.routes");
const app = express();
app.use(express.json({ limit: "2mb" }));
app.use("/admin", adminRouter());
const server = app.listen(0);

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(58)} ${ok ? JSON.stringify(actual) : `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
}

(async () => {
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  console.log("=".repeat(70));
  console.log("Admin session gate");
  console.log("=".repeat(70));

  const noAuthRes = await fetch(`${base}/admin/api/finished-jobs`);
  check("no session -> 401 on API routes", noAuthRes.status, 401);

  const badLoginRes = await fetch(`${base}/admin/login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "wrong" }), redirect: "manual"
  });
  check("wrong password -> 401", badLoginRes.status, 401);

  const loginRes = await fetch(`${base}/admin/login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "test-admin-password" }), redirect: "manual"
  });
  check("correct password -> redirect to /admin", loginRes.status, 302);
  const cookie = (loginRes.headers.get("set-cookie") || "").split(";")[0];
  check("session cookie issued", cookie.startsWith("tmv_admin="), true);
  const authed = { headers: { Cookie: cookie } };

  console.log("\n" + "=".repeat(70));
  console.log("Served dashboard page: the inline <script> must actually parse");
  console.log("=".repeat(70));
  // Everything above and below this only ever exercises the JSON APIs directly -- never
  // what a real browser loads and runs. dashboardShell() builds its whole page,
  // including the <script> block, as one big TS template literal: a stray single-escaped
  // "\/" anywhere in there silently collapses to "/" once TS evaluates the string
  // (ordinary JS string-escaping, nothing to do with regex), which can turn "//x" into a
  // line comment and truncate the rest of the script -- exactly what shipped and broke
  // the live admin panel ("Unexpected token '.'"). new Function() parses without
  // executing, so this catches that class of bug without needing a real browser.
  const dashboardRes = await fetch(`${base}/admin`, authed);
  check("dashboard page status", dashboardRes.status, 200);
  const dashboardHtml = await dashboardRes.text();
  const scriptMatch = dashboardHtml.match(/<script>([\s\S]*?)<\/script>/);
  check("dashboard page has an inline <script>", Boolean(scriptMatch), true);
  let scriptSyntaxError = null;
  try { new Function(scriptMatch[1]); } catch (error) { scriptSyntaxError = error; }
  check("dashboard's inline script has no syntax error", scriptSyntaxError ? scriptSyntaxError.message : null, null);

  console.log("\n" + "=".repeat(70));
  console.log("Finished Jobs: joins Bookings x Drivers x Evidence x Signatures");
  console.log("=".repeat(70));

  const finishedRes = await fetch(`${base}/admin/api/finished-jobs`, authed);
  check("finished-jobs status", finishedRes.status, 200);
  const { jobs } = await finishedRes.json();
  check("only the COMPLETED job is returned, the IN_PROGRESS one is not", jobs.map(j => j.jobId), ["TMV-ADMIN0001"]);

  const job = jobs[0];
  check("driver initials resolved to the driver's full name", job.driverName, "William Driver");
  check("customer name carried through", job.customerName, "Barry Thompson");
  check("pickup/dropoff carried through", [job.pickup, job.dropoff], ["10 Example Street", "74 Ferndale Road, N15 6UQ"]);
  check("actual start/finish timestamps carried through", [job.actualStart, job.actualFinish],
    ["2026-08-15T09:02:00.000Z", "2026-08-15T10:15:00.000Z"]);
  check("total charges carried through", job.totalCharges, "350");
  check("Drive folder url carried through (now that ensureJobFolder persists it)", job.driveFolderUrl, "https://drive.google.com/drive/folders/folder123456789");

  check("only the 2 COMPLETED classic-step photos are listed (RECEIVED and CheckIn excluded)",
    job.photos.map(p => p.label), ["Arrival", "Loaded"]);
  check("photo thumb URLs point at the Drive-file proxy with the right file id",
    job.photos.map(p => p.thumbUrl), ["/admin/api/drive-file/fileArrival123456", "/admin/api/drive-file/fileLoaded123456"]);

  check("signature present, with the customer name from the Signatures row", job.signature && job.signature.customerName, "Barry Thompson");
  check("signature file id extracted from the Drive webViewLink stored in Confirmation Text",
    job.signature && job.signature.thumbUrl, "/admin/api/drive-file/fileSignature12345");

  console.log("\n" + "=".repeat(70));
  console.log("Drive-file proxy: streams real bytes with the right content type");
  console.log("=".repeat(70));

  const photoRes = await fetch(`${base}${job.photos[0].thumbUrl}`, authed);
  check("photo proxy status", photoRes.status, 200);
  check("photo proxy content-type", photoRes.headers.get("content-type"), "image/jpeg");
  const photoBuf = Buffer.from(await photoRes.arrayBuffer());
  check("photo proxy returns the exact stored bytes", photoBuf.toString(), "arrival-photo-bytes");

  const sigRes = await fetch(`${base}${job.signature.thumbUrl}`, authed);
  check("signature proxy content-type", sigRes.headers.get("content-type"), "image/png");

  const unknownFileRes = await fetch(`${base}/admin/api/drive-file/doesNotExist12345`, authed);
  check("unknown Drive file id -> 404, not a crash", unknownFileRes.status, 404);

  const badFileIdRes = await fetch(`${base}/admin/api/drive-file/invalid!!id!!123`, authed);
  check("malformed file id rejected before touching Drive", badFileIdRes.status, 400);

  const proxyNoAuthRes = await fetch(`${base}${job.photos[0].thumbUrl}`);
  check("Drive-file proxy is also gated behind the admin session", proxyNoAuthRes.status, 401);

  console.log("\n" + "=".repeat(70));
  console.log("Notifications: was the job-started email/SMS actually delivered?");
  console.log("=".repeat(70));

  const notifyRes = await fetch(`${base}/admin/api/notifications`, authed);
  check("notifications status", notifyRes.status, 200);
  const { rows: notifyRows } = await notifyRes.json();
  const byId = Object.fromEntries(notifyRows.map(r => [r.jobId, r]));

  check("a never-started job (no Actual Start) is excluded entirely",
    Boolean(byId["TMV-NOTIFY-NOTSTARTED"]), false);

  check("both channels show sent, with the recorded detail", [byId["TMV-NOTIFY-SENT"].email, byId["TMV-NOTIFY-SENT"].sms],
    [{ state: "sent", detail: "carla@example.test", at: "2026-08-16T09:00:05.000Z" },
      { state: "sent", detail: "447111111111", at: "2026-08-16T09:00:06.000Z" }]);

  check("both channels show failed, with the failure reason as the detail",
    [byId["TMV-NOTIFY-FAILED"].email.state, byId["TMV-NOTIFY-FAILED"].email.detail],
    ["failed", "Invalid recipient address"]);
  check("SMS failure detail carried through too", byId["TMV-NOTIFY-FAILED"].sms.detail,
    "Firetext send failed: 2:0 Invalid destination number");

  check("no activity row yet -> pending, not mistaken for skipped",
    [byId["TMV-NOTIFY-PENDING"].email.state, byId["TMV-NOTIFY-PENDING"].sms.state], ["pending", "pending"]);

  check("no email/phone on the booking -> skipped, distinct from pending",
    [byId["TMV-NOTIFY-SKIPPED"].email.state, byId["TMV-NOTIFY-SKIPPED"].sms.state], ["skipped", "skipped"]);
  check("skipped SMS on a job with no phone at all (not just no activity row)",
    byId["TMV-NOTIFY-SKIPPED"].sms.state, "skipped");

  check("a later successful retry wins over an earlier failure for the same channel",
    byId["TMV-NOTIFY-RETRY"].email, { state: "sent", detail: "rita@example.test", at: "2026-08-16T09:25:00.000Z" });
  check("a channel with no booking phone at all still reads skipped even mid-retry job",
    byId["TMV-NOTIFY-RETRY"].sms.state, "skipped");

  await new Promise((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
  server.closeAllConnections?.();

  console.log("\n" + "=".repeat(70));
  console.log(`${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
  setTimeout(() => process.exit(process.exitCode), 300).unref();
})();
