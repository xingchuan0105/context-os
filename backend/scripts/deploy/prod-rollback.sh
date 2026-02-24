#!/usr/bin/env bash
set -euo pipefail

RECORD_FILE="${RECORD_FILE:-/var/lib/context-os/deploy/latest.env}"
ROLLBACK_REF="${ROLLBACK_REF:-}"
RESTORE_ENV="${RESTORE_ENV:-1}"
RESTORE_SQLITE="${RESTORE_SQLITE:-1}"
RESTORE_QDRANT="${RESTORE_QDRANT:-1}"
RESTORE_LITELLM_DB="${RESTORE_LITELLM_DB:-1}"
SKIP_NPM_CI="${SKIP_NPM_CI:-0}"

log() {
  echo "[$(date +'%F %T')] $*" >&2
}

fail() {
  log "ERROR: $*"
  exit 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Missing command: $1"
  fi
}

resolve_backend_dir() {
  if [ -n "$BACKEND_DIR" ]; then
    return
  fi

  if [ -f "$APP_DIR/package.json" ] && [ -f "$APP_DIR/next.config.ts" ]; then
    BACKEND_DIR="$APP_DIR"
    return
  fi

  if [ -f "$APP_DIR/backend/package.json" ] && [ -f "$APP_DIR/backend/next.config.ts" ]; then
    BACKEND_DIR="$APP_DIR/backend"
    return
  fi

  fail "Cannot detect backend directory under APP_DIR=$APP_DIR"
}

get_env_value() {
  local file="$1"
  local key="$2"
  awk -F= -v k="$key" '$1==k{print substr($0,length(k)+2); exit}' "$file" 2>/dev/null || true
}

resolve_db_path() {
  local db_url="$1"

  if [ -z "$db_url" ] || [[ "$db_url" == *"://"* ]]; then
    echo ""
    return
  fi

  if [[ "$db_url" = /* ]]; then
    echo "$db_url"
    return
  fi

  echo "$BACKEND_DIR/$db_url"
}

wait_http_code() {
  local url="$1"
  local accepted_regex="$2"
  local max_attempts="${3:-60}"
  local sleep_seconds="${4:-2}"
  local code=""

  for ((attempt=1; attempt<=max_attempts; attempt++)); do
    code="$(curl -sS -o /dev/null -w '%{http_code}' "$url" || true)"
    if [[ "$code" =~ $accepted_regex ]]; then
      return 0
    fi
    sleep "$sleep_seconds"
  done

  fail "Health gate failed for $url (last status=$code)"
}

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  fail "Run as root (needs systemctl + restore permissions)."
fi

[ -f "$RECORD_FILE" ] || fail "Record file not found: $RECORD_FILE"
# shellcheck disable=SC1090
source "$RECORD_FILE"

APP_DIR="${APP_DIR:-/var/www/context-os}"
BACKEND_DIR="${BACKEND_DIR:-}"
ENV_FILE="${ENV_FILE:-/etc/context-os/context-os.env}"
LITELLM_DIR="${LITELLM_DIR:-/opt/context-os/litellm}"
LITELLM_ENV_FILE="${LITELLM_ENV_FILE:-$LITELLM_DIR/.env}"
BACKUP_DIR="${BACKUP_DIR:-}"
PREVIOUS_REF="${PREVIOUS_REF:-}"
DATABASE_BACKUP_PATH="${DATABASE_BACKUP_PATH:-}"
QDRANT_SNAPSHOT_MANIFEST="${QDRANT_SNAPSHOT_MANIFEST:-}"
LITELLM_DB_DUMP_PATH="${LITELLM_DB_DUMP_PATH:-}"

rollback_ref="${ROLLBACK_REF:-$PREVIOUS_REF}"
[ -n "$rollback_ref" ] || fail "No rollback target: set ROLLBACK_REF or ensure PREVIOUS_REF in record."
[ -d "$APP_DIR" ] || fail "APP_DIR not found: $APP_DIR"
git -C "$APP_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "APP_DIR is not a git working tree: $APP_DIR"
resolve_backend_dir

require_cmd git
require_cmd npm
require_cmd curl
require_cmd docker
require_cmd python3
require_cmd systemctl

log "Detected backend directory: $BACKEND_DIR"

log "Rollback: stop API + worker"
systemctl stop context-os-worker context-os-api || true

if [ "$RESTORE_ENV" = "1" ] && [ -n "$BACKUP_DIR" ]; then
  if [ -f "$BACKUP_DIR/context-os.env.bak" ]; then
    log "Rollback: restore app env"
    cp -a "$BACKUP_DIR/context-os.env.bak" "$ENV_FILE"
  fi
  if [ -f "$BACKUP_DIR/litellm.env.bak" ]; then
    log "Rollback: restore LiteLLM env"
    cp -a "$BACKUP_DIR/litellm.env.bak" "$LITELLM_ENV_FILE"
  fi
fi

log "Rollback: checkout ref $rollback_ref"
git -C "$APP_DIR" fetch --all --tags
if git -C "$APP_DIR" rev-parse --verify "$rollback_ref^{commit}" >/dev/null 2>&1; then
  git -C "$APP_DIR" checkout "$rollback_ref"
elif git -C "$APP_DIR" show-ref --verify --quiet "refs/remotes/origin/$rollback_ref"; then
  git -C "$APP_DIR" checkout -B "$rollback_ref" "origin/$rollback_ref"
else
  fail "Cannot resolve rollback ref: $rollback_ref"
fi

log "Rollback: install + build"
cd "$BACKEND_DIR"
if [ "$SKIP_NPM_CI" != "1" ]; then
  npm ci
fi
npm run build

if [ "$RESTORE_SQLITE" = "1" ] && [ -n "$DATABASE_BACKUP_PATH" ] && [ -f "$DATABASE_BACKUP_PATH" ]; then
  db_url="$(get_env_value "$ENV_FILE" DATABASE_URL)"
  db_file="$(resolve_db_path "$db_url")"
  if [ -n "$db_file" ]; then
    mkdir -p "$(dirname "$db_file")"
    log "Rollback: restore sqlite database to $db_file"
    cp -a "$DATABASE_BACKUP_PATH" "$db_file"
  fi
fi

if [ "$RESTORE_LITELLM_DB" = "1" ] && [ -n "$LITELLM_DB_DUMP_PATH" ] && [ -f "$LITELLM_DB_DUMP_PATH" ]; then
  if (cd "$LITELLM_DIR" && docker compose config --services | grep -qx "litellm-db"); then
    log "Rollback: restore LiteLLM Postgres"
    (
      cd "$LITELLM_DIR"
      docker compose up -d litellm-db >/dev/null
      docker compose exec -T litellm-db sh -lc 'psql -U "${POSTGRES_USER:-litellm}" -d "${POSTGRES_DB:-litellm}" -v ON_ERROR_STOP=1'
    ) < "$LITELLM_DB_DUMP_PATH"
  fi
fi

if [ "$RESTORE_QDRANT" = "1" ] && [ -n "$QDRANT_SNAPSHOT_MANIFEST" ] && [ -f "$QDRANT_SNAPSHOT_MANIFEST" ]; then
  qdrant_url="$(get_env_value "$ENV_FILE" QDRANT_URL)"
  [ -n "$qdrant_url" ] || fail "QDRANT_URL is empty in $ENV_FILE"
  log "Rollback: recover qdrant snapshots"
  tail -n +2 "$QDRANT_SNAPSHOT_MANIFEST" | while IFS=$'\t' read -r collection_name snapshot_name; do
    [ -n "$collection_name" ] || continue
    [ -n "$snapshot_name" ] || continue
    curl -fsS -X POST "$qdrant_url/collections/$collection_name/snapshots/$snapshot_name/recover" >/dev/null
  done
fi

log "Rollback: restart LiteLLM"
(
  cd "$LITELLM_DIR"
  docker compose up -d litellm-db litellm
)

log "Rollback: restart API + worker"
systemctl restart context-os-api context-os-worker

litellm_port="$(get_env_value "$LITELLM_ENV_FILE" LITELLM_PORT)"
litellm_port="${litellm_port:-4410}"

log "Health gates"
wait_http_code "http://127.0.0.1:3000/api/health" '^200$' 90 2
wait_http_code "http://127.0.0.1:${litellm_port}/health/readiness" '^200$' 90 2
wait_http_code "http://127.0.0.1:3000/api/admin/auth/me" '^(200|401)$' 60 2

rollback_state_dir="/var/lib/context-os/deploy/rollbacks"
mkdir -p "$rollback_state_dir"
rollback_record="$rollback_state_dir/$(date +%Y%m%d%H%M%S).env"
{
  echo "ROLLED_BACK_AT=$(date +%Y%m%d%H%M%S)"
  echo "SOURCE_RECORD=$RECORD_FILE"
  echo "ROLLBACK_REF=$rollback_ref"
  echo "CURRENT_REF=$(git -C "$APP_DIR" rev-parse HEAD)"
  echo "APP_DIR=$APP_DIR"
  echo "BACKEND_DIR=$BACKEND_DIR"
} > "$rollback_record"

log "SUCCESS: rollback completed to $rollback_ref"
log "Rollback record: $rollback_record"
