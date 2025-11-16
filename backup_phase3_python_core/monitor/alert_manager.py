from __future__ import annotations

import json
import threading
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional

from .resource_monitor import Sample, append_json_line, default_log_dir, iso_timestamp

DEFAULT_CONFIG = {
    "cpu_pct_high": 90.0,
    "rss_mb_high": 500.0,
    "duration_sec": 3.0,
}


@dataclass
class AlertRecord:
    alert_id: str
    metric: str
    run_id: str
    triggered_at: str
    value: float
    threshold: float
    duration_sec: float
    acknowledged: bool = False
    acknowledged_at: Optional[str] = None
    acknowledged_by: Optional[str] = None

    def as_dict(self) -> Dict[str, object]:
        return {
            "alert_id": self.alert_id,
            "metric": self.metric,
            "run_id": self.run_id,
            "triggered_at": self.triggered_at,
            "value": self.value,
            "threshold": self.threshold,
            "duration_sec": self.duration_sec,
            "acknowledged": self.acknowledged,
            "acknowledged_at": self.acknowledged_at,
            "acknowledged_by": self.acknowledged_by,
        }


class AlertManager:
    """Evaluates monitoring samples against configurable thresholds."""

    def __init__(self, log_dir: Optional[Path] = None, config_path: Optional[Path] = None) -> None:
        self._log_dir = default_log_dir() if log_dir is None else log_dir
        self._log_dir.mkdir(parents=True, exist_ok=True)
        self._config_path = config_path or (self._log_dir.parent / "alerting.json")
        self._log_path = self._log_dir / "alerts.jsonl"
        self._config = self._load_config()
        self._lock = threading.Lock()
        self._active_alerts: Dict[str, AlertRecord] = {}
        self._active_by_metric: Dict[str, str] = {}
        self._metric_counters: Dict[str, float] = {
            "cpu_pct_high": 0.0,
            "rss_mb_high": 0.0,
        }
        self._current_run_id: Optional[str] = None
        self._load_existing_alerts()

    # ------------------------------------------------------------------
    # Configuration & persistence helpers
    # ------------------------------------------------------------------
    def _load_config(self) -> Dict[str, float]:
        if self._config_path and self._config_path.exists():
            try:
                data = json.loads(self._config_path.read_text(encoding="utf-8"))
                merged = {**DEFAULT_CONFIG, **{k: float(v) for k, v in data.items() if k in DEFAULT_CONFIG}}
                return merged
            except (ValueError, TypeError):
                return dict(DEFAULT_CONFIG)
        return dict(DEFAULT_CONFIG)

    def _load_existing_alerts(self) -> None:
        if not self._log_path.exists():
            return
        try:
            for line in self._log_path.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                entry = json.loads(line)
                event = entry.get("event")
                if event == "alert":
                    record = AlertRecord(
                        alert_id=entry["alert_id"],
                        metric=entry["metric"],
                        run_id=entry.get("run_id", "unknown"),
                        triggered_at=entry.get("triggered_at", iso_timestamp()),
                        value=float(entry.get("value", 0.0)),
                        threshold=float(entry.get("threshold", 0.0)),
                        duration_sec=float(entry.get("duration_sec", self._config["duration_sec"])),
                        acknowledged=bool(entry.get("acknowledged", False)),
                        acknowledged_at=entry.get("acknowledged_at"),
                        acknowledged_by=entry.get("acknowledged_by"),
                    )
                    if not record.acknowledged:
                        self._active_alerts[record.alert_id] = record
                        self._active_by_metric.setdefault(record.metric, record.alert_id)
                elif event == "ack":
                    alert_id = entry.get("alert_id")
                    ack_time = entry.get("timestamp")
                    ack_by = entry.get("ack_by")
                    record = self._active_alerts.get(alert_id)
                    if record:
                        record.acknowledged = True
                        record.acknowledged_at = ack_time
                        record.acknowledged_by = ack_by
                        self._active_alerts.pop(alert_id, None)
                        self._active_by_metric.pop(record.metric, None)
        except (OSError, ValueError):
            # Corrupt log entries should not break runtime behaviour.
            self._active_alerts.clear()
            self._active_by_metric.clear()

    def _write_entry(self, payload: Dict[str, object]) -> None:
        append_json_line(self._log_path, payload)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def reset_for_run(self, run_id: str) -> None:
        with self._lock:
            self._current_run_id = run_id
            for key in self._metric_counters:
                self._metric_counters[key] = 0.0

    def evaluate(self, sample: Sample, interval: float) -> List[AlertRecord]:
        alerts: List[AlertRecord] = []
        rss_mb = sample.memory_rss / (1024.0 * 1024.0)
        cpu_threshold = self._config["cpu_pct_high"]
        rss_threshold = self._config["rss_mb_high"]
        duration = self._config["duration_sec"]

        with self._lock:
            cpu_counter = self._metric_counters["cpu_pct_high"]
            rss_counter = self._metric_counters["rss_mb_high"]

            if sample.cpu_percent >= cpu_threshold:
                cpu_counter += interval
            else:
                cpu_counter = 0.0

            if rss_mb >= rss_threshold:
                rss_counter += interval
            else:
                rss_counter = 0.0

            self._metric_counters["cpu_pct_high"] = cpu_counter
            self._metric_counters["rss_mb_high"] = rss_counter

            if (
                cpu_counter >= duration
                and "cpu_pct_high" not in self._active_by_metric
            ):
                alerts.append(self._create_alert("cpu_pct_high", sample.cpu_percent, cpu_threshold))

            if (
                rss_counter >= duration
                and "rss_mb_high" not in self._active_by_metric
            ):
                alerts.append(self._create_alert("rss_mb_high", rss_mb, rss_threshold))

        return alerts

    def active_alerts(self) -> List[AlertRecord]:
        with self._lock:
            return sorted(self._active_alerts.values(), key=lambda item: item.triggered_at)

    def acknowledge(self, alert_id: str, ack_by: str = "GUI") -> bool:
        with self._lock:
            record = self._active_alerts.get(alert_id)
            if not record:
                return False
            record.acknowledged = True
            record.acknowledged_at = iso_timestamp()
            record.acknowledged_by = ack_by
            self._active_alerts.pop(alert_id, None)
            self._active_by_metric.pop(record.metric, None)
            self._write_entry(
                {
                    "event": "ack",
                    "alert_id": record.alert_id,
                    "timestamp": record.acknowledged_at,
                    "ack_by": ack_by,
                }
            )
            return True

    def alert_count(self) -> int:
        with self._lock:
            return len(self._active_alerts)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _create_alert(self, metric: str, value: float, threshold: float) -> AlertRecord:
        alert_id = uuid.uuid4().hex
        run_id = self._current_run_id or "unknown"
        record = AlertRecord(
            alert_id=alert_id,
            metric=metric,
            run_id=run_id,
            triggered_at=iso_timestamp(),
            value=float(value),
            threshold=float(threshold),
            duration_sec=float(self._config["duration_sec"]),
        )
        self._active_alerts[alert_id] = record
        self._active_by_metric[metric] = alert_id
        self._write_entry(
            {
                "event": "alert",
                **record.as_dict(),
            }
        )
        return record


__all__ = ["AlertManager", "AlertRecord", "DEFAULT_CONFIG"]
