#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/context-os}"
BACKEND_DIR="${BACKEND_DIR:-}"
ENV_FILE="${ENV_FILE:-/etc/context-os/context-os.env}"
LITELLM_DIR="${LITELLM_DIR:-/opt/context-os/litellm}"
LITELLM_ENV_FILE="${LITELLM_ENV_FILE:-$LITELLM_DIR/.env}"
RELEASE_REF="${RELEASE_REF:-}"
DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-/var/lib/context-os/deploy}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/context-os}"
SKIP_SELFCHECK="${SKIP_SELFCHECK:-0}"
SKIP_QDRANT_SNAPSHOT="${SKIP_QDRANT_SNAPSHOT:-0}"
SKIP_LITELLM_DB_DUMP="${SKIP_LITELLM_DB_DUMP:-0}"

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
  fail "Run as root (needs systemctl + backup write permissions)."
fi

[ -n "$RELEASE_REF" ] || fail "RELEASE_REF is required (branch/tag/commit)."
[ -d "$APP_DIR" ] || fail "APP_DIR not found: $APP_DIR"
git -C "$APP_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "APP_DIR is not a git working tree: $APP_DIR"
resolve_backend_dir
[ -f "$ENV_FILE" ] || fail "Missing env file: $ENV_FILE"
[ -f "$LITELLM_ENV_FILE" ] || fail "Missing LiteLLM env file: $LITELLM_ENV_FILE"
[ -f "$LITELLM_DIR/docker-compose.yml" ] || fail "Missing LiteLLM compose file: $LITELLM_DIR/docker-compose.yml"

require_cmd git
require_cmd npm
require_cmd curl
require_cmd docker
require_cmd python3
require_cmd systemctl

release_timestamp="$(date +%Y%m%d%H%M%S)"
backup_dir="$BACKUP_ROOT/$release_timestamp"
mkdir -p "$backup_dir" "$DEPLOY_STATE_DIR/releases"

previous_ref="$(git -C "$APP_DIR" rev-parse HEAD)"
current_ref_before_checkout="$previous_ref"

log "Detected backend directory: $BACKEND_DIR"

log "Preflight: validate required env keys"
for key in JWT_SECRET LITELLM_BASE_URL LITELLM_API_KEY QDRANT_URL; do
  value="$(get_env_value "$ENV_FILE" "$key")"
  [ -n "$value" ] || fail "ENV missing key: $key ($ENV_FILE)"
done
for key in LITELLM_MASTER_KEY LITELLM_SALT_KEY DATABASE_URL STORE_MODEL_IN_DB; do
  value="$(get_env_value "$LITELLM_ENV_FILE" "$key")"
  [ -n "$value" ] || fail "LiteLLM ENV missing key: $key ($LITELLM_ENV_FILE)"
done

log "Backup: env files"
cp -a "$ENV_FILE" "$backup_dir/context-os.env.bak"
cp -a "$LITELLM_ENV_FILE" "$backup_dir/litellm.env.bak"

database_backup_path=""
db_url="$(get_env_value "$ENV_FILE" DATABASE_URL)"
db_file="$(resolve_db_path "$db_url")"
if [ -n "$db_file" ] && [ -f "$db_file" ]; then
  database_backup_path="$backup_dir/context-os.db.bak"
  log "Backup: sqlite database $db_file"
  cp -a "$db_file" "$database_backup_path"
else
  log "Backup: skip sqlite copy (DATABASE_URL is not local file or file missing)"
fi

qdrant_snapshot_manifest=""
if [ "$SKIP_QDRANT_SNAPSHOT" != "1" ]; then
  qdrant_url="$(get_env_value "$ENV_FILE" QDRANT_URL)"
  [ -n "$qdrant_url" ] || fail "QDRANT_URL is empty in $ENV_FILE"
  qdrant_snapshot_manifest="$backup_dir/qdrant-snapshots.tsv"
  {
    echo -e "collection\tsnapshot"
    collections_json="$(curl -fsS "$qdrant_url/collections")"
    collections="$(python3 - "$collections_json" <<'PY'
import json,sys
raw = sys.argv[1]
obj = json.loads(raw)
items = obj.get("result", {}).get("collections", [])
for item in items:
    name = item.get("name")
    if name:
        print(name)
PY
)"

    if [ -z "$collections" ]; then
      log "Backup: no qdrant collections found"
    else
      while IFS= read -r collection_name; do
        [ -n "$collection_name" ] || continue
        resp="$(curl -fsS -X POST "$qdrant_url/collections/$collection_name/snapshots")"
        snapshot_name="$(python3 - "$resp" <<'PY'
import json,sys
raw = sys.argv[1]
obj = json.loads(raw)
res = obj.get("result") or {}
print(res.get("name", ""))
PY
)"
        [ -n "$snapshot_name" ] || fail "Qdrant snapshot creation failed for collection=$collection_name"
        echo -e "$collection_name\t$snapshot_name"
      done <<< "$collections"
    fi
  } > "$qdrant_snapshot_manifest"
fi

litellm_db_dump_path=""
if [ "$SKIP_LITELLM_DB_DUMP" != "1" ]; then
  if (cd "$LITELLM_DIR" && docker compose config --services | grep -qx "litellm-db"); then
    log "Backup: LiteLLM Postgres dump"
    litellm_db_dump_path="$backup_dir/litellm-db.sql"
    (
      cd "$LITELLM_DIR"
      docker compose up -d litellm-db >/dev/null
      docker compose exec -T litellm-db sh -lc 'pg_dump -U "${POSTGRES_USER:-litellm}" -d "${POSTGRES_DB:-litellm}"'
    ) > "$litellm_db_dump_path"
  else
    log "Backup: skip LiteLLM DB dump (service litellm-db not found in compose)"
  fi
fi

log "Deploy: checkout target ref $RELEASE_REF"
git -C "$APP_DIR" fetch --all --tags
if git -C "$APP_DIR" rev-parse --verify "$RELEASE_REF^{commit}" >/dev/null 2>&1; then
  git -C "$APP_DIR" checkout "$RELEASE_REF"
elif git -C "$APP_DIR" show-ref --verify --quiet "refs/remotes/origin/$RELEASE_REF"; then
  git -C "$APP_DIR" checkout -B "$RELEASE_REF" "origin/$RELEASE_REF"
else
  fail "Cannot resolve RELEASE_REF=$RELEASE_REF"
fi

log "Deploy: install + build"
cd "$BACKEND_DIR"
npm ci
npm run build

if [ "$SKIP_SELFCHECK" != "1" ]; then
  log "Deploy: startup selfcheck"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  # shellcheck disable=SC1090
  source "$LITELLM_ENV_FILE"
  set +a
  npm run selfcheck
fi

log "Deploy: restart LiteLLM services"
(
  cd "$LITELLM_DIR"
  docker compose up -d litellm-db litellm
)

log "Deploy: restart API + worker"
systemctl restart context-os-api context-os-worker

log "Health gates: backend + LiteLLM + admin auth"
wait_http_code "http://127.0.0.1:3000/api/health" '^200$' 90 2

litellm_port="$(get_env_value "$LITELLM_ENV_FILE" LITELLM_PORT)"
litellm_port="${litellm_port:-4410}"
wait_http_code "http://127.0.0.1:${litellm_port}/health/readiness" '^200$' 90 2
wait_http_code "http://127.0.0.1:3000/api/admin/auth/me" '^(200|401)$' 60 2

record_file="$DEPLOY_STATE_DIR/releases/$release_timestamp.env"
{
  echo "RELEASE_TIMESTAMP=$release_timestamp"
  echo "APP_DIR=$APP_DIR"
  echo "BACKEND_DIR=$BACKEND_DIR"
  echo "ENV_FILE=$ENV_FILE"
  echo "LITELLM_DIR=$LITELLM_DIR"
  echo "LITELLM_ENV_FILE=$LITELLM_ENV_FILE"
  echo "RELEASE_REF=$RELEASE_REF"
  echo "DEPLOYED_REF=$(git -C "$APP_DIR" rev-parse HEAD)"
  echo "PREVIOUS_REF=$current_ref_before_checkout"
  echo "BACKUP_DIR=$backup_dir"
  echo "DATABASE_BACKUP_PATH=$database_backup_path"
  echo "QDRANT_SNAPSHOT_MANIFEST=$qdrant_snapshot_manifest"
  echo "LITELLM_DB_DUMP_PATH=$litellm_db_dump_path"
} > "$record_file"

ln -sfn "$record_file" "$DEPLOY_STATE_DIR/latest.env"

log "SUCCESS: deployed $RELEASE_REF"
log "Release record: $record_file"
log "Rollback command: sudo RECORD_FILE=$record_file $BACKEND_DIR/scripts/deploy/prod-rollback.sh"
