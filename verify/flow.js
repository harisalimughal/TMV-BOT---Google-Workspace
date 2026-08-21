/** Menu-driven job flow (start -> menu -> scenario form -> finish) + idempotency checks. */
process.env.GOOGLE_SHEETS_SPREADSHEET_ID = "sheet-test";
process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = "root-test";
process.env.TMV_CHAT_ACTION_URL = "https://example.test/chat";
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "svc@test.iam.gserviceaccount.com";
process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nFAKE\\n-----END PRIVATE KEY-----\\n";
process.env.TMV_SIGNATURE_LINK_SECRET = "test-scenario-link-secret";
process.env.LOG_LEVEL = "error";
process.env.BOOTSTRAP_ON_START = "false";
process.env.TMV_SHEET_CACHE_TTL_MS = "0";   // test mutates the fake sheet directly

const path = require("node:path");
const http = require("node:http");
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
  Evidence: ["Evidence ID","Job ID","Driver","Evidence Type","Attachment Ref","Content Type","File Name","Status","Received","Processing Started","Processing Completed","Drive File ID","Drive URL","Retry Count","Last Error"],
  StorageCheckIn: ["Timestamp","Job ID","Driver","Container Number","Client Name","Client Phone","Client Email","Client Present","Date","Photo URLs","Signature URL"],
  StorageCheckOut: ["Timestamp","Job ID","Driver","Container Number","Client Name","Client Email","Client Present At Dropoff","Date","Photo URLs","Signature URL"],
  ParkingLiability: ["Timestamp","Job ID","Driver","Address","Client Full Name","Photo URLs","Signature URL"],
  LiabilityReport: ["Timestamp","Job ID","Driver","Damage Categories","Photo URLs","Signature URL"]
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
googleapis.google.drive = () => ({ files: {
  list: async () => ({ data: { files: [] } }),
  create: async ({ media }) => {
    if (!media) bump("folderCreate"); else bump("driveUpload");
    return { data: { id: "f" + Math.random().toString(36).slice(2, 8), webViewLink: "https://drive.test/f", name: "n", mimeType: "image/jpeg" } };
  }
} });
googleapis.google.calendar = () => ({ events: { list: async () => ({ data: { items: [] } }) } });
googleapis.google.gmail = () => ({ users: { messages: { send: async () => { bump("email"); return { data: {} }; } } } });
const gal = require(require.resolve("google-auth-library", { paths: [BOT + "/.."] }));
gal.JWT.prototype.getAccessToken = async () => ({ token: "fake" });

const express = require("express");
const { handleChatEvent } = require(BOT + "/chat/chat.controller");
const { scenarioRouter } = require(BOT + "/chat/scenario.routes");
const { scenarioLinkFor } = require(BOT + "/chat/scenario.link");
const { registerInlineDispatcher } = require(BOT + "/queue/queue.service");
registerInlineDispatcher(async () => {}); // nothing enqueues background tasks in the new flow

const USER = { email: "driver@tmv.test" };
const state = () => tabs.Bookings[1][HEADERS.Bookings.indexOf("Current State")];
const status = () => tabs.Bookings[1][HEADERS.Bookings.indexOf("Status")];
const field = c => tabs.Bookings[1][HEADERS.Bookings.indexOf(c)];

const click = (fn, jobId) => handleChatEvent({
  type: "CARD_CLICKED", user: USER,
  action: { function: fn, parameters: [{ key: "jobId", value: jobId ?? JOB }] },
  common: { formInputs: {} }
});

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(46)} ${ok ? actual : `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
}
const title = r => JSON.stringify(r.message).match(/"title":"([^"]+)"/)?.[1] ?? "(none)";
const buttonUrl = (r, text) => {
  const json = JSON.stringify(r.message);
  const idx = json.indexOf(`"text":"${text}"`);
  if (idx === -1) return null;
  const after = json.slice(idx);
  return after.match(/"url":"([^"]+)"/)?.[1]?.replace(/\\u0026/g, "&").replace(/\\\//g, "/") ?? null;
};
const disabledButtons = r => {
  const widgets = r.message?.cardsV2?.[0]?.card?.sections?.[0]?.widgets ?? [];
  return widgets
    .flatMap(w => w.buttonList?.buttons ?? [])
    .filter(b => b.disabled)
    .map(b => b.text);
};

(async () => {
  console.log("=".repeat(74));
  console.log("Menu-driven job flow");
  console.log("=".repeat(74));

  const jobCardBefore = await click("RESUME_JOB");
  check("not started -> Next Job shows the job summary card", title(jobCardBefore), `Job ${JOB}`);

  const menuFromSpace = await handleChatEvent({ type: "ADDED_TO_SPACE", user: USER });
  check("bot added to space -> menu shown", title(menuFromSpace), "TMV Driver Bot");
  check("Check In disabled before start", disabledButtons(menuFromSpace).includes("Check In"), true);
  check("Finish Job disabled before start", disabledButtons(menuFromSpace).includes("Finish Job"), true);
  check("Next Job stays enabled before start", disabledButtons(menuFromSpace).includes("Next Job"), false);

  const blocked = await click("MENU_CHECK_IN");
  check("scenario blocked without an active job", title(blocked), "Start a job first");
  const blockedFinish = await click("FINISH_JOB_CONFIRM");
  check("finish blocked without an active job", title(blockedFinish), "Start a job first");

  await click("START_JOB");
  check("after START_JOB, status", status(), "IN_PROGRESS");
  check("after START_JOB, currentState", state(), "IN_PROGRESS");
  check("actualStart is a server timestamp", /^\d{4}-\d{2}-\d{2}T/.test(field("Actual Start")), true);
  check("drive folder deferred (no folder created yet)", (calls.folderCreate ?? 0), 0);

  // Double-tap: must not restart or duplicate the start email.
  const startedAt = field("Actual Start");
  const emailsBefore = calls.email ?? 0;
  await Promise.all([click("START_JOB"), click("START_JOB")]);
  check("double-tap START_JOB keeps timestamp", field("Actual Start"), startedAt);

  const menuAfter = await click("RESUME_JOB");
  check("active job -> full menu shown", title(menuAfter), "TMV Driver Bot");
  check("Check In enabled after start", disabledButtons(menuAfter).includes("Check In"), false);
  check("Finish Job enabled after start", disabledButtons(menuAfter).includes("Finish Job"), false);

  console.log("\n" + "-".repeat(74));
  console.log("Scenario link generation (all 4)");
  console.log("-".repeat(74));
  const checkInCard = await click("MENU_CHECK_IN");
  check("Check In opens a form card", title(checkInCard), "Check In");
  const checkInUrl = buttonUrl(checkInCard, "OPEN CHECK IN");
  check("Check In link generated", typeof checkInUrl === "string" && checkInUrl.includes("/forms/checkin/"), true);

  check("Check Out opens a form card", title(await click("MENU_CHECK_OUT")), "Check Out");
  check("Parking Liability opens a form card", title(await click("MENU_PARKING_LIABILITY")), "Parking Liability");
  check("Liability Report opens a form card", title(await click("MENU_LIABILITY_REPORT")), "Liability Report");

  console.log("\n" + "-".repeat(74));
  console.log("Check-In form: real HTTP GET + POST against the actual route");
  console.log("-".repeat(74));
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use("/forms", scenarioRouter());
  const server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;

  const linkUrl = new URL(scenarioLinkFor("checkin", JOB));
  const target = `http://127.0.0.1:${port}${linkUrl.pathname}${linkUrl.search}`;

  const getRes = await fetch(target);
  check("check-in form GET status", getRes.status, 200);
  const html = await getRes.text();
  check("check-in form contains Container Number field", html.includes("Container Number"), true);

  const png = "data:image/png;base64," + Buffer.from("fake-photo-bytes").toString("base64");
  const postRes = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        container_number: "C-123", client_name: "Barry Thompson", client_phone: "07123456789",
        client_email: "barry@example.test", client_present: "Yes", date: "2026-08-15"
      },
      photos: [png],
      signature: png
    })
  });
  const postBody = await postRes.json();
  check("check-in form POST status", postRes.status, 200);
  check("check-in form POST ok", postBody.ok, true);
  check("StorageCheckIn row written", tabs.StorageCheckIn.length - 1, 1);
  check("StorageCheckIn container number stored", tabs.StorageCheckIn[1][HEADERS.StorageCheckIn.indexOf("Container Number")], "C-123");
  check("job still IN_PROGRESS after a scenario submit", status(), "IN_PROGRESS");

  const badLinkRes = await fetch(target.replace(/sig=[^&]+/, "sig=deadbeef"));
  check("tampered signature rejected", badLinkRes.status, 410);

  const missingFieldRes = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: {}, photos: [png], signature: png })
  });
  check("missing required field rejected", missingFieldRes.status, 400);

  await new Promise((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
  // fetch's keep-alive pool can leave a socket to this server open past server.close()
  // (whose callback fires once it stops accepting new connections, not once every
  // pooled client connection is gone), which otherwise holds the event loop open
  // indefinitely since process.exit() is deliberately not used below (see the comment
  // there). Force them shut so the process can exit on its own.
  server.closeAllConnections?.();

  console.log("\n" + "-".repeat(74));
  console.log("Finish Job");
  console.log("-".repeat(74));
  const confirmCard = await click("FINISH_JOB_CONFIRM");
  check("finish confirm card shown", title(confirmCard), "Finish this job?");
  check("job not completed yet", status(), "IN_PROGRESS");

  const doneCard = await click("FINISH_JOB");
  check("job completed", status(), "COMPLETED");
  check("currentState completed", state(), "COMPLETED");
  check("finish timestamp set", /^\d{4}-\d{2}-\d{2}T/.test(field("Actual Finish")), true);
  check("completion card returned", title(doneCard), "Job completed");
  check("card replaces clicked message", doneCard.update, true);

  const finishAgain = await click("FINISH_JOB_CONFIRM");
  check("finish blocked once already completed", title(finishAgain), "Start a job first");

  const noMoreJobs = await click("RESUME_JOB");
  check("no more jobs for today", title(noMoreJobs), "No unfinished jobs");

  console.log("\n" + "=".repeat(74));
  console.log(`${pass} passed, ${fail} failed`);
  console.log("Audit trail: " + JSON.stringify({
    ActivityLog: tabs.ActivityLog.length - 1, DriverFlow: tabs.DriverFlow.length - 1,
    StorageCheckIn: tabs.StorageCheckIn.length - 1
  }));
  // Neither an immediate process.exit() nor letting the loop drain naturally works
  // here: an immediate exit() races the HTTP server's teardown on Windows and crashes
  // at the libuv layer (UV_HANDLE_CLOSING assertion) even after server.close()'s
  // callback already fired, while waiting for a natural drain hangs indefinitely —
  // fetch's keep-alive pool holds a socket open past both server.close() and
  // closeAllConnections(). A short bounded delay clears both failure modes: it's long
  // enough to dodge the immediate-exit race, short enough not to matter for a test run.
  process.exitCode = fail ? 1 : 0;
  setTimeout(() => process.exit(process.exitCode), 300).unref();
})();
