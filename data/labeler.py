"""Label assignment logic for ZenCube Phase 4 datasets."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional

from .collector import FeatureVector


@dataclass(slots=True)
class AlertSignal:
    run_id: str
    metric: str
    value: float
    threshold: float
    severity: float


class RunLabeler:
    """Assigns semantic labels to telemetry runs using heuristics and alerts."""

    def __init__(self, alerts: Optional[Dict[str, List[AlertSignal]]] = None) -> None:
        self._alerts = alerts or {}

    def label(self, feature_vector: FeatureVector) -> str:
        run = feature_vector.run
        features = feature_vector.features
        label = (run.label or feature_vector.label or "").lower()
        if label in {"benign", "malicious", "unknown"}:
            return label

        run_alerts = self._alerts.get(run.run_id, [])
        if run_alerts:
            if any(alert.metric == "cpu_pct_high" or alert.metric == "rss_mb_high" for alert in run_alerts):
                return "malicious"

        if features["violation_count"] >= 1 or features["cpu_max"] >= 96.0:
            return "malicious"
        if features["rss_max"] >= 1.2 * 1024 * 1024 * 1024:
            return "malicious"
        if features["io_write_rate"] >= 140_000_000 or features["io_read_rate"] >= 140_000_000:
            return "malicious"
        if features["open_files_mean"] >= 180 or features["socket_count_mean"] >= 220:
            return "malicious"
        if features["cpu_slope"] >= 15.0 and features["cpu_mean"] >= 65.0:
            return "malicious"

        if features["cpu_mean"] <= 25.0 and features["rss_mean"] <= 280 * 1024 * 1024 and features["io_write_rate"] < 40_000_000:
            return "benign"
        if features["cpu_mean"] <= 55.0 and features["cpu_std"] <= 12.0 and features["rss_slope"] <= 1_000_000:
            return "benign"
        if features["time_above_cpu_50"] <= features["duration_seconds"] * 0.3 and features["io_read_rate"] <= 60_000_000:
            return "benign"

        return "unknown"


def load_alert_index(alert_log: Path) -> Dict[str, List[AlertSignal]]:
    if not alert_log.exists():
        return {}
    mapping: Dict[str, List[AlertSignal]] = {}
    with alert_log.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if entry.get("event") != "alert":
                continue
            run_id = str(entry.get("run_id", "unknown"))
            metric = str(entry.get("metric", "unknown"))
            try:
                value = float(entry.get("value", 0.0))
                threshold = float(entry.get("threshold", 0.0))
            except (TypeError, ValueError):
                value = 0.0
                threshold = 0.0
            severity = value - threshold
            mapping.setdefault(run_id, []).append(
                AlertSignal(
                    run_id=run_id,
                    metric=metric,
                    value=value,
                    threshold=threshold,
                    severity=severity,
                )
            )
    return mapping


def assign_labels(
    feature_vectors: Iterable[FeatureVector],
    alert_index: Optional[Dict[str, List[AlertSignal]]] = None,
) -> List[FeatureVector]:
    labeler = RunLabeler(alert_index)
    result: List[FeatureVector] = []
    for vector in feature_vectors:
        label = labeler.label(vector)
        vector.label = label
        vector.run.label = label
        result.append(vector)
    return result


__all__ = [
    "AlertSignal",
    "RunLabeler",
    "assign_labels",
    "load_alert_index",
]
