#!/usr/bin/env bash
set -euo pipefail

DOMAIN="contextlm.top"
WWW_DOMAIN="www.contextlm.top"
APP_DIR="/var/www/context-os"
ENV_DIR="/etc/context-os"
LOG_DIR="/var/log/context-os"
LITELLM_DIR="/opt/context-os/litellm"
QDRANT_INTERNAL_IP="10.5.4.5"
LITELLM_PORT="4410"
REPO_URL="REPLACE_ME"

ENABLE_SSL="${ENABLE_SSL:-0}"
SSL_CERT_PATH="${SSL_CERT_PATH:-}"
SSL_KEY_PATH="${SSL_KEY_PATH:-}"
SSL_CERT_CONTENT="${SSL_CERT_CONTENT:-}"
SSL_KEY_CONTENT="${SSL_KEY_CONTENT:-}"

if [ "$REPO_URL" = "REPLACE_ME" ]; then
  echo "Please set REPO_URL in this script before running."
  exit 1
fi

echo "[1/9] Install system deps"
apt-get update -y
apt-get install -y git curl ca-certificates nginx redis-server build-essential python3

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

if ! command -v docker >/dev/null 2>&1; then
  apt-get install -y docker.io docker-compose-plugin
  systemctl enable --now docker
fi

echo "[2/9] Clone or update repo"
if [ ! -d "$APP_DIR/.git" ]; then
  mkdir -p "$(dirname "$APP_DIR")"
  git clone "$REPO_URL" "$APP_DIR"
else
  cd "$APP_DIR"
  git pull
fi

echo "[3/9] Build app"
cd "$APP_DIR"
npm ci
npm run build

echo "[4/9] Write env file"
mkdir -p "$ENV_DIR" "$LOG_DIR"
cp "$APP_DIR/scripts/templates/context-os.env" "$ENV_DIR/context-os.env"
sed -i "s/{{QDRANT_INTERNAL_IP}}/${QDRANT_INTERNAL_IP}/g" "$ENV_DIR/context-os.env"
sed -i "s/{{LITELLM_PORT}}/${LITELLM_PORT}/g" "$ENV_DIR/context-os.env"
sed -i "s/{{DOMAIN}}/${DOMAIN}/g" "$ENV_DIR/context-os.env"
sed -i "s/{{WWW_DOMAIN}}/${WWW_DOMAIN}/g" "$ENV_DIR/context-os.env"

echo "[5/9] Configure systemd"
cp "$APP_DIR/scripts/templates/systemd/context-os-api.service" /etc/systemd/system/context-os-api.service
cp "$APP_DIR/scripts/templates/systemd/context-os-worker.service" /etc/systemd/system/context-os-worker.service
sed -i "s|{{APP_DIR}}|$APP_DIR|g" /etc/systemd/system/context-os-api.service
sed -i "s|{{APP_DIR}}|$APP_DIR|g" /etc/systemd/system/context-os-worker.service
sed -i "s|{{ENV_FILE}}|$ENV_DIR/context-os.env|g" /etc/systemd/system/context-os-api.service
sed -i "s|{{ENV_FILE}}|$ENV_DIR/context-os.env|g" /etc/systemd/system/context-os-worker.service
systemctl daemon-reload

echo "[6/9] Configure LiteLLM"
mkdir -p "$LITELLM_DIR"
cp "$APP_DIR/litellm-config.yaml" "$LITELLM_DIR/litellm-config.yaml"
cp "$APP_DIR/scripts/templates/litellm/docker-compose.yml" "$LITELLM_DIR/docker-compose.yml"
cp "$APP_DIR/scripts/templates/litellm/.env" "$LITELLM_DIR/.env"
if grep -q "^LITELLM_PORT=" "$LITELLM_DIR/.env"; then
  sed -i "s/^LITELLM_PORT=.*/LITELLM_PORT=${LITELLM_PORT}/" "$LITELLM_DIR/.env"
else
  echo "LITELLM_PORT=${LITELLM_PORT}" >> "$LITELLM_DIR/.env"
fi
docker compose -f "$LITELLM_DIR/docker-compose.yml" up -d

echo "[7/9] Configure Nginx (HTTP first)"
cp "$APP_DIR/scripts/templates/nginx-contextlm-http.conf" /etc/nginx/conf.d/context-os.conf
sed -i "s/{{DOMAIN}}/${DOMAIN}/g" /etc/nginx/conf.d/context-os.conf
sed -i "s/{{WWW_DOMAIN}}/${WWW_DOMAIN}/g" /etc/nginx/conf.d/context-os.conf
nginx -t
systemctl enable --now nginx
systemctl reload nginx

if [ "$ENABLE_SSL" = "1" ]; then
  echo "[7.1] Enable SSL via Cloudflare Origin cert"
  SSL_CERT_PATH="${SSL_CERT_PATH:-/etc/nginx/ssl/${DOMAIN}.pem}"
  SSL_KEY_PATH="${SSL_KEY_PATH:-/etc/nginx/ssl/${DOMAIN}.key}"

  if [ -n "$SSL_CERT_CONTENT" ] || [ -n "$SSL_KEY_CONTENT" ]; then
    if [ -z "$SSL_CERT_CONTENT" ] || [ -z "$SSL_KEY_CONTENT" ]; then
      echo "SSL_CERT_CONTENT and SSL_KEY_CONTENT must both be set"
      exit 1
    fi
    mkdir -p "$(dirname "$SSL_CERT_PATH")"
    printf '%s\n' "$SSL_CERT_CONTENT" > "$SSL_CERT_PATH"
    printf '%s\n' "$SSL_KEY_CONTENT" > "$SSL_KEY_PATH"
    chmod 600 "$SSL_KEY_PATH"
  fi

  if [ ! -f "$SSL_CERT_PATH" ] || [ ! -f "$SSL_KEY_PATH" ]; then
    echo "SSL cert/key not found. Expected:"
    echo "  $SSL_CERT_PATH"
    echo "  $SSL_KEY_PATH"
    exit 1
  fi
  cp "$APP_DIR/scripts/templates/nginx-contextlm-ssl.conf" /etc/nginx/conf.d/context-os.conf
  sed -i "s/{{DOMAIN}}/${DOMAIN}/g" /etc/nginx/conf.d/context-os.conf
  sed -i "s/{{WWW_DOMAIN}}/${WWW_DOMAIN}/g" /etc/nginx/conf.d/context-os.conf
  sed -i "s|/etc/nginx/ssl/${DOMAIN}.pem|${SSL_CERT_PATH}|g" /etc/nginx/conf.d/context-os.conf
  sed -i "s|/etc/nginx/ssl/${DOMAIN}.key|${SSL_KEY_PATH}|g" /etc/nginx/conf.d/context-os.conf
  nginx -t
  systemctl reload nginx
fi

echo "[8/9] Logrotate"
cp "$APP_DIR/scripts/templates/logrotate-context-os" /etc/logrotate.d/context-os

echo "[9/9] Start services"
systemctl enable --now redis-server
systemctl enable --now context-os-api
systemctl enable --now context-os-worker

echo "Done. Edit $ENV_DIR/context-os.env with real keys before production use."
