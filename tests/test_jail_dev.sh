#!/usr/bin/env bash
# Verify that the development jail wrapper flags attempts to read outside the jail.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
JAIL_DIR="${REPO_ROOT}/sandbox_jail"
WRAPPER="${REPO_ROOT}/monitor/jail_wrapper.py"
TESTBINS_DIR="${REPO_ROOT}/testbins"
TEST_SCRIPT="${TESTBINS_DIR}/try_read_outside.py"
JAIL_TEST_SCRIPT="${JAIL_DIR}/try_read_outside.py"
LOG_DIR="${REPO_ROOT}/monitor/logs"

if [[ ! -d "${JAIL_DIR}" ]]; then
    printf '[test-jail] Jail directory missing. Building default layout...\n'
    "${REPO_ROOT}/scripts/build_jail_dev.sh"
fi

mkdir -p "${TESTBINS_DIR}"
if [[ ! -f "${TEST_SCRIPT}" ]]; then
    printf '[test-jail] ERROR: %s is missing. Run git checkout or recreate it.\n' "${TEST_SCRIPT}" >&2
    exit 1
fi

cp "${TEST_SCRIPT}" "${JAIL_TEST_SCRIPT}"

printf '[test-jail] Running wrapper...\n'
set +e
python3 "${WRAPPER}" --jail "${JAIL_DIR}" -- python3 ./try_read_outside.py
status=$?
set -e

if [[ ${status} -eq 0 ]]; then
    printf '[test-jail] ERROR: Wrapper allowed escaping read.\n' >&2
    exit 1
fi

if [[ ${status} -ne 2 ]]; then
    printf '[test-jail] ERROR: Unexpected wrapper exit code %s (expected 2).\n' "${status}" >&2
    exit 1
fi

if ! python3 - "${LOG_DIR}" <<'PY'; then
import json
import pathlib
import sys

log_dir = pathlib.Path(sys.argv[1])
logs = sorted(log_dir.glob('jail_run_*.json'), key=lambda p: p.stat().st_mtime, reverse=True)
if not logs:
    raise SystemExit(1)

log_path = logs[0]
with open(log_path, 'r', encoding='utf-8') as handle:
    payload = json.load(handle)
violations = payload.get('violations', [])
if not any('/etc/hosts' in item for item in violations):
    raise SystemExit(1)

print(f"[test-jail] Latest log recorded /etc/hosts violation: {log_path}")
PY
    printf '[test-jail] ERROR: Failed to confirm violation in jail logs.\n' >&2
    exit 1
fi

printf '[test-jail] PASS: wrapper blocked /etc/hosts (exit code %s).\n' "${status}"
exit 0
