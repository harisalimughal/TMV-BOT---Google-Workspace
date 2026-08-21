import { Request, Response, Router } from "express";
import { getJob } from "../google/sheets";
import { updateChatCard } from "../google/chat";
import { finalizeScenario } from "./scenario.engine";
import { verifyScenarioLink } from "./scenario.link";
import { ScenarioKey, SCENARIOS } from "./scenario.spec";
import { scenarioSubmittedCard } from "./cards";
import { ValidationError } from "../workflow/validation.engine";
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

/**
 * Sign-only page: fields and photos are collected step by step in Chat itself now
 * (see chat/scenario.engine.ts) — the signature is the one thing that still has to
 * open externally, since Chat cards have no drawing/canvas widget.
 */
function signOnlyPage(title: string, legalText: string | undefined): string {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 16px; background: #f5f6f8; color: #1a1a1a; }
  .card { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  h1 { font-size: 18px; margin: 0 0 8px; }
  p.legal { font-size: 13px; color: #555; line-height: 1.45; }
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
      <h1>${escapeHtml(title)}</h1>
      ${legalText ? `<p class="legal">${escapeHtml(legalText)}</p>` : ""}
      <label style="display:block;font-size:14px;font-weight:600;margin:18px 0 6px;">Sign below with your finger or the cursor</label>
      <canvas id="pad"></canvas>
      <div class="actions">
        <button id="clear" type="button">Clear</button>
        <button id="submit" type="button" disabled>Submit</button>
      </div>
      <div id="status"></div>
    </div>
    <div id="done">
      <h1>Thanks — submitted</h1>
      <p>Please hand the device back / return to the app. This window will close automatically — if it doesn't, you can close it now.</p>
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

    var submitBtn = document.getElementById('submit');
    var statusEl = document.getElementById('status');
    var drawing = false, hasDrawn = false, lastX = 0, lastY = 0;

    function refreshSubmit() { submitBtn.disabled = !hasDrawn; }
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

    document.getElementById('clear').addEventListener('click', function () {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawn = false;
      refreshSubmit();
    });

    submitBtn.addEventListener('click', function () {
      submitBtn.disabled = true;
      statusEl.textContent = 'Submitting…';
      fetch(location.pathname + location.search, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: canvas.toDataURL('image/png') })
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
): Promise<{ job: NonNullable<Awaited<ReturnType<typeof getJob>>> } | null> {
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
  return { job };
}

export function scenarioRouter(): Router {
  const router = Router();

  router.get("/:scenario/:jobId", async (req, res) => {
    const scenario = req.params.scenario as ScenarioKey;
    const authorized = await loadAuthorized(scenario, req, res);
    if (!authorized) return;
    const spec = SCENARIOS[scenario];
    return res.status(200).send(signOnlyPage(spec.title, spec.signatureText));
  });

  router.post("/:scenario/:jobId", async (req, res) => {
    const scenario = req.params.scenario as ScenarioKey;
    const spec = SCENARIOS[scenario];
    if (!spec) return res.status(404).json({ error: "Unknown form." });

    const jobId = String(req.params.jobId);
    if (!verifyScenarioLink(scenario, jobId, req.query.exp, req.query.sig)) {
      return res.status(410).json({ error: "This link has expired." });
    }

    const raw = typeof req.body?.signature === "string" ? req.body.signature : "";
    const match = raw.match(/^data:image\/png;base64,(.+)$/);
    if (!match) return res.status(400).json({ error: "A signature is required." });
    const signatureBuffer = Buffer.from(match[1], "base64");

    try {
      const { messageName } = await finalizeScenario(scenario, jobId, signatureBuffer);

      // Best-effort: push the "submitted" card into the driver's Chat conversation so
      // they don't have to tap anything — same pattern as the classic flow's signature
      // step. If this fails, the data is already safely recorded either way; the
      // driver just needs to tap Main Menu manually.
      if (messageName) {
        await updateChatCard(messageName, scenarioSubmittedCard(spec, jobId)).catch(error =>
          log.warn("failed to push scenario-submitted card", { job_id: jobId, scenario, error: String(error) })
        );
      }

      log.info("scenario finalized", { job_id: jobId, scenario });
      return res.status(200).json({ ok: true });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  });

  return router;
}
