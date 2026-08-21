import { Request, Response, Router } from "express";
import { getJob } from "../google/sheets";
import { uploadEvidenceImage } from "../google/drive";
import { CUSTOMER_CONFIRMATION_TEXT, SignatureAlreadyCapturedError, submitDrawnSignature } from "../workflow/workflow.engine";
import { WorkflowState } from "../workflow/workflow.states";
import { verifySignatureLink } from "./signature.link";
import { log } from "../utils/logger";

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

function signPad(job: { jobId: string; customerName: string }, exp: string, sig: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Sign for your move</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 16px; background: #f5f6f8; color: #1a1a1a; }
  .card { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  h1 { font-size: 18px; margin: 0 0 8px; }
  p.legal { font-size: 13px; color: #555; line-height: 1.45; }
  label { display: block; font-size: 14px; font-weight: 600; margin: 18px 0 6px; }
  input[type=text] { width: 100%; padding: 12px; font-size: 16px; border: 1px solid #ccc; border-radius: 8px; }
  canvas { width: 100%; height: 200px; touch-action: none; border: 2px dashed #aaa; border-radius: 8px; background: #fff; display: block; margin-top: 8px; }
  .actions { display: flex; gap: 10px; margin-top: 18px; }
  button { flex: 1; padding: 14px; font-size: 16px; font-weight: 600; border: none; border-radius: 8px; }
  #submit { background: #1a73e8; color: #fff; }
  #submit:disabled { background: #a7c3ef; }
  #clear { background: #eee; color: #333; }
  #status { margin-top: 12px; font-size: 14px; min-height: 18px; }
  #done { display: none; text-align: center; padding: 30px 4px; }
</style></head>
<body>
  <div class="card">
    <div id="form">
      <h1>Confirm and sign</h1>
      <p class="legal">${escapeHtml(CUSTOMER_CONFIRMATION_TEXT)}</p>
      <label for="name">Your full name</label>
      <input type="text" id="name" placeholder="Full name" value="${escapeHtml(job.customerName || "")}" autocomplete="name">
      <label>Sign below with your finger or the cursor</label>
      <canvas id="pad"></canvas>
      <div class="actions">
        <button id="clear" type="button">Clear</button>
        <button id="submit" type="button" disabled>Submit</button>
      </div>
      <div id="status"></div>
    </div>
    <div id="done">
      <h1>Thanks — signed</h1>
      <p>Please hand the device back to your driver. This window will close automatically — if it doesn't, you can close it now.</p>
    </div>
  </div>
  <script>
  (function () {
    var canvas = document.getElementById('pad');
    var ctx = canvas.getContext('2d');
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

    var nameInput = document.getElementById('name');
    var submitBtn = document.getElementById('submit');
    var drawing = false, hasDrawn = false, lastX = 0, lastY = 0;

    function refreshSubmit() {
      submitBtn.disabled = !(hasDrawn && nameInput.value.trim());
    }
    function pos(e) {
      var rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    canvas.addEventListener('pointerdown', function (e) {
      drawing = true;
      var p = pos(e);
      lastX = p.x; lastY = p.y;
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      var p = pos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastX = p.x; lastY = p.y;
      hasDrawn = true;
      refreshSubmit();
      e.preventDefault();
    });
    window.addEventListener('pointerup', function () { drawing = false; });
    nameInput.addEventListener('input', refreshSubmit);

    document.getElementById('clear').addEventListener('click', function () {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawn = false;
      refreshSubmit();
    });

    submitBtn.addEventListener('click', function () {
      submitBtn.disabled = true;
      document.getElementById('status').textContent = 'Submitting…';
      fetch(location.pathname + location.search, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.value.trim(), image: canvas.toDataURL('image/png') })
      }).then(function (res) {
        if (!res.ok) return res.json().then(function (b) { throw new Error(b.error || 'Something went wrong.'); });
        document.getElementById('form').style.display = 'none';
        document.getElementById('done').style.display = 'block';
        // Best-effort: browsers only allow script-closing a window they didn't open
        // themselves in some contexts (e.g. Chat's overlay), so this silently no-ops
        // where it isn't permitted — the on-screen message above is the real fallback.
        setTimeout(function () { window.close(); }, 1200);
      }).catch(function (err) {
        document.getElementById('status').textContent = err.message;
        submitBtn.disabled = false;
      });
    });
  })();
  </script>
</body></html>`;
}

async function loadAuthorized(req: Request, res: Response): Promise<{ job: NonNullable<Awaited<ReturnType<typeof getJob>>> } | null> {
  const jobId = String(req.params.jobId);
  if (!verifySignatureLink(jobId, req.query.exp, req.query.sig)) {
    res.status(410).send(page("Link expired", "<h1>This link has expired</h1><p>Ask your driver to reopen the signature step and share a fresh link.</p>"));
    return null;
  }
  const job = await getJob(jobId, 0);
  if (!job) {
    res.status(404).send(page("Not found", "<h1>Job not found</h1>"));
    return null;
  }
  return { job };
}

export function signatureRouter(): Router {
  const router = Router();

  router.get("/:jobId", async (req, res) => {
    const authorized = await loadAuthorized(req, res);
    if (!authorized) return;
    const { job } = authorized;

    if (job.currentState !== WorkflowState.WAITING_CLIENT_CONFIRMATION) {
      return res.status(200).send(
        page("Already signed", "<h1>Already signed</h1><p>This job's signature has already been recorded. You can close this page.</p>")
      );
    }
    return res.status(200).send(signPad(job, String(req.query.exp), String(req.query.sig)));
  });

  router.post("/:jobId", async (req, res) => {
    const jobId = String(req.params.jobId);
    if (!verifySignatureLink(jobId, req.query.exp, req.query.sig)) {
      return res.status(410).json({ error: "This link has expired." });
    }

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const image = typeof req.body?.image === "string" ? req.body.image : "";
    const match = image.match(/^data:image\/png;base64,(.+)$/);
    if (!name || !match) {
      return res.status(400).json({ error: "A name and a signature are required." });
    }

    const job = await getJob(jobId, 0);
    if (!job) return res.status(404).json({ error: "Job not found." });
    if (job.currentState !== WorkflowState.WAITING_CLIENT_CONFIRMATION) {
      // Idempotent: a double-submit or a reopened link after the driver moved on.
      return res.status(200).json({ ok: true, alreadySigned: true });
    }

    const buffer = Buffer.from(match[1], "base64");
    const file = await uploadEvidenceImage(job, "Signature", "sig", "signature.png", buffer, "image/png");

    try {
      await submitDrawnSignature(jobId, name, { fileId: file.fileId, fileUrl: file.fileUrl });
    } catch (error) {
      if (error instanceof SignatureAlreadyCapturedError) {
        return res.status(200).json({ ok: true, alreadySigned: true });
      }
      throw error;
    }

    log.info("customer signature captured", { job_id: jobId });
    return res.status(200).json({ ok: true });
  });

  return router;
}
