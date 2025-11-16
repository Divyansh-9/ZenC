from __future__ import annotations

import os
import shlex
import sys
import json
from pathlib import Path
from typing import Dict, List, Sequence, Optional

from PySide6.QtCore import Qt, QTimer
from PySide6.QtWidgets import (
    QLabel,
    QCheckBox,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

ROOT_DIR = Path(__file__).resolve().parents[1]
MONITOR_DIR = ROOT_DIR / "monitor"
LOG_DIR = MONITOR_DIR / "logs"


class NetworkPanel(QWidget):
    """PySide6 panel that manages dev-safe network restrictions."""

    def __init__(self, main_window, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._main_window = main_window
        self._python = sys.executable
        self._status_label = QLabel("Network access: enabled")
        self._note_box = QTextEdit()
        self._note_box.setReadOnly(True)
        self._note_box.setFixedHeight(90)
        self._note_box.setStyleSheet(
            "QTextEdit { background-color: #f7fafc; border: 1px solid #e2e8f0; "
            "border-radius: 8px; padding: 6px; }"
        )
        
        # Track active execution for status polling
        self._active_pid: Optional[int] = None
        self._poll_timer: Optional[QTimer] = None
        self._latest_log_path: Optional[str] = None

        self.disable_check = QCheckBox("Disable Network Access")
        self.enforce_check = QCheckBox("Enforce (requires sudo)")
        self.enforce_check.setToolTip(
            "Requires root. GUI will display sudo command; it will not run privileged commands."
        )
        self.enforce_check.setEnabled(False)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(8)
        header = QLabel("📡 Network Restriction")
        header.setStyleSheet("font-size: 18px; font-weight: bold; color: #2d3748;")
        layout.addWidget(header)
        layout.addWidget(self.disable_check)
        layout.addWidget(self.enforce_check)
        layout.addWidget(self._status_label)
        layout.addWidget(self._note_box)

        self.disable_check.toggled.connect(self._on_disable_toggled)
        self.enforce_check.toggled.connect(self._on_enforce_toggled)
        self._update_status()

    def is_disabled(self) -> bool:
        return self.disable_check.isChecked()

    def is_enforce_mode(self) -> bool:
        return self.is_disabled() and self.enforce_check.isChecked()

    def prepare_command(self, command: Sequence[str]) -> List[str]:
        if not self.is_disabled():
            return list(command)
        if self.is_enforce_mode():
            return list(command)
        wrapper_cmd = [self._python, "-m", "monitor.net_wrapper", "--", *command]
        return wrapper_cmd

    def apply_env_overrides(self, env: Dict[str, str]) -> None:
        existing = env.get("PYTHONPATH", "")
        root = str(ROOT_DIR)
        if existing:
            if root not in existing.split(os.pathsep):
                env["PYTHONPATH"] = os.pathsep.join([root, existing])
        else:
            env["PYTHONPATH"] = root

        if self.is_enforce_mode():
            env.setdefault("ZENCUBE_NET_MODE", "seccomp")
        elif self.is_disabled():
            env.setdefault("ZENCUBE_NET_MODE", "dev-safe")

    def show_enforce_command(self, sandbox_path: str, base_args: Sequence[str]) -> None:
        if not self.is_enforce_mode():
            return
        parts = ["sudo", sandbox_path, *base_args]
        command = shlex.join(parts)
        self._note_box.setPlainText(
            "Enforce mode requires sudo. Run the following command manually:\n\n" + command
        )

    def reset_note(self) -> None:
        if not self.is_disabled():
            self._note_box.clear()
        else:
            if not self.is_enforce_mode():
                self._note_box.setPlainText(
                    "Dev-safe mode: monitor.net_wrapper will automatically wrap the command."
                )

    def _update_status(self) -> None:
        if not self.is_disabled():
            self._status_label.setText("Network access: enabled")
            self._note_box.setPlaceholderText("Enable network restriction to view status messages.")
        elif self.is_enforce_mode():
            self._status_label.setText("Network access: disabled via seccomp (requires sudo)")
        else:
            self._status_label.setText("Network access: disabled (dev-safe)")
            if not self._note_box.toPlainText():
                self._note_box.setPlainText(
                    "Dev-safe mode: network sockets will raise PermissionError and attempts are logged."
                )

    def _on_disable_toggled(self, checked: bool) -> None:
        self.enforce_check.setEnabled(checked)
        if not checked:
            self.enforce_check.setChecked(False)
        self._update_status()
        self.reset_note()
        if hasattr(self._main_window, "log_output"):
            message = "Network restriction disabled" if not checked else "Network restriction enabled"
            self._main_window.log_output(message + "\n", "info")

    def _on_enforce_toggled(self, checked: bool) -> None:
        self._update_status()
        if checked and hasattr(self._main_window, "log_output"):
            self._main_window.log_output("Seccomp enforce mode requested. Run with sudo to activate.\n", "warning")
        if not checked:
            self.reset_note()

    def attach_to_execution(self, pid: int) -> None:
        """Called by main window when execution starts with network restrictions"""
        if not self.is_disabled():
            return
        
        self._active_pid = pid
        self._latest_log_path = None
        self._status_label.setText(f"Network blocking: monitoring PID {pid}...")
        
        # Start polling for log file (check every 500ms for up to 30 seconds)
        if self._poll_timer is not None:
            self._poll_timer.stop()
        
        self._poll_timer = QTimer(self)
        self._poll_timer.timeout.connect(self._poll_network_log)
        self._poll_timer.start(500)
        
        # Safety timeout: stop polling after 30 seconds
        QTimer.singleShot(30000, self._stop_polling)
    
    def handle_execution_finished(self) -> None:
        """Called when execution completes"""
        # Do one final poll attempt
        self._poll_network_log()
        # Stop polling timer
        self._stop_polling()
    
    def _stop_polling(self) -> None:
        """Stop the log polling timer"""
        if self._poll_timer is not None:
            self._poll_timer.stop()
            self._poll_timer = None
        
        if self._active_pid is not None and self._latest_log_path is None:
            # Execution finished but no log found
            self._status_label.setText("Network blocking: completed (no log found)")
            self._note_box.setPlainText(
                "Network restriction was active but no wrapper log was detected.\n"
                "This may indicate the command finished too quickly or didn't use network APIs."
            )
    
    def _poll_network_log(self) -> None:
        """Check for network wrapper log file and display status"""
        if self._active_pid is None or not LOG_DIR.exists():
            return
        
        # Look for monitor_run logs (net_wrapper wraps commands that get monitored)
        # The monitor panel creates monitor_run_*_{pid}.jsonl files
        pattern = f"monitor_run_*_{self._active_pid}.jsonl"
        matching_logs = sorted(LOG_DIR.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
        
        if not matching_logs:
            return
        
        log_path = matching_logs[0]
        
        # Check if we've already processed this log
        if self._latest_log_path == str(log_path):
            return
        
        # Try to parse the log
        try:
            status_info = self._parse_network_log(log_path)
            if status_info:
                self._latest_log_path = str(log_path)
                self._display_network_status(status_info, log_path)
                # Stop polling once we have results
                if self._poll_timer is not None:
                    self._poll_timer.stop()
        except Exception as exc:
            # Continue polling on parse errors (file may still be writing)
            pass
    
    def _parse_network_log(self, log_path: Path) -> Optional[Dict]:
        """Parse network wrapper log to extract blocking status"""
        # Read JSONL format
        events = []
        try:
            with open(log_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        events.append(json.loads(line))
        except (OSError, json.JSONDecodeError):
            return None
        
        if not events:
            return None
        
        # Look for start/stop events
        start_event = next((e for e in events if e.get("event") == "start"), None)
        stop_event = next((e for e in events if e.get("event") == "stop"), None)
        
        if not stop_event:
            return None  # Execution not finished yet
        
        # Extract status information
        result = {
            "completed": True,
            "exit_code": stop_event.get("exit_code"),
            "samples": stop_event.get("samples", 0),
            "duration": stop_event.get("duration_seconds", 0),
        }
        
        # Check if net_wrapper was actually used (prepared_command would contain net_wrapper)
        if start_event:
            prepared = start_event.get("prepared_command", [])
            if isinstance(prepared, list):
                result["net_wrapper_used"] = "net_wrapper" in " ".join(prepared)
            else:
                result["net_wrapper_used"] = "net_wrapper" in str(prepared)
        
        return result
    
    def _display_network_status(self, status_info: Dict, log_path: Path) -> None:
        """Display network blocking status in the panel"""
        exit_code = status_info.get("exit_code")
        duration = status_info.get("duration", 0)
        net_wrapper_used = status_info.get("net_wrapper_used", False)
        
        if net_wrapper_used:
            status_msg = f"Network blocking: ACTIVE (exit code: {exit_code}, duration: {duration:.1f}s)"
            self._status_label.setText(status_msg)
            
            note_text = (
                f"Network restriction was enforced via monitor.net_wrapper.\n"
                f"Any network socket operations were blocked and logged.\n"
                f"Log: {log_path.name}"
            )
        else:
            status_msg = f"Network blocking: wrapped execution completed (exit code: {exit_code})"
            self._status_label.setText(status_msg)
            
            note_text = (
                f"Execution completed under monitoring.\n"
                f"Network restriction mode: {self._get_mode_description()}\n"
                f"Log: {log_path.name}"
            )
        
        self._note_box.setPlainText(note_text)
        
        # Add clickable log link if main window has log_output
        if hasattr(self._main_window, "log_output"):
            self._main_window.log_output(
                f"Network panel: execution finished, log at {log_path}\n",
                "info"
            )
    
    def _get_mode_description(self) -> str:
        """Get human-readable network mode description"""
        if not self.is_disabled():
            return "disabled (network enabled)"
        elif self.is_enforce_mode():
            return "enforce (seccomp - requires sudo)"
        else:
            return "dev-safe (wrapper mode)"


def attach_network_panel(main_window, layout) -> NetworkPanel:
    panel = NetworkPanel(main_window)
    layout.addWidget(panel)
    return panel
