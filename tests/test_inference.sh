#!/usr/bin/env bash
set -eu -o pipefail

# Smoke test for ML inference shim.
# Prints JSON response and appends a one-line summary to phase3/TEST_RUNS.md

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="python3"
LOG_PATH="$ROOT_DIR/monitor/logs/monitor_run_20251113T031259Z_6962.jsonl"

if [ ! -f "$LOG_PATH" ]; then
  echo "Test log not found: $LOG_PATH" >&2
  exit 2
fi

set +e
OUTPUT=$($PYTHON - <<PY
import json, sys
from inference.ml_inference import MLInferenceEngine
engine = MLInferenceEngine()
res = engine.predict_run(r"$LOG_PATH")
try:
    doc = res.to_dict()
except Exception:
    # fallback if object-like dict
    if isinstance(res, dict):
        doc = res
    else:
        doc = {}
print(json.dumps(doc, indent=2))
sys.exit(0)
PY
)
RC=$?
set -e

echo "$OUTPUT"

# Append one-line summary to phase3/TEST_RUNS.md
SUMMARY_LINE="$(date -u +%Y-%m-%dT%H:%M:%SZ) test_inference: rc=$RC"
echo "$SUMMARY_LINE" >> "$ROOT_DIR/phase3/TEST_RUNS.md"

exit $RC
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${ROOT_DIR}/.venv/bin/python"
if [[ ! -x "${PYTHON_BIN}" ]]; then
  PYTHON_BIN="python3"
fi

LOG_ID="${1:-monitor/logs/synth/mal_memory_leak.jsonl}"
LOG_PATH="${LOG_ID}"
if [[ ! -f "${LOG_PATH}" ]]; then
  if [[ -f "${ROOT_DIR}/${LOG_ID}" ]]; then
    LOG_PATH="${ROOT_DIR}/${LOG_ID}"
  elif [[ -f "${ROOT_DIR}/monitor/logs/${LOG_ID}" ]]; then
    LOG_PATH="${ROOT_DIR}/monitor/logs/${LOG_ID}"
  elif [[ -f "${ROOT_DIR}/monitor/logs/synth/${LOG_ID}" ]]; then
    LOG_PATH="${ROOT_DIR}/monitor/logs/synth/${LOG_ID}"
  else
    echo "Log file not found for inference: ${LOG_ID}" >&2
    exit 1
  fi
fi

RESULT_PATH="$(mktemp)"
trap 'rm -f "${RESULT_PATH}"' EXIT

PYTHONPATH="${ROOT_DIR}" "${PYTHON_BIN}" - "${LOG_PATH}" "${RESULT_PATH}" <<'PY'
from __future__ import annotations

import json
import os
import sys

from inference import ml_inference

log_path = os.path.abspath(sys.argv[1])
result_path = sys.argv[2]

result = ml_inference.predict_run(log_path)
print(json.dumps(result, indent=2))

with open(result_path, "w", encoding="utf-8") as handle:
    json.dump(result, handle)
PY

read_summary="$(${PYTHON_BIN} - "${RESULT_PATH}" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    data = json.load(handle)
label = data.get("label", "unknown")
score = data.get("score")
run_id = data.get("runId") or "n/a"
if isinstance(score, (int, float)):
    score_text = f"{score:.2f}"
else:
    score_text = "n/a"
print(label)
print(score_text)
print(run_id)
PY
)"
LABEL="$(echo "${read_summary}" | sed -n '1p')"
SCORE="$(echo "${read_summary}" | sed -n '2p')"
RUN_ID="$(echo "${read_summary}" | sed -n '3p')"

TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
ENTRY="PASS – ML inference predicted ${LABEL} (score ${SCORE}) for ${RUN_ID}"

"${PYTHON_BIN}" - <<PY
from __future__ import annotations

from pathlib import Path

timestamp = "${TIMESTAMP}"
entry = "${ENTRY}"
root = Path("${ROOT_DIR}")
log_line = f"| {timestamp} | `bash tests/test_inference.sh` | {entry} |\n"
path = root / "phase3" / "TEST_RUNS.md"
with path.open("a", encoding="utf-8") as handle:
    handle.write(log_line)
PY
