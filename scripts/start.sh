#!/usr/bin/env bash
# Start the Prelegal server in the background and record its PID.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT/.data/server.pid"
LOG_FILE="$ROOT/.data/server.log"

mkdir -p "$ROOT/.data"

if [ -f "$PID_FILE" ]; then
  EXISTING="$(cat "$PID_FILE")"
  if kill -0 "$EXISTING" 2>/dev/null; then
    echo "Prelegal is already running (PID $EXISTING). Use scripts/stop.sh first."
    exit 0
  fi
  rm -f "$PID_FILE"
fi

if [ ! -d "$ROOT/node_modules" ]; then
  echo "Installing dependencies..."
  (cd "$ROOT" && npm install)
fi

cd "$ROOT"
nohup node server/index.js > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
sleep 2

echo "Prelegal started (PID $(cat "$PID_FILE"))."
echo "  URL:  http://localhost:${PORT:-3000}"
echo "  Logs: $LOG_FILE"
echo "  Stop: scripts/stop.sh"
