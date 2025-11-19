#!/bin/bash
# Test: Monitor Panel - Graph Population Test
# Verifies that monitoring graphs populate with data during execution
# This is a MANUAL test - requires GUI interaction

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "═══════════════════════════════════════════════════"
echo "Monitor Panel - Graph Population Test (MANUAL)"
echo "═══════════════════════════════════════════════════"
echo ""

# Check if GUI is already running
if pgrep -f "zencube_modern_gui.py" > /dev/null; then
    echo "⚠️  GUI is already running. Please close it first."
    exit 1
fi

echo "This test verifies that the Monitoring panel graphs populate with data."
echo ""
echo "MANUAL STEPS:"
echo "1. The GUI will launch in 3 seconds"
echo "2. Navigate to the Monitoring Dashboard panel"
echo "3. Enable 'Enable monitoring for executions' checkbox"
echo "4. Set interval to 0.5 seconds (for faster sampling)"
echo "5. In Command section, set command: /bin/sleep"
echo "6. Set arguments: 3"
echo "7. Click 'Execute' button"
echo "8. Watch the graphs and sample view during execution"
echo "9. Wait for execution to complete"
echo ""
echo "PASS CRITERIA:"
echo "✅ Sample view shows live updates (CPU%, RSS, Threads)"
echo "✅ CPU graph shows data points (line appears)"
echo "✅ Memory graph shows data points (line appears)"
echo "✅ Summary displays: samples > 0, duration ~3s"
echo "✅ Log link appears"
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
echo "Expected monitor panel state:"
echo "  - Sample view: Contains multiple sample entries"
echo "  - CPU graph: Shows line with data points"
echo "  - Memory graph: Shows line with data points"
echo "  - Summary: 'samples 5-6 | duration 3.0s | peak CPU X% | peak RSS Y MB'"
echo "  - Log link: Clickable link to monitor_run_*.jsonl file"
echo ""
echo "To verify log file exists:"
echo "  ls -lht $PROJECT_ROOT/monitor/logs/monitor_run_*.jsonl | head -1"
