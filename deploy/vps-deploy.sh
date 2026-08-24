#!/usr/bin/env bash
#
# Deploys TMV Bot to a single-host VPS (e.g. Hostinger) as one long-lived Docker
# container. Run this ON THE VPS, from the directory the source was uploaded to.
#
# Prereqs already in place before running this:
#   - /opt/tmv-bot/           <- source tree (this repo, minus node_modules/dist/.git)
#   - /opt/tmv-bot/.env.production   <- filled-in production env file (see .env.example)
#   - /opt/tmv-bot/service-account.json  <- GCP service account key (Sheets/Drive/
#     Calendar/Gmail/Chat access), shared as Editor/Content manager on those resources
#
# Same in-process-lock constraint as deploy.sh (Cloud Run): this MUST run as exactly
# one container instance. Do not scale replicas or run a second copy in parallel.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/tmv-bot}"
IMAGE_NAME="${IMAGE_NAME:-tmv-bot}"
CONTAINER_NAME="${CONTAINER_NAME:-tmv-bot}"
PORT="${PORT:-8080}"

cd "$APP_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker"
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

for f in .env.production service-account.json; do
  if [ ! -f "$f" ]; then
    echo "Missing $APP_DIR/$f -- upload it before running this script." >&2
    exit 1
  fi
done

echo "==> Building image"
docker build -t "$IMAGE_NAME" .

echo "==> Replacing running container"
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "${PORT}:8080" \
  --env-file .env.production \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/service-account.json \
  -v "$APP_DIR/service-account.json:/app/service-account.json:ro" \
  "$IMAGE_NAME"

echo "==> Opening firewall port ${PORT} (if ufw is active)"
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow "${PORT}/tcp"
fi

echo "==> Installing cron: sweep stale evidence every 5 minutes"
WORKER_SECRET=$(grep '^TMV_WORKER_SHARED_SECRET=' .env.production | cut -d= -f2-)
CRON_CMD="*/5 * * * * curl -s -X POST -H 'Content-Type: application/json' -H 'x-tmv-worker-secret: ${WORKER_SECRET}' -d '{\"type\":\"SWEEP_STALE_EVIDENCE\"}' http://localhost:${PORT}/internal/tasks/sweep-evidence >/dev/null 2>&1"
( crontab -l 2>/dev/null | grep -v 'sweep-evidence' ; echo "$CRON_CMD" ) | crontab -

echo "==> Done. Tailing logs (Ctrl+C to stop watching, container keeps running):"
sleep 2
docker logs -f "$CONTAINER_NAME"
