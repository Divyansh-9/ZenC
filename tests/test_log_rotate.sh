#!/usr/bin/env bash
set -euo pipefail

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

export TMP_DIR

mkdir -p "$TMP_DIR"

# Create 15 synthetic log files with slight modification deltas
for i in $(seq 1 15); do
    printf '{"event":"sample","index":%d}\n' "$i" >"$TMP_DIR/run_$i.jsonl"
    # Ensure differing timestamps for ordering
    sleep 0.02
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
PYTHON_BIN="${ROOT_DIR}/.venv/bin/python"
if [[ ! -x "${PYTHON_BIN}" ]]; then
    PYTHON_BIN="$(command -v python3)"
fi

"${PYTHON_BIN}" - <<'PY'
import os
from pathlib import Path

from monitor.log_rotate import rotate_logs

log_dir = Path(os.environ["TMP_DIR"])
# Dry run should keep everything intact while reporting planned actions
preview = rotate_logs(log_dir, keep=10, dry_run=True)
assert preview.archived == 5, f"Expected 5 files to be flagged for archival, got {preview.archived}"
assert len(list(log_dir.glob("*.jsonl"))) == 15, "Dry-run must not remove files"

# Real rotation should compress five files and leave ten JSONL logs
result = rotate_logs(log_dir, keep=10)
assert result.archived == 5, f"Expected 5 files archived, got {result.archived}"
remaining = list(log_dir.glob("*.jsonl"))
assert len(remaining) == 10, f"Expected 10 jsonl files remaining, got {len(remaining)}"
archive_files = list((log_dir / "archive").glob("*.gz"))
assert len(archive_files) == 5, f"Expected 5 archived files, got {len(archive_files)}"
PY
