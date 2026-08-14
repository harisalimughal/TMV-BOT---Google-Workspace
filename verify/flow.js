/** Full 12-step driver workflow + concurrency/idempotency checks. No network. */
process.env.GOOGLE_SHEETS_SPREADSHEET_ID = "sheet-test";
process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = "root-test";
process.env.TMV_CHAT_ACTION_URL = "https://example.test/chat";
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "svc@test.iam.gserviceaccount.com";
process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nFAKE\\n-----END PRIVATE KEY-----\\n";
process.env.LOG_LEVEL = "error";
process.env.BOOTSTRAP_ON_START = "false";
process.env.TMV_SHEET_CACHE_TTL_MS = "0";   // test mutates the fake sheet directly

const path = require("node:path");
const BOT = path.join(__dirname, "..", "dist");
const HEADERS = {
  Bookings: ["Job ID","Calendar Event ID","Driver Initials","Customer","Customer Email","Phone","Pickup","Dropoff","Crew Size","Base Price","Paid Online","Booked Start","Booked Finish","Actual Start","Actual Finish","Booked Minutes","Actual Minutes","Difference Minutes","Delay Status","Extra Charges","Overtime Minutes","Overtime Charge","Total Charges","Payment Method","Payment Status","Client Name/Postcode","Client Confirmed By","Status","Current State","Drive Folder ID","Drive Folder URL","Created","Updated"],
  Drivers: ["Initials","Full Name","Email","Chat User Name","Active","Role"],
  Photos: ["Timestamp","Job ID","Driver","Step","File ID","File URL","File Name","Content Type"],
  Signatures: ["Timestamp","Job ID","Driver","Customer Name","Mode","Confirmation Text"],
  DriverFlow: ["Timestamp","Job ID","Driver","Field","Value","State"],
  ActivityLog: ["Timestamp","Job ID","Driver","Action","From State","To State","Detail"],
  WorkflowState: ["Job ID","Driver","State","Updated"],
  Payments: ["Timestamp","Job ID","Driver","Method","Amount","Status"],
  Dashboard: ["Metric","Value"], Customers: ["Customer ID","Name","Email","Phone","Address","Updated"],
  ProcessedEvents: ["Event Key","Job ID","Outcome State","Processed At"],
  Settings: ["Key","Value","Notes"], Reports: ["Generated","Report","Value"],
  ExceptionReport: ["Timestamp","Job ID","Type","Detail","Resolved"], Analytics: ["Date","Metric","Value"],
  Evidence: ["Evidence ID","Job ID","Driver","Evidence Type","Attachment Ref","Content Type","File Name","Status","Received","Processing Started","Processing Completed","Drive File ID","Drive URL","Retry Count","Last Error"]
};
const tabs = {};
for (const [n, h] of Object.entries(HEADERS)) tabs[n] = [h.slice()];

const JOB = "TMV-FLOW0001";
const row = new Array(HEADERS.Bookings.length).fill("");
const set = (c, v) => { row[HEADERS.Bookings.indexOf(c)] = String(v); };
set("Job ID", JOB); set("Calendar Event ID", "evt-flow"); set("Driver Initials", "WD");
set("Customer", "Barry"); set("Customer Email", "barry@example.test");
set("Pickup", "10 Example Street"); set("Dropoff", "74 Ferndale Road, N15 6UQ");
set("Base Price", 350); set("Booked Start", new Date().toISOString());
set("Booked Finish", new Date(Date.now() + 3600e3).toISOString()); set("Booked Minutes", 60);
set("Status", "READY"); set("Current State", "READY");
tabs.Bookings.push(row);
tabs.Drivers.push(["WD", "Test Driver", "driver@tmv.test", "", "TRUE", "Driver"]);

const calls = {};
const bump = k => { calls[k] = (calls[k] || 0) + 1; };
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
const idToTab = {}; Object.keys(HEADERS).forEach((n, i) => { idToTab[i + 1] = n; });

const googleapis = require(require.resolve("googleapis", { paths: [BOT + "/.."] }));
googleapis.google.sheets = () => ({ spreadsheets: {
  get: async () => ({ data: { sheets: Object.keys(HEADERS).map((title, i) => ({ properties: { title, sheetId: i + 1, gridProperties: { columnCount: 40 } } })) } }),
  values: {
    batchGet: async ({ ranges }) => { bump("batchGet"); return { data: { valueRanges: ranges.map(r => ({ values: slice(r) })) } }; },
    batchUpdate: async () => ({ data: {} })
  },
  batchUpdate: async ({ requestBody }) => {
    bump("batchUpdate");
    for (const rq of requestBody.requests || []) {
      if (rq.appendCells) tabs[idToTab[rq.appendCells.sheetId]].push(rq.appendCells.rows[0].values.map(cellText));
      else if (rq.updateCells) tabs[idToTab[rq.updateCells.start.sheetId]][rq.updateCells.start.rowIndex] = rq.updateCells.rows[0].values.map(cellText);
    }
    return { data: {} };
  }
} });
// Lets a test hold the fake Drive upload open, so "evidence still processing" is a
// deterministic state rather than a race against the inline worker.
let uploadGate = null;
const holdUploads = () => { let release; uploadGate = new Promise(r => (release = r)); return release; };

googleapis.google.drive = () => ({ files: {
  list: async () => ({ data: { files: [] } }),
  create: async ({ media }) => {
    if (media && uploadGate) await uploadGate; if (!media) bump("folderCreate"); return { data: { id: "f" + Math.random().toString(36).slice(2, 8), webViewLink: "https://drive.test/f", name: "n", mimeType: "image/jpeg" } }; }
} });
googleapis.google.calendar = () => ({ events: { list: async () => ({ data: { items: [] } }) } });
googleapis.google.gmail = () => ({ users: { messages: { send: async () => { bump("email"); return { data: {} }; } } } });
let mediaFailures = 0;   // set >0 to make the next N downloads fail transiently
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(1020)]);
global.fetch = async () => {
  bump("mediaDownload");
  if (mediaFailures > 0) { mediaFailures--; return { ok: false, status: 503, text: async () => "busy", headers: { get: () => null } }; }
  return {
    ok: true, status: 200,
    headers: { get: k => (k === "content-length" ? String(jpeg.length) : "image/jpeg") },
    arrayBuffer: async () => jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.length)
  };
};
const gal = require(require.resolve("google-auth-library", { paths: [BOT + "/.."] }));
gal.JWT.prototype.getAccessToken = async () => ({ token: "fake" });

const { handleChatEvent } = require(BOT + "/chat/chat.controller");
const { registerInlineDispatcher, drainInlineQueue } = require(BOT + "/queue/queue.service");
const { dispatchTask } = require(BOT + "/queue/dispatch");
const { submitDrawnSignature } = require(BOT + "/workflow/workflow.engine");
/*
 * Background tasks are captured rather than executed immediately, so the test decides
 * exactly when the worker runs. Timing-based draining made assertions race the worker,
 * which is a property of the harness, not of the product.
 */
const queued = [];
registerInlineDispatcher(async task => { queued.push(task); });

/** Runs every task queued so far, including tasks those tasks enqueue. */
const drain = async () => {
  for (let pass = 0; pass < 5 && queued.length; pass++) {
    const batch = queued.splice(0, queued.length);
    for (const task of batch) {
      try { await dispatchTask(task); }
      catch (error) { lastTaskError = error; }
    }
    await drainInlineQueue();
  }
};
let lastTaskError = null;
const evidence = () => tabs.Evidence.slice(1);
const statuses = () => evidence().map(r => r[HEADERS.Evidence.indexOf("Status")]);
const USER = { email: "driver@tmv.test" };
const state = () => tabs.Bookings[1][HEADERS.Bookings.indexOf("Current State")];
const field = c => tabs.Bookings[1][HEADERS.Bookings.indexOf(c)];

const click = (fn, formInputs) => handleChatEvent({
  type: "CARD_CLICKED", user: USER,
  action: { function: fn, parameters: [{ key: "jobId", value: JOB }] },
  common: { formInputs: formInputs || {} }
});
// Real Chat gives every upload its own media resourceName. Reusing one across
// distinct uploads would be indistinguishable from a redelivery, and the replay
// guard would (correctly) suppress it.
let mediaSeq = 0;
const photo = (resourceName) => handleChatEvent({
  type: "MESSAGE", user: USER,
  message: {
    name: resourceName ? undefined : `spaces/S/messages/M${++mediaSeq}`,
    attachment: [{
      contentName: "p.jpg",
      contentType: "image/jpeg",
      attachmentDataRef: { resourceName: resourceName ?? `media/x${mediaSeq}` }
    }]
  }
});
const si = (...v) => ({ stringInputs: { value: v } });

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(46)} ${ok ? actual : `got ${actual}, expected ${expected}`}`);
}
const title = r => JSON.stringify(r.message).match(/"title":"([^"]+)"/)?.[1] ?? "(none)";

(async () => {
  console.log("=".repeat(74));
  console.log("Full driver workflow");
  console.log("=".repeat(74));

  await click("START_JOB");
  check("after START_JOB", state(), "WAITING_ARRIVAL_PHOTO");
  check("actualStart is a server timestamp", /^\d{4}-\d{2}-\d{2}T/.test(field("Actual Start")), true);
  check("drive folder deferred to first photo", field("Drive Folder ID").length === 0, true);

  // Double-tap: must not restart, re-email, or duplicate folders.
  await drain();
  const foldersBefore = calls.folderCreate ?? 0, emailsBefore = calls.email ?? 0;
  const startedAt = field("Actual Start");
  await Promise.all([click("START_JOB"), click("START_JOB")]);
  check("double-tap START_JOB keeps timestamp", field("Actual Start"), startedAt);
  check("double-tap creates no extra folders", calls.folderCreate ?? 0, foldersBefore);
  await drain();
  check("double-tap sends no extra email", calls.email ?? 0, emailsBefore);
  check("exactly one start email for the job", calls.email ?? 0, 1);

  // Out-of-order action must be rejected by the state machine.
  const bad = await click("SUBMIT_PAYMENT", { payment_method: si("Cash") });
  check("skipping to payment is blocked", title(bad), "TMV — Action blocked");
  check("blocked action leaves state intact", state(), "WAITING_ARRIVAL_PHOTO");

  const ack = await photo();
  check("arrival photo advances immediately", state(), "WAITING_LOADED_PHOTO");
  check("evidence recorded as RECEIVED", statuses().includes("RECEIVED"), true);
  const ackText = JSON.stringify(ack.message);
  check("ack says received, not saved", /received/i.test(ackText) && !/saved successfully/i.test(ackText), true);
  check("no Drive upload on the critical path", calls.mediaDownload || 0, 0);

  await drain();
  check("background worker completed the upload", statuses().every(s => s === "COMPLETED"), true);
  check("Photos audit row written by worker", tabs.Photos.length - 1, 1);

  await photo(); await drain(); check("loaded-van photo", state(), "IN_PROGRESS");
  await click("FINISH_MOVE"); check("finish move", state(), "WAITING_EXTRA_CHARGES");

  // Without an extra-time claim the overtime step is skipped entirely (§47).
  await click("SUBMIT_EXTRA_CHARGES", { extra_charges: si("London Congestion charge", "Tunnel Charges") });
  check("no extra time skips the overtime step", state(), "WAITING_TOTAL_CHARGES");
  check("overtime zeroed when not claimed", field("Overtime Charge"), "0");

  // Reopen the step and claim extra time so the overtime branch is still covered.
  tabs.Bookings[1][HEADERS.Bookings.indexOf("Current State")] = "WAITING_EXTRA_CHARGES";
  await click("SUBMIT_EXTRA_CHARGES", {
    extra_charges: si("London Congestion charge", "Tunnel Charges", "Extra time / Charges")
  });
  check("extra time claimed asks for overtime", state(), "WAITING_OVERTIME");

  await click("SUBMIT_OVERTIME", { overtime_minutes: si("45") });
  check("overtime state", state(), "WAITING_TOTAL_CHARGES");
  check("overtime rounds 45min up to 2 blocks", field("Overtime Charge"), "110");

  await click("SUBMIT_TOTAL_CHARGES", { total_charges: si("493") });
  check("total charges", state(), "WAITING_PAYMENT");
  check("total stored", field("Total Charges"), "493");

  await click("SUBMIT_PAYMENT", { payment_method: si("Cash") });
  check("payment", state(), "WAITING_EMPTY_VAN_PHOTO");
  check("payment row written", tabs.Payments.length - 1, 1);

  await photo(); await drain(); check("empty-van photo", state(), "WAITING_CLIENT_DETAILS");

  await click("SUBMIT_CLIENT_DETAILS", { client_name_postcode: si("Barry, N15 6UQ") });
  check("client details", state(), "WAITING_CLIENT_CONFIRMATION");

  // Signature capture now happens on the customer's own device (see
  // chat/signature.routes.ts), not as a Chat form submission. Simulating the upload +
  // state transition directly is the equivalent of a real /sign/:jobId POST.
  await submitDrawnSignature(JOB, "Barry Smith", { fileId: "sig1", fileUrl: "https://drive.test/sig1" });
  check("client confirmation", state(), "WAITING_ORGANIZED_PHOTO");
  check("signature row written", tabs.Signatures.length - 1, 1);

  // Deliberately not drained: the organized photo is still in flight while every other
  // requirement is satisfied, which is the only state that isolates the pending path.
  await photo();
  check("organized photo", state(), "READY_TO_COMPLETE");
  const pendingGate = await click("COMPLETE_JOB");
  check("completion deferred while evidence processing", title(pendingGate), "Still processing");
  check("job not completed while evidence in flight", field("Status"), "IN_PROGRESS");
  await drain();

  // Idempotency: re-running a completed task must not upload a second copy.
  const uploadsBefore = calls.mediaDownload;
  const firstEvidenceId = evidence()[0][HEADERS.Evidence.indexOf("Evidence ID")];
  await dispatchTask({ type: "PROCESS_JOB_IMAGE", evidenceId: firstEvidenceId, jobId: JOB });
  check("replayed task re-uploads nothing", calls.mediaDownload, uploadsBefore);
  check("no duplicate Photos row", tabs.Photos.length - 1, 4);

  const done = await click("COMPLETE_JOB");
  check("completion", state(), "COMPLETED");
  check("status column", field("Status"), "COMPLETED");
  check("finish timestamp set", /^\d{4}-\d{2}-\d{2}T/.test(field("Actual Finish")), true);
  check("completion card returned", title(done), "Job completed");
  check("card replaces clicked message", done.update, true);

  console.log("\n" + "=".repeat(74));
  console.log("Completion gate (evidence deliberately removed)");
  console.log("=".repeat(74));
  tabs.Bookings[1][HEADERS.Bookings.indexOf("Current State")] = "READY_TO_COMPLETE";
  tabs.Bookings[1][HEADERS.Bookings.indexOf("Status")] = "IN_PROGRESS";
  tabs.Signatures = [HEADERS.Signatures.slice()];
  tabs.Photos = [HEADERS.Photos.slice()];
  tabs.Evidence = [HEADERS.Evidence.slice()];
  const before = calls.batchGet;
  const gated = await click("COMPLETE_JOB");
  const text = JSON.stringify(gated.message);
  check("completion blocked", title(gated), "TMV — Action blocked");
  check("names arrival photo as missing", text.includes("arrival photo"), true);
  check("names organized photo as missing", text.includes("organized-van photo"), true);
  check("evidence gate costs <= 2 reads", calls.batchGet - before <= 2, true);

  console.log("\n" + "=".repeat(74));
  console.log(`${pass} passed, ${fail} failed`);
  console.log("Audit trail: " + JSON.stringify({
    ActivityLog: tabs.ActivityLog.length - 1, DriverFlow: tabs.DriverFlow.length - 1,
    Signatures: tabs.Signatures.length - 1, Payments: tabs.Payments.length - 1
  }));
  process.exit(fail ? 1 : 0);
})();
