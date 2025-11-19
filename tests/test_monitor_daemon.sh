#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
PYTHON_BIN="${ROOT_DIR}/.venv/bin/python"
if [[ ! -x "${PYTHON_BIN}" ]]; then
    PYTHON_BIN="$(command -v python3)"
fi

# Sanity check: sampling a short-lived process produces at least one sample without raising.
"${PYTHON_BIN}" - <<'PY'
import subprocess
import time

from monitor.resource_monitor import MonitorError, ProcessInspector

proc = subprocess.Popen(["sleep", "1"])
try:
    inspector = ProcessInspector(proc.pid)
    time.sleep(0.2)
    sample = inspector.sample()
    assert sample.cpu_percent >= 0.0
    assert sample.memory_rss >= 0
except MonitorError as exc:
    raise AssertionError(f"Sampling failed: {exc}")
finally:
    proc.terminate()
    proc.wait()
PY
