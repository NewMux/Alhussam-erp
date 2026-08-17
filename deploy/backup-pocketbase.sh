#!/usr/bin/env bash
# Nightly backup for one client's PocketBase instance: asks PocketBase for a
# consistent snapshot via its own backup API, downloads it, pushes it off the
# VPS with rclone, then prunes old copies (local, PocketBase-side, remote).
#
# Usage: backup-pocketbase.sh <client-name>
# Install as a systemd timer — see pocketbase-backup@.timer in this directory.
set -euo pipefail

CLIENT="${1:?Usage: backup-pocketbase.sh <client-name>}"
ENV_FILE="/etc/pocketbase/${CLIENT}.env"
STAGING_DIR="/srv/backups/${CLIENT}"

[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
source "$ENV_FILE"

: "${PORT:?PORT not set in $ENV_FILE}"
: "${BACKUP_PB_SUPERUSER_EMAIL:?BACKUP_PB_SUPERUSER_EMAIL not set in $ENV_FILE}"
: "${BACKUP_PB_SUPERUSER_PASSWORD:?BACKUP_PB_SUPERUSER_PASSWORD not set in $ENV_FILE}"
: "${BACKUP_RCLONE_REMOTE:?BACKUP_RCLONE_REMOTE not set in $ENV_FILE}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

BASE_URL="http://127.0.0.1:${PORT}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_NAME="${CLIENT}-${STAMP}.zip"

mkdir -p "$STAGING_DIR"

json_field() { grep -oP "\"$2\":\"\K[^\"]+" <<<"$1"; }

echo "[$CLIENT] Authenticating..."
AUTH_RESPONSE="$(curl -sf -X POST "$BASE_URL/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$BACKUP_PB_SUPERUSER_EMAIL\",\"password\":\"$BACKUP_PB_SUPERUSER_PASSWORD\"}")"
TOKEN="$(json_field "$AUTH_RESPONSE" token)"
[ -n "$TOKEN" ] || { echo "[$CLIENT] Auth failed: $AUTH_RESPONSE" >&2; exit 1; }

echo "[$CLIENT] Requesting backup $BACKUP_NAME..."
curl -sf -X POST "$BASE_URL/api/backups" \
  -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"$BACKUP_NAME\"}" >/dev/null

echo "[$CLIENT] Waiting for backup to finish..."
for _ in $(seq 1 60); do
  if curl -sf "$BASE_URL/api/backups" -H "Authorization: $TOKEN" | grep -q "\"key\":\"$BACKUP_NAME\""; then
    break
  fi
  sleep 2
done

FILE_TOKEN_RESPONSE="$(curl -sf -X POST "$BASE_URL/api/files/token" -H "Authorization: $TOKEN")"
FILE_TOKEN="$(json_field "$FILE_TOKEN_RESPONSE" token)"
[ -n "$FILE_TOKEN" ] || { echo "[$CLIENT] Could not mint a file token: $FILE_TOKEN_RESPONSE" >&2; exit 1; }

LOCAL_PATH="${STAGING_DIR}/${BACKUP_NAME}"
echo "[$CLIENT] Downloading to $LOCAL_PATH..."
curl -sf -o "$LOCAL_PATH" "$BASE_URL/api/backups/${BACKUP_NAME}?token=${FILE_TOKEN}"

echo "[$CLIENT] Pushing to $BACKUP_RCLONE_REMOTE..."
rclone copy "$LOCAL_PATH" "$BACKUP_RCLONE_REMOTE"

echo "[$CLIENT] Deleting the copy PocketBase kept in pb_data/backups..."
curl -sf -X DELETE "$BASE_URL/api/backups/${BACKUP_NAME}" -H "Authorization: $TOKEN" >/dev/null

echo "[$CLIENT] Pruning local + remote copies older than ${RETENTION_DAYS} days..."
find "$STAGING_DIR" -name '*.zip' -mtime "+${RETENTION_DAYS}" -delete
rclone delete --min-age "${RETENTION_DAYS}d" "$BACKUP_RCLONE_REMOTE"

echo "[$CLIENT] Backup complete: $BACKUP_NAME"
