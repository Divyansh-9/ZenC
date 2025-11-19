#!/bin/bash
# Test: Network Panel - Status Update Test
# Verifies that network restriction status updates after execution
# This is a MANUAL test - requires GUI interaction

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "═══════════════════════════════════════════════════"
echo "Network Panel - Status Update Test (MANUAL)"
echo "═══════════════════════════════════════════════════"
echo ""

# Check if GUI is already running
if pgrep -f "zencube_modern_gui.py" > /dev/null; then
    echo "⚠️  GUI is already running. Please close it first."
    exit 1
fi

echo "This test verifies that the Network panel updates status after execution."
echo ""
echo "MANUAL STEPS:"
echo "1. The GUI will launch in 3 seconds"
echo "2. Navigate to the Network Restriction panel"
echo "3. Enable 'Disable Network Access' checkbox"
echo "4. In Command section, set command: /bin/echo"
echo "5. Set arguments: 'Network test'"
echo "6. Enable monitoring (optional, for better tracking)"
echo "7. Click 'Execute' button"
echo "8. Wait for execution to complete"
echo "9. Check Network panel for status update"
echo ""
echo "PASS CRITERIA:"
echo "✅ Status label updates (shows 'monitoring PID' then 'completed')"
echo "✅ Note box displays execution summary or log reference"
echo "✅ Status is NOT just 'Network access: disabled (dev-safe)'"
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
echo ""
echo "Expected network panel state:"
echo "  - Status: 'Network blocking: ACTIVE' or 'wrapped execution completed'"
echo "  - Note box: Contains log filename and summary"
