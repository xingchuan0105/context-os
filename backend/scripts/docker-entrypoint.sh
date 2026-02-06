#!/bin/sh
# Docker entrypoint script for Context-OS backend

set -e

# Use the mounted database directly (shared with worker)
DB_PATH="/app/data/context-os.db"

# Ensure data directory exists
mkdir -p /app/data

# Set DATABASE_URL to use mounted volume directly
# This ensures backend and worker use the same database
export DATABASE_URL="$DB_PATH"

echo "[Entrypoint] Starting server with DATABASE_URL=$DATABASE_URL"

# Execute the main command
exec "$@"
