# ZenCube GUI User Guide

**Application:** ZenCube Modern GUI  
**Status:** ✅ Running  
**Date:** November 16, 2025

---

## 🎨 **GUI Overview**

The ZenCube Modern GUI provides a graphical interface for:

1. **File Jail Panel** - Sandbox execution with file restrictions
2. **Monitor Panel** - Real-time resource monitoring
3. **Network Panel** - Network restriction controls

---

## 📋 **Current Features**

### **File Jail Panel**

**Purpose:** Execute commands in a sandboxed environment with file access restrictions

**Features:**
- ✅ Command input with arguments
- ✅ Chroot jail path configuration
- ✅ Execute with sandbox wrapper
- ✅ **NEW: Displays both .json and .jsonl logs** ⭐
- ✅ Log summary with clickable links

**Recent Enhancement:**
The File Jail Panel now automatically detects and displays Core C monitoring logs (`.jsonl` format):

**Python Logs (.json):**
```
Summary → method: chroot | exit: 0 | violations: 0
```

**Core C Logs (.jsonl):**
```
Summary → samples: 3 | duration: 2.7s | max CPU: 0.9% | max mem: 3.5MB | exit: 0
```

### **Monitor Panel**

**Purpose:** Real-time resource monitoring of running processes

**Features:**
- CPU usage tracking
- Memory consumption (RSS/VMS)
- Thread count monitoring
- File descriptor tracking
- I/O statistics
- EWMA (Exponentially Weighted Moving Average) smoothing
- Real-time charts with Matplotlib
- Alert threshold configuration

### **Network Panel**

**Purpose:** Network restriction controls

**Features:**
- Enable/disable network access
- Seccomp filter configuration
- Network syscall blocking

---

## 🚀 **How to Use**

### **Running the GUI**

```bash
# From project root
cd /home/Idred/Downloads/ZenCube

# Launch GUI
/home/Idred/Downloads/ZenCube/.venv/bin/python zencube/zencube_modern_gui.py

# Or use the shortcut (if created)
python3 zencube/zencube_modern_gui.py
```

### **Using File Jail Panel**

1. **Enter Command:**
   - Type the command you want to execute (e.g., `python3 script.py`)
   - Add arguments if needed

2. **Set Jail Path (Optional):**
   - Specify a chroot jail directory
   - Leave empty for no jail restriction

3. **Execute:**
   - Click "Run in Jail" button
   - Monitor execution in output area

4. **View Logs:**
   - After execution, log summary appears
   - Click the log link to open the log file
   - **Supports both Python (.json) and Core C (.jsonl) logs**

### **Using Monitor Panel**

1. **Enter Process Details:**
   - PID (Process ID) of target process
   - Command name (for reference)
   - Sampling interval (seconds)

2. **Start Monitoring:**
   - Click "Start Monitor" button
   - Real-time metrics appear
   - Charts update continuously

3. **View Metrics:**
   - CPU usage percentage
   - Memory consumption (MB)
   - Thread count
   - File descriptors
   - I/O operations

4. **Stop Monitoring:**
   - Click "Stop Monitor" button
   - View summary statistics

---

## 🎯 **Testing the GUI with Core C Logs**

### **Scenario 1: Quick Test**

1. Open a terminal and run:
   ```bash
   cd /home/Idred/Downloads/ZenCube/zencube
   ./sandbox --enable-core-c --cpu=10 bash -c 'for i in {1..3}; do echo "Test $i"; sleep 1; done'
   ```

2. In the GUI File Jail Panel:
   - Click "Refresh" or "View Latest Log"
   - You should see the JSONL summary:
     ```
     Summary → samples: 3 | duration: 3.0s | max CPU: 1.2% | max mem: 3.5MB | exit: 0
     ```

### **Scenario 2: CPU-Intensive Test**

1. Terminal:
   ```bash
   cd /home/Idred/Downloads/ZenCube/zencube
   ./sandbox --enable-core-c --cpu=10 python3 -c 'sum(i*i for i in range(10000000))'
   ```

2. GUI:
   - Check File Jail Panel for summary
   - Should show high CPU usage (70-90%)

### **Scenario 3: Memory Test**

1. Terminal:
   ```bash
   cd /home/Idred/Downloads/ZenCube/zencube
   ./sandbox --enable-core-c --mem=100 python3 -c 'import time; data = bytearray(50*1024*1024); time.sleep(2)'
   ```

2. GUI:
   - Summary shows ~50MB memory allocation
   - Duration ~2 seconds

---

## 📊 **GUI Features Showcase**

### **Dual Log Format Support** ⭐ NEW

The GUI seamlessly handles both log formats:

**Log Discovery:**
- Scans `monitor/logs/` directory
- Finds both `.json` and `.jsonl` files
- Shows most recent log (regardless of format)

**Log Parsing:**
- **Python logs (.json):** Full JSON object with jail wrapper info
- **Core C logs (.jsonl):** Line-by-line JSONL with sample events

**Summary Display:**
- Automatically detects format
- Shows appropriate metrics
- Rich information for JSONL logs

### **Real-Time Monitoring**

**Monitor Panel Features:**
- Live CPU percentage
- Memory usage graphs
- Thread count tracking
- File descriptor monitoring
- Smooth EWMA curves
- Alert threshold indicators

---

## 🔧 **Troubleshooting**

### **GUI Won't Launch**

**Check Python environment:**
```bash
/home/Idred/Downloads/ZenCube/.venv/bin/python --version
```

**Verify PySide6 installed:**
```bash
/home/Idred/Downloads/ZenCube/.venv/bin/python -c "import PySide6; print('OK')"
```

**Reinstall if needed:**
```bash
cd /home/Idred/Downloads/ZenCube
pip install --user PySide6 matplotlib
```

### **No Logs Appearing**

1. **Generate a test log:**
   ```bash
   cd zencube
   ./sandbox --enable-core-c echo "Test"
   ```

2. **Check log directory:**
   ```bash
   ls -lh monitor/logs/*.jsonl
   ```

3. **Refresh GUI:**
   - Click refresh button
   - Or restart GUI

### **Log Summary Not Showing**

**Verify log format:**
```bash
# Check if JSONL is valid
head -1 monitor/logs/jail_run_*.jsonl | python3 -m json.tool
```

**Test summarization:**
```bash
python3 tests/test_jsonl_summary.py
```

---

## 💡 **Tips & Tricks**

### **Keyboard Shortcuts**
- `Ctrl+C` in terminal to stop GUI
- `Tab` to navigate between fields
- `Enter` to submit forms

### **Best Practices**

1. **Always check logs after execution**
   - View summary for quick metrics
   - Open full log for detailed analysis

2. **Use appropriate sampling intervals**
   - Fast processes: 0.5s interval
   - Long processes: 1-2s interval
   - Very long: 5s interval

3. **Monitor resource limits**
   - Check if process hit CPU limit
   - Verify memory usage stayed within bounds

### **Advanced Usage**

**Custom Log Analysis:**
```python
import json
from pathlib import Path

log_dir = Path("monitor/logs")
latest = max(log_dir.glob("*.jsonl"), key=lambda p: p.stat().st_mtime)

samples = []
with open(latest) as f:
    for line in f:
        data = json.loads(line)
        if data['event'] == 'sample':
            samples.append(data)

# Analyze samples
avg_cpu = sum(s['cpu_percent'] for s in samples) / len(samples)
print(f"Average CPU: {avg_cpu:.1f}%")
```

---

## 📈 **What's Next**

### **Current Capabilities**
- ✅ View both Python and C logs
- ✅ Rich JSONL summaries
- ✅ Real-time monitoring
- ✅ Resource limit tracking

### **Future Enhancements** (Optional)
- 🔄 Real-time log streaming
- 🔄 Live JSONL sample display
- 🔄 Alert notifications in GUI
- 🔄 Graphical metrics from JSONL logs
- 🔄 Export functionality

---

## 🎓 **Example Workflow**

1. **Launch GUI:**
   ```bash
   /home/Idred/Downloads/ZenCube/.venv/bin/python zencube/zencube_modern_gui.py
   ```

2. **Run test in terminal:**
   ```bash
   cd zencube
   ./sandbox --enable-core-c --cpu=10 python3 -c 'import time; print("Working..."); time.sleep(3)'
   ```

3. **View in GUI:**
   - File Jail Panel shows latest log
   - Summary displays: samples, duration, CPU, memory
   - Click log link to view full details

4. **Repeat for different workloads:**
   - CPU-intensive tasks
   - Memory-heavy operations
   - I/O-bound processes

---

## ✅ **GUI Status**

| Component | Status | Notes |
|-----------|--------|-------|
| GUI Launch | ✅ Running | Successfully started |
| PySide6 | ✅ Installed | v6.x |
| Matplotlib | ✅ Installed | For charts |
| File Jail Panel | ✅ Working | Dual format support |
| Monitor Panel | ✅ Working | Real-time metrics |
| JSONL Support | ✅ Active | Seamless integration |

---

## 🎉 **Conclusion**

The ZenCube GUI is now:
- ✅ **Running successfully**
- ✅ **Supports Core C JSONL logs**
- ✅ **Real-time monitoring enabled**
- ✅ **Production ready**

**Enjoy the graphical interface!** 🎨🚀

---

**GUI Process:** Running in background  
**Terminal ID:** Available for monitoring  
**Log Directory:** `monitor/logs/`  
**Test Script:** `tests/test_jsonl_summary.py`
