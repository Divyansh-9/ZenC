# Generative Dataset Prompt for ZenCube ML

You are generating synthetic telemetry for the ZenCube sandbox monitor. Produce data in JSONL format where each file contains a single sandbox run with events mirroring `monitor/logs/monitor_run_*.jsonl`:

- Line 1: `{ "event": "start", "timestamp": <ISO>, "pid": <int>, "raw_command": [...], "prepared_command": [...], "interval": <float> }`
- Intermediate lines: `{ "event": "sample", "timestamp": <ISO>, "cpu_percent": <float>, "memory_rss": <int>, "memory_vms": <int>, "threads": <int>, "open_files": <int>, "socket_count": <int>, "read_bytes": <int>, "write_bytes": <int> }`
- Final line: `{ "event": "stop", "timestamp": <ISO>, "samples": <int>, "duration_seconds": <float>, "max_cpu_percent": <float>, "max_memory_rss": <int>, "peak_open_files": <int>, "exit_code": <int>, "label": "benign"|"malicious" }`

Follow these behavioural families and create **balanced** coverage with at least 20 malicious patterns and 20 benign patterns. Randomise amplitudes, durations, and burst frequencies using a seeded PRNG so repeated generations yield diverse results.

## Malicious Scenario Families (20+)

Combine and permute the following characteristics to produce at least **20 distinct malicious behaviours**:

1. High CPU attack bursts with rapid spikes (amplitude 80–100%).
2. Stepped CPU escalations that ramp from idle to 100% within 5 samples.
3. Oscillating CPU storms with sine-wave patterns.
4. Slow-burn CPU creep that rises 5% per sample.
5. Memory floods that allocate until RSS exceeds 1 GiB.
6. Memory saw-tooth patterns repeatedly allocating and freeing large chunks.
7. RSS leaks increasing 50 MiB per interval.
8. File-access violations with peak `open_files` >= 200.
9. Descriptor storms manipulating 500+ files then dropping to 0.
10. Socket storms issuing 400+ sockets within 30 seconds.
11. Network beacons with alternating send/receive spikes.
12. Disk IO explosions generating `write_bytes` bursts > 200 MB/s.
13. Read amplification attacks with repeated `read_bytes` surges.
14. Sudden I/O spikes after a calm period (time bombs).
15. Fork-based CPU saturation using 64+ threads.
16. Zombie CPU usage where exit code != 0 and CPU remains high until termination.
17. Multi-vector attacks combining CPU + memory + IO anomalies.
18. Hidden prelude attacks: low activity followed by instant max resource grab.
19. Slow creeping anomalies staying below 70% but never idling.
20. Stealthy malicious mimicry with alternating benign-like and spiky windows.
21. Memory fragmentation storms with alternating high/low RSS.
22. Socket+file combined storms toggling between descriptors.
23. Anomaly patterns triggered by random seeded toggles across metrics.
24. Rare violation events referencing policy breaches (`violation_count` > 0).

Ensure each malicious JSONL includes metadata linking to the scenario name and a summary field describing the attack vector.

## Benign Scenario Families (20+)

Produce **20+ benign behaviours** with realistic, resource-respecting characteristics:

1. Idle background daemons with near-zero CPU.
2. Short CLI utilities with CPU < 10% and constant RSS.
3. Batch downloads with moderate network IO but limited CPU.
4. Log tailers with consistent read operations and minimal writes.
5. Editor sessions with periodic CPU bursts < 35%.
6. Compilers with predictable CPU ramps and bounded memory.
7. Compression tasks with steady CPU 40–60% and mild IO.
8. Video stream decoders using sockets but stable CPU.
9. Database clients with moderate open files (< 40).
10. Backup utilities reading large amounts but low writes.
11. Scientific workloads with sinusoidal CPU at 50% +/- 10%.
12. Continuous integration jobs with multi-threaded CPU <= 70%.
13. Patch installers mixing IO and moderate CPU.
14. RSS-steady services holding 150 MiB constant.
15. Documentation builds spiking CPU briefly then returning to idle.
16. Chat workloads with occasional network bursts and low CPU.
17. Long-running watchers with open_files <= 10 and sockets <= 5.
18. Cron jobs running short CPU bursts at fixed cadence.
19. Data exporters streaming write_bytes steadily < 50 MB/s.
20. Trusted monitoring agents with minor IO noise.
21. ML inference tasks holding CPU 45% and RSS 300 MiB.
22. Benign maintenance scripts using low resources but longer duration.
24. Benchmark harness idle phases preceding moderate work.
25. Multi-stage CLI pipelines alternating between CPU and IO in predictable ranges.

Each benign JSONL must embed `label: "benign"` in the stop event and include a `summary` describing the scenario.

## Global Generation Rules

- Use ISO 8601 timestamps in UTC.
- Intervals between samples: 0.1–0.5 seconds.
- Generate 120–240 samples per scenario (covering 12–120 seconds).
- Include `socket_count` even if zero; vary realistically.
- Provide `violation_count` field in the stop event.
- Use random seeds per scenario and record the seed in the stop event metadata.
- Save files to `monitor/logs/synth/<scenario_name>.jsonl` (match scenario).
- Ensure labels are balanced and include `unknown` runs for ambiguous cases.
- Provide rare anomaly edge cases where metrics briefly spike outside usual ranges.
- Document every generated file in a sidecar JSON summary if requested.

## Output Requirements

- Generate JSONL files exactly following the schema above.
- Maintain class balance across benign, malicious, and unknown labels.
- Ensure statistical diversity across CPU, RSS, IO, open files, sockets, and duration.
- Avoid deterministic repetition; leverage seeded randomness for permutations.
- Guarantee reproducibility by storing the seed in the metadata.
- Make sure each scenario name is unique and descriptive.

Use this prompt whenever regenerating synthetic telemetry for Phase 4. Save the generated files under `monitor/logs/synth/` next to real telemetry for downstream processing.
