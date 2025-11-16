from __future__ import annotations

import datetime as dt
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional, Sequence

try:
    import psutil  # type: ignore
except Exception:  # pragma: no cover - psutil is optional
    psutil = None  # type: ignore


_LOG_DIR_ENV = "MONITOR_LOG_DIR"
_DEFAULT_LOG_DIR = Path(__file__).resolve().parent / "logs"


class MonitorError(RuntimeError):
    """Raised when the monitoring subsystem cannot observe a process."""


@dataclass(slots=True)
class Sample:
    """Represents a single process resource snapshot."""

    timestamp: str
    cpu_percent: float
    memory_rss: int
    memory_vms: Optional[int]
    threads: int
    open_files: Optional[int]
    read_bytes: Optional[int]
    write_bytes: Optional[int]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event": "sample",
            "timestamp": self.timestamp,
            "cpu_percent": round(self.cpu_percent, 2),
            "memory_rss": self.memory_rss,
            "memory_vms": self.memory_vms,
            "threads": self.threads,
            "open_files": self.open_files,
            "read_bytes": self.read_bytes,
            "write_bytes": self.write_bytes,
        }


class ProcessInspector:
    """Collects lightweight metrics for a running process.

    The inspector prefers :mod:`psutil` when available and falls back to parsing
    ``/proc/<pid>`` on Linux hosts. Only the metrics required by the GUI
    dashboard are exposed to keep the implementation straightforward.
    """

    def __init__(self, pid: int) -> None:
        self._pid = pid
        self._cpu_count = os.cpu_count() or 1
        self._psutil_proc = None
        self._last_total_time: Optional[int] = None
        self._last_timestamp: Optional[float] = None
        self._clock_ticks: Optional[int] = None
        self._page_size: Optional[int] = None

        if psutil is not None:
            try:
                proc = psutil.Process(pid)
                proc.cpu_percent(None)
            except (psutil.NoSuchProcess, psutil.AccessDenied) as exc:  # type: ignore[attr-defined]
                raise MonitorError(f"Unable to monitor process {pid}: {exc}") from exc
            self._psutil_proc = proc
        else:
            stat_path = Path(f"/proc/{pid}/stat")
            if not stat_path.exists():
                raise MonitorError(f"Process {pid} is not running or /proc is unavailable.")
            self._clock_ticks = int(os.sysconf(os.sysconf_names["SC_CLK_TCK"]))
            self._page_size = int(os.sysconf(os.sysconf_names["SC_PAGE_SIZE"]))
            self._prime_fallback()

    @property
    def pid(self) -> int:
        return self._pid

    def is_running(self) -> bool:
        if self._psutil_proc is not None:
            try:
                return self._psutil_proc.is_running() and not self._psutil_proc.status() == getattr(psutil, "STATUS_ZOMBIE", "zombie")
            except psutil.Error:  # type: ignore[attr-defined]
                return False
        return Path(f"/proc/{self._pid}").exists()

    def sample(self) -> Sample:
        timestamp = dt.datetime.now(dt.timezone.utc).isoformat()
        if self._psutil_proc is not None:
            return self._sample_with_psutil(timestamp)
        return self._sample_fallback(timestamp)

    def _sample_with_psutil(self, timestamp: str) -> Sample:
        assert self._psutil_proc is not None
        try:
            cpu_percent = float(self._psutil_proc.cpu_percent(interval=None))
            mem = self._psutil_proc.memory_info()
            threads = self._psutil_proc.num_threads()
            try:
                open_files = len(self._psutil_proc.open_files())
            except psutil.Error:  # type: ignore[attr-defined]
                open_files = None
            try:
                io = self._psutil_proc.io_counters()
            except psutil.Error:  # type: ignore[attr-defined]
                io = None
        except psutil.NoSuchProcess as exc:  # type: ignore[attr-defined]
            raise MonitorError(f"Process {self._pid} exited during sampling") from exc

        return Sample(
            timestamp=timestamp,
            cpu_percent=cpu_percent,
            memory_rss=int(getattr(mem, "rss", 0)),
            memory_vms=int(getattr(mem, "vms", 0)),
            threads=threads,
            open_files=open_files,
            read_bytes=int(getattr(io, "read_bytes", 0)) if io else None,
            write_bytes=int(getattr(io, "write_bytes", 0)) if io else None,
        )

    def _prime_fallback(self) -> None:
        snapshot = self._read_proc_stat()
        self._last_total_time = snapshot["total_time"]
        self._last_timestamp = time.monotonic()

    def _sample_fallback(self, timestamp: str) -> Sample:
        if self._clock_ticks is None or self._page_size is None:
            raise MonitorError("Fallback monitor not initialised correctly.")
        snapshot = self._read_proc_stat()
        now = time.monotonic()
        if self._last_total_time is None or self._last_timestamp is None:
            cpu_percent = 0.0
        else:
            cpu_time_delta = snapshot["total_time"] - self._last_total_time
            wall_delta = max(now - self._last_timestamp, 1e-6)
            cpu_seconds = cpu_time_delta / float(self._clock_ticks)
            cpu_percent = (cpu_seconds / wall_delta) * 100.0 / self._cpu_count
        self._last_total_time = snapshot["total_time"]
        self._last_timestamp = now

        rss_bytes = snapshot["rss"] * self._page_size
        vms_bytes = snapshot.get("vsize")
        threads = snapshot["threads"]
        open_files = self._count_open_files()
        io = self._read_proc_io()

        return Sample(
            timestamp=timestamp,
            cpu_percent=max(cpu_percent, 0.0),
            memory_rss=int(rss_bytes),
            memory_vms=int(vms_bytes) if vms_bytes is not None else None,
            threads=threads,
            open_files=open_files,
            read_bytes=io.get("read_bytes"),
            write_bytes=io.get("write_bytes"),
        )

    def _read_proc_stat(self) -> Dict[str, int]:
        stat_path = Path(f"/proc/{self._pid}/stat")
        try:
            content = stat_path.read_text(encoding="utf-8")
        except FileNotFoundError as exc:
            raise MonitorError(f"Process {self._pid} exited before sampling.") from exc
        parts = content.split()
        if len(parts) < 24:
            raise MonitorError(f"Unexpected /proc stat format for pid {self._pid}")
        utime = int(parts[13])
        stime = int(parts[14])
        threads = int(parts[19])
        vsize = int(parts[22])
        rss_pages = int(parts[23])
        return {
            "total_time": utime + stime,
            "threads": threads,
            "vsize": vsize,
            "rss": rss_pages,
        }

    def _count_open_files(self) -> Optional[int]:
        fd_dir = Path(f"/proc/{self._pid}/fd")
        try:
            return sum(1 for _ in fd_dir.iterdir())
        except FileNotFoundError:
            return None
        except PermissionError:
            return None

    def _read_proc_io(self) -> Dict[str, int]:
        io_path = Path(f"/proc/{self._pid}/io")
        data: Dict[str, int] = {}
        try:
            for line in io_path.read_text(encoding="utf-8").splitlines():
                if not line:
                    continue
                key, value = [segment.strip() for segment in line.split(":", 1)]
                if key in {"read_bytes", "write_bytes"}:
                    try:
                        data[key] = int(value)
                    except ValueError:
                        continue
        except FileNotFoundError:
            return {}
        except PermissionError:
            return {}
        return data


def iso_timestamp() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def build_log_path(log_dir: Path, prefix: str, pid: int) -> Path:
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return log_dir / f"{prefix}_{stamp}_{pid}.jsonl"


def append_json_line(path: Path, payload: Dict[str, Any]) -> None:
    with path.open("a", encoding="utf-8") as handle:
        json.dump(payload, handle)
        handle.write("\n")
        handle.flush()


def ensure_log_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def format_command(command: Sequence[str]) -> Sequence[str]:
    return list(command)


def default_log_dir() -> Path:
    override = os.getenv(_LOG_DIR_ENV)
    if override:
        return ensure_log_dir(Path(override))
    return ensure_log_dir(_DEFAULT_LOG_DIR)
