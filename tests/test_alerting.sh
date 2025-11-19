#!/usr/bin/env bash
set -euo pipefail

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

export MONITOR_LOG_DIR="$TMP_DIR"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
PYTHON_BIN="${ROOT_DIR}/.venv/bin/python"
if [[ ! -x "${PYTHON_BIN}" ]]; then
    PYTHON_BIN="$(command -v python3)"
fi

"${PYTHON_BIN}" - <<'PY'
import os
from pathlib import Path

from monitor.alert_manager import AlertManager
from monitor.resource_monitor import Sample

log_dir = Path(os.environ["MONITOR_LOG_DIR"])
manager = AlertManager(log_dir)
manager.reset_for_run("test-run")

sample = Sample(
    timestamp="2025-11-13T00:00:00Z",
    cpu_percent=95.0,
    memory_rss=int(600 * 1024 * 1024),
    memory_vms=None,
    threads=4,
    open_files=None,
    read_bytes=None,
    write_bytes=None,
)

# Simulate four consecutive samples at 1s intervals
for _ in range(4):
    manager.evaluate(sample, interval=1.0)

alerts = manager.active_alerts()
assert len(alerts) == 2, f"Expected both CPU and RSS alerts, got {len(alerts)}"

# Acknowledge the first alert and ensure it persists in the log
first_alert = alerts[0]
assert manager.acknowledge(first_alert.alert_id), "Acknowledging the alert should succeed"
assert manager.alert_count() == 1, "One alert should remain active after acknowledgement"

log_path = log_dir / "alerts.jsonl"
contents = log_path.read_text(encoding="utf-8")
assert '"event": "alert"' in contents
assert first_alert.alert_id in contents
assert '"event": "ack"' in contents
PY
