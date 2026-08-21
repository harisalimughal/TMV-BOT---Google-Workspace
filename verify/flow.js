/**
 * Two independent flows now coexist and this checks both, plus that neither leaks into
 * the other:
 *   1. The classic Start Job workflow (arrival photo -> loaded photo -> charges ->
 *      payment -> empty-van photo -> client details -> customer signature -> organized
 *      photo -> complete), restored after being briefly replaced by a menu-only design.
 *      This is also the only way a job ever completes -- there is no standalone
 *      "Finish Job" menu action.
 *   2. The menu's standalone scenarios (Check In / Check Out / Parking Liability /
 *      Liability Report), which must work on a job that never ran Start Job at all --
 *      no "start a job first" gate, no silent auto-start.
 */
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

const JOB_CLASSIC = "TMV-FLOW0001";
const JOB_STANDALONE = "TMV-FLOW0002";
const JOB_OVERDUE = "TMV-FLOW0003";
function addBooking(jobId, eventId, daysAgo = 0) {
  const row = new Array(HEADERS.Bookings.length).fill("");
  const set = (c, v) => { row[HEADERS.Bookings.indexOf(c)] = String(v); };
  const start = new Date(Date.now() - daysAgo * 86400e3);
  set("Job ID", jobId); set("Calendar Event ID", eventId); set("Driver Initials", "WD");
  set("Customer", "Barry"); set("Customer Email", "barry@example.test");
  set("Pickup", "10 Example Street"); set("Dropoff", "74 Ferndale Road, N15 6UQ");
  set("Base Price", 350); set("Booked Start", start.toISOString());
  set("Booked Finish", new Date(start.getTime() + 3600e3).toISOString()); set("Booked Minutes", 60);
  set("Status", "READY"); set("Current State", "READY");
  tabs.Bookings.push(row);
}
addBooking(JOB_CLASSIC, "evt-flow-classic");
addBooking(JOB_STANDALONE, "evt-flow-standalone");
// JOB_OVERDUE is added later, right before the section that tests it — adding it here
// would make it (earliest Booked Start) win driver-resolution ahead of JOB_CLASSIC in
// the very first "Next Job" check below, which explicitly expects JOB_CLASSIC.
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
// The classic workflow's background worker downloads each Chat-attached photo before
// uploading it to Drive -- the one bit of real network I/O the merged scripts still
// need. The Check-In HTTP round-trip test later in this file also uses fetch, against
// this test's own local server, so only fake the Chat-media-download shape and let
// anything else (localhost) through to the real fetch.
const realFetch = global.fetch;
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(1020)]);
global.fetch = async (url, ...rest) => {
  if (typeof url === "string" && url.includes("127.0.0.1")) return realFetch(url, ...rest);
  return {
    ok: true, status: 200,
    headers: { get: k => (k === "content-length" ? String(jpeg.length) : "image/jpeg") },
    arrayBuffer: async () => jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.length)
  };
};
const gal = require(require.resolve("google-auth-library", { paths: [BOT + "/.."] }));
gal.JWT.prototype.getAccessToken = async () => ({ token: "fake" });

const express = require("express");
const { handleChatEvent } = require(BOT + "/chat/chat.controller");
const { scenarioRouter } = require(BOT + "/chat/scenario.routes");
const { scenarioLinkFor } = require(BOT + "/chat/scenario.link");
const { submitDrawnSignature } = require(BOT + "/workflow/workflow.engine");
const { registerInlineDispatcher, drainInlineQueue } = require(BOT + "/queue/queue.service");
const { dispatchTask } = require(BOT + "/queue/dispatch");

/*
 * Background tasks (photo processing) are captured rather than run immediately, so the
 * test controls exactly when the worker runs instead of racing it.
 */
const queued = [];
registerInlineDispatcher(async task => { queued.push(task); });
const drain = async () => {
  for (let pass = 0; pass < 5 && queued.length; pass++) {
    const batch = queued.splice(0, queued.length);
    for (const task of batch) await dispatchTask(task);
    await drainInlineQueue();
  }
};

const USER = { email: "driver@tmv.test" };
const row = jobId => tabs.Bookings.find(r => r[HEADERS.Bookings.indexOf("Job ID")] === jobId);
const stateOf = jobId => row(jobId)[HEADERS.Bookings.indexOf("Current State")];
const statusOf = jobId => row(jobId)[HEADERS.Bookings.indexOf("Status")];
const fieldOf = (jobId, c) => row(jobId)[HEADERS.Bookings.indexOf(c)];
const evidenceFor = jobId => tabs.Evidence.slice(1).filter(r => r[HEADERS.Evidence.indexOf("Job ID")] === jobId);

const click = (fn, jobId) => handleChatEvent({
  type: "CARD_CLICKED", user: USER,
  action: { function: fn, parameters: [{ key: "jobId", value: jobId }] },
  common: { formInputs: {} }
});
const clickWithInputs = (fn, jobId, formInputs) => handleChatEvent({
  type: "CARD_CLICKED", user: USER,
  action: { function: fn, parameters: [{ key: "jobId", value: jobId }] },
  common: { formInputs }
});
let mediaSeq = 0;
const photo = () => handleChatEvent({
  type: "MESSAGE", user: USER,
  message: {
    name: `spaces/S/messages/M${++mediaSeq}`,
    attachment: [{
      contentName: "p.jpg", contentType: "image/jpeg",
      attachmentDataRef: { resourceName: `media/x${mediaSeq}` }
    }]
  }
});
const si = (...v) => ({ stringInputs: { value: v } });

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(52)} ${ok ? actual : `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
}
const title = r => JSON.stringify(r.message).match(/"title":"([^"]+)"/)?.[1] ?? "(none)";
const buttonUrl = (r, text) => {
  const json = JSON.stringify(r.message);
  const idx = json.indexOf(`"text":"${text}"`);
  if (idx === -1) return null;
  const after = json.slice(idx);
  return after.match(/"url":"([^"]+)"/)?.[1]?.replace(/\\u0026/g, "&").replace(/\\\//g, "/") ?? null;
};
const menuButtons = r => {
  const widgets = r.message?.cardsV2?.[0]?.card?.sections?.[0]?.widgets ?? [];
  return widgets.flatMap(w => w.buttonList?.buttons ?? []);
};
const disabledButtons = r => menuButtons(r).filter(b => b.disabled).map(b => b.text);

(async () => {
  console.log("=".repeat(74));
  console.log("Main menu: every option always enabled, colorful, no Finish Job button");
  console.log("=".repeat(74));

  const menuFromSpace = await handleChatEvent({ type: "ADDED_TO_SPACE", user: USER });
  check("bot added to space -> menu shown", title(menuFromSpace), "TMV Driver Bot");
  check("nothing disabled before either job is started", disabledButtons(menuFromSpace).length, 0);
  check("menu has exactly 5 buttons (no Finish Job)", menuButtons(menuFromSpace).length, 5);
  check("no button is labelled Finish Job", menuButtons(menuFromSpace).some(b => b.text === "Finish Job"), false);
  check("every menu button carries a distinct color", new Set(menuButtons(menuFromSpace).map(b => JSON.stringify(b.color))).size, 5);

  console.log("\n" + "=".repeat(74));
  console.log("Classic Start Job workflow (restored)");
  console.log("=".repeat(74));

  const jobCardBefore = await click("RESUME_JOB", JOB_CLASSIC);
  check("Next Job, not started -> job summary card with Start Job button", title(jobCardBefore), `Job ${JOB_CLASSIC}`);

  await click("START_JOB", JOB_CLASSIC);
  check("Start Job begins the classic workflow at step 1", stateOf(JOB_CLASSIC), "WAITING_ARRIVAL_PHOTO");
  check("status flips to IN_PROGRESS immediately", statusOf(JOB_CLASSIC), "IN_PROGRESS");
  check("actualStart is a server timestamp", /^\d{4}-\d{2}-\d{2}T/.test(fieldOf(JOB_CLASSIC, "Actual Start")), true);

  // Double-tap must not restart or duplicate the start email.
  const startedAt = fieldOf(JOB_CLASSIC, "Actual Start");
  await Promise.all([click("START_JOB", JOB_CLASSIC), click("START_JOB", JOB_CLASSIC)]);
  check("double-tap START_JOB keeps the same timestamp", fieldOf(JOB_CLASSIC, "Actual Start"), startedAt);
  await drain();
  check("exactly one start email sent", calls.email ?? 0, 1);

  await photo(); await drain();
  check("arrival photo advances to loaded-photo step", stateOf(JOB_CLASSIC), "WAITING_LOADED_PHOTO");
  check("evidence uploaded by the background worker", evidenceFor(JOB_CLASSIC).some(r => r[HEADERS.Evidence.indexOf("Status")] === "COMPLETED"), true);

  await photo(); await drain();
  check("loaded-van photo advances to move execution", stateOf(JOB_CLASSIC), "IN_PROGRESS");

  await click("FINISH_MOVE", JOB_CLASSIC);
  check("finish move asks about extra charges", stateOf(JOB_CLASSIC), "WAITING_EXTRA_CHARGES");

  await clickWithInputs("SUBMIT_EXTRA_CHARGES", JOB_CLASSIC, { extra_charges: si("No Extras Time") });
  check("no extra time skips straight to totals", stateOf(JOB_CLASSIC), "WAITING_TOTAL_CHARGES");

  await clickWithInputs("SUBMIT_TOTAL_CHARGES", JOB_CLASSIC, { total_charges: si("350") });
  check("total charges accepted", stateOf(JOB_CLASSIC), "WAITING_PAYMENT");
  check("total stored", fieldOf(JOB_CLASSIC, "Total Charges"), "350");

  await clickWithInputs("SUBMIT_PAYMENT", JOB_CLASSIC, { payment_method: si("Cash") });
  check("payment recorded", stateOf(JOB_CLASSIC), "WAITING_EMPTY_VAN_PHOTO");
  check("payment row written", tabs.Payments.length - 1, 1);

  await photo(); await drain();
  check("empty-van photo advances to client details", stateOf(JOB_CLASSIC), "WAITING_CLIENT_DETAILS");

  const signatureStepCard = await clickWithInputs("SUBMIT_CLIENT_DETAILS", JOB_CLASSIC, { client_name_postcode: si("Barry, N15 6UQ") });
  check("client details advance to signature step", stateOf(JOB_CLASSIC), "WAITING_CLIENT_CONFIRMATION");
  // onClose: RELOAD was assumed to auto-refresh this card once the customer signs;
  // confirmed live in Chat that it doesn't reliably do that, so CHECK AGAIN is back.
  check("signature step has a manual CHECK AGAIN fallback button",
    JSON.stringify(signatureStepCard.message).includes('"CHECK AGAIN"'), true);

  // The customer signature is captured on their own device (see chat/signature.routes.ts)
  // rather than as a Chat form submission -- simulating it directly is the equivalent of
  // a real POST to /sign/:jobId.
  await submitDrawnSignature(JOB_CLASSIC, "Barry Smith", { fileId: "sig1", fileUrl: "https://drive.test/sig1" });
  check("signature advances to the organized-photo step", stateOf(JOB_CLASSIC), "WAITING_ORGANIZED_PHOTO");
  check("signature row written", tabs.Signatures.length - 1, 1);

  await photo(); await drain();
  check("organized photo makes the job ready to complete", stateOf(JOB_CLASSIC), "READY_TO_COMPLETE");

  const doneCard = await click("COMPLETE_JOB", JOB_CLASSIC);
  check("workflow's own last step completes the job", stateOf(JOB_CLASSIC), "COMPLETED");
  check("status column completed", statusOf(JOB_CLASSIC), "COMPLETED");
  check("finish timestamp set", /^\d{4}-\d{2}-\d{2}T/.test(fieldOf(JOB_CLASSIC, "Actual Finish")), true);
  check("completion card returned", title(doneCard), "Job completed");

  console.log("\n" + "=".repeat(74));
  console.log("Menu scenarios run standalone -- no Start Job required or triggered");
  console.log("=".repeat(74));

  // JOB_CLASSIC is now COMPLETED, so the driver's only eligible job is JOB_STANDALONE --
  // every menu action below resolves to it without an explicit jobId being trusted.
  const checkInCard = await click("MENU_CHECK_IN", JOB_STANDALONE);
  check("Check In runs immediately with no job ever started", title(checkInCard), "Check In");
  check("Check In does NOT start the job -- status unchanged", statusOf(JOB_STANDALONE), "READY");
  check("Check In does NOT touch currentState", stateOf(JOB_STANDALONE), "READY");
  check("Check In leaves actualStart blank", fieldOf(JOB_STANDALONE, "Actual Start"), "");

  const checkInUrl = buttonUrl(checkInCard, "OPEN CHECK IN");
  check("Check In link generated", typeof checkInUrl === "string" && checkInUrl.includes("/forms/checkin/"), true);
  check("Check Out opens a form card", title(await click("MENU_CHECK_OUT", JOB_STANDALONE)), "Check Out");
  check("Parking Liability opens a form card", title(await click("MENU_PARKING_LIABILITY", JOB_STANDALONE)), "Parking Liability");
  check("Liability Report opens a form card", title(await click("MENU_LIABILITY_REPORT", JOB_STANDALONE)), "Liability Report");

  console.log("\n" + "-".repeat(74));
  console.log("Check-In form: real HTTP GET + POST against the actual route");
  console.log("-".repeat(74));
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use("/forms", scenarioRouter());
  const server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;

  const linkUrl = new URL(scenarioLinkFor("checkin", JOB_STANDALONE));
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
  check("job still not started after a scenario submit", statusOf(JOB_STANDALONE), "READY");

  const badLinkRes = await fetch(target.replace(/sig=[^&]+/, "sig=deadbeef"));
  check("tampered signature rejected", badLinkRes.status, 410);

  console.log("\n" + "-".repeat(74));
  console.log("Parking Liability form: requires a signature even with no legal paragraph");
  console.log("-".repeat(74));
  const parkingLinkUrl = new URL(scenarioLinkFor("parking", JOB_STANDALONE));
  const parkingTarget = `http://127.0.0.1:${port}${parkingLinkUrl.pathname}${parkingLinkUrl.search}`;
  const parkingHtml = await (await fetch(parkingTarget)).text();
  check("parking form GET includes a signature canvas", parkingHtml.includes('id="pad"'), true);

  const parkingNoSig = await fetch(parkingTarget, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: { address: "12 High Street", client_name: "Barry Thompson" }, photos: [png]
    })
  });
  check("parking submit without a signature is rejected", parkingNoSig.status, 400);

  const parkingWithSig = await fetch(parkingTarget, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: { address: "12 High Street", client_name: "Barry Thompson" }, photos: [png], signature: png
    })
  });
  const parkingBody = await parkingWithSig.json();
  check("parking submit with a signature succeeds", parkingWithSig.status, 200);
  check("parking submit ok", parkingBody.ok, true);
  check("ParkingLiability row written", tabs.ParkingLiability.length - 1, 1);

  console.log("\n" + "-".repeat(74));
  console.log("Liability Report form: single-select damage category + conditional waiver");
  console.log("-".repeat(74));
  const liabilityLinkUrl = new URL(scenarioLinkFor("liability", JOB_STANDALONE));
  const liabilityTarget = `http://127.0.0.1:${port}${liabilityLinkUrl.pathname}${liabilityLinkUrl.search}`;
  const liabilityHtml = await (await fetch(liabilityTarget)).text();
  check("liability form renders a single-select dropdown", liabilityHtml.includes("<select"), true);
  check("liability form includes the Van Overloaded option", liabilityHtml.includes("Van Overloaded"), true);
  check("liability form includes the conditional waiver, hidden by default",
    /class="notice conditional-notice"[^>]*style="display:none"/.test(liabilityHtml), true);
  check("liability form includes the waiver text", liabilityHtml.includes("Overloading Liability Waiver"), true);

  const liabilitySubmit = await fetch(liabilityTarget, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { damage_categories: "Van Overloaded" }, photos: [png], signature: png })
  });
  const liabilityBody = await liabilitySubmit.json();
  check("liability submit with a single selected category succeeds", liabilitySubmit.status, 200);
  check("liability submit ok", liabilityBody.ok, true);
  check("LiabilityReport row written", tabs.LiabilityReport.length - 1, 1);
  check("LiabilityReport stores the selected category", tabs.LiabilityReport[1][HEADERS.LiabilityReport.indexOf("Damage Categories")], "Van Overloaded");

  await new Promise((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
  // fetch's keep-alive pool can leave a socket to this server open past server.close()
  // (whose callback fires once it stops accepting new connections, not once every
  // pooled client connection is gone), which otherwise holds the event loop open
  // indefinitely since process.exit() is deliberately not used below (see the comment
  // there). Force them shut so the process can exit on its own.
  server.closeAllConnections?.();

  console.log("\n" + "-".repeat(74));
  console.log("Finish Job is gone: those action names are unknown now");
  console.log("-".repeat(74));
  const unknownConfirm = await click("FINISH_JOB_CONFIRM", JOB_STANDALONE);
  check("FINISH_JOB_CONFIRM is rejected as an unknown action", title(unknownConfirm), "TMV — Action blocked");
  const unknownFinish = await click("FINISH_JOB", JOB_STANDALONE);
  check("FINISH_JOB is rejected as an unknown action", title(unknownFinish), "TMV — Action blocked");
  check("job is still not completed", statusOf(JOB_STANDALONE), "READY");

  console.log("\n" + "-".repeat(74));
  console.log("Overdue jobs (booked for a previous day) still surface as Next Job");
  console.log("-".repeat(74));
  // Booked 3 days ago, never started -- the oldest unfinished job, so it should now
  // outrank JOB_STANDALONE (booked today) as "next".
  addBooking(JOB_OVERDUE, "evt-flow-overdue", 3);
  const overdueCard = await click("RESUME_JOB", "");
  check("an overdue, never-started job is still offered as Next Job", title(overdueCard), `Job ${JOB_OVERDUE}`);

  console.log("\n" + "-".repeat(74));
  console.log("Any message shows the menu (not just an exact keyword)");
  console.log("-".repeat(74));
  // Last in the script deliberately: this is the only path that requests a fresh
  // Calendar sync (sync: true), and the stub calendar always returns zero events, which
  // would reconcile every fixture job above as "cancelled" (see reconcileDisappeared())
  // if this ran any earlier. Real Calendar always has the actual events, so this isn't
  // a production concern -- it's specific to the stub having no calendar data at all.
  const hiMenu = await handleChatEvent({ type: "MESSAGE", user: USER, message: { text: "Hi" } });
  check("typing 'Hi' shows the menu, not a placeholder greeting", title(hiMenu), "TMV Driver Bot");

  console.log("\n" + "=".repeat(74));
  console.log(`${pass} passed, ${fail} failed`);
  console.log("Audit trail: " + JSON.stringify({
    ActivityLog: tabs.ActivityLog.length - 1, DriverFlow: tabs.DriverFlow.length - 1,
    Photos: tabs.Photos.length - 1, Signatures: tabs.Signatures.length - 1,
    Payments: tabs.Payments.length - 1, StorageCheckIn: tabs.StorageCheckIn.length - 1
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
