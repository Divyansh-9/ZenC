# ZenCube GUI - User Guide

## 📺 Graphical User Interface for ZenCube Sandbox

The ZenCube GUI provides an intuitive, user-friendly interface for executing commands with resource limits without using the command line.

---

## 🎯 Features

✅ **File Browser** - Select executables visually  
✅ **Quick Commands** - Pre-configured test commands  
✅ **Toggle Limits** - Enable/disable each limit individually  
✅ **Preset Configurations** - Quick limit presets  
✅ **Real-time Output** - Live terminal output display  
✅ **Color-coded Logs** - Easy-to-read status messages  
✅ **Stop Button** - Terminate running processes  
✅ **Cross-platform** - Works on Windows (WSL) and Linux  

---

## 🚀 Quick Start

### Installation

1. **Ensure Python 3 is installed:**
   ```bash
   python --version
   # Should show Python 3.7 or higher
   ```

2. **Install required packages** (Tkinter is usually pre-installed):
   ```bash
   # Windows
   pip install tkinter

   # Linux (if needed)
   sudo apt-get install python3-tk
   ```

3. **Launch the GUI:**
   ```bash
   # From the ZenCube directory
   python zencube_gui.py
   ```

---

## 🖥️ GUI Layout Overview

```
┌─────────────────────────────────────────────────────────────┐
│  🧊 ZenCube Sandbox Controller                            │
│  Execute commands safely with resource limits              │
├─────────────────────────────────────────────────────────────┤
│  COMMAND SELECTION                                          │
│  Command/File: [________________] [Browse...]               │
│  Arguments:    [_________________________________]           │
│  Quick:        [ls] [echo] [whoami] [loop] [memory]       │
├─────────────────────────────────────────────────────────────┤
│  RESOURCE LIMITS                                            │
│  ☑ CPU Time (seconds)      [5    ]  (Default: 5s)         │
│  ☑ Memory (MB)             [256  ]  (Default: 256 MB)     │
│  ☐ Max Processes           [10   ]  (Default: 10)         │
│  ☐ File Size (MB)          [100  ]  (Default: 100 MB)     │
│                                                             │
│  Presets: [No Limits] [Light] [Medium] [Strict]          │
├─────────────────────────────────────────────────────────────┤
│  OUTPUT TERMINAL                                            │
│  🧊 ZenCube Sandbox Terminal                               │
│  ════════════════════════════════════════════════════════  │
│  Ready to execute commands...                               │
│  │                                                          │
│  │  [Terminal output displays here]                        │
│  │                                                          │
│  │                                                          │
│  ▼                                                          │
├─────────────────────────────────────────────────────────────┤
│  [▶ Execute] [⏹ Stop] [🗑 Clear] [❓ Help]                │
├─────────────────────────────────────────────────────────────┤
│  Ready | Sandbox: ./sandbox                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 📖 Step-by-Step Usage Guide

### Step 1: Select a Command

**Option A: Browse for a File**
1. Click the **"Browse..."** button
2. Navigate to your executable/script
3. Select the file
4. The path appears in the "Command/File" field

**Option B: Use Quick Commands**
- Click any quick command button:
  - **ls** - List files
  - **echo** - Echo test message
  - **whoami** - Show current user
  - **infinite_loop** - Test CPU limit
  - **memory_hog** - Test memory limit

**Option C: Type Manually**
- Type the full path: `/bin/ls`
- Or relative path: `./tests/infinite_loop`

---

### Step 2: Add Arguments (Optional)

Enter command-line arguments in the **"Arguments"** field:

**Examples:**
```
-la                  # For ls -la
Hello World!         # For echo
--version            # For program --version
-o output.txt        # For redirection
```

---

### Step 3: Configure Resource Limits

**Enable/Disable Limits:**
- ✅ **Checked** = Limit is active
- ☐ **Unchecked** = Limit is disabled

**Available Limits:**

| Limit | Description | When to Use |
|-------|-------------|-------------|
| **CPU Time** | Max CPU seconds | Prevent infinite loops |
| **Memory** | Max RAM in MB | Prevent memory exhaustion |
| **Max Processes** | Max child processes | Prevent fork bombs |
| **File Size** | Max file write in MB | Prevent disk exhaustion |

**Editing Values:**
1. Check the limit you want to enable
2. The input field becomes active
3. Enter your desired value
4. Value is used when executing

---

### Step 4: Use Presets (Optional)

Click a preset button for quick configuration:

#### **No Limits**
- All limits disabled
- Use for trusted code

#### **Light** 
- CPU: 30 seconds
- Memory: 1024 MB
- Good for development

#### **Medium**
- CPU: 10 seconds
- Memory: 512 MB
- Processes: 10
- Good for testing

#### **Strict**
- CPU: 5 seconds
- Memory: 256 MB
- Processes: 5
- File Size: 50 MB
- Good for untrusted code

---

### Step 5: Execute the Command

1. Click **"▶ Execute Command"** button
2. Output appears in the terminal area
3. Watch for:
   - ✅ Success messages (green)
   - ⚠️ Warnings (yellow)
   - ❌ Errors (red)
   - 📋 Info messages (blue)

**During Execution:**
- The Execute button is disabled
- The Stop button is enabled
- Status bar shows "Running..."

---

### Step 6: View Results

**Output Terminal shows:**
```
════════════════════════════════════════════════════════════
🚀 Executing: wsl ./sandbox --cpu=5 --mem=256 /bin/ls -la
════════════════════════════════════════════════════════════
[SANDBOX] CPU limit set to: 5 seconds
[SANDBOX] Memory limit set to: 256 MB
[SANDBOX] Starting sandbox process...
total 48
drwxr-xr-x 1 user user 4096 ...
-rwxr-xr-x 1 user user 1234 sandbox
...
✅ Command completed successfully (exit code: 0)
```

---

### Step 7: Additional Actions

**Stop Execution:**
- Click **"⏹ Stop"** to terminate running command
- Useful for long-running processes

**Clear Output:**
- Click **"🗑 Clear Output"** to clear terminal
- Keeps previous logs in memory

**Get Help:**
- Click **"❓ Help"** for quick reference
- Shows usage tips and shortcuts

---

## 💡 Usage Examples

### Example 1: Test CPU Limit

1. **Command Selection:**
   - Click quick command: **"infinite_loop"**
   - Or browse to: `./tests/infinite_loop`

2. **Set Limits:**
   - ✅ Enable CPU Time
   - Set value: `3`

3. **Execute:**
   - Click **"▶ Execute Command"**

4. **Expected Result:**
   ```
   🚀 Executing: wsl ./sandbox --cpu=3 ./tests/infinite_loop
   Starting infinite loop...
   Still running... counter: 1 billion
   ❌ Process killed by signal: 24 (SIGXCPU)
   ⚠️ Command exited with code: 1
   ```

---

### Example 2: Test Memory Limit

1. **Command Selection:**
   - Click quick command: **"memory_hog"**

2. **Set Limits:**
   - ✅ Enable Memory
   - Set value: `100`

3. **Execute and observe:**
   ```
   Allocated 10 MB
   Allocated 20 MB
   ...
   Allocated 90 MB
   Failed to allocate: Cannot allocate memory
   ✅ Command completed successfully (exit code: 0)
   ```

---

### Example 3: Run Normal Command

1. **Command:**
   - Type: `/bin/ls`
   - Arguments: `-la`

2. **Limits:**
   - Click **"No Limits"** preset

3. **Execute:**
   ```
   🚀 Executing: wsl ./sandbox /bin/ls -la
   [Directory listing shown]
   ✅ Command completed successfully (exit code: 0)
   ```

---

### Example 4: Use Multiple Limits

1. **Command:**
   - Browse to your application

2. **Limits:**
   - Click **"Strict"** preset
   - OR manually enable:
     - ✅ CPU: 10
     - ✅ Memory: 512
     - ✅ Processes: 5

3. **Execute:**
   - All limits are enforced
   - First limit hit will terminate process

---

## 🎨 Understanding Output Colors

The terminal uses colors to highlight different message types:

| Color | Type | Meaning |
|-------|------|---------|
| 🟢 **Green** | Success | Command completed normally |
| 🟡 **Yellow** | Warning | Non-zero exit code or stopped |
| 🔴 **Red** | Error | Execution failed or error occurred |
| 🔵 **Blue** | Info | General information messages |

---

## ⚙️ Advanced Features

### Custom Commands

You can run any executable:

```
Command: /usr/bin/python3
Arguments: script.py --input data.txt

Command: gcc
Arguments: mycode.c -o mycode

Command: ./custom_app
Arguments: --config config.json
```

### Monitoring Long-Running Processes

1. Enable appropriate limits (CPU, Memory)
2. Execute command
3. Watch terminal for real-time output
4. Use Stop button if needed

### Testing Resource Limits

Use built-in test programs:

| Test Program | Purpose | Suggested Limit |
|--------------|---------|-----------------|
| `infinite_loop` | CPU testing | `--cpu=3` |
| `memory_hog` | Memory testing | `--mem=100` |
| `fork_bomb` | Process testing | `--procs=10` |
| `file_size_test` | File size testing | `--fsize=30` |

---

## 🔧 Troubleshooting

### Issue: "Sandbox not found"

**Solution:**
1. Ensure you're in the ZenCube directory
2. Build sandbox: `wsl make` (in PowerShell)
3. Check status bar shows correct sandbox path

---

### Issue: "No such file or directory" error

**Problem:** Selected a `.c` source file instead of the compiled executable

**Solution:**
1. Navigate to the `tests/` directory
2. Select the file **without** `.c` extension
3. Example: Choose `infinite_loop` NOT `infinite_loop.c`
4. GUI will now warn you if you select a source file

---

### Issue: No output appears

**Solution:**
1. Check command path is correct
2. Verify WSL is installed and working
3. Try running: `wsl ls` in PowerShell first
4. Check terminal for error messages

---

### Issue: GUI doesn't start

**Solution:**
```powershell
# Install Tkinter
pip install tk

# Or reinstall Python with Tkinter support
```

---

### Issue: Command not executing

**Solution:**
1. Check command path is valid
2. Ensure file has execute permissions
3. Verify WSL sandbox is built
4. Look for error messages in terminal
5. Make sure you selected an executable, not a `.c` file

---

### Issue: Limits not working

**Solution:**
1. Ensure checkbox is checked ✅
2. Verify limit value is a valid number
3. Remember: Some limits work differently in WSL
4. Check terminal output for limit messages

---

## 🎯 Tips & Best Practices

### 💡 Do's

✅ **Start with presets** for common scenarios  
✅ **Enable only needed limits** for better performance  
✅ **Test with test programs** before using on real code  
✅ **Watch the terminal** for detailed execution info  
✅ **Use Stop button** for runaway processes  

### ❌ Don'ts

❌ **Don't run fork bombs** without process limits  
❌ **Don't set limits too low** for legitimate programs  
❌ **Don't ignore error messages** in the terminal  
❌ **Don't execute untrusted code** without strict limits  

---

## 📊 Quick Reference

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Execute | Alt+E (planned) |
| Stop | Alt+S (planned) |
| Clear | Alt+C (planned) |
| Help | F1 (planned) |

### Quick Commands Cheat Sheet

```bash
# List files
/bin/ls -la

# Test CPU limit
./tests/infinite_loop

# Test memory limit
./tests/memory_hog

# Test process limit
./tests/fork_bomb

# Test file size limit
./tests/file_size_test

# Simple test
/bin/echo "Hello, ZenCube!"
```

---

## 🆘 Getting Help

1. **Click Help Button** - In-app quick reference
2. **Check Terminal** - Detailed error messages
3. **Read README.md** - Complete project documentation
4. **Check TEST_RESULTS.md** - Expected behaviors
5. **Review PHASE2_COMPLETE.md** - Implementation details

---

## 📝 Notes

- **WSL Requirement**: GUI uses WSL to execute Linux sandbox
- **Real-time Output**: Terminal updates live during execution
- **Thread-safe**: Uses threading for non-blocking execution
- **Cross-platform**: Designed for Windows with WSL, adaptable for Linux

---

## 🎓 Learning Path

### Beginner
1. Use Quick Commands
2. Try "No Limits" preset
3. Watch terminal output
4. Understand exit codes

### Intermediate
1. Browse for custom files
2. Add command arguments
3. Enable individual limits
4. Use Medium preset

### Advanced
1. Configure custom limit combinations
2. Test with own applications
3. Monitor resource violations
4. Use Strict preset for security

---

**🧊 ZenCube GUI - Making Sandboxing Simple!**

For more information, see the main [README.md](README.md) or run `python zencube_gui.py` to get started!
