/**
 * Two independent flows coexist and this checks both, plus that neither leaks into
 * the other:
 *   1. The classic Start Job workflow (arrival photo -> loaded photo -> charges ->
 *      payment -> empty-van photo -> client details -> customer signature -> organized
 *      photo -> complete). This is also the only way a job ever completes -- there is
 *      no standalone "Finish Job" menu action.
 *   2. The menu's standalone scenarios (Check In / Check Out / Parking Liability /
 *      Liability Report), which must work on a job that never ran Start Job at all --
 *      no "start a job first" gate, no silent auto-start. Each is a Chat-card stepper
 *      now (one field asked at a time, like the classic flow) instead of a bundled web
 *      form -- only the final signature still opens externally, since Chat has no
 *      drawing/canvas widget. Both flows' signature steps push their next card into
 *      Chat automatically once signed (google/chat.ts's updateChatCard) -- confirmed
 *      working live, so there's no manual "check again" button on either.
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
  LiabilityReport: ["Timestamp","Job ID","Driver","Damage Categories","Photo URLs","Signature URL"],
  PendingSignatures: ["Job ID","Message Name","Updated"],
  ScenarioProgress: ["Key","Job ID","Scenario","Step","Fields JSON","Message Name","Updated"]
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
let lastChatPatch = null;
googleapis.google.chat = () => ({ spaces: { messages: {
  patch: async ({ name, requestBody }) => { bump("chatPatch"); lastChatPatch = { name, requestBody }; return { data: {} }; }
} } });
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
const { signatureRouter } = require(BOT + "/chat/signature.routes");
const { signatureLinkFor } = require(BOT + "/chat/signature.link");
const { registerInlineDispatcher, drainInlineQueue } = require(BOT + "/queue/queue.service");
const { dispatchTask } = require(BOT + "/queue/dispatch");

// One shared server for the whole script: the classic workflow's real /sign/:jobId
// round trip needs it early, the scenario forms need it later.
const app = express();
app.use(express.json({ limit: "2mb" }));
app.use("/forms", scenarioRouter());
app.use("/sign", signatureRouter());
const server = app.listen(0);

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

// A real Chat CARD_CLICKED event always carries the identity of the message that was
// clicked (event.message.name) -- UPDATE_MESSAGE responses replace that same message's
// content in place, so one job's card keeps one message identity across its whole
// classic-flow lifecycle. Needed so the pending-signature push (see
// chat.controller.ts) has something real to record.
const click = (fn, jobId) => handleChatEvent({
  type: "CARD_CLICKED", user: USER,
  action: { function: fn, parameters: [{ key: "jobId", value: jobId }] },
  message: { name: `spaces/S/messages/${jobId}` },
  common: { formInputs: {} }
});
const clickWithInputs = (fn, jobId, formInputs) => handleChatEvent({
  type: "CARD_CLICKED", user: USER,
  action: { function: fn, parameters: [{ key: "jobId", value: jobId }] },
  message: { name: `spaces/S/messages/${jobId}` },
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

// A scenario's Chat card message keeps one identity for its whole session, same as the
// classic flow's job card -- UPDATE_MESSAGE always replaces that same message in place,
// and it's what scenario.engine.ts remembers as the pending "push the next step"
// target once the driver reaches the signature step.
const scenarioMsgName = (jobId, scenario) => `spaces/S/messages/${jobId}-${scenario}`;
const menuTap = (fn, jobId, scenario) => handleChatEvent({
  type: "CARD_CLICKED", user: USER,
  action: { function: fn, parameters: [{ key: "jobId", value: jobId }] },
  message: { name: scenarioMsgName(jobId, scenario) },
  common: { formInputs: {} }
});
const scenarioClick = (fn, jobId, scenario, extra = {}, formInputsObj = {}) => handleChatEvent({
  type: "CARD_CLICKED", user: USER,
  action: {
    function: fn,
    parameters: [
      { key: "jobId", value: jobId }, { key: "scenario", value: scenario },
      ...Object.entries(extra).map(([key, value]) => ({ key, value }))
    ]
  },
  message: { name: scenarioMsgName(jobId, scenario) },
  common: { formInputs: formInputsObj }
});
const submitField = (jobId, scenario, fieldIndex, fieldName, ...values) =>
  scenarioClick("SCENARIO_FIELD_SUBMIT", jobId, scenario, { fieldIndex: String(fieldIndex) }, { [fieldName]: si(...values) });
// Real Chat submits a dateTimePicker (DATE_ONLY) field as a UTC-midnight epoch, not
// text -- a completely different shape from every other widget (see
// chat.controller.ts's formInputs()), so this needs its own helper rather than si().
const submitDateField = (jobId, scenario, fieldIndex, fieldName, msSinceEpoch) =>
  scenarioClick("SCENARIO_FIELD_SUBMIT", jobId, scenario, { fieldIndex: String(fieldIndex) },
    { [fieldName]: { dateInput: { msSinceEpoch: String(msSinceEpoch) } } });
const ackNotice = (jobId, scenario) => scenarioClick("SCENARIO_NOTICE_ACK", jobId, scenario);
const continuePhotos = (jobId, scenario) => scenarioClick("SCENARIO_PHOTOS_CONTINUE", jobId, scenario);

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(52)} ${ok ? actual : `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
}
const title = r => JSON.stringify(r.message).match(/"title":"([^"]+)"/)?.[1] ?? "(none)";
const subtitle = r => JSON.stringify(r.message).match(/"subtitle":"([^"]+)"/)?.[1] ?? "(none)";
const hasText = (r, needle) => JSON.stringify(r.message).includes(needle);
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
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;
  const png = "data:image/png;base64," + Buffer.from("fake-photo-bytes").toString("base64");
  // A real phone camera almost always produces image/jpeg, not image/png -- using only
  // png data URIs here would never have caught the bug where the upload path rejected
  // anything but PNG with "One of the photos was not a valid image."
  const jpeg = "data:image/jpeg;base64," + Buffer.from("fake-jpeg-bytes").toString("base64");

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
  // Firetext isn't configured in this test env (no FIRETEXT_API_KEY/SENDER_ID) -- the
  // SMS task must still enqueue and process cleanly as a no-op, not throw or crash the
  // drain, and must not record a fake "sent" outcome.
  check("start SMS task no-ops cleanly when Firetext isn't configured",
    tabs.ActivityLog.slice(1).some(r => r[HEADERS.ActivityLog.indexOf("Action")] === "CLIENT_START_SMS_SENT"), false);

  await photo(); await drain();
  check("arrival photo advances to loaded-photo step", stateOf(JOB_CLASSIC), "WAITING_LOADED_PHOTO");
  check("evidence uploaded by the background worker", evidenceFor(JOB_CLASSIC).some(r => r[HEADERS.Evidence.indexOf("Status")] === "COMPLETED"), true);
  // ensureJobFolder() used to resolve the Drive folder on every upload without ever
  // writing it back -- Drive Folder ID/URL stayed blank in the sheet forever.
  check("first photo upload persists the Drive folder id onto the booking row", fieldOf(JOB_CLASSIC, "Drive Folder ID") !== "", true);
  check("first photo upload persists the Drive folder url onto the booking row", fieldOf(JOB_CLASSIC, "Drive Folder URL") !== "", true);

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
  // Confirmed live: the server-side push (not onClose: RELOAD) reliably advances this
  // card once the customer signs, so there's no manual fallback button anymore.
  check("signature step has no manual CHECK AGAIN button",
    JSON.stringify(signatureStepCard.message).includes('"CHECK AGAIN"'), false);

  check("pending-signature message recorded for the push-forward", tabs.PendingSignatures.length - 1, 1);
  check("pending-signature message matches the clicked card",
    tabs.PendingSignatures[1][HEADERS.PendingSignatures.indexOf("Message Name")], `spaces/S/messages/${JOB_CLASSIC}`);

  // The customer signature is captured on their own device -- a real HTTP round trip
  // against /sign/:jobId, not a Chat form submission.
  const signLinkUrl = new URL(signatureLinkFor(JOB_CLASSIC));
  const signTarget = `http://127.0.0.1:${port}${signLinkUrl.pathname}${signLinkUrl.search}`;
  const signGetRes = await fetch(signTarget);
  check("sign pad GET status", signGetRes.status, 200);
  const signHtml = await signGetRes.text();
  check("sign pad has a signature canvas", signHtml.includes('id="pad"'), true);

  lastChatPatch = null;
  const signPostRes = await fetch(signTarget, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: png })
  });
  const signPostBody = await signPostRes.json();
  check("sign pad POST status", signPostRes.status, 200);
  check("sign pad POST ok", signPostBody.ok, true);
  check("signature advances to the organized-photo step", stateOf(JOB_CLASSIC), "WAITING_ORGANIZED_PHOTO");
  check("signature row written", tabs.Signatures.length - 1, 1);

  // The real point of this whole feature: signing pushed the next card into Chat on
  // its own, no CHECK AGAIN tap needed.
  check("signing pushed a card update into Chat automatically", lastChatPatch !== null, true);
  check("the push targeted the exact message that was showing the signature step",
    lastChatPatch && lastChatPatch.name, `spaces/S/messages/${JOB_CLASSIC}`);
  check("the pushed card shows the next step (organized photo)",
    lastChatPatch && JSON.stringify(lastChatPatch.requestBody).includes("Is the van organized"), true);

  await photo(); await drain();
  check("organized photo makes the job ready to complete", stateOf(JOB_CLASSIC), "READY_TO_COMPLETE");

  const doneCard = await click("COMPLETE_JOB", JOB_CLASSIC);
  check("workflow's own last step completes the job", stateOf(JOB_CLASSIC), "COMPLETED");
  check("status column completed", statusOf(JOB_CLASSIC), "COMPLETED");
  check("finish timestamp set", /^\d{4}-\d{2}-\d{2}T/.test(fieldOf(JOB_CLASSIC, "Actual Finish")), true);
  check("completion card returned", title(doneCard), "Job completed");
  check("completion card has a Main Menu button, not just typed text",
    JSON.stringify(doneCard.message).includes('"Main Menu"'), true);

  console.log("\n" + "=".repeat(74));
  console.log("Menu scenarios run standalone -- step by step in Chat, no Start Job needed");
  console.log("=".repeat(74));

  // JOB_CLASSIC is now COMPLETED, so the driver's only eligible job is JOB_STANDALONE --
  // every menu action below resolves to it without an explicit jobId being trusted.
  const widgetsOf = r => r.message?.cardsV2?.[0]?.card?.sections?.[0]?.widgets ?? [];
  const { DAMAGE_CATEGORIES, CHECK_IN_SIGNATURE_TEXT, CHECK_OUT_SIGNATURE_TEXT, LIABILITY_REPORT_SIGNATURE_TEXT,
    OVERLOADING_LIABILITY_WAIVER_TITLE, OVERLOADING_LIABILITY_WAIVER_TEXT, PARKING_LIABILITY_NOTICE_TITLE
  } = require(BOT + "/chat/scenario.text");

  console.log("\n" + "-".repeat(74));
  console.log("Check In: full field-by-field walkthrough, photo parked after Container Number");
  console.log("-".repeat(74));

  const checkInField0 = await menuTap("MENU_CHECK_IN", JOB_STANDALONE, "checkin");
  check("Check In starts immediately, asking for field 1", title(checkInField0), "Check In");
  check("step subtitle shows position 1 of 6", subtitle(checkInField0), "Step 1 of 6");
  check("first field is Container Number", hasText(checkInField0, "Container Number"), true);
  check("Check In does NOT start the job -- status unchanged", statusOf(JOB_STANDALONE), "READY");
  check("Check In does NOT touch currentState", stateOf(JOB_STANDALONE), "READY");
  check("Check In leaves actualStart blank", fieldOf(JOB_STANDALONE, "Actual Start"), "");

  const checkInPhotosEmpty = await submitField(JOB_STANDALONE, "checkin", 0, "container_number", "C-123");
  check("container number submitted -> photo step (parked mid-form, not at the end)", title(checkInPhotosEmpty), "Check In");
  check("photo step asks for evidence, not the next field yet", hasText(checkInPhotosEmpty, "Evidence that the items have been loaded."), true);
  check("no CONTINUE button until the minimum photo count is met", hasText(checkInPhotosEmpty, "CONTINUE"), false);

  const checkInAfterPhoto = await photo();
  check("sending a photo advances the received count immediately (no drain needed)",
    hasText(checkInAfterPhoto, "<b>1</b> of up to 1 photo(s) received."), true);
  check("CONTINUE appears once the minimum is met", hasText(checkInAfterPhoto, "CONTINUE"), true);

  const checkInField1 = await continuePhotos(JOB_STANDALONE, "checkin");
  check("continuing from photos resumes the REMAINING fields, not signature", subtitle(checkInField1), "Step 2 of 6");
  check("resumed field is Cliente Name", hasText(checkInField1, "Cliente Name"), true);

  const checkInField2 = await submitField(JOB_STANDALONE, "checkin", 1, "client_name", "Barry Thompson");
  check("step 3 of 6 (Client phone)", subtitle(checkInField2), "Step 3 of 6");
  const checkInField3 = await submitField(JOB_STANDALONE, "checkin", 2, "client_phone", "07123456789");
  check("step 4 of 6 (Client Email)", subtitle(checkInField3), "Step 4 of 6");
  const checkInField4 = await submitField(JOB_STANDALONE, "checkin", 3, "client_email", "barry@example.test");
  check("step 5 of 6 (Is the client present ?)", subtitle(checkInField4), "Step 5 of 6");
  const checkInField5 = await submitField(JOB_STANDALONE, "checkin", 4, "client_present", "Yes");
  check("step 6 of 6 (date)", subtitle(checkInField5), "Step 6 of 6");

  // Real Chat submits this field as a dateTimePicker epoch, not typed text -- 15 Aug
  // 2026, UTC midnight.
  const checkInSig = await submitDateField(JOB_STANDALONE, "checkin", 5, "date", Date.UTC(2026, 7, 15));
  check("final field goes straight to signature -- photo step is not asked again", title(checkInSig), "Check In");
  check("signature step subtitle", subtitle(checkInSig), "Waiting on signature");
  check("signature step shows the verbatim Check In confirmation text", hasText(checkInSig, CHECK_IN_SIGNATURE_TEXT), true);
  check("signature step has no manual CHECK AGAIN button (auto-push only)", hasText(checkInSig, "CHECK AGAIN"), false);
  const checkInSigUrl = buttonUrl(checkInSig, "OPEN SIGNATURE PAD");
  check("signature link points at the checkin sign-only route", typeof checkInSigUrl === "string" && checkInSigUrl.includes("/forms/checkin/"), true);

  await drain(); // finalizeScenario requires every photo's background upload to have completed

  const checkInLinkUrl = new URL(scenarioLinkFor("checkin", JOB_STANDALONE));
  const checkInTarget = `http://127.0.0.1:${port}${checkInLinkUrl.pathname}${checkInLinkUrl.search}`;
  const checkInGetRes = await fetch(checkInTarget);
  check("sign-only page GET status", checkInGetRes.status, 200);
  const checkInSignHtml = await checkInGetRes.text();
  check("sign-only page has a signature canvas", checkInSignHtml.includes('id="pad"'), true);
  check("sign-only page shows the same verbatim confirmation text", checkInSignHtml.includes(CHECK_IN_SIGNATURE_TEXT), true);
  check("sign-only page collects ONLY a signature -- fields/photos already came in via Chat",
    !checkInSignHtml.includes("Container Number"), true);

  lastChatPatch = null;
  const checkInPostRes = await fetch(checkInTarget, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signature: png })
  });
  const checkInPostBody = await checkInPostRes.json();
  check("check-in sign POST status", checkInPostRes.status, 200);
  check("check-in sign POST ok", checkInPostBody.ok, true);
  check("StorageCheckIn row written", tabs.StorageCheckIn.length - 1, 1);
  check("StorageCheckIn captured the container number entered in Chat",
    tabs.StorageCheckIn[1][HEADERS.StorageCheckIn.indexOf("Container Number")], "C-123");
  check("StorageCheckIn's date column has the date picker's value, formatted dd/MM/yyyy",
    tabs.StorageCheckIn[1][HEADERS.StorageCheckIn.indexOf("Date")], "15/08/2026");
  check("job still not started after a scenario submit", statusOf(JOB_STANDALONE), "READY");

  check("signing pushed the submitted card into Chat automatically", lastChatPatch !== null, true);
  check("the push targeted the exact message that was showing the signature step",
    lastChatPatch && lastChatPatch.name, scenarioMsgName(JOB_STANDALONE, "checkin"));
  check("the pushed card confirms submission and offers Main Menu",
    lastChatPatch && JSON.stringify(lastChatPatch.requestBody).includes("Check In submitted") &&
    JSON.stringify(lastChatPatch.requestBody).includes("Main Menu"), true);

  const checkInBadLink = await fetch(checkInTarget.replace(/sig=[^&]+/, "sig=deadbeef"));
  check("tampered signature link rejected", checkInBadLink.status, 410);

  console.log("\n" + "-".repeat(74));
  console.log("Check Out: same pattern, lighter walkthrough");
  console.log("-".repeat(74));

  const checkOutField0 = await menuTap("MENU_CHECK_OUT", JOB_STANDALONE, "checkout");
  check("Check Out step 1 of 5", subtitle(checkOutField0), "Step 1 of 5");
  await submitField(JOB_STANDALONE, "checkout", 0, "container_number", "C-999");
  await photo();
  const checkOutField1 = await continuePhotos(JOB_STANDALONE, "checkout");
  check("Check Out resumes remaining fields after its photo step", subtitle(checkOutField1), "Step 2 of 5");
  await submitField(JOB_STANDALONE, "checkout", 1, "client_name", "Barry Thompson");
  await submitField(JOB_STANDALONE, "checkout", 2, "client_email", "barry@example.test");
  await submitField(JOB_STANDALONE, "checkout", 3, "client_present", "No");
  const checkOutSig = await submitDateField(JOB_STANDALONE, "checkout", 4, "date", Date.UTC(2026, 7, 16));
  check("Check Out reaches signature with the verbatim Check Out confirmation text",
    hasText(checkOutSig, CHECK_OUT_SIGNATURE_TEXT), true);
  await drain();

  const checkOutLinkUrl = new URL(scenarioLinkFor("checkout", JOB_STANDALONE));
  const checkOutTarget = `http://127.0.0.1:${port}${checkOutLinkUrl.pathname}${checkOutLinkUrl.search}`;
  const checkOutPostRes = await fetch(checkOutTarget, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signature: png })
  });
  check("check-out sign POST status", checkOutPostRes.status, 200);
  check("StorageCheckOut row written", tabs.StorageCheckOut.length - 1, 1);
  check("StorageCheckOut's date column has the date picker's value, formatted dd/MM/yyyy",
    tabs.StorageCheckOut[1][HEADERS.StorageCheckOut.indexOf("Date")], "16/08/2026");

  console.log("\n" + "-".repeat(74));
  console.log("Parking Liability: notice on field 1, bare signature (no legal paragraph), 4-photo cap");
  console.log("-".repeat(74));

  const parkingField0 = await menuTap("MENU_PARKING_LIABILITY", JOB_STANDALONE, "parking");
  check("Parking Liability step 1 of 2 shows the PCN notice above the field", subtitle(parkingField0), "Step 1 of 2");
  check("PCN notice title shown", hasText(parkingField0, PARKING_LIABILITY_NOTICE_TITLE), true);
  check("PCN notice mentions the fine amounts", hasText(parkingField0, "£60"), true);

  await submitField(JOB_STANDALONE, "parking", 0, "address", "12 High Street");
  const parkingPhotos = await submitField(JOB_STANDALONE, "parking", 1, "client_name", "Barry Thompson");
  check("Parking Liability's photo step comes after BOTH fields (no photoAfterField)", title(parkingPhotos), "Parking Liability");
  const parkingAfterPhoto = await photo();
  check("parking photo step allows up to 4", hasText(parkingAfterPhoto, "up to 4"), true);
  const parkingSig = await continuePhotos(JOB_STANDALONE, "parking");
  check("Parking Liability signature step has no legal paragraph, just the pad", subtitle(parkingSig), "Waiting on signature");
  check("parking signature step doesn't show unrelated scenario text", hasText(parkingSig, CHECK_IN_SIGNATURE_TEXT), false);
  await drain();

  const parkingLinkUrl = new URL(scenarioLinkFor("parking", JOB_STANDALONE));
  const parkingTarget = `http://127.0.0.1:${port}${parkingLinkUrl.pathname}${parkingLinkUrl.search}`;
  const parkingNoSig = await fetch(parkingTarget, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({})
  });
  check("parking sign submit without a signature is rejected", parkingNoSig.status, 400);
  const parkingWithSig = await fetch(parkingTarget, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signature: png })
  });
  const parkingBody = await parkingWithSig.json();
  check("parking sign submit with a signature succeeds", parkingWithSig.status, 200);
  check("parking sign submit ok", parkingBody.ok, true);
  check("ParkingLiability row written", tabs.ParkingLiability.length - 1, 1);
  check("ParkingLiability captured the address entered in Chat",
    tabs.ParkingLiability[1][HEADERS.ParkingLiability.indexOf("Address")], "12 High Street");

  console.log("\n" + "-".repeat(74));
  console.log("Liability Report: full damage-category dropdown + conditional Overloading waiver");
  console.log("-".repeat(74));

  const liabilityField0 = await menuTap("MENU_LIABILITY_REPORT", JOB_STANDALONE, "liability");
  const dropdown = widgetsOf(liabilityField0).find(w => w.selectionInput)?.selectionInput;
  check("damage-category field renders as a DROPDOWN, not a giant radio-button stack", dropdown?.type, "DROPDOWN");
  check("dropdown lists every damage category from the client's full list", dropdown?.items?.length, DAMAGE_CATEGORIES.length);
  check("dropdown includes a category added in the latest list", dropdown?.items?.some(i => i.value === "Fridges and Freezers"), true);
  check("dropdown includes the last (longest) category added",
    dropdown?.items?.some(i => i.value === "Lift Got No Protection – Damage Responsibility Notice"), true);

  // Chat's dropdown has no hover-tooltip for a long item -- it just gets cut off
  // mid-word. The "(e.g., ...)" examples are dropped from the on-screen label only;
  // the full original text must still be what actually gets submitted and stored.
  const glassware = dropdown?.items?.find(i => i.value.startsWith("Glassware"));
  check("long option's stored value keeps the full original text", glassware?.value, "Glassware (e.g., glasses, plates, mirrors, vases)");
  check("long option's on-screen label drops the parenthetical so it doesn't truncate", glassware?.text, "Glassware");
  const shortOption = dropdown?.items?.find(i => i.value === "Van Overloaded");
  check("a short option's label is untouched", shortOption?.text, "Van Overloaded");

  const liabilityNotice = await submitField(JOB_STANDALONE, "liability", 0, "damage_categories", "Van Overloaded");
  check("picking Van Overloaded shows the conditional Overloading Liability Waiver", title(liabilityNotice), OVERLOADING_LIABILITY_WAIVER_TITLE);
  check("waiver shows the verbatim waiver text", hasText(liabilityNotice, OVERLOADING_LIABILITY_WAIVER_TEXT), true);

  const liabilityPhotos = await ackNotice(JOB_STANDALONE, "liability");
  check("acknowledging the waiver moves on to photos (only field, no photoAfterField)", title(liabilityPhotos), "Liability Report");
  const liabilityAfterPhoto = await photo();
  check("liability photo step allows up to 8", hasText(liabilityAfterPhoto, "up to 8"), true);
  const liabilitySig = await continuePhotos(JOB_STANDALONE, "liability");
  check("Liability Report reaches signature with its own verbatim confirmation text",
    hasText(liabilitySig, LIABILITY_REPORT_SIGNATURE_TEXT), true);
  await drain();

  const liabilityLinkUrl = new URL(scenarioLinkFor("liability", JOB_STANDALONE));
  const liabilityTarget = `http://127.0.0.1:${port}${liabilityLinkUrl.pathname}${liabilityLinkUrl.search}`;
  const liabilitySubmit = await fetch(liabilityTarget, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signature: png })
  });
  const liabilityBody = await liabilitySubmit.json();
  check("liability sign submit succeeds", liabilitySubmit.status, 200);
  check("liability sign submit ok", liabilityBody.ok, true);
  check("LiabilityReport row written", tabs.LiabilityReport.length - 1, 1);
  check("LiabilityReport stores the selected category",
    tabs.LiabilityReport[1][HEADERS.LiabilityReport.indexOf("Damage Categories")], "Van Overloaded");

  console.log("\n" + "-".repeat(74));
  console.log("Add Job refuses to silently fall back to the broken direct-share behavior");
  console.log("-".repeat(74));
  // Calendar won't grant a service account write access directly (confirmed live) --
  // event creation must impersonate a real user via domain-wide delegation instead.
  // This test process never sets GOOGLE_WORKSPACE_IMPERSONATED_USER, so this checks
  // the guard fires with a clear error instead of quietly reusing the un-impersonated
  // client and hitting the exact "no writer access" error this was built to avoid.
  const { createCalendarEvent } = require(BOT + "/google/calendar");
  let createEventError = null;
  try {
    await createCalendarEvent({ summary: "test", start: { dateTime: new Date().toISOString() }, end: { dateTime: new Date().toISOString() } });
  } catch (error) {
    createEventError = error;
  }
  check("createCalendarEvent refuses to run without an impersonated user configured",
    createEventError && createEventError.message.includes("GOOGLE_WORKSPACE_IMPERSONATED_USER"), true);

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

  await new Promise((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
  // fetch's keep-alive pool can leave a socket to this server open past server.close()
  // (whose callback fires once it stops accepting new connections, not once every
  // pooled client connection is gone), which otherwise holds the event loop open
  // indefinitely since process.exit() is deliberately not used below (see the comment
  // there). Force them shut so the process can exit on its own.
  server.closeAllConnections?.();

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
