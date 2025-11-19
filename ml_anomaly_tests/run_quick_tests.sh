#!/bin/bash
# Quick test runner for ML anomaly tests
# Runs each test program with a timeout to avoid long waits

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$SCRIPT_DIR/bin"

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║          ML Anomaly Test Suite - Quick Runner                   ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Running all ML anomaly tests with 8-second timeout..."
echo "Note: These tests are designed to trigger anomalies."
echo ""

run_test() {
    local name=$1
    local timeout=$2
    echo "─────────────────────────────────────────────────────────────────"
    echo "🧪 Running: $name (timeout: ${timeout}s)"
    echo "─────────────────────────────────────────────────────────────────"
    
    if timeout ${timeout}s "$BIN_DIR/$name" 2>&1 | head -n 30; then
        echo "✅ Test completed successfully"
    else
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            echo "⏱️  Test timed out (expected for long-running tests)"
        else
            echo "⚠️  Test exited with code $exit_code"
        fi
    fi
    echo ""
}

# Run each test with appropriate timeout
run_test "cpu_spike_attack" 8
run_test "memory_leak_progressive" 8
run_test "fork_bomb_gradual" 8
run_test "io_storm_writer" 8
run_test "resource_exhaustion_combo" 8
run_test "ml_test_pattern" 8

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                    All Tests Completed                           ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "📝 Next steps:"
echo "  1. Run these tests via ZenCube GUI (Sandbox tab)"
echo "  2. Check ML Anomaly Detection tab for analysis results"
echo "  3. Verify anomalies are detected for these programs"
echo "  4. Verify ui_test_programs/bin files do NOT show anomalies"
echo ""
