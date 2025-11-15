from __future__ import annotations

import os
import signal
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Sequence, Tuple

from data.collector import TelemetryRun
from inference.ml_inference import MLInferenceEngine, PredictionResult
from monitor.resource_monitor import MonitorError, ProcessInspector, append_json_line, iso_timestamp

LOG_DIR = Path(__file__).resolve().parent / "logs"
EVENT_LOG = LOG_DIR / "ml_guard_events.jsonl"


@dataclass(slots=True)
class GuardConfig:
    poll_interval: float = 0.4
    min_samples: int = 8
    kill_threshold: float = 0.85


class MLGuard:
    def __init__(self, config: GuardConfig | None = None, engine: MLInferenceEngine | None = None) -> None:
        self._config = config or GuardConfig()
        self._engine = engine or MLInferenceEngine()
        self._threads: Dict[int, Tuple[threading.Thread, threading.Event]] = {}
        LOG_DIR.mkdir(parents=True, exist_ok=True)

    def watch(self, pid: int, jail_root: Path, command: Sequence[str], run_id: Optional[str] = None) -> None:
        if pid in self._threads:
            return
        stop_event = threading.Event()
        thread = threading.Thread(
            target=self._monitor_loop,
            args=(pid, Path(jail_root), tuple(command), stop_event, run_id or f"live-{pid}"),
            name=f"ml-guard-{pid}",
            daemon=True,
        )
        self._threads[pid] = (thread, stop_event)
        thread.start()

    def stop(self, pid: int) -> None:
        entry = self._threads.get(pid)
        if not entry:
            return
        _, stop_event = entry
        stop_event.set()
        self._threads.pop(pid, None)

    def _monitor_loop(
        self,
        pid: int,
        jail_root: Path,
        command: Tuple[str, ...],
        stop_event: threading.Event,
        run_id: str,
    ) -> None:
        try:
            inspector = ProcessInspector(pid)
        except MonitorError:
            return

        samples = []
        last_label: Optional[str] = None
        last_confidence: float = 0.0
        terminated = False

        start_event = {
            "event": "start",
            "timestamp": iso_timestamp(),
            "interval": self._config.poll_interval,
        }

        result: Optional[PredictionResult] = None

        while not stop_event.is_set() and inspector.is_running():
            try:
                sample = inspector.sample()
            except MonitorError:
                break

            sample_payload = {
                "event": "sample",
                "timestamp": sample.timestamp,
                "cpu_percent": sample.cpu_percent,
                "memory_rss": sample.memory_rss,
                "memory_vms": sample.memory_vms or sample.memory_rss,
                "threads": sample.threads,
                "open_files": sample.open_files or 0,
                "socket_count": 0,
                "read_bytes": sample.read_bytes or 0,
                "write_bytes": sample.write_bytes or 0,
            }
            samples.append(sample_payload)
            if len(samples) > 240:
                samples.pop(0)

            if len(samples) < self._config.min_samples:
                stop_event.wait(self._config.poll_interval)
                continue

            run = TelemetryRun(
                run_id=run_id,
                path=Path(f"live_{pid}.jsonl"),
                source="live",
                start_event=start_event,
                samples=list(samples),
                stop_event=None,
                label=None,
                summary=None,
            )
            result = self._engine.predict_run(run)

            if result.label == "malicious" and result.confidence >= self._config.kill_threshold:
                if _is_process_in_jail(pid, jail_root):
                    self._terminate(pid)
                    self._maybe_log_event(pid, command, run_id, result, action="terminated")
                    terminated = True
                else:
                    self._maybe_log_event(pid, command, run_id, result, action="skip-termination")
                break

            if result.label != last_label or abs(result.confidence - last_confidence) >= 0.2:
                last_label = result.label
                last_confidence = result.confidence
                self._maybe_log_event(pid, command, run_id, result, action="update")

            stop_event.wait(self._config.poll_interval)

        if result is not None and not terminated:
            self._maybe_log_event(pid, command, run_id, result, action="exit")

        self.stop(pid)

    def _maybe_log_event(
        self,
        pid: int,
        command: Tuple[str, ...],
        run_id: str,
        result: PredictionResult,
        action: str,
    ) -> None:
        payload = {
            "event": "ml_guard",
            "timestamp": iso_timestamp(),
            "pid": pid,
            "command": list(command),
            "run_id": run_id,
            "action": action,
            "label": result.label,
            "confidence": result.confidence,
            "probabilities": result.probabilities,
            "top_features": list(result.top_features),
        }
        append_json_line(EVENT_LOG, payload)

    def _terminate(self, pid: int) -> None:
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def _is_process_in_jail(pid: int, jail_root: Path) -> bool:
    try:
        cwd = Path(f"/proc/{pid}/cwd").resolve()
    except FileNotFoundError:
        return False
    jail_root = jail_root.resolve()
    try:
        return cwd == jail_root or str(cwd).startswith(str(jail_root) + "/")
    except RuntimeError:
        return False


__all__ = ["MLGuard", "GuardConfig"]
