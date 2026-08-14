#!/usr/bin/env bash
# One-time IAM and secret setup.
set -euo pipefail
PROJECT="${GCP_PROJECT:?}"
RUNTIME_SA="${RUNTIME_SA:?}"
SA_NAME="${RUNTIME_SA%%@*}"

gcloud iam service-accounts create "$SA_NAME" --project "$PROJECT" \
  --display-name "TMV Bot runtime" 2>/dev/null || echo "service account exists"

for ROLE in roles/cloudtasks.enqueuer roles/logging.logWriter roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member "serviceAccount:${RUNTIME_SA}" --role "$ROLE" --condition=None >/dev/null
  echo "granted $ROLE"
done

for SECRET in tmv-sync-secret tmv-worker-secret; do
  if ! gcloud secrets describe "$SECRET" --project "$PROJECT" >/dev/null 2>&1; then
    openssl rand -hex 32 | gcloud secrets create "$SECRET" --project "$PROJECT" --data-file=-
    echo "created secret $SECRET"
  else
    echo "secret $SECRET exists"
  fi
done

cat <<EOF

Remaining manual steps (they cannot be scripted):

1. Share the Google Sheet with ${RUNTIME_SA} as Editor.
2. Share the Drive evidence folder with ${RUNTIME_SA} as Content manager.
   The folder MUST live in a Shared Drive. Service accounts have no My Drive
   storage quota, so uploads into a personal folder fail with storageQuotaExceeded.
3. Share the booking Calendar with ${RUNTIME_SA} (See all event details).
4. For customer emails, enable domain-wide delegation for the service account and
   authorise scope https://www.googleapis.com/auth/gmail.send, then set
   GOOGLE_WORKSPACE_IMPERSONATED_USER. Without this, start emails are skipped.
5. In the Google Chat API console, set the app endpoint to <SERVICE_URL>/chat.
EOF
