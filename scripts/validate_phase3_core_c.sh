#!/usr/bin/env bash
# Comprehensive validation script for Phase-3 Core C Implementation
# Scores implementation on a 0-10 scale across multiple dimensions

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}/.."
CORE_DIR="${PROJECT_ROOT}/core_c"
TESTS_DIR="${PROJECT_ROOT}/tests"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Scoring variables
TOTAL_SCORE=0
MAX_SCORE=100

echo "═══════════════════════════════════════════════════════════"
echo "  ZenCube Phase-3 Core C - Comprehensive Validation"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Test 1: Build System (10 points)
echo "[1/10] Testing Build System..."
cd "${CORE_DIR}"
if make clean > /dev/null 2>&1 && make all > /dev/null 2>&1; then
    if [[ -f "bin/sampler" ]] && [[ -f "bin/alertd" ]] && [[ -f "bin/logrotate_core" ]] && [[ -f "bin/prom_exporter" ]]; then
        echo -e "${GREEN}✓ All binaries built successfully${NC}"
        TOTAL_SCORE=$((TOTAL_SCORE + 10))
    else
        echo -e "${YELLOW}⚠ Build succeeded but missing binaries${NC}"
        TOTAL_SCORE=$((TOTAL_SCORE + 5))
    fi
else
    echo -e "${RED}✗ Build failed${NC}"
fi

# Test 2: Sampler Module (20 points)
echo ""
echo "[2/10] Testing Sampler Module..."
if bash "${TESTS_DIR}/test_sampler.sh" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Sampler tests passed${NC}"
    TOTAL_SCORE=$((TOTAL_SCORE + 20))
else
    echo -e "${RED}✗ Sampler tests failed${NC}"
fi

# Test 3: Alert Engine Module (20 points)
echo ""
echo "[3/10] Testing Alert Engine Module..."
if bash "${TESTS_DIR}/test_alert_engine.sh" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Alert engine tests passed${NC}"
    TOTAL_SCORE=$((TOTAL_SCORE + 20))
else
    echo -e "${RED}✗ Alert engine tests failed${NC}"
fi

# Test 4: Prometheus Exporter Module (20 points)
echo ""
echo "[4/10] Testing Prometheus Exporter Module..."
if bash "${TESTS_DIR}/test_core_c_prom.sh" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Prometheus exporter tests passed${NC}"
    TOTAL_SCORE=$((TOTAL_SCORE + 20))
else
    echo -e "${RED}✗ Prometheus exporter tests failed${NC}"
fi

# Test 5: Code Quality (10 points)
echo ""
echo "[5/10] Checking Code Quality..."
WARNINGS=$(cd "${CORE_DIR}" && make clean > /dev/null 2>&1 && make all 2>&1 | grep -c "warning:" || echo "0")
WARNINGS=$(echo "$WARNINGS" | tail -1)  # Get only the last line (the count)
if [[ ${WARNINGS} -eq 0 ]]; then
    echo -e "${GREEN}✓ No compiler warnings${NC}"
    TOTAL_SCORE=$((TOTAL_SCORE + 10))
elif [[ ${WARNINGS} -lt 10 ]]; then
    echo -e "${YELLOW}⚠ ${WARNINGS} compiler warnings${NC}"
    TOTAL_SCORE=$((TOTAL_SCORE + 5))
else
    echo -e "${RED}✗ ${WARNINGS} compiler warnings${NC}"
fi

# Test 6: Documentation (5 points)
echo ""
echo "[6/10] Checking Documentation..."
DOCS_SCORE=0
if [[ -f "${CORE_DIR}/README.md" ]]; then
    DOCS_SCORE=$((DOCS_SCORE + 2))
fi
if grep -q "Usage" "${CORE_DIR}/README.md" 2>/dev/null; then
    DOCS_SCORE=$((DOCS_SCORE + 1))
fi
if grep -q "Example" "${CORE_DIR}/README.md" 2>/dev/null; then
    DOCS_SCORE=$((DOCS_SCORE + 1))
fi
if [[ -f "${CORE_DIR}/Makefile" ]]; then
    DOCS_SCORE=$((DOCS_SCORE + 1))
fi

if [[ ${DOCS_SCORE} -ge 4 ]]; then
    echo -e "${GREEN}✓ Documentation complete${NC}"
    TOTAL_SCORE=$((TOTAL_SCORE + 5))
elif [[ ${DOCS_SCORE} -ge 2 ]]; then
    echo -e "${YELLOW}⚠ Documentation incomplete${NC}"
    TOTAL_SCORE=$((TOTAL_SCORE + 2))
else
    echo -e "${RED}✗ Missing documentation${NC}"
fi

# Test 7: JSON Schema Compatibility (5 points)
echo ""
echo "[7/10] Checking JSON Schema Compatibility..."
TEST_DIR=$(mktemp -d)
trap "rm -rf ${TEST_DIR}" EXIT

sleep 5 & PID=$!
"${CORE_DIR}/bin/sampler" --pid $PID --interval 1 --run-id compat_test --out "${TEST_DIR}/compat.jsonl" &
SAMPLER_PID=$!
sleep 2
kill -INT ${SAMPLER_PID} 2>/dev/null || true
wait ${SAMPLER_PID} 2>/dev/null || true
kill $PID 2>/dev/null || true

REQUIRED_FIELDS=("event" "run_id" "timestamp" "pid" "cpu_percent" "rss_bytes" "vms_bytes" "threads" "fds_open")
COMPAT_SCORE=0

if [[ -f "${TEST_DIR}/compat.jsonl" ]]; then
    FIRST_SAMPLE=$(grep '"event":"sample"' "${TEST_DIR}/compat.jsonl" | head -n1)
    for field in "${REQUIRED_FIELDS[@]}"; do
        if echo "${FIRST_SAMPLE}" | grep -q "\"${field}\""; then
            COMPAT_SCORE=$((COMPAT_SCORE + 1))
        fi
    done
fi

if [[ ${COMPAT_SCORE} -eq ${#REQUIRED_FIELDS[@]} ]]; then
    echo -e "${GREEN}✓ All required fields present${NC}"
    TOTAL_SCORE=$((TOTAL_SCORE + 5))
elif [[ ${COMPAT_SCORE} -ge 7 ]]; then
    echo -e "${YELLOW}⚠ Missing ${#REQUIRED_FIELDS[@]}-${COMPAT_SCORE} fields${NC}"
    TOTAL_SCORE=$((TOTAL_SCORE + 3))
else
    echo -e "${RED}✗ Schema compatibility issues${NC}"
fi

# Test 8: Memory Safety (5 points)
echo ""
echo "[8/10] Checking Memory Safety..."
if command -v valgrind &> /dev/null; then
    sleep 3 & PID=$!
    timeout 5s valgrind --leak-check=full --error-exitcode=1 \
        "${CORE_DIR}/bin/sampler" --pid $PID --interval 1 --run-id valgrind_test --out "${TEST_DIR}/valgrind.jsonl" \
        > /dev/null 2>&1 &
    SAMPLER_PID=$!
    sleep 2
    kill -INT ${SAMPLER_PID} 2>/dev/null || true
    wait ${SAMPLER_PID} 2>/dev/null
    VALGRIND_EXIT=$?
    kill $PID 2>/dev/null || true
    
    if [[ ${VALGRIND_EXIT} -eq 0 ]]; then
        echo -e "${GREEN}✓ No memory leaks detected${NC}"
        TOTAL_SCORE=$((TOTAL_SCORE + 5))
    else
        echo -e "${YELLOW}⚠ Potential memory issues${NC}"
        TOTAL_SCORE=$((TOTAL_SCORE + 2))
    fi
else
    echo -e "${YELLOW}⚠ Valgrind not available, skipping${NC}"
    TOTAL_SCORE=$((TOTAL_SCORE + 3))
fi

# Test 9: Performance (3 points)
echo ""
echo "[9/10] Checking Performance..."
sleep 10 & PID=$!
START=$(date +%s%N)
timeout 3s "${CORE_DIR}/bin/sampler" --pid $PID --interval 0.5 --run-id perf_test --out "${TEST_DIR}/perf.jsonl" &
SAMPLER_PID=$!
sleep 2.5
kill -INT ${SAMPLER_PID} 2>/dev/null || true
wait ${SAMPLER_PID} 2>/dev/null || true
END=$(date +%s%N)
kill $PID 2>/dev/null || true

DURATION_NS=$((END - START))
DURATION_MS=$((DURATION_NS / 1000000))

SAMPLE_COUNT=$(grep -c '"event":"sample"' "${TEST_DIR}/perf.jsonl" || echo "0")

if [[ ${SAMPLE_COUNT} -ge 4 ]] && [[ ${DURATION_MS} -lt 3000 ]]; then
    echo -e "${GREEN}✓ Performance acceptable (${SAMPLE_COUNT} samples in ${DURATION_MS}ms)${NC}"
    TOTAL_SCORE=$((TOTAL_SCORE + 3))
elif [[ ${SAMPLE_COUNT} -ge 3 ]]; then
    echo -e "${YELLOW}⚠ Performance marginal (${SAMPLE_COUNT} samples)${NC}"
    TOTAL_SCORE=$((TOTAL_SCORE + 1))
else
    echo -e "${RED}✗ Performance poor (${SAMPLE_COUNT} samples)${NC}"
fi

# Test 10: Portability (2 points)
echo ""
echo "[10/10] Checking Portability..."
PORT_SCORE=0

# Check for POSIX compliance
if grep -q "_POSIX_C_SOURCE" "${CORE_DIR}/Makefile"; then
    PORT_SCORE=$((PORT_SCORE + 1))
fi

# Check for Linux-specific dependencies
if ! grep -qE "(__linux__|linux)" "${CORE_DIR}"/*.c; then
    PORT_SCORE=$((PORT_SCORE + 1))
else
    # If Linux-specific, check if documented
    if grep -qi "linux" "${CORE_DIR}/README.md" 2>/dev/null; then
        PORT_SCORE=$((PORT_SCORE + 1))
    fi
fi

if [[ ${PORT_SCORE} -eq 2 ]]; then
    echo -e "${GREEN}✓ Portable implementation${NC}"
    TOTAL_SCORE=$((TOTAL_SCORE + 2))
elif [[ ${PORT_SCORE} -eq 1 ]]; then
    echo -e "${YELLOW}⚠ Limited portability${NC}"
    TOTAL_SCORE=$((TOTAL_SCORE + 1))
else
    echo -e "${RED}✗ Platform-specific code without documentation${NC}"
fi

# Calculate final score
FINAL_SCORE=$(echo "scale=1; ${TOTAL_SCORE} / 10" | bc)

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "                    FINAL SCORE"
echo "═══════════════════════════════════════════════════════════"
echo ""
printf "Score: %.1f / 10.0\n" ${FINAL_SCORE}
echo "Raw Points: ${TOTAL_SCORE} / ${MAX_SCORE}"
echo ""

if (( $(echo "${FINAL_SCORE} >= 9.0" | bc -l) )); then
    echo -e "${GREEN}✓ EXCELLENT - Ready for production${NC}"
    echo "Status: APPROVED for Python module removal"
    exit 0
elif (( $(echo "${FINAL_SCORE} >= 7.0" | bc -l) )); then
    echo -e "${YELLOW}⚠ GOOD - Minor improvements recommended${NC}"
    echo "Status: Conditional approval, review warnings"
    exit 0
elif (( $(echo "${FINAL_SCORE} >= 5.0" | bc -l) )); then
    echo -e "${YELLOW}⚠ ACCEPTABLE - Significant improvements needed${NC}"
    echo "Status: NOT APPROVED, requires fixes"
    exit 1
else
    echo -e "${RED}✗ POOR - Major issues detected${NC}"
    echo "Status: NOT APPROVED, substantial rework required"
    exit 1
fi
