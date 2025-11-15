"""Sequence extraction helpers for LSTM-style models."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Sequence, Tuple

import numpy as np

from .collector import TelemetryRun

DEFAULT_KEYS = ("cpu_percent", "memory_rss", "open_files", "socket_count", "read_bytes", "write_bytes")


@dataclass(slots=True)
class SequenceExample:
    run_id: str
    label: str
    start_index: int
    features: np.ndarray
    timestamps: Tuple[str, ...]


def extract_sequences(
    runs: Iterable[TelemetryRun],
    window: int = 20,
    stride: int = 10,
    keys: Sequence[str] = DEFAULT_KEYS,
) -> List[SequenceExample]:
    sequences: List[SequenceExample] = []
    for run in runs:
        samples = run.samples
        if len(samples) < window:
            continue
        cleaned = _normalise_samples(samples, keys)
        ts = [sample.get("timestamp", "") for sample in samples]
        label = (run.label or "unknown").lower()
        for start in range(0, len(cleaned) - window + 1, stride):
            window_slice = cleaned[start : start + window]
            timestamps = tuple(ts[start : start + window])
            sequences.append(
                SequenceExample(
                    run_id=run.run_id,
                    label=label,
                    start_index=start,
                    features=window_slice,
                    timestamps=timestamps,
                )
            )
    return sequences


def _normalise_samples(samples: Sequence[dict], keys: Sequence[str]) -> np.ndarray:
    matrix = []
    for sample in samples:
        row = []
        for key in keys:
            value = sample.get(key, 0.0)
            try:
                row.append(float(value))
            except (TypeError, ValueError):
                row.append(0.0)
        matrix.append(row)
    array = np.asarray(matrix, dtype=float)
    mins = array.min(axis=0)
    maxs = array.max(axis=0)
    denom = np.where(maxs - mins > 1e-6, maxs - mins, 1.0)
    scaled = (array - mins) / denom
    return scaled.astype(np.float32)


__all__ = ["SequenceExample", "extract_sequences", "DEFAULT_KEYS"]
