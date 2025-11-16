#!/bin/bash
# ZenCube Demo Script - Shows all features in action
# Date: November 16, 2025

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "═══════════════════════════════════════════════════════════"
echo "          ZenCube Phase-3 Core C Integration Demo"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Change to project directory
cd "$(dirname "$0")/zencube"

echo -e "${BLUE}[Demo 1]${NC} Basic execution with Core C monitoring"
echo "Command: ./sandbox --enable-core-c --cpu=10 echo 'Hello, ZenCube!'"
echo ""
./sandbox --enable-core-c --cpu=10 echo "Hello, ZenCube!"
echo ""
sleep 1

echo -e "${BLUE}[Demo 2]${NC} CPU-intensive workload"
echo "Command: Python computing sum of squares"
echo ""
./sandbox --enable-core-c --cpu=5 python3 -c 'print("Computing..."); sum(i*i for i in range(5000000)); print("Done!")'
echo ""
sleep 1

echo -e "${BLUE}[Demo 3]${NC} Memory allocation test"
echo "Command: Python allocating 50MB"
echo ""
./sandbox --enable-core-c --mem=100 --cpu=5 python3 -c 'import time; data = bytearray(50*1024*1024); print(f"Allocated {len(data)/(1024*1024):.0f}MB"); time.sleep(1); print("Done!")'
echo ""
sleep 1

echo -e "${BLUE}[Demo 4]${NC} Multi-process simulation"
echo "Command: Bash loop with multiple iterations"
echo ""
./sandbox --enable-core-c --cpu=10 bash -c 'for i in {1..5}; do echo "Process iteration $i"; sleep 0.5; done'
echo ""
sleep 1

echo -e "${BLUE}[Demo 5]${NC} Backward compatibility (without Core C)"
echo "Command: Same as above but without --enable-core-c flag"
echo ""
./sandbox --cpu=10 bash -c 'echo "Running in legacy mode"; sleep 1; echo "No Core C monitoring"'
echo ""
sleep 1

# Show logs
cd ..
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}Recent Monitoring Logs${NC}"
echo "═══════════════════════════════════════════════════════════"
ls -lht monitor/logs/*.jsonl 2>/dev/null | head -5 || echo "No logs found"
echo ""

# Show latest log summary
if ls monitor/logs/*.jsonl 1> /dev/null 2>&1; then
    LATEST_LOG=$(ls -t monitor/logs/*.jsonl | head -1)
    echo -e "${GREEN}Latest Log Summary${NC}"
    echo "File: $(basename $LATEST_LOG)"
    
    STOP_EVENT=$(tail -1 "$LATEST_LOG")
    SAMPLES=$(echo "$STOP_EVENT" | python3 -c "import json, sys; print(json.load(sys.stdin)['samples'])")
    DURATION=$(echo "$STOP_EVENT" | python3 -c "import json, sys; print(f\"{json.load(sys.stdin)['duration_seconds']:.2f}\")")
    MAX_CPU=$(echo "$STOP_EVENT" | python3 -c "import json, sys; print(f\"{json.load(sys.stdin)['max_cpu_percent']:.1f}\")")
    MAX_MEM=$(echo "$STOP_EVENT" | python3 -c "import json, sys; print(f\"{json.load(sys.stdin)['max_memory_rss']/(1024*1024):.1f}\")")
    EXIT_CODE=$(echo "$STOP_EVENT" | python3 -c "import json, sys; print(json.load(sys.stdin)['exit_code'])")
    
    echo "  Samples: $SAMPLES"
    echo "  Duration: ${DURATION}s"
    echo "  Max CPU: ${MAX_CPU}%"
    echo "  Max Memory: ${MAX_MEM}MB"
    echo "  Exit Code: $EXIT_CODE"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ Demo Complete!${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Key Features Demonstrated:"
echo "  ✓ Core C monitoring with --enable-core-c flag"
echo "  ✓ Resource limits (CPU, memory)"
echo "  ✓ Real-time sampling (1-second intervals)"
echo "  ✓ JSONL log generation"
echo "  ✓ CPU and memory tracking"
echo "  ✓ Backward compatibility (works without flag)"
echo ""
echo "Next Steps:"
echo "  1. View logs: cat monitor/logs/jail_run_*.jsonl | python3 -m json.tool"
echo "  2. Run validation: bash scripts/validate_phase3_core_c.sh"
echo "  3. Launch GUI: python3 zencube_modern_gui.py (if PySide6 installed)"
echo ""
