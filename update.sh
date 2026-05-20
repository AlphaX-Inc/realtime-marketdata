#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

git pull

if docker compose version >/dev/null 2>&1; then
  docker compose -f docker-compose.yml up -d --build
elif command -v docker-compose >/dev/null 2>&1; then
  docker-compose -f docker-compose.yml up -d --build
else
  echo "Docker Compose is not installed or not available in PATH." >&2
  exit 1
fi
