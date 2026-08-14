/**
 * Counts real Google API round trips through the compiled TMV bot by stubbing the
 * googleapis transport. No network, no credentials.
 */
process.env.GOOGLE_SHEETS_SPREADSHEET_ID = "sheet-test";
process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = "root-test";
process.env.GOOGLE_CALENDAR_ID = "cal-test";
process.env.TMV_CHAT_ACTION_URL = "https://example.test/chat";
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "svc@test.iam.gserviceaccount.com";
process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nFAKE\\n-----END PRIVATE KEY-----\\n";
process.env.LOG_LEVEL = "error";
process.env.BOOTSTRAP_ON_START = "false";

const path = require("node:path");
const BOT = path.join(__dirname, "..", "dist");

// --------------------------------------------------------------------------
// Counters
// --------------------------------------------------------------------------
const counters = { total: 0, byOp: {}, authTokenFetches: 0 };
function count(op) {
  counters.total++;
  counters.byOp[op] = (counters.byOp[op] || 0) + 1;
}
function reset() {
  counters.total = 0;
  counters.byOp = {};
  counters.authTokenFetches = 0;
}
function snapshot() {
  return { total: counters.total, byOp: { ...counters.byOp }, authTokenFetches: counters.authTokenFetches };
}

// --------------------------------------------------------------------------
// Tiny in-memory spreadsheet
// --------------------------------------------------------------------------
const HEADERS = {
  Bookings: ["Job ID","Calendar Event ID","Driver Initials","Customer","Customer Email","Phone","Pickup","Dropoff","Crew Size","Base Price","Paid Online","Booked Start","Booked Finish","Actual Start","Actual Finish","Booked Minutes","Actual Minutes","Difference Minutes","Delay Status","Extra Charges","Overtime Minutes","Overtime Charge","Total Charges","Payment Method","Payment Status","Client Name/Postcode","Client Confirmed By","Status","Current State","Drive Folder ID","Drive Folder URL","Created","Updated"],
  Drivers: ["Initials","Full Name","Email","Chat User Name","Active","Role"],
  Evidence: ["Evidence ID","Job ID","Driver","Evidence Type","Attachment Ref","Content Type","File Name","Status","Received","Processing Started","Processing Completed","Drive File ID","Drive URL","Retry Count","Last Error"],
  Signatures: ["Timestamp","Job ID","Driver","Customer Name","Mode","Confirmation Text"],
  DriverFlow: ["Timestamp","Job ID","Driver","Field","Value","State"],
  ActivityLog: ["Timestamp","Job ID","Driver","Action","From State","To State","Detail"],
  WorkflowState: ["Job ID","Driver","State","Updated"],
  Payments: ["Timestamp","Job ID","Driver","Method","Amount","Status"],
  Dashboard: ["Metric","Value"], Customers: ["Customer ID","Name","Email","Phone","Address","Updated"],
  ProcessedEvents: ["Event Key","Job ID","Outcome State","Processed At"],
  Settings: ["Key","Value","Notes"], Reports: ["Generated","Report","Value"],
  ExceptionReport: ["Timestamp","Job ID","Type","Detail","Resolved"], Analytics: ["Date","Metric","Value"]
};

const tabs = {};
for (const [name, headers] of Object.entries(HEADERS)) tabs[name] = [headers.slice()];

function bookingRow(overrides) {
  const row = new Array(HEADERS.Bookings.length).fill("");
  const set = (col, value) => { row[HEADERS.Bookings.indexOf(col)] = String(value); };
  set("Job ID", "TMV-TESTJOB01");
  set("Calendar Event ID", "evt-1");
  set("Driver Initials", "WD");
  set("Customer", "Barry");
  set("Pickup", "10 Example Street");
  set("Dropoff", "74 Ferndale Road");
  set("Base Price", 350);
  set("Booked Start", new Date().toISOString());
  set("Booked Finish", new Date(Date.now() + 3600e3).toISOString());
  set("Status", "IN_PROGRESS");
  set("Current State", "WAITING_ARRIVAL_PHOTO");
  set("Actual Start", new Date().toISOString());
  set("Drive Folder ID", "folder-job-1");
  for (const [k, v] of Object.entries(overrides || {})) set(k, v);
  return row;
}
tabs.Bookings.push(bookingRow());
tabs.Drivers.push(["WD", "Test Driver", "driver@tmv.test", "", "TRUE", "Driver"]);

// A1 parsing sufficient for the ranges this code issues.
function colIndex(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
function slice(range) {
  const m = range.match(/^'((?:[^']|'')+)'!(.+)$/);
  if (!m) throw new Error("unparsed range: " + range);
  const tab = m[1].replace(/''/g, "'");
  const spec = m[2];
  const rows = tabs[tab] || [];
  if (/^\d+:\d+$/.test(spec)) {
    const [a, b] = spec.split(":").map(Number);
    return rows.slice(a - 1, b);
  }
  const rm = spec.match(/^([A-Z]+)(\d*):([A-Z]+)(\d*)$/);
  if (!rm) throw new Error("unparsed spec: " + spec);
  const c1 = colIndex(rm[1]);
  const c2 = colIndex(rm[3]);
  const r1 = rm[2] ? Number(rm[2]) : 1;
  const r2 = rm[4] ? Number(rm[4]) : rows.length;
  return rows.slice(r1 - 1, r2).map(r => r.slice(c1, c2 + 1));
}

function cellText(cell) {
  const v = cell && cell.userEnteredValue;
  if (!v) return "";
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.numberValue !== undefined) return String(v.numberValue);
  if (v.boolValue !== undefined) return v.boolValue ? "TRUE" : "FALSE";
  return "";
}
const sheetIdToTab = {};
Object.keys(HEADERS).forEach((name, i) => { sheetIdToTab[i + 1] = name; });

// --------------------------------------------------------------------------
// Stub googleapis
// --------------------------------------------------------------------------
const googleapis = require(require.resolve("googleapis", { paths: [BOT + "/.."] }));

googleapis.google.sheets = () => ({
  spreadsheets: {
    get: async () => {
      count("sheets.spreadsheets.get");
      return { data: { sheets: Object.keys(HEADERS).map((title, i) => ({
        properties: { title, sheetId: i + 1, gridProperties: { columnCount: 40 } } })) } };
    },
    values: {
      batchGet: async ({ ranges }) => {
        count("sheets.values.batchGet");
        return { data: { valueRanges: ranges.map(r => ({ range: r, values: slice(r) })) } };
      },
      batchUpdate: async () => { count("sheets.values.batchUpdate"); return { data: {} }; }
    },
    batchUpdate: async ({ requestBody }) => {
      count("sheets.spreadsheets.batchUpdate");
      for (const req of requestBody.requests || []) {
        if (req.appendCells) {
          const tab = sheetIdToTab[req.appendCells.sheetId];
          tabs[tab].push(req.appendCells.rows[0].values.map(cellText));
        } else if (req.updateCells) {
          const tab = sheetIdToTab[req.updateCells.start.sheetId];
          tabs[tab][req.updateCells.start.rowIndex] = req.updateCells.rows[0].values.map(cellText);
        }
      }
      return { data: {} };
    }
  }
});

googleapis.google.drive = () => ({
  files: {
    list: async () => { count("drive.files.list"); return { data: { files: [{ id: "folder-existing" }] } }; },
    create: async ({ media }) => {
      count(media ? "drive.files.create (upload)" : "drive.files.create (folder)");
      return { data: { id: "file-" + counters.total, webViewLink: "https://drive.test/f", name: "n", mimeType: "image/jpeg" } };
    }
  }
});
googleapis.google.calendar = () => ({
  events: { list: async () => { count("calendar.events.list"); return { data: { items: [] } }; } }
});
googleapis.google.gmail = () => ({
  users: { messages: { send: async () => { count("gmail.messages.send"); return { data: {} }; } } }
});

// Chat media download
global.fetch = async () => { count("chat.media.download"); return { ok: true, arrayBuffer: async () => new ArrayBuffer(2048) }; };

// Count token exchanges the way the real library would: once per client instance.
const gal = require(require.resolve("google-auth-library", { paths: [BOT + "/.."] }));
// The module exports JWT via a getter with no setter, so patch the prototype.
gal.JWT.prototype.getAccessToken = async function () {
  counters.authTokenFetches++;
  return { token: "fake-token" };
};

// --------------------------------------------------------------------------
// Run
// --------------------------------------------------------------------------
const { handleChatEvent } = require(BOT + "/chat/chat.controller");
const { registerInlineDispatcher } = require(BOT + "/queue/queue.service");
const { dispatchTask } = require(BOT + "/queue/dispatch");
// Captured, then run explicitly, so "critical path" means exactly that.
const queuedTasks = [];
registerInlineDispatcher(async task => { queuedTasks.push(task); });
const runQueued = async () => {
  const batch = queuedTasks.splice(0, queuedTasks.length);
  for (const task of batch) { try { await dispatchTask(task); } catch { /* counted, not asserted */ } }
};

const USER = { email: "driver@tmv.test", displayName: "Test Driver" };
let mediaSeq = 0;
const photoEvent = () => ({
  type: "MESSAGE", user: USER,
  message: { text: "", attachment: [{ contentName: "arrival.jpg", contentType: "image/jpeg", attachmentDataRef: { resourceName: `media/abc${++mediaSeq}` } }] }
});

function report(label, before) {
  const s = snapshot();
  console.log(`\n${label}`);
  console.log(`  Google API round trips : ${s.total}`);
  console.log(`  OAuth token exchanges  : ${s.authTokenFetches}`);
  for (const [op, n] of Object.entries(s.byOp)) console.log(`    ${op.padEnd(34)} ${n}`);
}

(async () => {
  console.log("=".repeat(66));
  console.log("TMV bot — API round trips per driver interaction (stubbed transport)");
  console.log("=".repeat(66));

  reset();
  let r = await handleChatEvent({ type: "MESSAGE", user: USER, message: { text: "jobs" } });
  report("COLD: type 'jobs'", null);
  console.log(`  -> card: ${JSON.stringify(r.message).slice(0, 60)}... update=${r.update}`);

  reset();
  await handleChatEvent({ type: "MESSAGE", user: USER, message: { text: "jobs" } });
  report("WARM: type 'jobs' again (caches + sync throttle hot)");

  reset();
  r = await handleChatEvent(photoEvent());
  report("WARM: upload arrival photo");
  console.log(`  -> next state: ${JSON.stringify(r.message).match(/"title":"([^"]+)"/)?.[1]}`);

  reset();
  r = await handleChatEvent(photoEvent());
  report("WARM: upload loaded-van photo");
  console.log(`  -> next state: ${JSON.stringify(r.message).match(/"title":"([^"]+)"/)?.[1]}`);

  reset();
  r = await handleChatEvent({
    type: "CARD_CLICKED", user: USER,
    action: { function: "FINISH_MOVE", parameters: [{ key: "jobId", value: "TMV-TESTJOB01" }] }
  });
  report("WARM: click FINISH MOVE");
  console.log(`  -> update=${r.update} (replaces the clicked card)`);

  console.log("\nPersisted rows written: " +
    JSON.stringify({ Evidence: tabs.Evidence.length - 1, DriverFlow: tabs.DriverFlow.length - 1,
      ActivityLog: tabs.ActivityLog.length - 1, WorkflowState: tabs.WorkflowState.length - 1 }));
  console.log("Booking Current State  : " + tabs.Bookings[1][HEADERS.Bookings.indexOf("Current State")]);
})();
