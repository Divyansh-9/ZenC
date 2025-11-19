#!/bin/bash
# Test: File Jail Panel - Button Re-Enable Test
# Verifies that the "Apply & Run" button always re-enables after execution
# This is a MANUAL test - requires GUI interaction

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "═══════════════════════════════════════════════════"
echo "File Jail Panel - Button Re-Enable Test (MANUAL)"
echo "═══════════════════════════════════════════════════"
echo ""

# Check if GUI is already running
if pgrep -f "zencube_modern_gui.py" > /dev/null; then
    echo "⚠️  GUI is already running. Please close it first."
    exit 1
fi

echo "This test verifies that the File Jail panel button always re-enables."
echo ""
echo "MANUAL STEPS:"
echo "1. The GUI will launch in 3 seconds"
echo "2. Navigate to the File Jail panel"
echo "3. Enable 'File Jail' checkbox"
echo "4. Set jail path to: sandbox_jail"
echo "5. Click 'Apply & Run' button"
echo "6. Observe the button status during execution"
echo "7. Verify button re-enables within 10 seconds"
echo ""
echo "PASS CRITERIA:"
echo "✅ Button re-enables automatically (even on error)"
echo "✅ Status output shows completion or error message"
echo "✅ Log link appears (if execution succeeded)"
echo ""
read -p "Press ENTER to launch GUI and begin manual test..."

cd "$PROJECT_ROOT/zencube"

# Launch GUI in background
python3 zencube_modern_gui.py &
GUI_PID=$!

echo "✅ GUI launched (PID: $GUI_PID)"
echo ""
echo "Perform the manual steps above, then press CTRL+C to stop the GUI."
echo ""

# Wait for user to finish testing
wait $GUI_PID || true

echo ""
echo "Test completed. Review the results manually."
