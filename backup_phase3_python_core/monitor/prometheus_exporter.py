from __future__ import annotations

import logging
import os
import threading
from dataclasses import dataclass
from typing import Optional

from .resource_monitor import Sample

try:  # pragma: no cover - optional dependency
    from prometheus_client import CollectorRegistry, Gauge, start_http_server
except Exception:  # pragma: no cover - tolerate missing package
    CollectorRegistry = None  # type: ignore
    Gauge = None  # type: ignore
    start_http_server = None  # type: ignore

_LOGGER = logging.getLogger(__name__)
_DEFAULT_PORT = 9109


def _bool_from_env(value: str | None) -> bool:
    if value is None:
        return False
    return value.lower() in {"1", "true", "yes", "on"}


@dataclass
class ExporterState:
    registry: CollectorRegistry  # type: ignore[valid-type]
    cpu_gauge: Gauge  # type: ignore[valid-type]
    rss_gauge: Gauge  # type: ignore[valid-type]


class PrometheusExporter:
    """Optional Prometheus metrics bridge for monitoring samples."""

    def __init__(self, enabled: bool = False, port: int = _DEFAULT_PORT) -> None:
        dependency_ready = CollectorRegistry is not None and Gauge is not None and start_http_server is not None
        self._enabled = enabled and dependency_ready
        self._port = port
        self._state: Optional[ExporterState] = None
        self._server_started = False
        self._lock = threading.Lock()

        if enabled and not dependency_ready:
            _LOGGER.warning("Prometheus exporter requested but prometheus_client is not installed.")
        if self._enabled:
            registry = CollectorRegistry()  # type: ignore[call-arg]
            cpu_gauge = Gauge(  # type: ignore[call-arg]
                "zencube_cpu_percent",
                "Process CPU utilisation percentage",
                labelnames=("run_id",),
                registry=registry,
            )
            rss_gauge = Gauge(  # type: ignore[call-arg]
                "zencube_memory_rss_megabytes",
                "Resident set size in megabytes",
                labelnames=("run_id",),
                registry=registry,
            )
            self._state = ExporterState(registry=registry, cpu_gauge=cpu_gauge, rss_gauge=rss_gauge)

    # ------------------------------------------------------------------
    # Construction helpers
    # ------------------------------------------------------------------
    @classmethod
    def from_env(cls) -> "PrometheusExporter":
        enabled = _bool_from_env(os.getenv("PROMETHEUS_ENABLED"))
        port_str = os.getenv("PROMETHEUS_PORT")
        try:
            port = int(port_str) if port_str else _DEFAULT_PORT
        except ValueError:
            port = _DEFAULT_PORT
        return cls(enabled=enabled, port=port)

    # ------------------------------------------------------------------
    # Operational API
    # ------------------------------------------------------------------
    def is_enabled(self) -> bool:
        return self._enabled

    def start(self) -> None:
        if not self._enabled or self._state is None or self._server_started:
            return
        start_http_server(self._port, addr="127.0.0.1", registry=self._state.registry)  # type: ignore[arg-type]
        self._server_started = True
        _LOGGER.info("Prometheus exporter listening on 127.0.0.1:%s", self._port)

    def record_sample(self, run_id: str, sample: Sample) -> None:
        if not self._enabled or self._state is None:
            return
        rss_mb = sample.memory_rss / (1024.0 * 1024.0)
        with self._lock:
            self._state.cpu_gauge.labels(run_id=run_id).set(sample.cpu_percent)
            self._state.rss_gauge.labels(run_id=run_id).set(rss_mb)

    def clear_run(self, run_id: str) -> None:
        if not self._enabled or self._state is None:
            return
        with self._lock:
            try:
                self._state.cpu_gauge.remove(run_id)
            except KeyError:
                pass
            try:
                self._state.rss_gauge.remove(run_id)
            except KeyError:
                pass


__all__ = ["PrometheusExporter"]
