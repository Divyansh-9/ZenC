#!/bin/bash
# Verification script for ML anomaly detection test suite
# This script validates that:
# 1. ui_test_programs/bin/* files are whitelisted (should NOT trigger ML analysis)
# 2. ml_anomaly_tests/bin/* files are NOT whitelisted (SHOULD trigger ML analysis)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║     ML Anomaly Detection Whitelist Verification Script          ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Check if anomaly config exists
CONFIG_FILE="$PROJECT_ROOT/config/anomaly.config.jsonc"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ ERROR: Anomaly config not found at $CONFIG_FILE"
    exit 1
fi

echo "✓ Found anomaly config: $CONFIG_FILE"
echo ""

# Extract whitelist from config (strip comments and parse JSON)
echo "📋 Whitelist contents:"
echo "─────────────────────────────────────────────────────────────────"
grep -A 10 '"whitelist"' "$CONFIG_FILE" | grep -E '^\s*"[^"]+"\s*,?' | sed 's/,$//' | sed 's/^\s*/  - /'
echo ""

# Check ui_test_programs/bin files (should be whitelisted)
echo "🔍 Checking ui_test_programs/bin files (SHOULD be whitelisted):"
echo "─────────────────────────────────────────────────────────────────"
WHITELIST_DIR="$PROJECT_ROOT/ui_test_programs/bin"
if [ -d "$WHITELIST_DIR" ]; then
    for file in "$WHITELIST_DIR"/*; do
        if [ -f "$file" ]; then
            basename=$(basename "$file")
            if grep -q "\"$basename\"" "$CONFIG_FILE"; then
                echo "  ✓ $basename - WHITELISTED (will skip ML analysis)"
            else
                echo "  ❌ $basename - NOT WHITELISTED (will be analyzed!)"
            fi
        fi
    done
else
    echo "  ⚠️  Directory not found: $WHITELIST_DIR"
fi
echo ""

# Check ml_anomaly_tests/bin files (should NOT be whitelisted)
echo "🔍 Checking ml_anomaly_tests/bin files (should NOT be whitelisted):"
echo "─────────────────────────────────────────────────────────────────"
ANOMALY_DIR="$PROJECT_ROOT/ml_anomaly_tests/bin"
if [ -d "$ANOMALY_DIR" ]; then
    for file in "$ANOMALY_DIR"/*; do
        if [ -f "$file" ]; then
            basename=$(basename "$file")
            if grep -q "\"$basename\"" "$CONFIG_FILE"; then
                echo "  ❌ $basename - WHITELISTED (should NOT be!)"
            else
                echo "  ✓ $basename - NOT WHITELISTED (will be analyzed)"
            fi
        fi
    done
else
    echo "  ⚠️  Directory not found: $ANOMALY_DIR"
fi
echo ""

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                     Verification Complete                        ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Summary:"
echo "  • ui_test_programs/bin: Benign test utilities (whitelisted)"
echo "  • ml_anomaly_tests/bin: Anomaly triggers (NOT whitelisted)"
echo ""
echo "✅ If all checks passed, the whitelist is configured correctly!"
echo ""
