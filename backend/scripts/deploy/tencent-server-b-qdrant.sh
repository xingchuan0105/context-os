#!/usr/bin/env bash
set -euo pipefail

QDRANT_PORT="6333"
DATA_DIR="/var/lib/qdrant/storage"

echo "[1/4] Install docker"
apt-get update -y
apt-get install -y docker.io docker-compose-plugin curl
systemctl enable --now docker

echo "[2/4] Check Qdrant"
if curl -fsS "http://127.0.0.1:${QDRANT_PORT}/" >/dev/null 2>&1; then
  echo "Qdrant is already running on :${QDRANT_PORT}"
  exit 0
fi

echo "[3/4] Start Qdrant container"
mkdir -p "$DATA_DIR"
docker run -d \
  --name context-os-qdrant \
  --restart unless-stopped \
  -p "${QDRANT_PORT}:6333" \
  -v "${DATA_DIR}:/qdrant/storage" \
  qdrant/qdrant:latest

echo "[4/4] Done"
echo "Tip: restrict :${QDRANT_PORT} to internal network only."
