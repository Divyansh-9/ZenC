# Task A – Test Runs

| Timestamp (UTC) | Command | Result Summary |
|----------------|---------|----------------|
| 2025-11-12T03:57:19Z | `./tests/test_jail_dev.sh` | PASS – wrapper returned 2 and log captured `/etc/hosts` violation |
| 2025-11-12T16:04:20Z | `./tests/test_gui_file_jail_py.sh` | PASS – PySide6 panel prepared jail and logged run via jail_wrapper |
| 2025-11-12T17:21:54Z | `./tests/test_network_restrict.sh` | PASS – sandbox exited non-zero and net_restrict log captured at least one blocked socket |
| 2025-11-13T03:16:51Z | `./tests/test_gui_monitoring_py.sh` | PASS – monitoring panel produced JSONL log with sample and summary records |
| 2025-11-13T12:44:40Z | `QT_QPA_PLATFORM=offscreen bash tests/test_monitor_daemon.sh` | PASS – ProcessInspector sampled short-lived process without raising |
| 2025-11-13T12:45:26Z | `QT_QPA_PLATFORM=offscreen bash tests/test_gui_monitoring_py.sh` | PASS – log `monitor_run_20251113T124526Z_10287.jsonl` recorded ≥1 samples and summary |
| 2025-11-13T12:46:10Z | `bash tests/test_alerting.sh` | PASS – AlertManager raised CPU/RSS alerts, persisted ack entry |
| 2025-11-13T12:46:42Z | `bash tests/test_log_rotate.sh` | PASS – rotate_logs archived 5 files and retained 10 JSONL logs |
| 2025-11-13T12:47:15Z | `bash tests/test_prom_exporter.sh` | PASS – Prometheus endpoint exposed metrics for `test-run` |

| 2025-11-15T00:00:00Z | `/home/Idred/Downloads/ZenCube/.venv/bin/python models/train.py --quick --no-lstm` | PASS – Dataset score: 10.0, Baseline model score: 9.3767; artifacts written to `models/artifacts` |
