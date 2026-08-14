import express, { NextFunction, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { randomUUID } from "node:crypto";
import { normalizeWorkspaceEvent, wrapCreateMessage, wrapUpdateMessage } from "./chat/workspace-adapter";
import { env, warmupAuth } from "./config/env";
import { handleChatEvent } from "./chat/chat.controller";
import { ensureDatabaseStructure } from "./google/sheets";
import { markSynced } from "./jobs/jobs.service";
import { syncTodayBookings } from "./jobs/booking.service";
import { log, runWithContext, setContext } from "./utils/logger";
import { PhaseTimer } from "./utils/timing";
import { WORKER_MOUNT_PATH, workerRouter } from "./queue/worker.routes";
import { dispatchTask } from "./queue/dispatch";
import { drainInlineQueue, registerInlineDispatcher } from "./queue/queue.service";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

const verifier = new OAuth2Client();
const CHAT_ISSUER = "chat@system.gserviceaccount.com";

/** Flipped once the Sheets structure has been verified. */
let bootstrapComplete = !env.bootstrapOnStart;
let bootstrapError: string | null = null;

async function verifyGoogleChatRequest(req: Request, res: Response, next: NextFunction) {
  if (!env.verifyChatRequests) return next();
  if (!env.chatAudience) {
    return res.status(500).json({ error: "GOOGLE_CHAT_AUDIENCE is required when verification is enabled." });
  }

  const authHeader = req.header("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: "Missing Google Chat bearer token." });

  try {
    const ticket = await verifier.verifyIdToken({ idToken: match[1], audience: env.chatAudience });
    const payload = ticket.getPayload();
    if (!payload?.email_verified || payload.email !== CHAT_ISSUER) {
      return res.status(401).json({ error: "Invalid Google Chat issuer." });
    }
    return next();
  } catch (error) {
    log.error("Google Chat request verification failed", error);
    return res.status(401).json({ error: "Invalid Google Chat request token." });
  }
}

// Liveness: the process is up. Available immediately, before bootstrap finishes.
app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

// Readiness: dependencies verified. Cloud Run can hold traffic until this is true.
app.get("/readyz", (_req, res) =>
  res.status(bootstrapComplete ? 200 : 503).json({
    ok: bootstrapComplete,
    spreadsheetId: Boolean(env.spreadsheetId),
    error: bootstrapError ?? undefined
  })
);

// Background worker endpoints, behind their own OIDC/shared-secret auth.
app.use(WORKER_MOUNT_PATH, workerRouter());

app.post("/chat", verifyGoogleChatRequest, async (req, res) => {
  const requestId = req.header("x-cloud-trace-context")?.split("/")[0] || randomUUID();

  await runWithContext({ requestId }, async () => {
    const timer = new PhaseTimer();
    const started = Date.now();
    try {
      const normalizedEvent = normalizeWorkspaceEvent(req.body);
      timer.mark("normalize");
      setContext({ userEmail: normalizedEvent.user?.email });
      log.info("chat event received", {
        event_type: normalizedEvent.type,
        action: normalizedEvent.action?.function || undefined
      });

      const { message, update } = await handleChatEvent(normalizedEvent);
      timer.mark("handle");

      // Latency breakdown for every driver interaction. The target is total_ms < 1000.
      log.info("chat event handled", {
        event_type: normalizedEvent.type,
        update,
        duration_ms: Date.now() - started,
        slow: Date.now() - started > 1000,
        status: "ok",
        ...timer.fields()
      });

      return res.status(200).json(update ? wrapUpdateMessage(message) : wrapCreateMessage(message));
    } catch (error) {
      log.error("chat handler error", error, { duration_ms: Date.now() - started, status: "error" });
      // Always 200: a non-200 makes Google Chat show a generic failure with no detail.
      return res.status(200).json(
        wrapCreateMessage({
          text: "TMV could not complete that action. Please type *jobs* to reload your current step, or try again."
        })
      );
    }
  });
});

app.post("/internal/sync", async (req, res) => {
  if (!env.syncSecret || req.header("x-tmv-sync-secret") !== env.syncSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  await runWithContext({ requestId: randomUUID() }, async () => {
    try {
      const jobs = await syncTodayBookings();
      markSynced();
      return res.json({ ok: true, synced: jobs.length, jobs: jobs.map(j => j.jobId) });
    } catch (error) {
      log.error("calendar sync failed", error);
      return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  log.error("unhandled express error", error);
  res.status(500).json({ error: "Internal server error" });
});

/** Fails fast on configuration that would otherwise break silently at runtime. */
function assertRuntimeConfig(): void {
  if (env.nodeEnv === "production") {
    if (!env.verifyChatRequests) {
      throw new Error(
        "VERIFY_CHAT_REQUESTS must be true in production. Without it the /chat endpoint trusts " +
          "an unauthenticated user.email and any caller can drive a job to COMPLETED."
      );
    }
    if (!env.chatAudience) {
      throw new Error("GOOGLE_CHAT_AUDIENCE is required in production so Chat request tokens can be verified.");
    }
    if (env.serviceAccountPrivateKey) {
      log.warn(
        "A service-account private key is set in the environment. On Cloud Run, attach the service " +
          "account to the service and let GoogleAuth use the metadata server instead (§38)."
      );
    }
    if (!env.syncSecret || env.syncSecret === "change-me") {
      throw new Error("SYNC_SECRET must be set to a non-default value in production.");
    }
  }

  if (env.queueDriver === "cloud-tasks") {
    const missing = [
      !env.gcpProject && "GOOGLE_CLOUD_PROJECT",
      !env.workerBaseUrl && "TMV_WORKER_BASE_URL",
      !env.tasksServiceAccountEmail && !env.workerSharedSecret &&
        "TMV_TASKS_SERVICE_ACCOUNT_EMAIL (or TMV_WORKER_SHARED_SECRET)"
    ].filter(Boolean);
    if (missing.length) {
      throw new Error(`TMV_QUEUE_DRIVER=cloud-tasks requires: ${missing.join(", ")}`);
    }
  }
  if (env.nodeEnv === "production" && env.queueDriver === "inline") {
    // The inline driver loses work when the instance is recycled, which on Cloud Run is
    // routine. Refusing to start is better than silently dropping evidence.
    throw new Error(
      "TMV_QUEUE_DRIVER=inline is not safe in production. Set TMV_QUEUE_DRIVER=cloud-tasks."
    );
  }
  if (!env.chatActionUrl) {
    throw new Error(
      "TMV_CHAT_ACTION_URL is required. Set it to the public HTTPS endpoint Google Chat calls " +
        "for card actions, e.g. https://your-service.run.app/chat"
    );
  }
  if (!/^https:\/\//i.test(env.chatActionUrl)) {
    throw new Error(`TMV_CHAT_ACTION_URL must be an https URL. Received: ${env.chatActionUrl}`);
  }
}

async function main() {
  assertRuntimeConfig();

  // Local development only: run queued tasks in-process after the response.
  if (env.queueDriver === "inline") {
    registerInlineDispatcher(async task => {
      await dispatchTask(task);
    });
    log.warn("using the inline queue driver; background work is NOT durable", { node_env: env.nodeEnv });
  }

  // Listen first. Bootstrap used to run ~15 sequential Sheets calls before
  // app.listen(), so Cloud Run saw no open port during startup.
  const server = app.listen(env.port, () =>
    log.info("TMV bot listening", { port: env.port, node_env: env.nodeEnv, queue_driver: env.queueDriver })
  );

  // Cloud Run sends SIGTERM then kills the container. Stop accepting traffic, let
  // in-flight work settle, and let the reaper recover anything that did not.
  process.on("SIGTERM", () => {
    log.info("SIGTERM received; draining");
    bootstrapComplete = false;
    server.close();
    Promise.race([drainInlineQueue(), new Promise(resolve => setTimeout(resolve, 8000))]).finally(() =>
      process.exit(0)
    );
  });
  process.on("unhandledRejection", reason => log.error("unhandledRejection", reason));

  await warmupAuth();

  if (env.bootstrapOnStart) {
    try {
      await ensureDatabaseStructure();
      bootstrapComplete = true;
      log.info("sheets structure verified");
    } catch (error) {
      bootstrapError = error instanceof Error ? error.message : String(error);
      log.error("sheets bootstrap failed", error);
    }
  }
}

main().catch(error => {
  log.error("TMV bot failed to start", error);
  process.exit(1);
});
