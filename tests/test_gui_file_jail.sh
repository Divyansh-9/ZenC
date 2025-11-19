#!/usr/bin/env bash
set -euo pipefail

# Simple E2E-ish test for the GUI file jail API endpoints.
# Requires: curl, jq. Server must be running at http://127.0.0.1:8000

API="http://127.0.0.1:8000/api/sandbox"
JAIL="sandbox_jail_test"

echo "Preparing jail..."
curl -s -X POST "$API/prepare_jail" -H 'Content-Type: application/json' -d "{\"jailPath\": \"$JAIL\"}" | jq . > /tmp/gui_prepare.json

echo "Response:"
cat /tmp/gui_prepare.json

echo "Starting run (dev-mode, enforce=false)..."
BODY=$(jq -n --arg cmd "./tests/test_jail_dev.sh" --arg jp "$JAIL" '{command:$cmd, jailPath:$jp, useJail:true, enforce:false}')
RESP=$(curl -s -X POST "$API/run" -H 'Content-Type: application/json' -d "$BODY")
echo "$RESP" | jq . > /tmp/gui_run_resp.json

LOG=$(jq -r '.log' /tmp/gui_run_resp.json)
echo "Server returned log path: $LOG"

if [ -z "$LOG" ] || [ "$LOG" = "null" ]; then
  echo "No log file reported by server" >&2
  exit 2
fi

if [ ! -f "$LOG" ]; then
  echo "Log file does not exist yet: $LOG" >&2
  # Wait briefly for process to create it
  for i in {1..10}; do
    sleep 0.5
    if [ -f "$LOG" ]; then
      break
    fi
  done
fi

if [ ! -f "$LOG" ]; then
  echo "Log file still missing: $LOG" >&2
  exit 3
fi

echo "Checking log contains jail path..."
if grep -q "$JAIL" "$LOG"; then
  echo "PASS: log contains jail path"
  exit 0
else
  echo "FAIL: log does not contain jail path" >&2
  exit 4
fi
