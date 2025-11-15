from __future__ import annotations

import collections
import json
import statistics
import threading
import time
from pathlib import Path
from typing import Deque, Dict, Iterable, List, Optional, Sequence

from PySide6.QtCore import Qt, Signal, QThread
from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QDoubleSpinBox,
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QSizePolicy,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from gui._mpl_canvas import MplCanvas
from monitor.alert_manager import AlertManager, AlertRecord
from monitor.log_rotate import KEEP_LAST_N, rotate_logs
from monitor.prometheus_exporter import PrometheusExporter
from monitor.resource_monitor import (
    MonitorError,
    ProcessInspector,
    Sample,
    append_json_line,
    build_log_path,
    default_log_dir,
    format_command,
    iso_timestamp,
)

_DEFAULT_WINDOW = 60
_WINDOW_CHOICES = (30, 60, 120)
_DEFAULT_ALPHA = 0.3
_MIN_ALPHA = 0.01
_MAX_ALPHA = 1.0
_MB_DIVISOR = 1024.0 * 1024.0


class _MonitorWorker(QThread):
    sample_ready = Signal(object)
    summary_ready = Signal(dict, str)
    failed = Signal(str)
    rotation_complete = Signal(dict)

    def __init__(
        self,
        pid: int,
        raw_command: Sequence[str],
        prepared_command: Sequence[str],
        interval: float,
        log_dir: Path,
        parent: Optional[QWidget] = None,
    ) -> None:
        super().__init__(parent)
        self._pid = pid
        self._raw_command = list(raw_command)
        self._prepared_command = list(prepared_command)
        self._interval = max(interval, 0.1)
        self._stop_event = threading.Event()
        self._exit_code: Optional[int] = None
        self._log_path: Optional[Path] = None
        self._log_dir = log_dir

    @property
    def interval(self) -> float:
        return self._interval

    def stop(self) -> None:
        self._stop_event.set()

    def set_exit_code(self, code: Optional[int]) -> None:
        self._exit_code = code

    def log_path(self) -> Optional[Path]:
        return self._log_path

    def run(self) -> None:  # noqa: D401 - QThread entry point
        try:
            inspector = ProcessInspector(self._pid)
        except MonitorError as exc:
            self.failed.emit(str(exc))
            return

        try:
            rotation = rotate_logs(self._log_dir, keep=KEEP_LAST_N)
            self.rotation_complete.emit(
                {
                    "kept": rotation.kept,
                    "archived": rotation.archived,
                    "skipped": [str(path) for path in rotation.skipped],
                }
            )
        except Exception as exc:  # pragma: no cover - defensive
            self.rotation_complete.emit({"error": str(exc)})

        self._log_dir.mkdir(parents=True, exist_ok=True)
        self._log_path = build_log_path(self._log_dir, "monitor_run", inspector.pid)
        start_ts = iso_timestamp()
        start_time = time.monotonic()
        samples = 0
        max_cpu = 0.0
        max_rss = 0
        peak_open_files = 0

        append_json_line(
            self._log_path,
            {
                "event": "start",
                "timestamp": start_ts,
                "pid": self._pid,
                "raw_command": format_command(self._raw_command),
                "prepared_command": format_command(self._prepared_command),
                "interval": self._interval,
            },
        )

        while not self._stop_event.is_set():
            if not inspector.is_running():
                break
            time.sleep(self._interval)
            try:
                sample = inspector.sample()
            except MonitorError as exc:
                if inspector.is_running():
                    self.failed.emit(str(exc))
                    return
                break

            append_json_line(self._log_path, sample.to_dict())
            self.sample_ready.emit(sample)
            samples += 1
            max_cpu = max(max_cpu, float(sample.cpu_percent))
            max_rss = max(max_rss, int(sample.memory_rss))
            if sample.open_files is not None:
                peak_open_files = max(peak_open_files, sample.open_files)

        duration = time.monotonic() - start_time
        if self._exit_code is None:
            self._stop_event.wait(0.2)
        summary = {
            "event": "stop",
            "timestamp": iso_timestamp(),
            "samples": samples,
            "duration_seconds": round(duration, 3),
            "max_cpu_percent": round(max_cpu, 2),
            "max_memory_rss": max_rss,
            "peak_open_files": peak_open_files,
            "exit_code": self._exit_code,
        }
        append_json_line(self._log_path, summary)
        self.summary_ready.emit(summary, str(self._log_path))


class _AlertDialog(QDialog):
    def __init__(self, parent: QWidget, alerts: List[AlertRecord], acknowledge_cb) -> None:
        super().__init__(parent)
        self.setWindowTitle("Active Alerts")
        self.setModal(True)

        layout = QVBoxLayout(self)
        if not alerts:
            message = QLabel("No active alerts.")
            message.setAlignment(Qt.AlignCenter)
            layout.addWidget(message)
        else:
            for alert in alerts:
                card = QFrame()
                card.setFrameShape(QFrame.StyledPanel)
                card_layout = QVBoxLayout(card)
                title = QLabel(f"{alert.metric} — triggered {alert.triggered_at}")
                title.setStyleSheet("font-weight: 600; color: #742a2a;")
                details = QLabel(
                    f"Value: {alert.value:.2f} (threshold {alert.threshold:.2f})\nRun: {alert.run_id}"
                )
                ack_btn = QPushButton("Acknowledge")
                ack_btn.clicked.connect(
                    lambda _=False, aid=alert.alert_id, button=ack_btn: self._acknowledge(
                        acknowledge_cb, aid, button
                    )
                )
                card_layout.addWidget(title)
                card_layout.addWidget(details)
                card_layout.addWidget(ack_btn, alignment=Qt.AlignRight)
                layout.addWidget(card)

        button_box = QDialogButtonBox(QDialogButtonBox.Close)
        button_box.rejected.connect(self.reject)
        button_box.accepted.connect(self.accept)
        layout.addWidget(button_box)

    @staticmethod
    def _acknowledge(callback, alert_id: str, button: QPushButton) -> None:
        if callback(alert_id):
            button.setEnabled(False)
            button.setText("Acknowledged")


class MonitoringPanel(QWidget):
    """Native PySide6 dashboard that visualises resource usage samples."""

    def __init__(self, main_window, parent: Optional[QWidget] = None) -> None:
        super().__init__(parent)
        self._main_window = main_window
        self._worker: Optional[_MonitorWorker] = None
        self._log_dir = default_log_dir()
        self._alert_manager = AlertManager(self._log_dir)
        self._prom_exporter = PrometheusExporter.from_env()
        self._prom_exporter.start()

        self._latest_log_path: Optional[str] = None
        self._last_summary: Optional[dict] = None
        self._recent_samples: Deque[str] = collections.deque(maxlen=8)
        self._active_pid: Optional[int] = None

        self._window_size = _DEFAULT_WINDOW
        self._alpha = _DEFAULT_ALPHA
        self._paused = False
        self._sample_counter = 0
        self._current_run_id: Optional[str] = None
        self._cpu_series: Deque[float] = collections.deque(maxlen=self._window_size)
        self._rss_series: Deque[float] = collections.deque(maxlen=self._window_size)
        self._sample_indices: Deque[int] = collections.deque(maxlen=self._window_size)

        self._cpu_fill = None
        self._rss_fill = None

        self._build_ui()
        self._connect_signals()
        self._reset_series()

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(8)

        header = QLabel("📊 Monitoring Dashboard")
        header.setStyleSheet("font-size: 18px; font-weight: bold; color: #2d3748;")
        layout.addWidget(header)

        control_row = QGridLayout()
        control_row.setHorizontalSpacing(10)
        control_row.setVerticalSpacing(6)

        self.enable_check = QCheckBox("Enable monitoring for executions")
        self.enable_check.setToolTip("Collect CPU and memory samples while a command runs.")
        control_row.addWidget(self.enable_check, 0, 0, 1, 3)

        interval_label = QLabel("Interval (seconds):")
        interval_label.setStyleSheet("font-weight: 600; color: #4a5568;")
        control_row.addWidget(interval_label, 1, 0)

        self.interval_spin = QDoubleSpinBox()
        self.interval_spin.setDecimals(1)
        self.interval_spin.setMinimum(0.2)
        self.interval_spin.setMaximum(5.0)
        self.interval_spin.setSingleStep(0.2)
        self.interval_spin.setValue(1.0)
        control_row.addWidget(self.interval_spin, 1, 1)

        window_label = QLabel("Window (samples):")
        window_label.setStyleSheet("font-weight: 600; color: #4a5568;")
        control_row.addWidget(window_label, 1, 2)

        self.window_combo = QComboBox()
        for value in _WINDOW_CHOICES:
            self.window_combo.addItem(str(value), value)
        self.window_combo.setCurrentText(str(_DEFAULT_WINDOW))
        control_row.addWidget(self.window_combo, 1, 3)

        alpha_label = QLabel("EWMA α:")
        alpha_label.setStyleSheet("font-weight: 600; color: #4a5568;")
        control_row.addWidget(alpha_label, 1, 4)

        self.alpha_spin = QDoubleSpinBox()
        self.alpha_spin.setDecimals(2)
        self.alpha_spin.setMinimum(_MIN_ALPHA)
        self.alpha_spin.setMaximum(_MAX_ALPHA)
        self.alpha_spin.setSingleStep(0.05)
        self.alpha_spin.setValue(_DEFAULT_ALPHA)
        control_row.addWidget(self.alpha_spin, 1, 5)

        self.pause_btn = QPushButton("Pause Charts")
        control_row.addWidget(self.pause_btn, 2, 0)

        self.rotate_btn = QPushButton("Rotate Logs")
        control_row.addWidget(self.rotate_btn, 2, 1)

        self.alert_btn = QPushButton("Alerts (0)")
        self.alert_btn.setStyleSheet(
            "QPushButton { background: #edf2f7; color: #2d3748; border-radius: 6px; padding: 6px 12px; }"
        )
        control_row.addWidget(self.alert_btn, 2, 2)

        layout.addLayout(control_row)

        charts_row = QHBoxLayout()
        charts_row.setSpacing(12)

        self.cpu_canvas = MplCanvas(self, width=5.5, height=3.0, dpi=100)
        self.cpu_canvas.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
        self.cpu_canvas.axes.set_title("CPU Usage (%)")
        self.cpu_canvas.axes.set_xlabel("Sample #")
        self.cpu_canvas.axes.set_ylabel("Percent")
        self.cpu_canvas.axes.grid(True, alpha=0.2)
        self._cpu_raw_line = self.cpu_canvas.axes.plot([], [], color="#2b6cb0", label="Raw")[0]
        self._cpu_ewma_line = self.cpu_canvas.axes.plot([], [], linestyle="--", color="#63b3ed", label="EWMA")[0]
        self._cpu_mean_line = self.cpu_canvas.axes.axhline(0, color="#4a5568", linestyle=":", linewidth=1, label="Mean")
        self.cpu_canvas.axes.legend(loc="upper left", frameon=False)
        charts_row.addWidget(self.cpu_canvas)

        self.mem_canvas = MplCanvas(self, width=5.5, height=3.0, dpi=100)
        self.mem_canvas.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
        self.mem_canvas.axes.set_title("Memory RSS (MB)")
        self.mem_canvas.axes.set_xlabel("Sample #")
        self.mem_canvas.axes.set_ylabel("Megabytes")
        self.mem_canvas.axes.grid(True, alpha=0.2)
        self._rss_raw_line = self.mem_canvas.axes.plot([], [], color="#38a169", label="Raw")[0]
        self._rss_ewma_line = self.mem_canvas.axes.plot([], [], linestyle="--", color="#68d391", label="EWMA")[0]
        self._rss_mean_line = self.mem_canvas.axes.axhline(0, color="#22543d", linestyle=":", linewidth=1, label="Mean")
        self.mem_canvas.axes.legend(loc="upper left", frameon=False)
        charts_row.addWidget(self.mem_canvas)

        layout.addLayout(charts_row)

        self.latest_values_label = QLabel("Last sample: (no data)")
        self.latest_values_label.setStyleSheet("color: #2d3748; font-size: 12px;")
        layout.addWidget(self.latest_values_label)

        self.status_label = QLabel("Status: idle")
        self.status_label.setStyleSheet("color: #4a5568;")
        layout.addWidget(self.status_label)

        self.summary_label = QLabel("Summary: (no data)")
        self.summary_label.setStyleSheet("color: #4a5568; font-size: 12px;")
        layout.addWidget(self.summary_label)

        self.log_label = QLabel("Log: (none)")
        self.log_label.setOpenExternalLinks(True)
        self.log_label.setTextInteractionFlags(Qt.TextBrowserInteraction)
        layout.addWidget(self.log_label)

        self.sample_view = QTextEdit()
        self.sample_view.setReadOnly(True)
        self.sample_view.setFixedHeight(130)
        self.sample_view.setStyleSheet(
            "QTextEdit { background-color: #f7fafc; border: 1px solid #e2e8f0; "
            "border-radius: 8px; padding: 6px; font-family: Consolas, monospace; font-size: 12px; }"
        )
        self.sample_view.setPlaceholderText("Enable monitoring to view live samples.")
        layout.addWidget(self.sample_view)

    def _connect_signals(self) -> None:
        self.enable_check.toggled.connect(self._on_enable_toggled)
        self.window_combo.currentIndexChanged.connect(self._on_window_changed)
        self.alpha_spin.valueChanged.connect(self._on_alpha_changed)
        self.pause_btn.clicked.connect(self._toggle_pause)
        self.rotate_btn.clicked.connect(self._handle_rotate_clicked)
        self.alert_btn.clicked.connect(self._show_alerts)

    def is_enabled(self) -> bool:
        return self.enable_check.isChecked()

    def latest_log_path(self) -> Optional[str]:
        return self._latest_log_path

    def last_summary(self) -> Optional[dict]:
        return self._last_summary

    def is_active(self) -> bool:
        return self._worker is not None and self._worker.isRunning()

    def attach_to_process(
        self,
        pid: int,
        raw_command: Sequence[str],
        prepared_command: Sequence[str],
    ) -> None:
        if not self.is_enabled():
            return
        self._cleanup_worker()
        self._active_pid = pid
        self._latest_log_path = None
        self._last_summary = None
        self._recent_samples.clear()
        self.sample_view.clear()
        self._reset_series()
        self.summary_label.setText("Summary: collecting...")
        self.log_label.setText("Log: (pending)")
        self.status_label.setText(f"Status: monitoring pid {pid}")
        self._sample_counter = 0
        self._current_run_id = f"run-{iso_timestamp().replace(':', '').replace('-', '')}-{pid}"
        self._alert_manager.reset_for_run(self._current_run_id)

        interval = float(self.interval_spin.value())
        self._worker = _MonitorWorker(pid, raw_command, prepared_command, interval, self._log_dir, self)
        self._worker.sample_ready.connect(self._on_sample)
        self._worker.summary_ready.connect(self._on_summary)
        self._worker.failed.connect(self._on_failure)
        self._worker.rotation_complete.connect(self._on_rotation_complete)
        self._worker.start()
        self._log(f"Monitoring started for pid {pid}.\n", "info")

    def handle_process_finished(self, exit_code: Optional[int]) -> None:
        if self._worker is None:
            return
        self._worker.set_exit_code(exit_code)
        self._worker.stop()
        self._log(f"Monitoring stopping (exit code {exit_code}).\n", "info")

    def shutdown(self) -> None:
        self._cleanup_worker()

    def _cleanup_worker(self) -> None:
        if self._worker is None:
            return
        self._worker.stop()
        self._worker.wait(2000)
        self._worker = None
        self._active_pid = None

    def _reset_series(self, preserve: bool = False) -> None:
        if preserve:
            self._cpu_series = collections.deque(self._cpu_series, maxlen=self._window_size)
            self._rss_series = collections.deque(self._rss_series, maxlen=self._window_size)
            self._sample_indices = collections.deque(self._sample_indices, maxlen=self._window_size)
        else:
            self._cpu_series = collections.deque(maxlen=self._window_size)
            self._rss_series = collections.deque(maxlen=self._window_size)
            self._sample_indices = collections.deque(maxlen=self._window_size)
        self._update_chart_visuals(force=True)

    def _on_enable_toggled(self, checked: bool) -> None:
        if not checked:
            self.status_label.setText("Status: idle")
            self.sample_view.setPlaceholderText("Enable monitoring to view live samples.")
            self._cleanup_worker()
            self._recent_samples.clear()
            self.sample_view.clear()
            self.summary_label.setText("Summary: (no data)")
            self.log_label.setText("Log: (none)")
            self._reset_series()
        else:
            self.status_label.setText("Status: armed for next execution")

    def _on_window_changed(self) -> None:
        choice = self.window_combo.currentData()
        if not choice:
            return
        self._window_size = int(choice)
        self._reset_series(preserve=True)

    def _on_alpha_changed(self, value: float) -> None:
        self._alpha = float(value)
        self._update_chart_visuals(force=True)

    def _toggle_pause(self) -> None:
        self._paused = not self._paused
        if self._paused:
            self.pause_btn.setText("Resume Charts")
        else:
            self.pause_btn.setText("Pause Charts")
            self._update_chart_visuals(force=True)

    def _handle_rotate_clicked(self) -> None:
        try:
            result = rotate_logs(self._log_dir, keep=KEEP_LAST_N)
            skipped = len(result.skipped)
            message = (
                f"Log rotation complete: kept {result.kept}, archived {result.archived}, "
                f"skipped {skipped}."
            )
            level = "warning" if skipped else "info"
            self._log(message + "\n", level)
            if skipped:
                for path in result.skipped:
                    self._log(f"Skipped (could not rotate): {path}\n", "warning")
        except Exception as exc:  # pragma: no cover - defensive
            self._log(f"Log rotation failed: {exc}\n", "error")

    def _show_alerts(self) -> None:
        dialog = _AlertDialog(self, self._alert_manager.active_alerts(), self._ack_alert)
        dialog.exec()
        self._update_alert_badge()

    def _ack_alert(self, alert_id: str) -> bool:
        acknowledged = self._alert_manager.acknowledge(alert_id)
        if acknowledged:
            self._log(f"Alert {alert_id} acknowledged.\n", "info")
        return acknowledged

    def _on_rotation_complete(self, payload: Dict[str, object]) -> None:
        if "error" in payload:
            self._log(f"Log rotation failed: {payload['error']}\n", "error")
            return
        kept = payload.get("kept", 0)
        archived = payload.get("archived", 0)
        skipped = payload.get("skipped", []) or []
        message = f"Pre-run rotation: kept {kept}, archived {archived}, skipped {len(skipped)}"
        level = "warning" if skipped else "info"
        self._log(message + "\n", level)
        if skipped:
            for entry in skipped:
                self._log(f"Skipped (in use?): {entry}\n", "warning")

    def _on_sample(self, sample: Sample) -> None:
        rss_mb = sample.memory_rss / _MB_DIVISOR
        entry = (
            f"{sample.timestamp} | CPU {sample.cpu_percent:.1f}% | RSS {rss_mb:.1f} MB | Threads {sample.threads}"
        )
        if sample.open_files is not None:
            entry += f" | FDs {sample.open_files}"
        self._recent_samples.append(entry)
        self.sample_view.setPlainText("\n".join(self._recent_samples))
        self.sample_view.verticalScrollBar().setValue(self.sample_view.verticalScrollBar().maximum())
        self.status_label.setText(f"Status: monitoring pid {self._active_pid}")

        self._sample_counter += 1
        self._sample_indices.append(self._sample_counter)
        self._cpu_series.append(float(sample.cpu_percent))
        self._rss_series.append(rss_mb)
        self._process_alerts(sample)
        self._update_alert_badge()
        if not self._paused:
            self._update_chart_visuals()
        if self._prom_exporter.is_enabled() and self._current_run_id:
            self._prom_exporter.record_sample(self._current_run_id, sample)

    def _update_alert_badge(self) -> None:
        count = self._alert_manager.alert_count()
        self.alert_btn.setText(f"Alerts ({count})")
        if count:
            self.alert_btn.setStyleSheet(
                "QPushButton { background: #fed7d7; color: #742a2a; font-weight: 600; border-radius: 6px; padding: 6px 12px; }"
            )
        else:
            self.alert_btn.setStyleSheet(
                "QPushButton { background: #edf2f7; color: #2d3748; border-radius: 6px; padding: 6px 12px; }"
            )

    def _process_alerts(self, sample: Sample) -> None:
        if self._worker is None:
            return
        new_alerts = self._alert_manager.evaluate(sample, self._worker.interval)
        for alert in new_alerts:
            metric = "CPU" if alert.metric == "cpu_pct_high" else "Memory"
            self._log(
                f"Alert triggered ({metric}): value {alert.value:.2f} exceeded threshold {alert.threshold:.2f} for "
                f"{alert.duration_sec:.1f}s.\n",
                "warning",
            )

    def _update_chart_visuals(self, force: bool = False) -> None:
        if not self._cpu_series and not force:
            return
        self._update_chart(
            canvas=self.cpu_canvas,
            raw_line=self._cpu_raw_line,
            ewma_line=self._cpu_ewma_line,
            mean_line=self._cpu_mean_line,
            fill_attr="_cpu_fill",
            values=self._cpu_series,
            tooltip_format="Latest raw: {raw:.2f}% | EWMA: {ewma:.2f}%\nMean: {mean:.2f}% | Range: {mins:.2f}% – {maxs:.2f}%",
        )
        self._update_chart(
            canvas=self.mem_canvas,
            raw_line=self._rss_raw_line,
            ewma_line=self._rss_ewma_line,
            mean_line=self._rss_mean_line,
            fill_attr="_rss_fill",
            values=self._rss_series,
            tooltip_format="Latest raw: {raw:.2f} MB | EWMA: {ewma:.2f} MB\nMean: {mean:.2f} MB | Range: {mins:.2f} – {maxs:.2f} MB",
        )
        if self._cpu_series:
            self.latest_values_label.setText(
                f"Last sample → CPU {self._cpu_series[-1]:.1f}% | RSS {self._rss_series[-1]:.1f} MB (α={self._alpha:.2f})"
            )
        else:
            self.latest_values_label.setText("Last sample: (no data)")

    def _compute_ewma(self, values: Iterable[float]) -> List[float]:
        iterator = list(values)
        if not iterator:
            return []
        acc = iterator[0]
        results = [acc]
        for value in iterator[1:]:
            acc = self._alpha * value + (1.0 - self._alpha) * acc
            results.append(acc)
        return results

    def _update_chart(
        self,
        *,
        canvas: MplCanvas,
        raw_line,
        ewma_line,
        mean_line,
        fill_attr: str,
        values: Deque[float],
        tooltip_format: str,
    ) -> None:
        x_values = list(self._sample_indices)[-len(values) :]
        y_values = list(values)
        ewma_values = self._compute_ewma(y_values)

        raw_line.set_data(x_values, y_values)
        ewma_line.set_data(x_values, ewma_values)

        if x_values:
            min_val = min(y_values)
            max_val = max(y_values)
            mean_val = statistics.fmean(y_values)
            x_min = x_values[0]
            x_max = x_values[-1] if len(x_values) > 1 else x_values[0] + 1
            canvas.axes.set_xlim(x_min, x_max)
            data_min = min(min_val, min(ewma_values) if ewma_values else min_val)
            data_max = max(max_val, max(ewma_values) if ewma_values else max_val)
            if data_min == data_max:
                data_min -= 1
                data_max += 1
            padding = max((data_max - data_min) * 0.1, 1.0)
            canvas.axes.set_ylim(data_min - padding, data_max + padding)

            existing_fill = getattr(self, fill_attr, None)
            if existing_fill is not None:
                existing_fill.remove()
            fill = canvas.axes.fill_between(
                x_values,
                [min_val] * len(x_values),
                [max_val] * len(x_values),
                color="#cbd5f5" if canvas is self.cpu_canvas else "#c6f6d5",
                alpha=0.3,
            )
            setattr(self, fill_attr, fill)

            mean_line.set_data([x_values[0], x_values[-1]], [mean_val, mean_val])
            tooltip = tooltip_format.format(
                raw=y_values[-1],
                ewma=ewma_values[-1] if ewma_values else y_values[-1],
                mean=mean_val,
                mins=min_val,
                maxs=max_val,
            )
            canvas.setToolTip(tooltip)
        else:
            canvas.axes.set_xlim(0, self._window_size)
            canvas.axes.set_ylim(0, 1)
            mean_line.set_data([], [])
            existing_fill = getattr(self, fill_attr, None)
            if existing_fill is not None:
                existing_fill.remove()
            setattr(self, fill_attr, None)
            canvas.setToolTip("No samples yet.")

        canvas.draw_idle()

    def _on_summary(self, summary: dict, log_path: str) -> None:
        self._latest_log_path = log_path
        self._last_summary = summary
        cpu = summary.get("max_cpu_percent", 0.0)
        rss = summary.get("max_memory_rss", 0)
        rss_mb = rss / _MB_DIVISOR
        duration = summary.get("duration_seconds", 0)
        samples = summary.get("samples", 0)
        self.summary_label.setText(
            "Summary: samples {} | duration {}s | peak CPU {:.1f}% | peak RSS {:.1f} MB".format(
                samples,
                duration,
                cpu,
                rss_mb,
            )
        )
        self.log_label.setText(f'<a href="file://{log_path}">Log: {log_path}</a>')
        self.status_label.setText("Status: idle")
        if self._prom_exporter.is_enabled() and self._current_run_id:
            self._prom_exporter.clear_run(self._current_run_id)
        self._cleanup_worker()

    def _on_failure(self, message: str) -> None:
        self.status_label.setText("Status: monitoring failed")
        self.sample_view.append(f"Error: {message}")
        self._log(f"Monitoring failed: {message}\n", "error")
        self._cleanup_worker()

    def _log(self, message: str, level: str) -> None:
        logger = getattr(self._main_window, "log_output", None)
        if callable(logger):
            logger(message, level)


def attach_monitor_panel(main_window, layout) -> MonitoringPanel:
    panel = MonitoringPanel(main_window)
    layout.addWidget(panel)
    return panel
