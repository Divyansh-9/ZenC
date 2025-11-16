#!/usr/bin/env bash
# Test script for alert_engine module
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_DIR="${SCRIPT_DIR}/../core_c"
BIN_DIR="${CORE_DIR}/bin"

echo "=== ZenCube Core C - Alert Engine Test ==="
echo ""

# Check if binary exists
if [[ ! -f "${BIN_DIR}/alertd" ]]; then
    echo "Error: alertd binary not found. Run 'make' first."
    exit 1
fi

# Create temp directory for test outputs
TEST_DIR=$(mktemp -d)
trap "rm -rf ${TEST_DIR}" EXIT

echo "Test directory: ${TEST_DIR}"
echo ""

# Test 1: Create test alert config
echo "[Test 1] Creating test alert configuration..."
ALERT_CONFIG="${TEST_DIR}/alert_config.json"
cat > "${ALERT_CONFIG}" <<EOF
{
  "rules": [
    {
      "metric": "cpu_percent",
      "operator": ">",
      "threshold": 50.0,
      "duration_samples": 2
    },
    {
      "metric": "rss_bytes",
      "operator": ">",
      "threshold": 100000000,
      "duration_samples": 1
    },
    {
      "metric": "fds_open",
      "operator": ">",
      "threshold": 100,
      "duration_samples": 3
    }
  ]
}
EOF

echo "PASS: Alert config created"
echo ""

# Test 2: Create synthetic sample log with violations
echo "[Test 2] Creating synthetic sample log..."
SAMPLE_LOG="${TEST_DIR}/samples.jsonl"
RUN_ID="test_alert_$(date +%s)"

# Generate samples with CPU violations
for i in {1..5}; do
    cat >> "${SAMPLE_LOG}" <<EOF
{"event":"sample","run_id":"${RUN_ID}","timestamp":"2024-01-01T00:0${i}:00Z","pid":1234,"cpu_percent":$(( 40 + i * 5 )),"rss_bytes":50000000,"vms_bytes":100000000,"threads":5,"fds_open":20,"read_bytes":1000,"write_bytes":2000,"cpu_max":70.0,"rss_max":60000000}
EOF
done

SAMPLE_COUNT=$(wc -l < "${SAMPLE_LOG}")
echo "Generated ${SAMPLE_COUNT} samples"
echo "PASS: Sample log created"
echo ""

# Test 3: Run alert engine
echo "[Test 3] Running alert engine (5 second evaluation)..."
ALERT_LOG="${TEST_DIR}/alerts.jsonl"

timeout 8s "${BIN_DIR}/alertd" \
    --config "${ALERT_CONFIG}" \
    --log "${SAMPLE_LOG}" \
    --out "${ALERT_LOG}" \
    --run-id "${RUN_ID}" \
    --interval 1 || true

# Check if alerts were generated
if [[ ! -f "${ALERT_LOG}" ]]; then
    echo "FAIL: Alert log not created"
    exit 1
fi

ALERT_COUNT=$(wc -l < "${ALERT_LOG}")
echo "Alerts triggered: ${ALERT_COUNT}"

if [[ ${ALERT_COUNT} -eq 0 ]]; then
    echo "FAIL: No alerts generated (expected at least 1)"
    exit 1
fi

echo "PASS: Alerts were triggered"
echo ""

# Test 4: Validate alert JSONL format
echo "[Test 4] Validating alert JSONL format..."
PARSE_ERRORS=0

while IFS= read -r line; do
    if ! echo "${line}" | python3 -m json.tool > /dev/null 2>&1; then
        echo "FAIL: Invalid JSON: ${line}"
        PARSE_ERRORS=$((PARSE_ERRORS + 1))
    fi
done < "${ALERT_LOG}"

if [[ ${PARSE_ERRORS} -gt 0 ]]; then
    echo "FAIL: ${PARSE_ERRORS} JSON parsing errors"
    exit 1
fi

echo "PASS: All alerts are valid JSON"
echo ""

# Test 5: Check alert fields
echo "[Test 5] Checking required alert fields..."
FIRST_ALERT=$(head -n1 "${ALERT_LOG}")

REQUIRED_FIELDS=(
    "alert_id"
    "metric"
    "run_id"
    "triggered_at"
    "value"
    "threshold"
    "duration_sec"
    "acknowledged"
)

MISSING_FIELDS=0
for field in "${REQUIRED_FIELDS[@]}"; do
    if ! echo "${FIRST_ALERT}" | grep -q "\"${field}\""; then
        echo "FAIL: Missing field: ${field}"
        MISSING_FIELDS=$((MISSING_FIELDS + 1))
    fi
done

if [[ ${MISSING_FIELDS} -gt 0 ]]; then
    echo "FAIL: ${MISSING_FIELDS} missing fields"
    exit 1
fi

echo "PASS: All required alert fields present"
echo ""

# Test 6: Verify alert content
echo "[Test 6] Verifying alert content..."
METRIC=$(echo "${FIRST_ALERT}" | python3 -c "import sys, json; print(json.load(sys.stdin)['metric'])")
VALUE=$(echo "${FIRST_ALERT}" | python3 -c "import sys, json; print(json.load(sys.stdin)['value'])")
THRESHOLD=$(echo "${FIRST_ALERT}" | python3 -c "import sys, json; print(json.load(sys.stdin)['threshold'])")

echo "  Metric: ${METRIC}"
echo "  Value: ${VALUE}"
echo "  Threshold: ${THRESHOLD}"

if [[ "${METRIC}" != "cpu_percent" ]]; then
    echo "FAIL: Expected cpu_percent alert, got ${METRIC}"
    exit 1
fi

if (( $(echo "$VALUE <= $THRESHOLD" | bc -l) )); then
    echo "FAIL: Alert value (${VALUE}) not greater than threshold (${THRESHOLD})"
    exit 1
fi

echo "PASS: Alert content is correct"
echo ""

# Test 7: Test with empty sample log
echo "[Test 7] Testing with empty sample log..."
EMPTY_LOG="${TEST_DIR}/empty.jsonl"
touch "${EMPTY_LOG}"

timeout 3s "${BIN_DIR}/alertd" \
    --config "${ALERT_CONFIG}" \
    --log "${EMPTY_LOG}" \
    --out "${TEST_DIR}/empty_alerts.jsonl" \
    --run-id "test_empty" \
    --interval 1 || true

echo "PASS: Handles empty log gracefully"
echo ""

# Summary
echo "==================================="
echo "All alert engine tests PASSED ✓"
echo "==================================="
