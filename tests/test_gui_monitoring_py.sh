#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
export QT_QPA_PLATFORM=offscreen
PYTHON_BIN="${ROOT_DIR}/.venv/bin/python"
if [[ ! -x "${PYTHON_BIN}" ]]; then
    PYTHON_BIN="$(command -v python3)"
fi

"${PYTHON_BIN}" <<'PY'
import json
import os
import subprocess
import sys
import time
from pathlib import Path

from PySide6.QtWidgets import QApplication

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from gui.monitor_panel import MonitoringPanel


class _DummyMain:
    def log_output(self, message: str, level: str = "info") -> None:
        pass


def _wait(condition, app: QApplication, timeout: float = 3.0) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        app.processEvents()
        if condition():
            return True
        time.sleep(0.05)
    return False


def main() -> None:
    app = QApplication([])
    panel = MonitoringPanel(_DummyMain())
    panel.enable_check.setChecked(True)
    panel.interval_spin.setValue(0.2)

    proc = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(0.6)"])
    panel.attach_to_process(proc.pid, ["python", "sleep"], ["python", "sleep"])

    while proc.poll() is None:
        app.processEvents()
        time.sleep(0.05)

    panel.handle_process_finished(proc.returncode)

    if not _wait(lambda: not panel.is_active(), app):
        panel.shutdown()
        raise SystemExit("Monitoring worker did not finish")

    latest_path = panel.latest_log_path()
    if not latest_path:
        panel.shutdown()
        raise SystemExit("Monitoring log path not recorded")

    log_path = Path(latest_path)
    if not log_path.exists():
        panel.shutdown()
        raise SystemExit(f"Monitoring log missing: {log_path}")
    lines = [line for line in log_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if not lines:
        panel.shutdown()
        raise SystemExit("Monitoring log empty")

    summary = json.loads(lines[-1])
    sample_seen = any('"event": "sample"' in line for line in lines[1:-1])

    result = {
        "log": str(log_path),
        "samples": summary.get("samples"),
        "duration": summary.get("duration_seconds"),
        "sample_captured": sample_seen,
    }
    print(json.dumps(result))
    panel.shutdown()
    app.quit()


if __name__ == "__main__":
    main()
PY
