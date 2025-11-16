#!/usr/bin/env bash
# Test script for sampler module
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_DIR="${SCRIPT_DIR}/../core_c"
BIN_DIR="${CORE_DIR}/bin"

echo "=== ZenCube Core C - Sampler Test ==="
echo ""

# Check if binary exists
if [[ ! -f "${BIN_DIR}/sampler" ]]; then
    echo "Error: sampler binary not found. Run 'make' first."
    exit 1
fi

# Create temp directory for test outputs
TEST_DIR=$(mktemp -d)
trap "rm -rf ${TEST_DIR}" EXIT

echo "Test directory: ${TEST_DIR}"
echo ""

# Test 1: Basic sampler run with self-monitoring
echo "[Test 1] Running sampler on self for 5 samples..."
RUN_ID="test_$(date +%s)"
SAMPLE_LOG="${TEST_DIR}/samples.jsonl"

# Start a long-running dummy process to monitor
sleep 30 &
TARGET_PID=$!

echo "Monitoring PID: ${TARGET_PID}"

# Start sampler in background
"${BIN_DIR}/sampler" \
    --pid ${TARGET_PID} \
    --interval 1 \
    --run-id "${RUN_ID}" \
    --out "${SAMPLE_LOG}" &
SAMPLER_PID=$!

# Let it run for 6 seconds (collect ~6 samples)
sleep 6

# Stop sampler gracefully
kill -INT ${SAMPLER_PID} 2>/dev/null || true
wait ${SAMPLER_PID} 2>/dev/null || true

# Kill the dummy process
kill ${TARGET_PID} 2>/dev/null || true
wait ${TARGET_PID} 2>/dev/null || true

# Check if log was created
if [[ ! -f "${SAMPLE_LOG}" ]]; then
    echo "FAIL: Sample log not created"
    exit 1
fi

# Count samples
SAMPLE_COUNT=$(wc -l < "${SAMPLE_LOG}")
echo "Samples collected: ${SAMPLE_COUNT}"

if [[ ${SAMPLE_COUNT} -lt 3 ]]; then
    echo "FAIL: Too few samples (expected at least 3, got ${SAMPLE_COUNT})"
    exit 1
fi

echo "PASS: Sampler generated samples"
echo ""

# Test 2: Validate JSONL format
echo "[Test 2] Validating JSONL format..."
PARSE_ERRORS=0

while IFS= read -r line; do
    if ! echo "${line}" | python3 -m json.tool > /dev/null 2>&1; then
        echo "FAIL: Invalid JSON: ${line}"
        PARSE_ERRORS=$((PARSE_ERRORS + 1))
    fi
done < "${SAMPLE_LOG}"

if [[ ${PARSE_ERRORS} -gt 0 ]]; then
    echo "FAIL: ${PARSE_ERRORS} JSON parsing errors"
    exit 1
fi

echo "PASS: All samples are valid JSON"
echo ""

# Test 3: Verify required fields
echo "[Test 3] Checking required fields in samples..."
FIRST_SAMPLE=$(head -n1 "${SAMPLE_LOG}")

REQUIRED_FIELDS=(
    "event"
    "run_id"
    "timestamp"
    "pid"
    "cpu_percent"
    "rss_bytes"
    "vms_bytes"
    "threads"
    "fds_open"
    "read_bytes"
    "write_bytes"
    "cpu_max"
    "rss_max"
)

MISSING_FIELDS=0
for field in "${REQUIRED_FIELDS[@]}"; do
    if ! echo "${FIRST_SAMPLE}" | grep -q "\"${field}\""; then
        echo "FAIL: Missing field: ${field}"
        MISSING_FIELDS=$((MISSING_FIELDS + 1))
    fi
done

if [[ ${MISSING_FIELDS} -gt 0 ]]; then
    echo "FAIL: ${MISSING_FIELDS} missing fields"
    exit 1
fi

echo "PASS: All required fields present"
echo ""

# Test 4: Verify metric values are reasonable
echo "[Test 4] Checking metric value ranges..."
CPU=$(echo "${FIRST_SAMPLE}" | python3 -c "import sys, json; print(json.load(sys.stdin)['cpu_percent'])")
RSS=$(echo "${FIRST_SAMPLE}" | python3 -c "import sys, json; print(json.load(sys.stdin)['rss_bytes'])")
THREADS=$(echo "${FIRST_SAMPLE}" | python3 -c "import sys, json; print(json.load(sys.stdin)['threads'])")

# Basic sanity checks
if (( $(echo "$CPU < 0 || $CPU > 100" | bc -l) )); then
    echo "FAIL: CPU percent out of range: ${CPU}"
    exit 1
fi

if (( $(echo "$RSS < 100000" | bc -l) )); then  # At least 100KB
    echo "FAIL: RSS too small: ${RSS}"
    exit 1
fi

if (( $(echo "$THREADS < 1" | bc -l) )); then
    echo "FAIL: Thread count invalid: ${THREADS}"
    exit 1
fi

echo "PASS: Metric values are reasonable"
echo "  CPU: ${CPU}%"
echo "  RSS: ${RSS} bytes"
echo "  Threads: ${THREADS}"
echo ""

# Test 5: Verify run_id propagation
echo "[Test 5] Verifying run_id propagation..."
RUN_ID_FROM_LOG=$(echo "${FIRST_SAMPLE}" | python3 -c "import sys, json; print(json.load(sys.stdin)['run_id'])")

if [[ "${RUN_ID_FROM_LOG}" != "${RUN_ID}" ]]; then
    echo "FAIL: run_id mismatch (expected: ${RUN_ID}, got: ${RUN_ID_FROM_LOG})"
    exit 1
fi

echo "PASS: run_id correctly propagated"
echo ""

# Test 6: Check timestamp format (ISO 8601)
echo "[Test 6] Validating timestamp format..."
TIMESTAMP=$(echo "${FIRST_SAMPLE}" | python3 -c "import sys, json; print(json.load(sys.stdin)['timestamp'])")

if ! echo "${TIMESTAMP}" | grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$'; then
    echo "FAIL: Invalid ISO 8601 timestamp: ${TIMESTAMP}"
    exit 1
fi

echo "PASS: Timestamp is valid ISO 8601 UTC"
echo "  ${TIMESTAMP}"
echo ""

# Summary
echo "==================================="
echo "All sampler tests PASSED ✓"
echo "==================================="
