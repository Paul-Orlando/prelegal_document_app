#!/usr/bin/env bash
# Stop the Prelegal server started by scripts/start.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT/.data/server.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "Prelegal does not appear to be running (no PID file)."
  exit 0
fi

SERVER_PID="$(cat "$PID_FILE")"
if kill -0 "$SERVER_PID" 2>/dev/null; then
  kill "$SERVER_PID"
  echo "Stopped Prelegal (PID $SERVER_PID)."
else
  echo "No process with PID $SERVER_PID; clearing stale PID file."
fi

rm -f "$PID_FILE"
