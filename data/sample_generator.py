"""Synthetic telemetry generation utilities for Phase 4 datasets."""

from __future__ import annotations

import json
import math
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import numpy as np

MB = 1024 * 1024
GB = 1024 * MB


@dataclass(slots=True)
class ScenarioSpec:
    name: str
    label: str
    cpu_pattern: str
    rss_pattern: str
    io_pattern: str
    descriptor_pattern: str
    socket_pattern: str
    summary: str
    samples: Tuple[int, int]
    violation_range: Tuple[int, int]
    exit_code_range: Tuple[int, int]


def generate_dataset(output_dir: Path, seed: int = 2025, overwrite: bool = True) -> List[Path]:
    """Generate synthetic telemetry JSONL files for all scenarios."""

    output_dir = output_dir.expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    rng = random.Random(seed)
    generated: List[Path] = []
    for spec in _scenario_catalogue():
        scenario_seed = rng.randint(1, 10_000_000)
        path = output_dir / f"{spec.name}.jsonl"
        if path.exists() and not overwrite:
            generated.append(path)
            continue
        events = _simulate_run(spec, scenario_seed)
        _write_jsonl(path, events)
        generated.append(path)
    return generated


# ---------------------------------------------------------------------------
# Scenario catalogue
# ---------------------------------------------------------------------------

def _scenario_catalogue() -> List[ScenarioSpec]:
    malicious: List[ScenarioSpec] = [
        ScenarioSpec("mal_cpu_burst_overload", "malicious", "burst", "flat", "write_blast", "storm", "low", "Rapid CPU saturation bursts with sustained file churn", (150, 220), (2, 6), (128, 145)),
        ScenarioSpec("mal_cpu_ramp_coreburn", "malicious", "ramp_extreme", "flat", "low", "moderate", "low", "Linear CPU ramp to 100% with exit failure", (160, 220), (1, 4), (120, 140)),
        ScenarioSpec("mal_cpu_oscillation_wave", "malicious", "oscillation_high", "flat", "write_blast", "storm", "burst", "Sinusoidal CPU storm with IO spikes", (170, 220), (2, 5), (130, 150)),
        ScenarioSpec("mal_cpu_slow_creep", "malicious", "slow_creep", "leak", "low", "low", "low", "Slow creeping CPU paired with memory leak", (180, 220), (1, 3), (126, 140)),
        ScenarioSpec("mal_memory_flood", "malicious", "moderate_noise", "flood", "low", "moderate", "low", "Memory flood breaching a gigabyte", (180, 220), (2, 4), (130, 148)),
        ScenarioSpec("mal_memory_sawtooth", "malicious", "burst", "saw", "read_blast", "storm", "low", "Saw-tooth memory churn with read storms", (170, 210), (2, 5), (132, 152)),
        ScenarioSpec("mal_memory_leak", "malicious", "slow_creep", "leak_fast", "low", "low", "low", "Aggressive RSS leak", (180, 220), (3, 6), (133, 151)),
        ScenarioSpec("mal_file_violation", "malicious", "moderate_noise", "flat", "write_blast", "violation", "low", "File descriptor violations exceeding policy", (170, 210), (4, 7), (134, 152)),
        ScenarioSpec("mal_descriptor_storm", "malicious", "burst", "flat", "low", "extreme", "low", "Descriptor storm hitting 600+ entries", (170, 210), (2, 5), (136, 154)),
        ScenarioSpec("mal_socket_storm", "malicious", "moderate_noise", "flat", "low", "low", "storm", "Socket storm with hundreds of sockets", (170, 210), (2, 6), (126, 144)),
        ScenarioSpec("mal_network_beacon", "malicious", "moderate_noise", "flat", "balanced_beacon", "low", "beacon", "Alternating network beacon traffic", (180, 220), (1, 4), (132, 148)),
        ScenarioSpec("mal_disk_write_explosion", "malicious", "burst", "flat", "write_megaspike", "storm", "low", "Disk IO explosion over 200 MB/s", (170, 210), (3, 7), (132, 154)),
        ScenarioSpec("mal_read_amplification", "malicious", "moderate_noise", "flat", "read_blast", "moderate", "low", "Repeated high-volume read amplification", (170, 210), (1, 4), (130, 146)),
        ScenarioSpec("mal_time_bomb", "malicious", "time_bomb", "flat", "write_blast", "storm", "burst", "Calm run detonating into CPU spike", (180, 220), (2, 5), (133, 150)),
        ScenarioSpec("mal_thread_forking", "malicious", "multi_thread", "flat", "low", "moderate", "low", "Fork bomb style thread proliferation", (180, 220), (3, 6), (138, 155)),
        ScenarioSpec("mal_zombie_cpu", "malicious", "zombie", "flat", "low", "low", "low", "Persistent CPU usage after failure", (170, 210), (2, 4), (148, 160)),
        ScenarioSpec("mal_multi_vector", "malicious", "multi_vector", "multi_vector", "write_megaspike", "extreme", "storm", "Combined CPU, memory, IO assault", (190, 220), (4, 8), (142, 160)),
        ScenarioSpec("mal_hidden_prelude", "malicious", "hidden_prelude", "flat", "write_blast", "moderate", "burst", "Low prelude then instant resource grab", (190, 220), (2, 5), (136, 152)),
        ScenarioSpec("mal_slow_creeping_anomaly", "malicious", "slow_creep_high", "leak", "low", "low", "low", "Slow creeping anomaly under 70%", (190, 220), (2, 5), (130, 146)),
        ScenarioSpec("mal_stealth_mimic", "malicious", "stealth_mimic", "fragment", "balanced_beacon", "moderate", "beacon", "Stealth attack alternating benign-like windows", (180, 220), (1, 4), (138, 154)),
        ScenarioSpec("mal_memory_fragmentation", "malicious", "moderate_noise", "fragment", "low", "low", "low", "Memory fragmentation oscillations", (180, 220), (2, 5), (132, 148)),
        ScenarioSpec("mal_socket_file_combo", "malicious", "multi_vector", "flat", "balanced", "extreme", "storm", "Combined socket and file descriptor storm", (190, 220), (4, 8), (140, 158)),
        ScenarioSpec("mal_random_toggle", "malicious", "random_toggle", "random_toggle", "write_megaspike", "storm", "burst", "Random toggled anomaly across metrics", (180, 220), (3, 6), (134, 152)),
        ScenarioSpec("mal_policy_breach", "malicious", "moderate_noise", "flat", "write_blast", "violation", "storm", "Policy breach flagged via violations", (190, 220), (5, 9), (145, 165)),
    ]

    benign: List[ScenarioSpec] = [
        ScenarioSpec("ben_idle_daemon", "benign", "idle", "flat_low", "low", "low", "low", "Idle background daemon", (150, 200), (0, 0), (0, 0)),
        ScenarioSpec("ben_cli_short_run", "benign", "low_jitter", "flat_low", "low", "low", "low", "Short CLI utility", (150, 200), (0, 0), (0, 0)),
        ScenarioSpec("ben_batch_download", "benign", "low_jitter", "flat", "read_stream", "moderate", "beacon", "Batch download with moderate network IO", (170, 210), (0, 0), (0, 0)),
        ScenarioSpec("ben_log_tailer", "benign", "idle", "flat_low", "read_stream", "moderate_low", "low", "Log tailer with consistent reads", (150, 200), (0, 0), (0, 0)),
        ScenarioSpec("ben_editor_session", "benign", "editor", "flat_low", "low", "moderate_low", "low", "Editor session with periodic bursts", (160, 210), (0, 0), (0, 0)),
        ScenarioSpec("ben_compiler", "benign", "compiler", "compiler", "write_balanced", "moderate", "low", "Compiler workload with bounded memory", (180, 220), (0, 0), (0, 0)),
        ScenarioSpec("ben_compression", "benign", "compression", "flat", "write_balanced", "moderate", "low", "Compression steady CPU 40-60%", (180, 220), (0, 0), (0, 0)),
        ScenarioSpec("ben_video_stream", "benign", "video", "flat", "balanced_beacon", "low", "beacon", "Video stream decoder with sockets", (170, 210), (0, 0), (0, 0)),
        ScenarioSpec("ben_db_client", "benign", "low_jitter", "flat", "balanced_low", "moderate", "low", "Database client moderate open files", (170, 210), (0, 0), (0, 0)),
        ScenarioSpec("ben_backup_utility", "benign", "low_jitter", "flat", "write_stream", "moderate", "low", "Backup utility streaming writes", (180, 220), (0, 0), (0, 0)),
        ScenarioSpec("ben_scientific_wave", "benign", "sine_mid", "flat", "balanced_low", "moderate", "low", "Scientific workload sinusoidal CPU", (180, 220), (0, 0), (0, 0)),
        ScenarioSpec("ben_ci_job", "benign", "ci_job", "ci_job", "write_balanced", "moderate", "low", "CI job multi-threaded but bounded", (180, 220), (0, 0), (0, 0)),
        ScenarioSpec("ben_patch_installer", "benign", "patch", "patch", "write_balanced", "moderate", "low", "Patch installer mixing IO and CPU", (180, 220), (0, 0), (0, 0)),
        ScenarioSpec("ben_rss_service", "benign", "low_jitter", "constant", "low", "moderate_low", "low", "RSS steady service holding memory", (180, 220), (0, 0), (0, 0)),
        ScenarioSpec("ben_doc_build", "benign", "doc_build", "flat", "write_balanced", "moderate", "low", "Documentation build with brief spikes", (170, 210), (0, 0), (0, 0)),
        ScenarioSpec("ben_chat_workload", "benign", "chat", "flat_low", "balanced_low", "low", "beacon", "Chat workload occasional network bursts", (180, 220), (0, 0), (0, 0)),
        ScenarioSpec("ben_long_watcher", "benign", "low_jitter", "flat_low", "low", "moderate_low", "low", "Long-running watcher few descriptors", (180, 220), (0, 0), (0, 0)),
        ScenarioSpec("ben_cron_cadence", "benign", "cron", "flat_low", "low", "low", "low", "Cron job periodic CPU bursts", (170, 210), (0, 0), (0, 0)),
        ScenarioSpec("ben_data_export", "benign", "low_jitter", "flat", "write_stream", "moderate", "low", "Data exporter steady writes", (180, 220), (0, 0), (0, 0)),
        ScenarioSpec("ben_monitor_agent", "benign", "low_jitter", "flat_low", "low", "low", "low", "Trusted monitoring agent", (180, 220), (0, 0), (0, 0)),
        ScenarioSpec("ben_ml_inference", "benign", "ml_inference", "ml_inference", "balanced_low", "moderate", "low", "ML inference steady CPU 45%", (180, 220), (0, 0), (0, 0)),
        ScenarioSpec("ben_maintenance_script", "benign", "patch", "flat", "balanced_low", "moderate", "low", "Maintenance script long duration low resources", (180, 220), (0, 0), (0, 0)),
        ScenarioSpec("ben_benchmark_idle", "benign", "benchmark_idle", "flat", "low", "low", "low", "Benchmark idle then moderate work", (180, 220), (0, 0), (0, 0)),
        ScenarioSpec("ben_cli_pipeline", "benign", "pipeline", "flat", "balanced", "moderate", "low", "CLI pipeline alternating CPU and IO", (180, 220), (0, 0), (0, 0)),
    ]

    unknown: List[ScenarioSpec] = [
        ScenarioSpec("unk_short_spike", "unknown", "time_bomb", "flat", "low", "low", "low", "Short spike ambiguous", (150, 190), (0, 1), (0, 128)),
        ScenarioSpec("unk_gradual_mem", "unknown", "low_jitter", "leak", "low", "low", "low", "Gradual memory growth ambiguous", (160, 200), (0, 2), (0, 130)),
        ScenarioSpec("unk_balanced", "unknown", "moderate_noise", "flat", "balanced", "moderate", "low", "Balanced metrics borderline", (160, 200), (0, 1), (0, 0)),
        ScenarioSpec("unk_network", "unknown", "moderate_noise", "flat", "balanced_beacon", "low", "beacon", "Network heavy but CPU modest", (170, 210), (0, 2), (0, 0)),
        ScenarioSpec("unk_io_loader", "unknown", "low_jitter", "flat", "write_stream", "moderate", "low", "IO loader uncertain classification", (170, 210), (0, 1), (0, 0)),
        ScenarioSpec("unk_fragment_like", "unknown", "moderate_noise", "fragment", "balanced_low", "moderate", "low", "Fragmented RSS but moderate CPU", (170, 210), (0, 2), (0, 0)),
    ]

    return malicious + benign + unknown


# ---------------------------------------------------------------------------
# Simulation helpers
# ---------------------------------------------------------------------------

def _simulate_run(spec: ScenarioSpec, seed: int) -> List[Dict[str, object]]:
    rng = random.Random(seed)
    sample_count = rng.randint(spec.samples[0], spec.samples[1])
    interval = rng.uniform(0.12, 0.45)
    start_time = datetime.now(timezone.utc) - timedelta(seconds=sample_count * interval)

    cpu = _cpu_series(spec.cpu_pattern, sample_count, rng)
    rss = _rss_series(spec.rss_pattern, sample_count, rng)
    read_rate, write_rate = _io_series(spec.io_pattern, sample_count, rng)
    open_files = _descriptor_series(spec.descriptor_pattern, sample_count, rng, spec.label)
    socket_count = _socket_series(spec.socket_pattern, sample_count, rng, spec.label)

    cumulative_read = 0.0
    cumulative_write = 0.0

    pid = rng.randint(2000, 80_000)
    command = ["synthetic", spec.label, spec.name]

    events: List[Dict[str, object]] = []
    events.append(
        {
            "event": "start",
            "timestamp": start_time.isoformat(),
            "pid": pid,
            "raw_command": command,
            "prepared_command": command,
            "interval": round(interval, 3),
            "scenario": spec.name,
            "label_hint": spec.label,
            "seed": seed,
        }
    )

    for index in range(sample_count):
        timestamp = start_time + timedelta(seconds=(index + 1) * interval)
        cumulative_read += max(read_rate[index], 0.0) * interval
        cumulative_write += max(write_rate[index], 0.0) * interval
        events.append(
            {
                "event": "sample",
                "timestamp": timestamp.isoformat(),
                "cpu_percent": round(float(cpu[index]), 2),
                "memory_rss": int(max(rss[index], 0.0)),
                "memory_vms": int(max(rss[index] * 1.1, rss[index])),
                "threads": int(_estimate_threads(cpu[index], spec.label, rng)),
                "open_files": int(max(open_files[index], 0)),
                "socket_count": int(max(socket_count[index], 0)),
                "read_bytes": int(cumulative_read),
                "write_bytes": int(cumulative_write),
            }
        )

    stop_time = start_time + timedelta(seconds=sample_count * interval)
    violation_count = rng.randint(spec.violation_range[0], spec.violation_range[1]) if spec.violation_range[1] else 0
    exit_code = rng.randint(spec.exit_code_range[0], spec.exit_code_range[1]) if spec.exit_code_range[1] else spec.exit_code_range[0]

    events.append(
        {
            "event": "stop",
            "timestamp": stop_time.isoformat(),
            "samples": sample_count,
            "duration_seconds": round(sample_count * interval, 3),
            "max_cpu_percent": round(float(np.max(cpu)), 2),
            "max_memory_rss": int(float(np.max(rss))),
            "peak_open_files": int(float(np.max(open_files))),
            "exit_code": exit_code,
            "label": spec.label,
            "summary": spec.summary,
            "violation_count": violation_count,
            "scenario": spec.name,
            "seed": seed,
        }
    )
    return events


def _cpu_series(pattern: str, size: int, rng: random.Random) -> np.ndarray:
    t = np.linspace(0.0, 1.0, size)
    noise_scale = rng.uniform(1.5, 4.0)

    if pattern == "burst":
        series = np.full(size, rng.uniform(5, 12))
        for _ in range(rng.randint(3, 6)):
            center = rng.randint(5, size - 5)
            width = rng.randint(4, 10)
            amplitude = rng.uniform(80, 100)
            span = range(max(0, center - width), min(size, center + width))
            for idx in span:
                decay = math.exp(-abs(idx - center) / max(width / 2, 1))
                series[idx] = max(series[idx], amplitude * decay)
    elif pattern == "ramp_extreme":
        start = rng.uniform(4, 10)
        end = rng.uniform(95, 100)
        series = np.linspace(start, end, size)
    elif pattern == "oscillation_high":
        freq = rng.uniform(6, 10)
        series = 65 + 35 * np.sin(2 * math.pi * freq * t + rng.uniform(0, math.pi))
        series = np.clip(series, 5, 100)
    elif pattern == "slow_creep":
        base = rng.uniform(5, 10)
        end = rng.uniform(65, 80)
        series = np.linspace(base, end, size)
    elif pattern == "slow_creep_high":
        base = rng.uniform(20, 35)
        end = rng.uniform(75, 85)
        series = np.linspace(base, end, size)
    elif pattern == "moderate_noise":
        base = rng.uniform(30, 45)
        series = base + 12 * np.sin(2 * math.pi * rng.uniform(2, 6) * t)
    elif pattern == "time_bomb":
        series = np.full(size, rng.uniform(5, 15))
        detonate_idx = rng.randint(size // 2, size - 5)
        series[detonate_idx:] = np.linspace(series[detonate_idx - 1], rng.uniform(80, 100), size - detonate_idx)
    elif pattern == "multi_thread":
        base = rng.uniform(40, 55)
        bursts = np.clip(np.sin(2 * math.pi * rng.uniform(3, 5) * t) * 20, 0, 30)
        series = base + bursts
    elif pattern == "zombie":
        series = np.linspace(rng.uniform(10, 20), rng.uniform(80, 90), size)
        series[-int(size * 0.2):] = rng.uniform(60, 85)
    elif pattern == "multi_vector":
        series = 55 + 25 * np.sin(2 * math.pi * rng.uniform(4, 6) * t)
        series += 20 * (t > 0.6)
    elif pattern == "hidden_prelude":
        series = np.full(size, rng.uniform(5, 12))
        jump = rng.randint(int(size * 0.6), size - 5)
        series[jump:] = np.linspace(series[jump - 1], rng.uniform(95, 100), size - jump)
    elif pattern == "stealth_mimic":
        series = 35 + 25 * np.sin(2 * math.pi * rng.uniform(3, 5) * t)
        series[t > 0.7] += 35 * np.sin(2 * math.pi * rng.uniform(8, 12) * t[t > 0.7])
    elif pattern == "random_toggle":
        series = np.full(size, rng.uniform(25, 40))
        for idx in range(0, size, rng.randint(8, 14)):
            toggle = rng.choice([rng.uniform(70, 95), rng.uniform(5, 15)])
            series[idx: idx + rng.randint(4, 8)] = toggle
    elif pattern == "idle":
        series = np.full(size, rng.uniform(1, 3))
    elif pattern == "low_jitter":
        series = np.full(size, rng.uniform(5, 12)) + rng.normalvariate(0, 1.5) * np.sin(2 * math.pi * 3 * t)
    elif pattern == "editor":
        series = np.full(size, rng.uniform(5, 10))
        for idx in range(0, size, rng.randint(15, 25)):
            burst_len = rng.randint(3, 6)
            series[idx: idx + burst_len] = rng.uniform(25, 35)
    elif pattern == "compiler":
        series = np.linspace(rng.uniform(10, 20), rng.uniform(65, 75), size)
    elif pattern == "compression":
        series = 50 + 10 * np.sin(2 * math.pi * rng.uniform(2, 4) * t)
    elif pattern == "video":
        series = 35 + 8 * np.sin(2 * math.pi * rng.uniform(2, 3) * t)
    elif pattern == "sine_mid":
        series = 50 + 10 * np.sin(2 * math.pi * rng.uniform(1, 2) * t)
    elif pattern == "ci_job":
        series = np.clip(60 + 20 * np.sin(2 * math.pi * rng.uniform(2, 4) * t), 15, 80)
    elif pattern == "patch":
        series = 35 + 15 * np.sin(2 * math.pi * rng.uniform(1, 3) * t)
    elif pattern == "doc_build":
        series = np.full(size, 15.0)
        for idx in range(0, size, rng.randint(10, 18)):
            series[idx: idx + rng.randint(3, 5)] = rng.uniform(45, 60)
    elif pattern == "chat":
        series = np.full(size, 12.0)
        for idx in range(0, size, rng.randint(12, 20)):
            series[idx: idx + rng.randint(2, 4)] += rng.uniform(15, 25)
    elif pattern == "cron":
        series = np.full(size, 5.0)
        for idx in range(0, size, rng.randint(25, 35)):
            series[idx: idx + rng.randint(1, 2)] = rng.uniform(35, 45)
    elif pattern == "ml_inference":
        series = np.full(size, rng.uniform(40, 48))
    elif pattern == "benchmark_idle":
        series = np.full(size, 5.0)
        series[int(size * 0.4): int(size * 0.7)] = rng.uniform(35, 45)
    elif pattern == "pipeline":
        cpu_a = np.full(size, 25.0)
        cpu_b = 45 + 10 * np.sin(2 * math.pi * rng.uniform(3, 5) * t)
        mask = (np.arange(size) // rng.randint(6, 10)) % 2 == 0
        series = np.where(mask, cpu_a, cpu_b)
    else:
        series = np.full(size, 30.0)

    series = series + noise_scale * np.random.standard_normal(size)
    return np.clip(series, 0, 100)


def _rss_series(pattern: str, size: int, rng: random.Random) -> np.ndarray:
    base_noise = rng.uniform(5 * MB, 25 * MB)
    if pattern == "flat":
        series = np.full(size, rng.uniform(220 * MB, 320 * MB))
    elif pattern == "flat_low":
        series = np.full(size, rng.uniform(90 * MB, 160 * MB))
    elif pattern == "flood":
        start = rng.uniform(150 * MB, 220 * MB)
        end = rng.uniform(1.1 * GB, 1.4 * GB)
        series = np.linspace(start, end, size)
    elif pattern == "leak":
        start = rng.uniform(120 * MB, 200 * MB)
        end = start + rng.uniform(150 * MB, 300 * MB)
        series = np.linspace(start, end, size)
    elif pattern == "leak_fast":
        start = rng.uniform(180 * MB, 260 * MB)
        end = 1.5 * GB
        series = np.linspace(start, end, size)
    elif pattern == "saw":
        ramp = np.linspace(120 * MB, 900 * MB, size)
        series = np.abs((ramp % (400 * MB)) - 200 * MB) + 400 * MB
    elif pattern == "fragment":
        series = np.full(size, rng.uniform(300 * MB, 500 * MB))
        for idx in range(0, size, rng.randint(12, 18)):
            series[idx: idx + rng.randint(4, 8)] = rng.uniform(700 * MB, 1.2 * GB)
    elif pattern == "multi_vector":
        base = np.linspace(400 * MB, 1.2 * GB, size)
        oscillation = 120 * MB * np.sin(2 * math.pi * rng.uniform(2, 4) * np.linspace(0, 1, size))
        series = base + oscillation
    elif pattern == "constant":
        series = np.full(size, rng.uniform(250 * MB, 320 * MB))
    elif pattern == "compiler":
        series = np.linspace(220 * MB, 520 * MB, size)
    elif pattern == "ci_job":
        series = 320 * MB + 130 * MB * np.sin(2 * math.pi * rng.uniform(2, 3) * np.linspace(0, 1, size))
    elif pattern == "patch":
        series = np.full(size, rng.uniform(200 * MB, 260 * MB))
        for idx in range(0, size, rng.randint(20, 30)):
            series[idx: idx + rng.randint(3, 6)] += rng.uniform(60 * MB, 120 * MB)
    elif pattern == "ml_inference":
        series = np.full(size, rng.uniform(280 * MB, 360 * MB))
    elif pattern == "random_toggle":
        series = np.full(size, rng.uniform(200 * MB, 320 * MB))
        for idx in range(0, size, rng.randint(10, 15)):
            series[idx: idx + rng.randint(3, 6)] = rng.uniform(600 * MB, 1.0 * GB)
    else:
        series = np.full(size, rng.uniform(250 * MB, 300 * MB))

    series = series + np.random.standard_normal(size) * base_noise
    return np.clip(series, 50 * MB, 1.8 * GB)


def _io_series(pattern: str, size: int, rng: random.Random) -> Tuple[np.ndarray, np.ndarray]:
    t = np.linspace(0, 1, size)
    if pattern == "low":
        read = np.full(size, rng.uniform(10_000, 100_000))
        write = np.full(size, rng.uniform(10_000, 150_000))
    elif pattern == "read_stream":
        read = np.full(size, rng.uniform(40_000_000, 70_000_000))
        write = np.full(size, rng.uniform(2_000_000, 5_000_000))
    elif pattern == "write_stream":
        read = np.full(size, rng.uniform(2_000_000, 5_000_000))
        write = np.full(size, rng.uniform(45_000_000, 70_000_000))
    elif pattern == "write_blast":
        read = np.full(size, rng.uniform(1_000_000, 3_000_000))
        write = np.full(size, rng.uniform(20_000_000, 40_000_000))
        for idx in range(0, size, rng.randint(15, 22)):
            write[idx: idx + rng.randint(3, 5)] = rng.uniform(120_000_000, 220_000_000)
    elif pattern == "write_megaspike":
        read = np.full(size, rng.uniform(1_000_000, 3_000_000))
        write = np.full(size, rng.uniform(25_000_000, 40_000_000))
        for idx in range(0, size, rng.randint(10, 16)):
            write[idx: idx + rng.randint(2, 4)] = rng.uniform(200_000_000, 320_000_000)
    elif pattern == "read_blast":
        read = np.full(size, rng.uniform(20_000_000, 40_000_000))
        for idx in range(0, size, rng.randint(12, 18)):
            read[idx: idx + rng.randint(3, 6)] = rng.uniform(140_000_000, 200_000_000)
        write = np.full(size, rng.uniform(3_000_000, 6_000_000))
    elif pattern == "balanced_low":
        base = rng.uniform(10_000_000, 20_000_000)
        read = base + 5_000_000 * np.sin(2 * math.pi * rng.uniform(1, 2) * t)
        write = base + 4_000_000 * np.cos(2 * math.pi * rng.uniform(1, 2) * t + 0.3)
    elif pattern == "balanced_beacon":
        read = 25_000_000 + 10_000_000 * np.sin(2 * math.pi * rng.uniform(4, 6) * t)
        write = 30_000_000 + 12_000_000 * np.cos(2 * math.pi * rng.uniform(4, 6) * t + 0.5)
    elif pattern == "balanced":
        base = rng.uniform(18_000_000, 28_000_000)
        read = base + 8_000_000 * np.sin(2 * math.pi * rng.uniform(2, 4) * t)
        write = base + 8_000_000 * np.cos(2 * math.pi * rng.uniform(2, 4) * t + 0.4)
    elif pattern == "write_balanced":
        base = rng.uniform(20_000_000, 30_000_000)
        read = base / 2 + 4_000_000 * np.sin(2 * math.pi * rng.uniform(1, 2) * t)
        write = base + 6_000_000 * np.sin(2 * math.pi * rng.uniform(2, 3) * t)
    else:
        read = np.full(size, rng.uniform(15_000_000, 20_000_000))
        write = np.full(size, rng.uniform(15_000_000, 20_000_000))

    read = np.maximum(read + np.random.standard_normal(size) * rng.uniform(200_000, 800_000), 0.0)
    write = np.maximum(write + np.random.standard_normal(size) * rng.uniform(200_000, 800_000), 0.0)
    return read, write


def _descriptor_series(pattern: str, size: int, rng: random.Random, label: str) -> np.ndarray:
    if pattern == "low":
        series = np.full(size, rng.uniform(2, 8))
    elif pattern == "moderate":
        series = np.full(size, rng.uniform(25, 60))
    elif pattern == "moderate_low":
        series = np.full(size, rng.uniform(10, 25))
    elif pattern == "storm":
        series = np.full(size, rng.uniform(120, 200))
        for idx in range(0, size, rng.randint(12, 18)):
            series[idx: idx + rng.randint(4, 6)] = rng.uniform(220, 320)
    elif pattern == "extreme":
        series = np.full(size, rng.uniform(220, 260))
        for idx in range(0, size, rng.randint(8, 12)):
            series[idx: idx + rng.randint(3, 5)] = rng.uniform(350, 620)
    elif pattern == "violation":
        series = np.full(size, rng.uniform(80, 120))
        for idx in range(0, size, rng.randint(10, 16)):
            series[idx: idx + rng.randint(4, 7)] = rng.uniform(200, 420)
    else:
        series = np.full(size, rng.uniform(10, 25))

    if label == "malicious":
        series += rng.uniform(10, 20)
    return np.clip(series + np.random.standard_normal(size) * rng.uniform(1, 5), 0, 800)


def _socket_series(pattern: str, size: int, rng: random.Random, label: str) -> np.ndarray:
    if pattern == "low":
        series = np.full(size, rng.uniform(1, 5))
    elif pattern == "burst":
        series = np.full(size, rng.uniform(3, 8))
        for idx in range(0, size, rng.randint(15, 22)):
            series[idx: idx + rng.randint(2, 4)] = rng.uniform(40, 80)
    elif pattern == "storm":
        series = np.full(size, rng.uniform(50, 120))
        for idx in range(0, size, rng.randint(8, 12)):
            series[idx: idx + rng.randint(3, 5)] = rng.uniform(220, 420)
    elif pattern == "beacon":
        series = 20 + 15 * np.sin(2 * math.pi * rng.uniform(4, 6) * np.linspace(0, 1, size))
        series = np.maximum(series, 0)
    else:
        series = np.full(size, rng.uniform(4, 10))

    if label == "malicious" and pattern in {"storm", "burst"}:
        series += rng.uniform(20, 40)
    return np.clip(series + np.random.standard_normal(size) * rng.uniform(0.5, 3.0), 0, 800)


def _estimate_threads(cpu_value: float, label: str, rng: random.Random) -> int:
    if label == "malicious" and cpu_value > 60:
        return rng.randint(32, 96)
    if label == "malicious":
        return rng.randint(12, 48)
    if label == "unknown":
        return rng.randint(6, 32)
    return rng.randint(2, 24)


def _write_jsonl(path: Path, events: Sequence[Dict[str, object]]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for event in events:
            handle.write(json.dumps(event, separators=(",", ":")))
            handle.write("\n")


__all__ = ["generate_dataset", "ScenarioSpec"]
