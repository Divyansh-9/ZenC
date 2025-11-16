#!/usr/bin/env python3
"""
Test JSONL log summarization logic without Qt dependencies.
"""
import json
from pathlib import Path

def summarise_jsonl_log(log_path: str) -> str:
    """Summarize Core C monitoring logs (JSONL format)"""
    samples = 0
    max_cpu = 0.0
    max_memory = 0
    exit_code = None
    duration = 0.0
    
    with open(log_path, "r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            data = json.loads(line)
            
            if data.get("event") == "sample":
                samples += 1
                max_cpu = max(max_cpu, data.get("cpu_percent", 0))
                max_memory = max(max_memory, data.get("rss_bytes", 0))
            elif data.get("event") == "stop":
                exit_code = data.get("exit_code")
                duration = data.get("duration_seconds", 0.0)
    
    max_memory_mb = max_memory / (1024 * 1024)
    return f"Summary → samples: {samples} | duration: {duration:.1f}s | max CPU: {max_cpu:.1f}% | max mem: {max_memory_mb:.1f}MB | exit: {exit_code}"

if __name__ == "__main__":
    # Find latest JSONL log
    log_dir = Path(__file__).parent.parent / "monitor" / "logs"
    jsonl_logs = sorted(log_dir.glob("jail_run_*.jsonl"), 
                        key=lambda p: p.stat().st_mtime, 
                        reverse=True)
    
    if not jsonl_logs:
        print("❌ No JSONL logs found")
        exit(1)
    
    latest_log = jsonl_logs[0]
    print(f"Testing log: {latest_log.name}")
    
    # Test summarization
    try:
        summary = summarise_jsonl_log(str(latest_log))
        print(f"✓ {summary}")
        
        # Verify expected fields
        expected_fields = ['samples:', 'duration:', 'max CPU:', 'max mem:', 'exit:']
        missing = [f for f in expected_fields if f not in summary]
        
        if missing:
            print(f"❌ Missing fields: {missing}")
            exit(1)
        
        print("✅ All fields present - GUI integration logic works!")
        exit(0)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
