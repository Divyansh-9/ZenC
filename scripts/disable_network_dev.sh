#!/usr/bin/env bash
# Dev helper: run a command inside a private network namespace without root.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <command ...>" >&2
  exit 64
fi

if ! command -v unshare >/dev/null 2>&1; then
  echo "error: unshare command not available; install util-linux." >&2
  exit 1
fi

SCRIPT_DIR=$(dirname "$(realpath "$0")")
LOG_DIR=$(realpath "$SCRIPT_DIR/../monitor/logs")
mkdir -p "$LOG_DIR"
STAMP=$(date -u +"%Y%m%dT%H%M%SZ")
LOG_FILE="$LOG_DIR/net_namespace_${STAMP}.log"

printf '[disable_network_dev] command: %s\n' "$*" | tee "$LOG_FILE" >/dev/null
printf '[disable_network_dev] log: %s\n' "$LOG_FILE"

if command -v ip >/dev/null 2>&1; then
  NS_SCRIPT='ip link set lo up >/dev/null 2>&1 || true; exec "$@"'
else
  echo "warning: ip command not available; loopback may remain down." | tee -a "$LOG_FILE" >&2
  NS_SCRIPT='exec "$@"'
fi

if ! unshare --user --map-root-user --net bash -c "$NS_SCRIPT" bash "$@" \
  2>&1 | tee -a "$LOG_FILE"; then
  echo "[disable_network_dev] failed to execute command inside isolated namespace." >&2
  exit 1
fi
