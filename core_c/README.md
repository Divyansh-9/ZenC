# Phase-3 Core C Implementation

Lightweight C implementation of ZenCube Phase-3 monitoring, alerting, and metrics export.

## Overview

This directory contains the core C modules that replace the Python-based Phase-3 implementation:

- **sampler**: Process resource sampling (CPU, memory, I/O, file descriptors)
- **alertd**: Alert rule evaluation engine
- **logrotate_core**: Log rotation and compression
- **prom_exporter**: Prometheus metrics HTTP endpoint

## Build

```bash
make clean
make all
```

Binaries will be placed in `bin/`:
- `bin/sampler`
- `bin/alertd`
- `bin/logrotate_core`
- `bin/prom_exporter`

## Usage

### Sampler

Monitor a process and write JSONL samples:

```bash
bin/sampler --pid 12345 \
            --interval 1.0 \
            --run-id monitor_run_20251116T073045Z_12345 \
            --out ../monitor/logs/monitor_run_20251116T073045Z_12345.jsonl
```

Options:
- `--pid <pid>`: Process ID to monitor
- `--interval <seconds>`: Sampling interval (default: 1.0)
- `--run-id <id>`: Unique run identifier
- `--out <path>`: Output JSONL file path

### Alert Daemon

Evaluate alert rules on monitoring logs:

```bash
bin/alertd --log-dir ../monitor/logs \
           --rules alert_rules.json \
           --alert-log ../monitor/logs/alerts.jsonl
```

Options:
- `--log-dir <path>`: Directory containing monitor logs
- `--rules <path>`: JSON alert rules file
- `--alert-log <path>`: Output alerts JSONL file

Alert rules format (`alert_rules.json`):
```json
{
  "rules": [
    {"metric": "cpu_pct", "operator": ">", "threshold": 80.0, "duration_samples": 3},
    {"metric": "rss_mb", "operator": ">", "threshold": 512.0, "duration_samples": 1}
  ]
}
```

### Log Rotation

Rotate and compress old logs:

```bash
bin/logrotate_core --dir ../monitor/logs --keep 10 --compress
```

Options:
- `--dir <path>`: Log directory
- `--keep <n>`: Keep last N files (default: 10)
- `--compress`: Compress old logs to .gz

### Prometheus Exporter

Expose metrics at HTTP `/metrics` endpoint:

```bash
bin/prom_exporter --port 9091 --log-dir ../monitor/logs
```

Access metrics:
```bash
curl http://localhost:9091/metrics
```

Example output:
```
# HELP zencube_cpu_percent Current CPU usage percentage
# TYPE zencube_cpu_percent gauge
zencube_cpu_percent{run_id="monitor_run_20251116..."} 45.2

# HELP zencube_memory_rss_mb Current memory RSS in megabytes
# TYPE zencube_memory_rss_mb gauge
zencube_memory_rss_mb{run_id="monitor_run_20251116..."} 128.5
```

## Testing

Run all tests:

```bash
make test
```

Individual tests:
```bash
bash tests/test_sampler.sh
bash tests/test_alert_engine.sh
bash tests/test_prom_exporter.sh
```

## Integration with sandbox.c

The sampler can be integrated into `sandbox.c` using the `--enable-core-c` flag:

```bash
./sandbox --enable-core-c --cpu=5 /bin/sleep 10
```

This will:
1. Initialize core monitoring
2. Start sampling when process forks
3. Stop sampling when process exits
4. Write JSONL logs compatible with GUI

## JSONL Schema

All output follows the same schema as Python Phase-3 for GUI compatibility.

**Sample Event**:
```json
{
  "event": "sample",
  "timestamp": "2025-11-16T07:30:45Z",
  "cpu_percent": 45.2,
  "memory_rss": 134217728,
  "memory_vms": 268435456,
  "threads": 1,
  "open_files": 12,
  "read_bytes": 1048576,
  "write_bytes": 524288
}
```

**Summary Event**:
```json
{
  "event": "stop",
  "timestamp": "2025-11-16T07:31:00Z",
  "samples": 15,
  "duration_seconds": 15.234,
  "max_cpu_percent": 95.3,
  "max_memory_rss": 268435456,
  "peak_open_files": 24,
  "exit_code": 0
}
```

## Dependencies

- Standard C library (libc)
- POSIX threads (pthread)
- Math library (libm)
- Compression library (libz) for log rotation
- cJSON (vendored, single-file library)

No external heavy dependencies required!

## Architecture

```
core_c/
├── sampler.c/h       - /proc parsing, CPU/memory sampling
├── alert_engine.c/h  - Rule evaluation, threshold checking
├── logutil.c/h       - JSONL writing, rotation, compression
├── prom_exporter.c/h - HTTP metrics server
├── cJSON.c/h         - JSON parser (vendored)
└── *_main.c          - CLI entry points for each daemon
```

All modules use atomic file operations and graceful signal handling.
