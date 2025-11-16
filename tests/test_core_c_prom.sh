#!/usr/bin/env bash
# Test script for Prometheus exporter module
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_DIR="${SCRIPT_DIR}/../core_c"
BIN_DIR="${CORE_DIR}/bin"

echo "=== ZenCube Core C - Prometheus Exporter Test ==="
echo ""

# Check if binary exists
if [[ ! -f "${BIN_DIR}/prom_exporter" ]]; then
    echo "Error: prom_exporter binary not found. Run 'make' first."
    exit 1
fi

# Check if curl is available
if ! command -v curl &> /dev/null; then
    echo "Error: curl not found. Please install curl for HTTP testing."
    exit 1
fi

# Create temp directory for test outputs
TEST_DIR=$(mktemp -d)
trap "rm -rf ${TEST_DIR}" EXIT

echo "Test directory: ${TEST_DIR}"
echo ""

# Test 1: Create sample log with metrics
echo "[Test 1] Creating sample log with metrics..."
SAMPLE_LOG="${TEST_DIR}/samples.jsonl"
cat > "${SAMPLE_LOG}" <<EOF
{"event":"sample","run_id":"test_prom","timestamp":"2024-01-01T00:00:00Z","pid":1234,"cpu_percent":45.5,"rss_bytes":123456789,"vms_bytes":234567890,"threads":8,"fds_open":42,"read_bytes":1048576,"write_bytes":2097152,"cpu_max":67.2,"rss_max":150000000}
EOF

echo "PASS: Sample log created"
echo ""

# Test 2: Start Prometheus exporter
echo "[Test 2] Starting Prometheus exporter on port 19090..."
PORT=19090

"${BIN_DIR}/prom_exporter" --log "${SAMPLE_LOG}" --port ${PORT} &
EXPORTER_PID=$!

# Wait for server to start
sleep 2

# Check if process is running
if ! kill -0 ${EXPORTER_PID} 2>/dev/null; then
    echo "FAIL: Exporter process died unexpectedly"
    exit 1
fi

echo "PASS: Exporter started (PID: ${EXPORTER_PID})"
echo ""

# Test 3: Fetch /metrics endpoint
echo "[Test 3] Fetching /metrics endpoint..."
METRICS_OUTPUT="${TEST_DIR}/metrics.txt"

HTTP_CODE=$(curl -s -o "${METRICS_OUTPUT}" -w "%{http_code}" http://localhost:${PORT}/metrics)

if [[ "${HTTP_CODE}" != "200" ]]; then
    echo "FAIL: HTTP request failed (code: ${HTTP_CODE})"
    kill ${EXPORTER_PID} 2>/dev/null || true
    exit 1
fi

echo "PASS: HTTP 200 OK received"
echo ""

# Test 4: Validate Prometheus format
echo "[Test 4] Validating Prometheus metrics format..."
EXPECTED_METRICS=(
    "zencube_cpu_percent"
    "zencube_memory_rss_bytes"
    "zencube_memory_vms_bytes"
    "zencube_threads"
    "zencube_fds_open"
    "zencube_io_read_bytes_total"
    "zencube_io_write_bytes_total"
    "zencube_cpu_max_percent"
    "zencube_memory_rss_max_bytes"
)

MISSING_METRICS=0
for metric in "${EXPECTED_METRICS[@]}"; do
    if ! grep -q "^${metric} " "${METRICS_OUTPUT}"; then
        echo "FAIL: Missing metric: ${metric}"
        MISSING_METRICS=$((MISSING_METRICS + 1))
    fi
done

if [[ ${MISSING_METRICS} -gt 0 ]]; then
    echo "FAIL: ${MISSING_METRICS} missing metrics"
    kill ${EXPORTER_PID} 2>/dev/null || true
    exit 1
fi

echo "PASS: All expected metrics present"
echo ""

# Test 5: Verify metric values
echo "[Test 5] Verifying metric values..."
CPU_VALUE=$(grep "^zencube_cpu_percent " "${METRICS_OUTPUT}" | awk '{print $2}')
RSS_VALUE=$(grep "^zencube_memory_rss_bytes " "${METRICS_OUTPUT}" | awk '{print $2}')
FDS_VALUE=$(grep "^zencube_fds_open " "${METRICS_OUTPUT}" | awk '{print $2}')

echo "  CPU: ${CPU_VALUE}%"
echo "  RSS: ${RSS_VALUE} bytes"
echo "  FDs: ${FDS_VALUE}"

if [[ "${CPU_VALUE}" != "45.50" ]]; then
    echo "FAIL: CPU value mismatch (expected 45.50, got ${CPU_VALUE})"
    kill ${EXPORTER_PID} 2>/dev/null || true
    exit 1
fi

if [[ "${RSS_VALUE}" != "123456789" ]]; then
    echo "FAIL: RSS value mismatch (expected 123456789, got ${RSS_VALUE})"
    kill ${EXPORTER_PID} 2>/dev/null || true
    exit 1
fi

echo "PASS: Metric values match sample data"
echo ""

# Test 6: Check HELP and TYPE comments
echo "[Test 6] Checking metric metadata..."
if ! grep -q "# HELP zencube_cpu_percent" "${METRICS_OUTPUT}"; then
    echo "FAIL: Missing HELP comment for cpu_percent"
    kill ${EXPORTER_PID} 2>/dev/null || true
    exit 1
fi

if ! grep -q "# TYPE zencube_cpu_percent gauge" "${METRICS_OUTPUT}"; then
    echo "FAIL: Missing TYPE comment for cpu_percent"
    kill ${EXPORTER_PID} 2>/dev/null || true
    exit 1
fi

echo "PASS: Metric metadata (HELP/TYPE) present"
echo ""

# Test 7: Test 404 for wrong path
echo "[Test 7] Testing 404 for invalid path..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${PORT}/invalid)

if [[ "${HTTP_CODE}" != "404" ]]; then
    echo "FAIL: Expected 404 for invalid path, got ${HTTP_CODE}"
    kill ${EXPORTER_PID} 2>/dev/null || true
    exit 1
fi

echo "PASS: Returns 404 for invalid paths"
echo ""

# Test 8: Test with missing sample log
echo "[Test 8] Testing 503 with missing sample log..."
# Start new exporter with non-existent log
"${BIN_DIR}/prom_exporter" --log "/nonexistent/path.jsonl" --port 19091 &
EXPORTER2_PID=$!
sleep 2

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:19091/metrics)

kill ${EXPORTER2_PID} 2>/dev/null || true

if [[ "${HTTP_CODE}" != "503" ]]; then
    echo "FAIL: Expected 503 for missing log, got ${HTTP_CODE}"
    kill ${EXPORTER_PID} 2>/dev/null || true
    exit 1
fi

echo "PASS: Returns 503 when sample log not found"
echo ""

# Cleanup
kill ${EXPORTER_PID} 2>/dev/null || true
wait ${EXPORTER_PID} 2>/dev/null || true

# Summary
echo "==================================="
echo "All Prometheus exporter tests PASSED ✓"
echo "==================================="
