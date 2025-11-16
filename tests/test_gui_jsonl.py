#!/usr/bin/env python3
"""
Test GUI's ability to read and display Core C JSONL logs.
"""
import sys
import json
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from gui.file_jail_panel import FileJailPanel
from PySide6.QtWidgets import QApplication, QMainWindow

def test_jsonl_log_reading():
    """Test that the GUI can find and summarize JSONL logs"""
    print("Testing JSONL log reading...")
    
    # Find the latest log
    log_dir = Path(__file__).parent.parent / "monitor" / "logs"
    jsonl_logs = sorted(log_dir.glob("jail_run_*.jsonl"), 
                        key=lambda p: p.stat().st_mtime, 
                        reverse=True)
    
    if not jsonl_logs:
        print("❌ No JSONL logs found")
        return False
    
    latest_log = jsonl_logs[0]
    print(f"✓ Found latest log: {latest_log.name}")
    
    # Create minimal Qt app
    app = QApplication.instance() or QApplication(sys.argv)
    main_window = QMainWindow()
    
    # Create panel
    panel = FileJailPanel(main_window)
    
    # Test log finding
    found_log = panel._find_latest_log()
    if not found_log:
        print("❌ Panel could not find logs")
        return False
    
    print(f"✓ Panel found log: {found_log.name}")
    
    # Test log summarization
    summary = panel._summarise_log(str(found_log))
    if not summary:
        print("❌ Could not summarize log")
        return False
    
    print(f"✓ Log summary: {summary}")
    
    # Verify summary contains expected fields for JSONL
    if found_log.suffix == '.jsonl':
        expected_fields = ['samples:', 'duration:', 'max CPU:', 'max mem:', 'exit:']
        for field in expected_fields:
            if field not in summary:
                print(f"❌ Missing field in summary: {field}")
                return False
        print("✓ All expected fields present in JSONL summary")
    
    # Parse the actual log to verify accuracy
    samples = 0
    max_cpu = 0.0
    max_mem = 0
    exit_code = None
    
    with open(found_log, 'r') as f:
        for line in f:
            if not line.strip():
                continue
            data = json.loads(line)
            if data.get('event') == 'sample':
                samples += 1
                max_cpu = max(max_cpu, data.get('cpu_percent', 0))
                max_mem = max(max_mem, data.get('rss_bytes', 0))
            elif data.get('event') == 'stop':
                exit_code = data.get('exit_code')
    
    print(f"✓ Log verification: {samples} samples, max CPU {max_cpu:.1f}%, "
          f"max mem {max_mem/(1024*1024):.1f}MB, exit {exit_code}")
    
    return True

if __name__ == "__main__":
    try:
        success = test_jsonl_log_reading()
        if success:
            print("\n✅ All GUI JSONL tests passed!")
            sys.exit(0)
        else:
            print("\n❌ Some tests failed")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
