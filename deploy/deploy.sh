#!/usr/bin/env bash
#
# Deploys TMV Bot to Cloud Run with the settings the code's correctness depends on.
#
# The concurrency flags are NOT tuning. The write mutex, the per-job lock, the Sheets
# read caches, the Drive folder cache and the Calendar sync throttle are all in-process.
# At concurrency > 1 or instances > 1, two requests can interleave a read-then-write and
# corrupt job state. Raising these limits requires moving job state to a transactional
# store first.
set -euo pipefail

PROJECT="${GCP_PROJECT:?set GCP_PROJECT}"
REGION="${GCP_REGION:-europe-west2}"
SERVICE="${SERVICE_NAME:-tmv-bot}"
RUNTIME_SA="${RUNTIME_SA:?set RUNTIME_SA, e.g. tmv-bot@$PROJECT.iam.gserviceaccount.com}"
QUEUE="${TASKS_QUEUE:-tmv-background}"

echo "==> Enabling APIs"
gcloud services enable \
  run.googleapis.com cloudbuild.googleapis.com cloudtasks.googleapis.com \
  cloudscheduler.googleapis.com sheets.googleapis.com drive.googleapis.com \
  calendar-json.googleapis.com gmail.googleapis.com chat.googleapis.com \
  --project "$PROJECT"

echo "==> Ensuring Cloud Tasks queue"
gcloud tasks queues create "$QUEUE" --location="$REGION" --project="$PROJECT" 2>/dev/null || \
  echo "    queue already exists"
# max-concurrent-dispatches 1 keeps background Sheets writes serialised too.
gcloud tasks queues update "$QUEUE" --location="$REGION" --project="$PROJECT" \
  --max-attempts=5 --min-backoff=5s --max-backoff=300s --max-concurrent-dispatches=1

echo "==> Deploying"
SERVICE_URL="https://${SERVICE}-$(gcloud projects describe "$PROJECT" --format='value(projectNumber)').${REGION}.run.app"

gcloud run deploy "$SERVICE" \
  --source . \
  --project "$PROJECT" \
  --region "$REGION" \
  --service-account "$RUNTIME_SA" \
  --no-allow-unauthenticated \
  --concurrency 1 \
  --max-instances 1 \
  --min-instances 1 \
  --cpu 1 \
  --memory 512Mi \
  --timeout 120 \
  --cpu-boost \
  --no-cpu-throttling \
  --set-env-vars "NODE_ENV=production,GCP_PROJECT=${PROJECT},TMV_TASKS_LOCATION=${REGION},TMV_TASKS_QUEUE=${QUEUE},TMV_QUEUE_DRIVER=cloud-tasks,TMV_WORKER_BASE_URL=${SERVICE_URL},TMV_CHAT_ACTION_URL=${SERVICE_URL}/chat,GOOGLE_CHAT_AUDIENCE=${SERVICE_URL}/chat,VERIFY_CHAT_REQUESTS=true,TMV_TASKS_SERVICE_ACCOUNT=${RUNTIME_SA}" \
  --set-secrets "SYNC_SECRET=tmv-sync-secret:latest,TMV_WORKER_SHARED_SECRET=tmv-worker-secret:latest" \
  --update-env-vars "GOOGLE_SHEETS_SPREADSHEET_ID=${GOOGLE_SHEETS_SPREADSHEET_ID:?},GOOGLE_CALENDAR_ID=${GOOGLE_CALENDAR_ID:?},GOOGLE_DRIVE_ROOT_FOLDER_ID=${GOOGLE_DRIVE_ROOT_FOLDER_ID:?}"

echo "==> Granting invoker rights"
# Google Chat calls /chat as this fixed system account.
gcloud run services add-iam-policy-binding "$SERVICE" \
  --project "$PROJECT" --region "$REGION" \
  --member="serviceAccount:chat@system.gserviceaccount.com" --role="roles/run.invoker"
# Cloud Tasks calls /internal/tasks/* as the runtime service account via OIDC.
gcloud run services add-iam-policy-binding "$SERVICE" \
  --project "$PROJECT" --region "$REGION" \
  --member="serviceAccount:${RUNTIME_SA}" --role="roles/run.invoker"

echo "==> Scheduled jobs"
gcloud scheduler jobs create http tmv-calendar-sync \
  --project "$PROJECT" --location "$REGION" --schedule "*/10 6-20 * * *" \
  --time-zone "Europe/London" --uri "${SERVICE_URL}/internal/sync" --http-method POST \
  --oidc-service-account-email "$RUNTIME_SA" 2>/dev/null || echo "    sync job exists"

gcloud scheduler jobs create http tmv-evidence-sweep \
  --project "$PROJECT" --location "$REGION" --schedule "*/15 * * * *" \
  --time-zone "Europe/London" --uri "${SERVICE_URL}/internal/tasks/sweep-evidence" \
  --http-method POST --message-body '{"type":"SWEEP_STALE_EVIDENCE"}' \
  --headers "Content-Type=application/json" \
  --oidc-service-account-email "$RUNTIME_SA" 2>/dev/null || echo "    sweep job exists"

echo
echo "Deployed: ${SERVICE_URL}"
echo "Set this as the Chat app HTTP endpoint: ${SERVICE_URL}/chat"
