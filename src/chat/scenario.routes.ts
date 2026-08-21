import { Request, Response, Router } from "express";
import {
  activityWrite, commitWrites, driverFlowWrite, getJob, liabilityReportWrite, parkingLiabilityWrite,
  storageCheckInWrite, storageCheckOutWrite
} from "../google/sheets";
import { uploadEvidenceImage } from "../google/drive";
import { log } from "../utils/logger";
import { verifyScenarioLink } from "./scenario.link";
import { ScenarioFieldSpec, ScenarioKey, ScenarioSpec, SCENARIOS } from "./scenario.spec";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function page(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 20px 16px 40px; background: #f5f6f8; color: #1a1a1a; }
  .card { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  h1 { font-size: 18px; margin: 0 0 12px; }
  p { font-size: 14px; line-height: 1.5; color: #444; }
</style></head>
<body><div class="card">${bodyHtml}</div></body></html>`;
}

/** One <input>/radio-group/checkbox-list per field, driven by the field's type. */
function fieldHtml(field: ScenarioFieldSpec): string {
  const req = field.required ? " *" : "";
  if (field.type === "yesno") {
    return `
      <label>${escapeHtml(field.label)}${req}</label>
      <div class="yesno" data-field="${field.name}">
        <label class="radio"><input type="radio" name="f_${field.name}" value="Yes"> Yes</label>
        <label class="radio"><input type="radio" name="f_${field.name}" value="No"> No</label>
      </div>`;
  }
  if (field.type === "multiselect") {
    const options = (field.options ?? []).map(opt => `
        <label class="checkbox"><input type="checkbox" name="f_${field.name}" value="${escapeHtml(opt)}"> ${escapeHtml(opt)}</label>`
    ).join("");
    return `
      <label>${escapeHtml(field.label)}${req}</label>
      <div class="multiselect" data-field="${field.name}">${options}</div>`;
  }
  if (field.type === "select") {
    const options = (field.options ?? []).map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join("");
    const echo = field.echoPrefix
      ? `<p class="echo" data-echo-for="${field.name}">${escapeHtml(field.echoPrefix)} <span>—</span></p>`
      : "";
    return `
      <label for="f_${field.name}">${escapeHtml(field.label)}${req}</label>
      <select id="f_${field.name}" name="f_${field.name}" data-field="${field.name}">
        <option value="" disabled selected>${escapeHtml(field.placeholder ?? "Tap to select")}</option>
        ${options}
      </select>
      ${echo}`;
  }
  const inputType = field.type === "date" ? "date" : field.type === "tel" ? "tel" : field.type === "email" ? "email" : "text";
  return `
      <label for="f_${field.name}">${escapeHtml(field.label)}${req}</label>
      <input type="${inputType}" id="f_${field.name}" name="f_${field.name}" placeholder="${escapeHtml(field.placeholder ?? "Type here")}">`;
}

function photoWidgetHtml(spec: ScenarioSpec): string {
  return `
      <label>${escapeHtml(spec.photoLabel)}${spec.photoMin > 0 ? " *" : ""}</label>
      <div id="photos"></div>
      <button id="addPhoto" type="button">📷 Upload an image</button>
      <input type="file" id="fileInput" accept="image/*" capture="environment" ${spec.photoMax > 1 ? "multiple" : ""} style="display:none">`;
}

function formPage(spec: ScenarioSpec, job: { customerName: string }): string {
  const notice = spec.noticeHtml
    ? `<div class="notice"><h2>${escapeHtml(spec.noticeTitle ?? spec.title)}</h2><p>${escapeHtml(spec.noticeHtml)}</p></div>`
    : "";

  // The photo picker renders right after `photoAfterField` (Check In/Check Out put it
  // straight after the container number, matching the client's field order) — or after
  // every field, the default, which already matches Parking Liability/Liability Report.
  let fieldsHtml = "";
  let photoInserted = false;
  for (const field of spec.fields) {
    fieldsHtml += fieldHtml(field);
    if (spec.conditionalNotice?.field === field.name) {
      const cn = spec.conditionalNotice;
      // Hidden until the client JS below sees the matching value selected.
      fieldsHtml += `
      <div class="notice conditional-notice" data-conditional-field="${escapeHtml(cn.field)}" data-conditional-value="${escapeHtml(cn.whenValue)}" style="display:none">
        <h2>${escapeHtml(cn.title)}</h2><p>${escapeHtml(cn.text)}</p>
      </div>`;
    }
    if (spec.photoAfterField === field.name) {
      fieldsHtml += photoWidgetHtml(spec);
      photoInserted = true;
    }
  }
  if (!photoInserted) fieldsHtml += photoWidgetHtml(spec);

  const signatureBlock = spec.hasSignature
    ? `
      ${spec.signatureText ? `<p class="legal">${escapeHtml(spec.signatureText)}</p>` : ""}
      <label>Sign below with your finger or the cursor</label>
      <canvas id="pad"></canvas>`
    : "";

  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>${escapeHtml(spec.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 16px; background: #f5f6f8; color: #1a1a1a; }
  .card { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  h1 { font-size: 18px; margin: 0 0 8px; }
  .notice { background: #fdecea; border: 1px solid #f5c2c0; border-radius: 8px; padding: 14px; margin-bottom: 18px; }
  .notice h2 { font-size: 15px; margin: 0 0 8px; color: #b3261e; }
  .notice p { font-size: 13px; line-height: 1.45; color: #7a2b27; margin: 0; }
  p.legal { font-size: 13px; color: #555; line-height: 1.45; }
  label { display: block; font-size: 14px; font-weight: 600; margin: 18px 0 6px; }
  input[type=text], input[type=tel], input[type=email], input[type=date], select {
    width: 100%; padding: 12px; font-size: 16px; border: 1px solid #ccc; border-radius: 8px; background: #fff;
  }
  .yesno { display: flex; gap: 18px; }
  .radio, .checkbox { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 400; margin: 6px 0; }
  .multiselect { max-height: 220px; overflow-y: auto; border: 1px solid #eee; border-radius: 8px; padding: 8px 12px; }
  p.echo { font-size: 13px; color: #666; margin: 8px 0 0; }
  p.echo span { font-weight: 600; color: #1a1a1a; }
  #photos { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  #photos .thumb { position: relative; width: 72px; height: 72px; border-radius: 8px; overflow: hidden; border: 1px solid #ddd; }
  #photos .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  #photos .thumb button { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,.6); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; line-height: 1; }
  #addPhoto { margin-top: 10px; padding: 12px 16px; font-size: 14px; font-weight: 600; border: 1px dashed #999; border-radius: 8px; background: #fafafa; color: #333; }
  canvas { width: 100%; height: 200px; touch-action: none; border: 2px dashed #aaa; border-radius: 8px; background: #fff; display: block; margin-top: 8px; }
  .actions { display: flex; gap: 10px; margin-top: 22px; }
  button.primary { flex: 1; padding: 14px; font-size: 16px; font-weight: 600; border: none; border-radius: 8px; background: #1a73e8; color: #fff; }
  button.primary:disabled { background: #a7c3ef; }
  #status { margin-top: 12px; font-size: 14px; min-height: 18px; }
  #done { display: none; text-align: center; padding: 30px 4px; }
</style></head>
<body>
  <div class="card">
    <div id="form">
      ${notice ? "" : `<h1>${escapeHtml(spec.title)}</h1>`}
      ${notice}
      ${fieldsHtml}
      ${signatureBlock}
      <div class="actions"><button class="primary" id="submit" type="button" disabled>Send</button></div>
      <div id="status"></div>
    </div>
    <div id="done">
      <h1>Thanks — submitted</h1>
      <p>Please hand the device back / return to the app. This window will close automatically — if it doesn't, you can close it now.</p>
    </div>
  </div>
  <script>
  (function () {
    var PHOTO_MIN = ${spec.photoMin}, PHOTO_MAX = ${spec.photoMax};
    var HAS_SIGNATURE = ${spec.hasSignature ? "true" : "false"};
    var photos = [];
    var submitBtn = document.getElementById('submit');
    var statusEl = document.getElementById('status');

    // ---- photo picker ----
    var fileInput = document.getElementById('fileInput');
    var photosEl = document.getElementById('photos');
    document.getElementById('addPhoto').addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var files = Array.prototype.slice.call(fileInput.files || []);
      files.forEach(function (file) {
        if (photos.length >= PHOTO_MAX) return;
        var reader = new FileReader();
        reader.onload = function () {
          photos.push(reader.result);
          renderPhotos();
          refreshSubmit();
        };
        reader.readAsDataURL(file);
      });
      fileInput.value = '';
    });
    function renderPhotos() {
      photosEl.innerHTML = '';
      photos.forEach(function (dataUrl, i) {
        var div = document.createElement('div');
        div.className = 'thumb';
        div.innerHTML = '<img src="' + dataUrl + '"><button type="button" data-i="' + i + '">×</button>';
        photosEl.appendChild(div);
      });
      Array.prototype.forEach.call(photosEl.querySelectorAll('button'), function (btn) {
        btn.addEventListener('click', function () {
          photos.splice(Number(btn.getAttribute('data-i')), 1);
          renderPhotos();
          refreshSubmit();
        });
      });
    }

    // ---- signature pad (only if this scenario needs one) ----
    var ctx, canvas, hasDrawn = false;
    if (HAS_SIGNATURE) {
      canvas = document.getElementById('pad');
      ctx = canvas.getContext('2d');
      function resize() {
        var ratio = window.devicePixelRatio || 1;
        var rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        ctx.scale(ratio, ratio);
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#111';
      }
      resize();
      window.addEventListener('resize', resize);
      var drawing = false, lastX = 0, lastY = 0;
      function pos(e) {
        var rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }
      canvas.addEventListener('pointerdown', function (e) {
        drawing = true;
        var p = pos(e); lastX = p.x; lastY = p.y;
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      canvas.addEventListener('pointermove', function (e) {
        if (!drawing) return;
        var p = pos(e);
        ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(p.x, p.y); ctx.stroke();
        lastX = p.x; lastY = p.y;
        hasDrawn = true;
        refreshSubmit();
        e.preventDefault();
      });
      window.addEventListener('pointerup', function () { drawing = false; });
    }

    // ---- validation ----
    function fieldsValid() {
      var ok = true;
      document.querySelectorAll('input[type=text],input[type=tel],input[type=email],input[type=date]').forEach(function (el) {
        if (!el.value.trim()) ok = false;
      });
      document.querySelectorAll('.yesno[data-field]').forEach(function (group) {
        if (!group.querySelector('input:checked')) ok = false;
      });
      document.querySelectorAll('.multiselect[data-field]').forEach(function (group) {
        if (!group.querySelector('input:checked')) ok = false;
      });
      document.querySelectorAll('select[data-field]').forEach(function (el) {
        if (!el.value) ok = false;
      });
      return ok;
    }
    function refreshSubmit() {
      var photosOk = photos.length >= PHOTO_MIN && photos.length <= PHOTO_MAX;
      var sigOk = !HAS_SIGNATURE || hasDrawn;
      submitBtn.disabled = !(fieldsValid() && photosOk && sigOk);
    }
    document.querySelectorAll('input,select').forEach(function (el) { el.addEventListener('input', refreshSubmit); el.addEventListener('change', refreshSubmit); });

    // A "select" field with an echoPrefix (e.g. the Liability Report damage picker)
    // echoes the chosen option back next to its prefix as soon as it's picked, matching
    // the "Waiver of Liability: <choice>" behaviour in the client's mockup.
    document.querySelectorAll('select[data-field]').forEach(function (el) {
      var echo = document.querySelector('.echo[data-echo-for="' + el.getAttribute('data-field') + '"]');
      if (echo) {
        var span = echo.querySelector('span');
        el.addEventListener('change', function () { span.textContent = el.value || '—'; });
      }
      // Conditional notice blocks (e.g. the Liability Report's Overloading Liability
      // Waiver) show only while their field currently holds the matching value.
      var conditional = document.querySelector('.conditional-notice[data-conditional-field="' + el.getAttribute('data-field') + '"]');
      if (conditional) {
        var matchValue = conditional.getAttribute('data-conditional-value');
        el.addEventListener('change', function () {
          conditional.style.display = el.value === matchValue ? 'block' : 'none';
          refreshSubmit();
        });
      }
    });

    // ---- submit ----
    submitBtn.addEventListener('click', function () {
      submitBtn.disabled = true;
      statusEl.textContent = 'Submitting…';
      var fields = {};
      document.querySelectorAll('input[type=text],input[type=tel],input[type=email],input[type=date]').forEach(function (el) {
        fields[el.name.replace(/^f_/, '')] = el.value.trim();
      });
      document.querySelectorAll('.yesno[data-field]').forEach(function (group) {
        var checked = group.querySelector('input:checked');
        fields[group.getAttribute('data-field')] = checked ? checked.value : '';
      });
      document.querySelectorAll('.multiselect[data-field]').forEach(function (group) {
        var values = [];
        group.querySelectorAll('input:checked').forEach(function (cb) { values.push(cb.value); });
        fields[group.getAttribute('data-field')] = values.join(' | ');
      });
      document.querySelectorAll('select[data-field]').forEach(function (el) {
        fields[el.getAttribute('data-field')] = el.value;
      });
      var body = { fields: fields, photos: photos };
      if (HAS_SIGNATURE) body.signature = canvas.toDataURL('image/png');

      fetch(location.pathname + location.search, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (res) {
        if (!res.ok) return res.json().then(function (b) { throw new Error(b.error || 'Something went wrong.'); });
        document.getElementById('form').style.display = 'none';
        document.getElementById('done').style.display = 'block';
        setTimeout(function () { window.close(); }, 1200);
      }).catch(function (err) {
        statusEl.textContent = err.message;
        submitBtn.disabled = false;
      });
    });
  })();
  </script>
</body></html>`;
}

async function loadAuthorized(
  scenario: ScenarioKey, req: Request, res: Response
): Promise<{ job: NonNullable<Awaited<ReturnType<typeof getJob>>>; spec: ScenarioSpec } | null> {
  const spec = SCENARIOS[scenario];
  if (!spec) {
    res.status(404).send(page("Not found", "<h1>Unknown form</h1>"));
    return null;
  }
  const jobId = String(req.params.jobId);
  if (!verifyScenarioLink(scenario, jobId, req.query.exp, req.query.sig)) {
    res.status(410).send(page("Link expired", "<h1>This link has expired</h1><p>Go back to Chat and open this form again from the menu.</p>"));
    return null;
  }
  const job = await getJob(jobId, 0);
  if (!job) {
    res.status(404).send(page("Not found", "<h1>Job not found</h1>"));
    return null;
  }
  return { job, spec };
}

function writeScenarioRow(
  spec: ScenarioSpec, jobId: string, driver: string, fields: Record<string, string>,
  photoUrls: string[], signatureUrl: string
) {
  switch (spec.key) {
    case "checkin":
      return storageCheckInWrite({
        jobId, driver, containerNumber: fields.container_number ?? "", clientName: fields.client_name ?? "",
        clientPhone: fields.client_phone ?? "", clientEmail: fields.client_email ?? "",
        clientPresent: fields.client_present ?? "", date: fields.date ?? "", photoUrls, signatureUrl
      });
    case "checkout":
      return storageCheckOutWrite({
        jobId, driver, containerNumber: fields.container_number ?? "", clientName: fields.client_name ?? "",
        clientEmail: fields.client_email ?? "", clientPresentAtDropoff: fields.client_present ?? "",
        date: fields.date ?? "", photoUrls, signatureUrl
      });
    case "parking":
      return parkingLiabilityWrite({
        jobId, driver, address: fields.address ?? "", clientFullName: fields.client_name ?? "", photoUrls, signatureUrl
      });
    case "liability":
      return liabilityReportWrite({
        jobId, driver, damageCategories: (fields.damage_categories ?? "").split(" | ").filter(Boolean), photoUrls, signatureUrl
      });
  }
}

export function scenarioRouter(): Router {
  const router = Router();

  router.get("/:scenario/:jobId", async (req, res) => {
    const scenario = req.params.scenario as ScenarioKey;
    const authorized = await loadAuthorized(scenario, req, res);
    if (!authorized) return;
    return res.status(200).send(formPage(authorized.spec, authorized.job));
  });

  router.post("/:scenario/:jobId", async (req, res) => {
    const scenario = req.params.scenario as ScenarioKey;
    const spec = SCENARIOS[scenario];
    if (!spec) return res.status(404).json({ error: "Unknown form." });

    const jobId = String(req.params.jobId);
    if (!verifyScenarioLink(scenario, jobId, req.query.exp, req.query.sig)) {
      return res.status(410).json({ error: "This link has expired." });
    }

    const job = await getJob(jobId, 0);
    if (!job) return res.status(404).json({ error: "Job not found." });

    const rawFields = (req.body?.fields && typeof req.body.fields === "object") ? req.body.fields : {};
    const fields: Record<string, string> = {};
    for (const field of spec.fields) {
      const value = typeof rawFields[field.name] === "string" ? rawFields[field.name].trim() : "";
      if (field.required && !value) {
        return res.status(400).json({ error: `${field.label} is required.` });
      }
      fields[field.name] = value;
    }

    const photosRaw: unknown[] = Array.isArray(req.body?.photos) ? req.body.photos : [];
    if (photosRaw.length < spec.photoMin || photosRaw.length > spec.photoMax) {
      return res.status(400).json({ error: `Attach between ${spec.photoMin} and ${spec.photoMax} photo(s).` });
    }
    // A phone camera almost always produces image/jpeg, not image/png — the upload
    // must accept whatever real image type the browser's FileReader gives it, not just
    // the one PNG format the canvas-based signature happens to always produce.
    const photoFiles: { buffer: Buffer; contentType: string; extension: string }[] = [];
    for (const raw of photosRaw) {
      const match = typeof raw === "string" ? raw.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/) : null;
      if (!match) return res.status(400).json({ error: "One of the photos was not a valid image." });
      const subtype = match[1].toLowerCase();
      photoFiles.push({
        buffer: Buffer.from(match[2], "base64"),
        contentType: `image/${subtype}`,
        extension: subtype === "jpeg" ? "jpg" : subtype
      });
    }

    let signatureBuffer: Buffer | null = null;
    if (spec.hasSignature) {
      const raw = typeof req.body?.signature === "string" ? req.body.signature : "";
      const match = raw.match(/^data:image\/png;base64,(.+)$/);
      if (!match) return res.status(400).json({ error: "A signature is required." });
      signatureBuffer = Buffer.from(match[1], "base64");
    }

    const driver = job.driverInitials || "driver device";

    const photoUrls: string[] = [];
    for (let i = 0; i < photoFiles.length; i++) {
      const { buffer, contentType, extension } = photoFiles[i];
      const file = await uploadEvidenceImage(job, spec.folderKey, `photo-${i + 1}`, `photo.${extension}`, buffer, contentType);
      photoUrls.push(file.fileUrl);
    }
    let signatureUrl = "";
    if (signatureBuffer) {
      const file = await uploadEvidenceImage(job, spec.folderKey, "sig", "signature.png", signatureBuffer, "image/png");
      signatureUrl = file.fileUrl;
    }

    await commitWrites([
      writeScenarioRow(spec, jobId, driver, fields, photoUrls, signatureUrl)!,
      driverFlowWrite({ jobId, driver, field: spec.title, value: "Submitted", state: job.currentState }),
      activityWrite({
        jobId, driver, action: `${spec.title.toUpperCase().replace(/\s+/g, "_")}_SUBMITTED`,
        fromState: job.currentState, toState: job.currentState, detail: `${photoUrls.length} photo(s)`
      })
    ]);

    log.info("scenario form submitted", { job_id: jobId, scenario });
    return res.status(200).json({ ok: true });
  });

  return router;
}
