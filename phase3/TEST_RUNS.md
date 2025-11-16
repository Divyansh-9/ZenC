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
| 2025-11-15T12:05:00Z | `PYTHONPATH=/home/Idred/Downloads/ZenCube /home/Idred/Downloads/ZenCube/.venv/bin/python models/train.py` | PASS – Full training (baseline + LSTM) achieved dataset 10.0, model 9.44, LSTM 10.0; artifacts refreshed |
| 2025-11-15T12:07:00Z | `PYTHONPATH=/home/Idred/Downloads/ZenCube /home/Idred/Downloads/ZenCube/.venv/bin/python models/evaluate.py --use-lstm` | PASS – Evaluation summary exported (RandomForest accuracy 0.88, LSTM 100% sequence accuracy) |

## test_inference.sh — 2025-11-15 00:00 UTC
Command:
bash tests/test_inference.sh monitor/logs/synth/mal_cpu_burst_overload.jsonl

Result: PASS

Output JSON:
{
	"runId": "mal_cpu_burst_overload",
	"model": "rf",
	"score": 0.9722222222222222,
	"label": "malicious",
	"probs": [
		{"label": "malicious", "prob": 0.9722222222222222},
		{"label": "benign", "prob": 0.016666666666666666},
		{"label": "unknown", "prob": 0.011111111111111112}
	],
	"explanation_top": {
		"violation_count": 0.2603512437636879,
		"threads_mean": 0.1974546636610868,
		"cpu_std": 0.11916568542695376,
		"cpu_max": 0.11910500344587469,
		"open_files_mean": 0.10511217512130289
	},
	"meta": {"model_type": "rf", "run_source": "synthetic"}
}

Notes:
- RF model returned high confidence; LSTM (if present) not invoked for this run.
- Test script was fixed to call predict_run only once to avoid repeated model loads.
2025-11-15T08:12:31Z test_inference: rc=1
2025-11-15T08:15:12Z test_inference: rc=1
2025-11-15T08:18:37Z test_inference: rc=1
2025-11-15T08:31:33Z test_inference: rc=1
2025-11-16T05:14:37Z test_inference: rc=0
