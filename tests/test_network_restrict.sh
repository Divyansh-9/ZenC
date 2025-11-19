#!/usr/bin/env bash
# Validate that --no-net prevents outbound connections and logs attempts.

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
SANDBOX_DIR="$ROOT_DIR/zencube"
SANDBOX_BIN="$SANDBOX_DIR/sandbox"
LOG_DIR="$ROOT_DIR/monitor/logs"
PYTHON_BIN=${PYTHON_BIN:-$(command -v python3)}

echo "[test_network_restrict] ensuring sandbox binary is up to date..."
make -C "$SANDBOX_DIR" sandbox >/dev/null

mkdir -p "$LOG_DIR"
rm -f "$LOG_DIR"/net_restrict_*.json

TMP_SCRIPT=$(mktemp "$ROOT_DIR/tests/net_probe_XXXX.py")
cat >"$TMP_SCRIPT" <<'PY'
import socket

# Attempt outbound TCP connection – should be blocked.
socket.create_connection(("google.com", 80), timeout=1)
PY

CMD=("$SANDBOX_BIN" "--no-net" "$PYTHON_BIN" "-m" "monitor.net_wrapper" "--" "$PYTHON_BIN" "$TMP_SCRIPT")

if "${CMD[@]}"; then
  echo "[test_network_restrict] expected command to fail when network is disabled" >&2
  rm -f "$TMP_SCRIPT"
  exit 1
fi

LATEST_LOG=$(ls -1t "$LOG_DIR"/net_restrict_*.json 2>/dev/null | head -n 1 || true)
if [[ -z "$LATEST_LOG" ]]; then
  echo "[test_network_restrict] expected a net_restrict log to be created" >&2
  rm -f "$TMP_SCRIPT"
  exit 1
fi

"$PYTHON_BIN" - <<'PY' "$LATEST_LOG"
import json
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as handle:
    data = json.load(handle)

if not data.get("events"):
    print(f"{path} contains no recorded events", file=sys.stderr)
    sys.exit(1)

print(f"[test_network_restrict] log recorded at {path}")
PY

rm -f "$TMP_SCRIPT"
echo "[test_network_restrict] PASS"
