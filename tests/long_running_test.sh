#!/bin/bash
# Test script for demonstrating the Stop button functionality
# This script runs for 60 seconds and outputs a message every 2 seconds

echo "🚀 Long-running test started - Run for 60 seconds"
echo "Use the STOP button in the GUI to terminate this process"
echo ""

for i in {1..30}; do
    echo "⏱️  Still running... (iteration $i/30)"
    sleep 2
done

echo ""
echo "✅ Test completed successfully!"
