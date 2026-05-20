#!/usr/bin/env bash
# scripts/runMonitor.sh
# Load env vars and run the QA monitor locally.
# Usage: bash scripts/runMonitor.sh [--config ./path/to/config.json]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env if it exists
if [ -f "$ROOT_DIR/.env" ]; then
  echo "[monitor] Loading .env..."
  export $(grep -v '^#' "$ROOT_DIR/.env" | xargs)
fi

# Check required env vars
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "[monitor] WARNING: ANTHROPIC_API_KEY is not set. AI incident summaries will be skipped."
fi

echo "[monitor] Starting ecom-qa-monitor..."
node "$ROOT_DIR/src/runner.js" "$@"
