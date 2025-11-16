from __future__ import annotations

import json
import os
import shlex
import sys
from pathlib import Path
from typing import Optional

from PySide6.QtCore import Qt, Signal, QThread
from PySide6.QtWidgets import (
    QFileDialog,
    QGridLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QCheckBox,
    QTextEdit,
    QWidget,
)

ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
MONITOR_DIR = ROOT_DIR / "monitor"
WRAPPER_PATH = MONITOR_DIR / "jail_wrapper.py"
LOG_DIR = MONITOR_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)


class _PrepareWorker(QThread):
    finished = Signal(int, str, str)
    failed = Signal(str)

    def __init__(self, jail_path: str, parent: Optional[QWidget] = None) -> None:
        super().__init__(parent)
        self._jail_path = jail_path

    def run(self) -> None:  # noqa: D401 - QThread entry point
        script = SCRIPTS_DIR / "build_jail_dev.sh"
        if not script.exists():
            self.failed.emit(f"Missing script: {script}")
            return

        cmd = ["bash", str(script), self._jail_path]
        try:
            proc = subprocess_run(cmd)
        except Exception as exc:  # pragma: no cover - surfaced in UI
            self.failed.emit(str(exc))
            return

        self.finished.emit(proc.returncode, proc.stdout, proc.stderr)


def subprocess_run(cmd: list[str]):
    import subprocess

    return subprocess.run(
        cmd,
        cwd=str(ROOT_DIR),
        capture_output=True,
        text=True,
    )


class _JailRunWorker(QThread):
    output = Signal(str)
    finished = Signal(int, object)
    failed = Signal(str)

    def __init__(self, command: list[str], parent: Optional[QWidget] = None) -> None:
        super().__init__(parent)
        self._command = command

    def run(self) -> None:  # noqa: D401 - QThread entry point
        import subprocess

        if not WRAPPER_PATH.exists():
            self.failed.emit(f"Missing wrapper: {WRAPPER_PATH}")
            return

        try:
            proc = subprocess.Popen(
                self._command,
                cwd=str(ROOT_DIR),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )
        except Exception as exc:  # pragma: no cover - surfaced in UI
            self.failed.emit(str(exc))
            return

        log_path: Optional[str] = None
        if proc.stdout is not None:
            for line in proc.stdout:
                text = line.rstrip()
                if text:
                    self.output.emit(text)
                if "Log written to" in text:
                    log_path = text.split("Log written to", 1)[-1].strip()
        code = proc.wait()
        self.finished.emit(code, log_path)


class FileJailPanel(QWidget):
    """Native PySide6 panel that manages the file jail workflow."""

    def __init__(self, main_window, parent: Optional[QWidget] = None) -> None:
        super().__init__(parent)
        self._main_window = main_window
        self._prepare_worker: Optional[_PrepareWorker] = None
        self._run_worker: Optional[_JailRunWorker] = None
        self._latest_log_path: Optional[str] = None

        self._init_ui()
        self._connect_signals()
        self._update_controls(False)

    def _init_ui(self) -> None:
        layout = QGridLayout(self)
        layout.setColumnStretch(1, 1)
        layout.setHorizontalSpacing(10)
        layout.setVerticalSpacing(8)

        header = QLabel("🗂️ File Restriction (File Jail)")
        header.setStyleSheet("font-size: 18px; font-weight: bold; color: #2d3748;")
        layout.addWidget(header, 0, 0, 1, 2)

        self.use_jail_check = QCheckBox("Enable File Jail")
        layout.addWidget(self.use_jail_check, 1, 0, 1, 2)

        self.path_label = QLabel("Jail Path:")
        self.path_label.setStyleSheet("font-weight: 600; color: #4a5568;")
        layout.addWidget(self.path_label, 2, 0)

        path_row = QWidget()
        path_layout = QGridLayout(path_row)
        path_layout.setContentsMargins(0, 0, 0, 0)
        path_layout.setHorizontalSpacing(8)

        self.jail_path_input = QLineEdit("sandbox_jail")
        self.jail_path_input.setPlaceholderText("Enter or browse for jail path")
        path_layout.addWidget(self.jail_path_input, 0, 0)

        self.browse_button = QPushButton("Browse")
        path_layout.addWidget(self.browse_button, 0, 1)
        layout.addWidget(path_row, 2, 1)

        self.path_warning = QLabel()
        self.path_warning.setStyleSheet("color: #c53030; font-size: 12px;")
        layout.addWidget(self.path_warning, 3, 0, 1, 2)

        self.enforce_check = QCheckBox("Enforce (requires sudo)")
        self.enforce_check.setToolTip("Requires root. GUI will display sudo command; it will not run privileged commands.")
        layout.addWidget(self.enforce_check, 4, 0, 1, 2)

        self.prepare_button = QPushButton("Prepare Jail")
        self.apply_button = QPushButton("Apply & Run")
        layout.addWidget(self.prepare_button, 5, 0)
        layout.addWidget(self.apply_button, 5, 1)

        status_label = QLabel("Status")
        status_label.setStyleSheet("font-weight: 600; color: #4a5568;")
        layout.addWidget(status_label, 7, 0, 1, 2)

        self.status_output = QTextEdit()
        self.status_output.setReadOnly(True)
        self.status_output.setFixedHeight(140)
        self.status_output.setStyleSheet(
            "QTextEdit { background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px; }"
        )
        layout.addWidget(self.status_output, 8, 0, 1, 2)

        self.log_link = QLabel("Log: (none)")
        self.log_link.setOpenExternalLinks(True)
        self.log_link.setTextInteractionFlags(Qt.TextBrowserInteraction)
        layout.addWidget(self.log_link, 9, 0, 1, 2)

    def _connect_signals(self) -> None:
        self.use_jail_check.toggled.connect(self._update_controls)
        self.browse_button.clicked.connect(self._on_browse)
        self.jail_path_input.textChanged.connect(lambda _: self._validate_path())
        self.enforce_check.toggled.connect(self._on_enforce_toggled)
        self.prepare_button.clicked.connect(self._on_prepare_clicked)
        self.apply_button.clicked.connect(self._on_apply_clicked)

    def _update_controls(self, enabled: bool) -> None:
        for widget in (
            self.jail_path_input,
            self.browse_button,
            self.enforce_check,
            self.prepare_button,
            self.apply_button,
        ):
            widget.setEnabled(enabled)
        if not enabled:
            self.status_output.append("File jail disabled. Enable to prepare or run.")

    def _validate_path(self) -> bool:
        path = self.jail_path_input.text().strip()
        warning = ""
        if not path:
            warning = "Jail path must not be empty."
        else:
            resolved = os.path.abspath(os.path.expanduser(path))
            if resolved == "/":
                warning = "Using / as jail is forbidden."
        self.path_warning.setText(warning)
        return warning == ""

    def _on_browse(self) -> None:
        selected = QFileDialog.getExistingDirectory(self, "Select jail directory", str(ROOT_DIR))
        if selected:
            self.jail_path_input.setText(selected)

    def _on_enforce_toggled(self, checked: bool) -> None:
        if not checked:
            return
        command = self._build_native_sudo_command()
        QMessageBox.information(
            self,
            "Sudo Required",
            "\n".join(
                [
                    "Running enforcement requires elevated privileges.",
                    "Execute the following command manually in a terminal:",
                    "",
                    command,
                ]
            ),
        )

    def _on_prepare_clicked(self) -> None:
        if not self.use_jail_check.isChecked():
            self.status_output.append("Enable File Jail before preparing.")
            return
        if not self._validate_path():
            self.status_output.append("Cannot prepare jail: invalid path.")
            return

        jail_path = os.path.abspath(os.path.expanduser(self.jail_path_input.text().strip()))
        self.status_output.append(f"Preparing jail at {jail_path}...")
        self.prepare_button.setEnabled(False)

        self._prepare_worker = _PrepareWorker(jail_path, self)
        self._prepare_worker.finished.connect(self._on_prepare_finished)
        self._prepare_worker.failed.connect(self._on_worker_failed)
        self._prepare_worker.finished.connect(lambda *_: self.prepare_button.setEnabled(True))
        self._prepare_worker.failed.connect(lambda *_: self.prepare_button.setEnabled(True))
        self._prepare_worker.start()

    def _on_prepare_finished(self, code: int, stdout: str, stderr: str) -> None:
        if code == 0:
            self.status_output.append("✅ Jail prepared successfully.\n" + stdout.strip())
        else:
            self.status_output.append(
                "❌ Jail preparation failed (rc={}).".format(code)
            )
            if stdout:
                self.status_output.append(stdout.strip())
            if stderr:
                self.status_output.append(stderr.strip())

    def _on_worker_failed(self, message: str) -> None:
        self.status_output.append(f"❌ Error: {message}")

    def _on_apply_clicked(self) -> None:
        if not self.use_jail_check.isChecked():
            self.status_output.append("Enable File Jail before applying.")
            return
        if not self._validate_path():
            self.status_output.append("Cannot run: invalid jail path.")
            return

        try:
            need_sudo = self.enforce_check.isChecked() and os.geteuid() != 0
        except AttributeError:
            need_sudo = self.enforce_check.isChecked()

        if need_sudo:
            command = self._build_native_sudo_command()
            QMessageBox.warning(
                self,
                "Elevation required",
                "Enforced jail requires sudo. Run manually:\n\n{}".format(command),
            )
            return

        command_parts = self._build_target_command()
        if not command_parts:
            QMessageBox.warning(self, "Missing command", "Specify a command in the Command section before running.")
            return

        jail_path = os.path.abspath(os.path.expanduser(self.jail_path_input.text().strip()))
        wrapper_cmd = [
            sys.executable,
            str(WRAPPER_PATH),
            "--jail",
            jail_path,
            "--",
            *command_parts,
        ]

        self.status_output.append("Launching jail wrapper...")
        self.apply_button.setEnabled(False)

        self._run_worker = _JailRunWorker(wrapper_cmd, self)
        self._run_worker.output.connect(lambda text: self.status_output.append(text))
        self._run_worker.finished.connect(self._on_run_finished)
        self._run_worker.failed.connect(self._on_worker_failed)
        self._run_worker.finished.connect(lambda *_: self.apply_button.setEnabled(True))
        self._run_worker.failed.connect(lambda *_: self.apply_button.setEnabled(True))
        self._run_worker.start()

    def _on_run_finished(self, code: int, log_path: Optional[str]) -> None:
        self.status_output.append(f"Run finished with exit code {code}.")
        if log_path and Path(log_path).exists():
            self._latest_log_path = log_path
            summary = self._summarise_log(log_path)
            if summary:
                self.status_output.append(summary)
            self.log_link.setText(f'<a href="file://{log_path}">Log: {log_path}</a>')
        else:
            latest = self._find_latest_log()
            if latest:
                self._latest_log_path = str(latest)
                summary = self._summarise_log(str(latest))
                self.status_output.append("Log located: {}".format(latest))
                if summary:
                    self.status_output.append(summary)
                self.log_link.setText(f'<a href="file://{latest}">Log: {latest}</a>')
            else:
                self.log_link.setText("Log: (none)")

    def _find_latest_log(self) -> Optional[Path]:
        if not LOG_DIR.exists():
            return None
        logs = sorted(LOG_DIR.glob("jail_run_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        return logs[0] if logs else None

    def _summarise_log(self, log_path: str) -> Optional[str]:
        try:
            with open(log_path, "r", encoding="utf-8") as handle:
                data = json.load(handle)
        except (OSError, json.JSONDecodeError):
            return None

        violations = data.get("violations", [])
        status = data.get("wrapper_exit_code")
        method = data.get("method")
        return "Summary → method: {} | exit: {} | violations: {}".format(method, status, len(violations))

    def _build_target_command(self) -> list[str]:
        getter = getattr(self._main_window, "get_effective_target_command", None)
        if callable(getter):
            try:
                return getter()
            except ValueError:
                return []

        cmd_field = getattr(self._main_window, "command_input", None)
        args_field = getattr(self._main_window, "args_input", None)
        if cmd_field is None:
            return []
        command = cmd_field.text().strip()
        args = args_field.text().strip() if args_field is not None else ""
        if not command:
            return []
        joined = command if not args else f"{command} {args}"
        try:
            return shlex.split(joined)
        except ValueError:
            return []

    def _build_native_sudo_command(self) -> str:
        command_parts = self._build_target_command()
        jail_path = os.path.abspath(os.path.expanduser(self.jail_path_input.text().strip()))
        base = ["sudo", str(ROOT_DIR / "zencube" / "sandbox"), f"--jail={jail_path}"]
        if command_parts:
            base.extend(command_parts)
        return " ".join(base)


def attach_file_jail_panel(parent, layout):
    """
    Factory function to create and attach FileJailPanel to the parent layout.
    
    Args:
        parent: Parent widget
        layout: Layout to attach the panel to
        
    Returns:
        FileJailPanel instance
    """
    panel = FileJailPanel(parent)
    layout.addWidget(panel)
    return panel
