#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
export QT_QPA_PLATFORM=offscreen

PYTHON="${ROOT_DIR}/.venv/bin/python"
if [ ! -x "$PYTHON" ]; then
    PYTHON="$(command -v python3)"
fi

"$PYTHON" <<'PY'
import json
import os
import sys
import time
from pathlib import Path

from PySide6.QtWidgets import QApplication

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from gui.file_jail_panel import FileJailPanel


class _Field:
    def __init__(self, value: str) -> None:
        self._value = value

    def text(self) -> str:
        return self._value


class _DummyMain:
    def __init__(self) -> None:
        self.command_input = _Field("/bin/echo")
        self.args_input = _Field("hello-from-file-jail-panel")


app = QApplication([])
panel = FileJailPanel(_DummyMain())
panel.use_jail_check.setChecked(True)
panel.jail_path_input.setText("sandbox_jail_py_gui")

panel._on_prepare_clicked()
while panel._prepare_worker is not None and panel._prepare_worker.isRunning():
    app.processEvents()
    time.sleep(0.1)

panel._on_apply_clicked()
while panel._run_worker is not None and panel._run_worker.isRunning():
    app.processEvents()
    time.sleep(0.1)

for _ in range(10):
    app.processEvents()
    time.sleep(0.1)
    if panel._latest_log_path:
        break

log_path = panel._latest_log_path
if not log_path:
    raise SystemExit("No log path recorded")
log_file = Path(log_path)
if not log_file.exists():
    raise SystemExit(f"Log file missing: {log_file}")

with log_file.open("r", encoding="utf-8") as handle:
    data = json.load(handle)

if "sandbox_jail_py_gui" not in str(data.get("jail", "")):
    raise SystemExit("Jail path missing from log")

print(json.dumps({"log": str(log_file), "wrapper_exit_code": data.get("wrapper_exit_code")}))
app.quit()
PY
