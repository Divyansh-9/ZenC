# ZenCube Desktop 🧊# ZenCube 🧊



**Modern Cross-Platform Process Sandboxing & Resource Control****A Lightweight Sandbox for Process Isolation and Resource Control**



A professional desktop application built with React, Electron, and TypeScript, powered by a high-performance C engine for process isolation and resource limiting.Modern, cross-platform sandbox with beautiful GUI and command-line interface.



---🎉 **NEW: Now available as a standalone desktop application!** No Python installation required!



## 🎯 Overview---



ZenCube is a cross-platform desktop application that allows you to execute processes in a controlled sandbox environment with configurable resource limits. It features a modern, intuitive UI with real-time terminal output and comprehensive resource management.## 🚀 Quick Start - Desktop App



### ✨ Key Features**Just want to run ZenCube? Download and go:**



- **🎨 Modern React UI** - Clean, responsive interface built with React and Tailwind CSS```bash

- **🌓 Dark Mode** - Beautiful light and dark themes# Extract the app

- **💻 Real-Time Terminal** - Live process output with Xterm.js integrationtar -xzf ZenCubeModern-v2.1.0-linux-x64.tar.gz

- **🔒 Resource Limits** - Configure CPU, memory, process, and file size constraints

- **🪟 Cross-Platform** - Native support for Linux, automatic WSL integration for Windows# Run it

- **⚡ High Performance** - C-based sandbox engine for minimal overheadcd ZenCubeModern && ./ZenCubeModern

- **🎛️ Presets** - Quick configurations for common use cases```



---**✅ No dependencies needed - everything is bundled!**



## 📁 Project Structure📖 **Complete Usage Guide:** [`HOW_TO_USE_APP.md`](HOW_TO_USE_APP.md)  

⚡ **Quick Reference:** [`QUICK_REFERENCE.md`](QUICK_REFERENCE.md)  

```🛠️ **Build Guide:** [`APP_BUILD_GUIDE.md`](APP_BUILD_GUIDE.md)

zencube-desktop/

├── src/                          # Application source code---

│   ├── main/                     # Electron main process

│   │   └── main.ts               # Platform-aware binary execution## 📁 Project Structure

│   ├── preload/                  # Electron preload script

│   │   └── preload.ts            # Secure IPC bridge```

│   └── renderer/                 # React applicationZenCube/

│       ├── components/           # React components├── zencube/                      # Core C sandbox implementation

│       │   ├── Header.tsx│   ├── sandbox.c                 # Main sandbox program (Phase 1 & 2)

│       │   ├── CommandInput.tsx│   ├── zencube_modern_gui.py     # 🎨 Modern PySide6 GUI (NEW!)

│       │   ├── ResourceLimits.tsx│   ├── zencube_gui.py            # 🖥️ Legacy Tkinter GUI

│       │   └── Terminal.tsx│   ├── Makefile                  # Build system

│       ├── styles/               # Tailwind CSS styles│   ├── tests/                    # Test programs

│       ├── App.tsx               # Main app component│   └── *.sh                      # Test scripts

│       └── index.tsx             # Entry point│

│├── docs/                         # Documentation

├── core_c/                       # C sandbox engine│   ├── GUI_USAGE.md              # GUI usage guide

│   ├── sampler.c                 # Process monitoring│   ├── MODERN_GUI_DOCUMENTATION.md  # Modern GUI complete docs

│   ├── alert_engine.c            # Resource alerts│   ├── RESPONSIVE_FEATURES.md    # Responsive design features

│   ├── prom_exporter.c           # Metrics export│   ├── CROSS_PLATFORM_SUPPORT.md # Platform compatibility

│   ├── Makefile                  # Build system│   └── BUGFIX_*.md               # Bug fix documentation

│   └── bin/                      # Compiled binaries│

│└── README.md                     # This file

├── docs/                         # Documentation```

│   ├── PROJECT_OVERVIEW.md

│   ├── ROLE_1_CORE_SANDBOX.md---

│   └── ...

│## ✨ Features

├── tests/                        # Test scripts

│   ├── test_alert_engine.sh### 🎨 Modern GUI (PySide6)

│   └── ...- **Beautiful Material Design** with gradient buttons and shadows

│- **Responsive Layout** - adapts to any screen size

├── package.json                  # Node.js dependencies- **Flow layouts** for wrapping buttons

├── tsconfig.json                 # TypeScript configuration- **Resizable splitter** with styled handle

├── electron-builder.yml          # Build & packaging config- **Hide/Show terminal** toggle

├── vite.config.ts                # Vite bundler config- **Real-time output** with colored messages

├── tailwind.config.js            # Tailwind CSS config- **Quick commands** and preset configurations

└── README.md                     # This file- **WSL support** for Windows users

```- **Cross-platform** - Windows & Linux



---### 🛡️ Sandbox Features

- **Process Isolation** (Phase 1) - Fork, execute, wait

## 🚀 Quick Start- **Resource Limits** (Phase 2):

  - ⏱️ CPU time limits (RLIMIT_CPU)

### Prerequisites  - 💾 Memory limits (RLIMIT_AS)

  - 👥 Process limits (RLIMIT_NPROC)

- **Node.js** >= 18.x  - 📁 File size limits (RLIMIT_FSIZE)

- **npm** >= 9.x- **Signal Handling** - SIGXCPU, SIGSEGV, SIGKILL

- **GCC** compiler (for building C core)- **Error Reporting** - Clear exit codes and messages

- **Make** build system

- **WSL2** (Windows only)---



### Installation## 🚀 Quick Start



```bash### Option 1: Modern GUI (Recommended) 🎨

# Clone the repository

git clone https://github.com/your-org/zencube.git**Requirements:**

cd zencube```bash

pip install PySide6>=6.5.0

# Install Node.js dependencies```

npm install

**Launch:**

# Build the C sandbox engine```bash

npm run build:corecd zencube

python zencube_modern_gui.py

# Build the application```

npm run build

```**Features:**

- ✅ Material Design interface (1200×750px default)

### Development- ✅ Responsive button layouts

- ✅ Styled splitter for terminal resize

```bash- ✅ Hide/show terminal option

# Run in development mode with hot reload- ✅ Quick command buttons (ls, echo, whoami, tests)

npm run dev- ✅ 4 preset configurations (None, Light, Medium, Strict)

```- ✅ Real-time colored output

- ✅ Browse for executables

This will:- ✅ WSL toggle for Windows

1. Start the Vite dev server (React hot reload)

2. Compile TypeScript files (main & preload)**See [`MODERN_GUI_DOCUMENTATION.md`](docs/MODERN_GUI_DOCUMENTATION.md) for complete guide.**

3. Launch Electron with dev tools

---

### Production Build

### Option 2: Legacy GUI (Tkinter) 🖥️

```bash

# Build for your current platform**No installation required** - uses built-in Tkinter.

npm run build

npm run package```bash

cd zencube

# Build for specific platformspython zencube_gui.py

npm run package:linux    # Linux AppImage, deb, tar.gz```

npm run package:win      # Windows NSIS installer, portable

```**Features:**

- ☑️ Toggle resource limits with checkboxes

Packages will be created in the `release/` directory.- 🎯 Quick preset configurations

- 📺 Real-time terminal output

---- ⏹️ Stop button for running processes

- 🔧 Settings dialog for custom paths

## 📖 Usage

**See [`GUI_USAGE.md`](docs/GUI_USAGE.md) for detailed instructions.**

### 1. Launch the Application

---

```bash

npm start### Option 3: Command Line Interface

# or run the packaged executable

./release/ZenCube-3.0.0.AppImage```bash

```# Navigate to core sandbox

cd zencube

### 2. Configure Resource Limits

# Build the sandbox

Choose from preset configurations or customize individual limits:make



- **CPU Time** - Maximum CPU seconds (prevents infinite loops)# Run a command with limits

- **Memory** - Maximum RAM usage in MB./sandbox --cpu=5 --mem=256 /bin/echo "Hello, ZenCube!"

- **Max Processes** - Limit concurrent processes (prevents fork bombs)

- **File Size** - Maximum file write size in MB# Run test suite

make test-phase2

**Presets:**```

- 🔓 **None** - No restrictions

- 🟢 **Light** - 30s CPU, 1GB RAM**See [`zencube/README.md`](zencube/README.md) for CLI documentation.**

- 🟡 **Medium** - 10s CPU, 512MB RAM, 10 processes

- 🔴 **Strict** - 5s CPU, 256MB RAM, 5 processes, 100MB files---



### 3. Execute Commands## 📖 Documentation



#### Quick Commands| File | Description |

Click any quick command button:|------|-------------|

- 📋 List Files (`ls -la`)| **[GUI_USAGE.md](GUI_USAGE.md)** | Complete GUI user guide with examples |

- 👤 Who Am I (`whoami`)| **[zencube/README.md](zencube/README.md)** | Full project documentation (450+ lines) |

- 💬 Echo Test| **[zencube/QUICKSTART.md](zencube/QUICKSTART.md)** | 5-minute quick start guide |

- ⏱️ CPU Test (infinite loop)| **[zencube/PHASE2_COMPLETE.md](zencube/PHASE2_COMPLETE.md)** | Phase 2 implementation details |

- 🐌 Sleep 10s| **[zencube/TEST_RESULTS.md](zencube/TEST_RESULTS.md)** | Testing results and analysis |

| **[zencube/TESTING_CHECKLIST.md](zencube/TESTING_CHECKLIST.md)** | Comprehensive testing guide |

#### Custom Commands

1. Enter executable path (e.g., `/bin/bash`)---

2. Enter arguments (e.g., `-c "echo hello"`)

3. Click **Execute**## ✨ Key Features



### 4. Monitor Output### ✅ Phase 1: Process Isolation

- Fork/exec process creation

Watch real-time output in the terminal panel:- Process lifecycle monitoring

- **Green** - Successful operations- Signal handling

- **Red** - Errors and stderr- High-precision timing

- **Yellow** - Warnings and signals

- **Cyan** - Command execution### ✅ Phase 2: Resource Limits

### ✅ Phase 2: Resource Limits 🎯

---- **CPU Time** limiting (prevent infinite loops)

- **Memory** limiting (prevent memory exhaustion)

## 🏗️ Architecture- **Process Count** limiting (prevent fork bombs)

- **File Size** limiting (prevent disk exhaustion)

### Frontend (React/Electron)

### ✨ Modern GUI Interface (PySide6)

The desktop UI is built with:- **Material Design** with gradients and shadows

- **React 18** - Component-based UI- **Responsive layout** adapts to screen size

- **TypeScript** - Type-safe development- **Flow layouts** for wrapping buttons

- **Tailwind CSS** - Utility-first styling- **Resizable splitter** with styled purple handle

- **Xterm.js** - Terminal emulation- **Hide/show terminal** toggle

- **Electron 28** - Desktop runtime- **Real-time colored output** (green, red, orange, blue)

- **Visual file selection** with browse dialog

### Backend Engine (C)- **Interactive limit configuration** with checkboxes

- **Quick commands** for common tasks

The sandbox execution engine provides:- **4 preset configurations** (None, Light, Medium, Strict)

- **Process Isolation** - `fork()` and `exec()` based- **Cross-platform** - WSL toggle for Windows/Linux

- **Resource Limits** - `setrlimit()` system calls- **Auto-detection** of operating system

- **Monitoring** - Real-time resource sampling- **Window size**: 1200×750px (fits most screens)

- **Alerting** - Threshold-based notifications

- **Metrics Export** - Prometheus integration### 🖥️ Legacy GUI (Tkinter)

- User-friendly traditional interface

### Cross-Platform Support- All core features included

- No additional dependencies

#### Linux (Native)- Smaller footprint

```

React App → Electron Main → spawn('./core_c/bin/sampler') → Process---

```

## 🎯 Use Cases

#### Windows (WSL)

```🔒 **Security**: Execute untrusted code safely  

React App → Electron Main → spawn('wsl', ['./core_c/bin/sampler']) → WSL → Process🎓 **Education**: Learn containerization concepts  

```🛡️ **Protection**: Prevent resource exhaustion attacks  

🧪 **Testing**: Test apps with resource constraints  

The application automatically detects Windows and uses WSL to execute the Linux binary.📚 **Learning**: Understand Linux process management  

🎨 **Development**: Beautiful UI for sandbox control

---

---

## 🛠️ Development

## 📊 Current Status

### Project Scripts

| Component | Status | Version | Notes |

```bash|-----------|--------|---------|-------|

# Build commands| Core Sandbox | ✅ Complete | 2.0 | Phase 1 & 2 |

npm run build:core       # Compile C binaries| Phase 1 (Isolation) | ✅ Complete | 100% | Fork, exec, wait |

npm run build:main       # Compile Electron main process| Phase 2 (Resources) | ✅ Complete | 100% | All 4 limits |

npm run build:preload    # Compile preload script| Modern GUI (PySide6) | ✅ Complete | 2.1 | Material Design |

npm run build:renderer   # Build React app with Vite| Legacy GUI (Tkinter) | ✅ Complete | 1.3 | Stable |

npm run build            # Build everything| Responsive Design | ✅ Complete | 100% | FlowLayout |

| Terminal Toggle | ✅ Complete | 100% | Hide/Show |

# Development| Cross-Platform | ✅ Complete | 100% | Windows & Linux |

npm run dev              # Dev mode with hot reload| Phase 3 (Filesystem) | ⏳ Planned | 0% | Future work |

npm run dev:renderer     # Only Vite dev server

npm run dev:electron     # Only Electron**Last Updated**: October 13, 2025  

**Branch**: `dev`

# Packaging

npm run package          # Package for all platforms---

npm run package:linux    # Linux only

npm run package:win      # Windows only## 🛠️ System Requirements



# Cleanup### For Modern GUI (PySide6):

npm run clean            # Remove all build artifacts- **Python**: 3.7 or higher

```- **PySide6**: 6.5.0 or higher

- **OS**: Windows 10/11 or Linux

### File Structure- **WSL2**: Required for Windows

- **Screen**: 1000×700 minimum (1200×750 recommended)

**TypeScript Configurations:**

- `tsconfig.json` - Base config (renderer)### For Legacy GUI (Tkinter):

- `tsconfig.main.json` - Main process config- **Python**: 3.7+

- `tsconfig.preload.json` - Preload script config- **Tkinter**: Usually pre-installed

- **WSL2**: Windows only

**Build Configurations:**- **Linux**: Native support

- `vite.config.ts` - React bundler

- `electron-builder.yml` - Packaging### For Sandbox:

- `tailwind.config.js` - CSS framework- **Linux** environment (WSL2 on Windows)

- **GCC** compiler

### Adding Features- **Make**: Build system

- **POSIX**: Compliant system

1. **New UI Component:**

   - Create in `src/renderer/components/`---

   - Import in `App.tsx`

   - Style with Tailwind classes## 💻 Installation



2. **New IPC Handler:**### 1. Clone the Repository

   - Add handler in `src/main/main.ts`

   - Expose in `src/preload/preload.ts````bash

   - Call from React componentsgit clone https://github.com/KamalSDhami/ZenCube.git

cd ZenCube

3. **New C Binary:**```

   - Add source in `core_c/`

   - Update `core_c/Makefile`### 2. Install Dependencies (Modern GUI)

   - Reference in Electron main process

```bash

---# For PySide6 Modern GUI

pip install PySide6>=6.5.0

## 🧪 Testing

# Or install from requirements.txt

### C Engine Testscd zencube

pip install -r requirements.txt

```bash```

cd core_c

make test### 3. Build the Sandbox

```

```bash

This runs:cd zencube

- `test_sampler.sh` - Process samplingmake

- `test_alert_engine.sh` - Alert rules```

- `test_prom_exporter.sh` - Metrics endpoint

This will compile `sandbox.c` into the `sandbox` executable.

### Integration Testing

### 4. Run the GUI

```bash

# Launch dev build**Modern GUI (Recommended):**

npm run dev```bash

python zencube_modern_gui.py

# Test scenarios:```

# 1. Execute each quick command

# 2. Try each preset configuration**Legacy GUI:**

# 3. Test custom limits

# 4. Verify stop button```bash

# 5. Check terminal output colorscd ..

```python zencube_gui.py

```

---

---

## 📊 System Requirements

## 🎓 Quick Examples

### Minimum

- **CPU:** x86_64 (Intel/AMD)### Using the GUI

- **RAM:** 2GB**Legacy GUI:**

- **Disk:** 500MB```bash

- **OS:** Ubuntu 20.04 / Windows 10 (with WSL2)python zencube_gui.py

```

### Recommended

- **CPU:** Multi-core processor---

- **RAM:** 4GB+

- **Disk:** 1GB+## 📖 Usage Examples

- **OS:** Ubuntu 22.04 / Windows 11 (with WSL2)

### Modern GUI Workflow

---

1. **Launch** Modern GUI:

## 🐛 Troubleshooting   ```bash

   cd zencube

### "Cannot find electron" Error   python zencube_modern_gui.py

   ```

```bash

npm install2. **Quick Test** - Click a quick command button:

```   - 📋 **ls** - List files

   - 💬 **echo** - Echo message

### C Binaries Not Building   - 👤 **whoami** - Show user

   - ⏱️ **CPU Test** - Test CPU limit

```bash   - 💾 **Memory Test** - Test memory limit

cd core_c

make clean3. **Enable Limits** - Check the boxes:

make all   - ☑️ CPU Time (5 seconds)

```   - ☑️ Memory (256 MB)

   - ☑️ Max Processes (10)

### WSL Not Working (Windows)   - ☑️ File Size (100 MB)



```bash4. **Or Use Presets**:

# Install WSL2   - 🔓 **No Limits** - Unrestricted

wsl --install   - 🟢 **Light** - CPU: 30s, Memory: 1GB

   - 🟡 **Medium** - CPU: 10s, Memory: 512MB, Procs: 10

# Update WSL   - 🔴 **Strict** - All limits enabled

wsl --update

5. **Execute** - Click **▶️ Execute Command**

# Verify

wsl --version6. **Watch Output** - See real-time colored output in terminal

```

7. **Stop if Needed** - Click **⏹️ Stop** button

### Terminal Not Showing Output

8. **Hide Terminal** - Click **👁️ Hide Terminal** for more workspace

Check that the C binary path is correct:

- Linux: `core_c/bin/sampler`### Legacy GUI Example

- Ensure binary has execute permissions: `chmod +x core_c/bin/*`

1. Launch: `python zencube_gui.py`

---2. Click quick command: **"infinite_loop"**

3. Enable CPU limit: ✅ (3 seconds)

## 📚 Documentation4. Click: **"▶ Execute Command"**

5. Watch terminal output show CPU limit violation!

| File | Description |

|------|-------------|### Command Line Interface

| `docs/PROJECT_OVERVIEW.md` | High-level architecture |

| `docs/ROLE_1_CORE_SANDBOX.md` | C engine internals |```bash

| `core_c/README.md` | C module documentation |cd zencube



---# Test CPU limit

./sandbox --cpu=3 ./tests/infinite_loop

## 🤝 Contributing

# Test memory limit

We welcome contributions! Please:./sandbox --mem=100 ./tests/memory_hog



1. Fork the repository# Test multiple limits

2. Create a feature branch (`git checkout -b feature/amazing-feature`)./sandbox --cpu=5 --mem=256 --procs=5 /bin/ls -la

3. Commit your changes (`git commit -m 'Add amazing feature'`)

4. Push to the branch (`git push origin feature/amazing-feature`)# No limits

5. Open a Pull Request./sandbox /bin/echo "Hello ZenCube!"

```

---

---

## 📄 License

## 🧪 Testing

This project is licensed under the MIT License - see the LICENSE file for details.

### Automated Tests

---

```bash

## 🌟 Highlightscd zencube



| Feature | Technology |# Run all Phase 2 tests

|---------|-----------|make test-phase2

| **UI Framework** | React 18 + TypeScript |

| **Styling** | Tailwind CSS 3 |# Run Phase 1 tests

| **Terminal** | Xterm.js 5 |make test-phase1

| **Desktop Runtime** | Electron 28 |

| **Bundler** | Vite 5 |# Interactive demo

| **Sandbox Engine** | C (POSIX) |./demo.sh

| **IPC** | Electron contextBridge |```

| **Build System** | electron-builder |

### GUI Testing

---

**Modern GUI:**

## 🎯 Roadmap1. Launch: `python zencube_modern_gui.py`

2. Test responsive design - resize window to see buttons wrap

- [x] React/Electron desktop app3. Try each quick command button (5 buttons)

- [x] Modern UI with dark mode4. Test each preset (None, Light, Medium, Strict)

- [x] Cross-platform support (Linux/Windows)5. Toggle individual limits with checkboxes

- [x] Real-time terminal output6. Test terminal hide/show toggle

- [x] Resource limit presets7. Drag splitter handle to resize terminal

- [ ] Filesystem restrictions (chroot)8. Verify colored output (green, red, orange, blue)

- [ ] Network isolation

- [ ] Advanced monitoring dashboard**Legacy GUI:**

- [ ] Log file viewer1. Launch: `python zencube_gui.py`

- [ ] Process statistics graphs2. Try each quick command button

3. Test each preset

---4. Toggle individual limits

5. Verify terminal output displays correctly

**🧊 ZenCube - Professional Process Sandboxing Made Beautiful**

**Expected Results**: 97%+ success rate (see `zencube/TEST_RESULTS.md`)

**Version:** 3.0.0  

**Last Updated:** November 17, 2025  ---

**Maintainer:** ZenCube Team

## 📚 Documentation

### Complete Guides

- **[MODERN_GUI_DOCUMENTATION.md](MODERN_GUI_DOCUMENTATION.md)** - Complete modern GUI guide
  - Installation and setup
  - Visual design details
  - Component architecture
  - Styling guide
  - Customization tips
  - ~600 lines of documentation

- **[RESPONSIVE_FEATURES.md](RESPONSIVE_FEATURES.md)** - Responsive design features
  - FlowLayout implementation
  - Terminal visibility toggle
  - Screen size adaptations
  - Usage tips

- **[BUGFIX_LAYOUT_ISSUES.md](BUGFIX_LAYOUT_ISSUES.md)** - Layout fixes
  - UI fitting on screen
  - Splitter visibility
  - Button placement
  - Compact grid layout

- **[GUI_USAGE.md](GUI_USAGE.md)** - Legacy GUI usage guide

- **[CROSS_PLATFORM_SUPPORT.md](CROSS_PLATFORM_SUPPORT.md)** - Platform compatibility

### Core Documentation

- **zencube/README.md** - Detailed C sandbox documentation
- **zencube/TEST_RESULTS.md** - Test results and benchmarks

---

## 🆘 Troubleshooting

### Modern GUI Won't Start

```bash
# Install PySide6
pip install PySide6>=6.5.0

# Or upgrade if already installed
pip install --upgrade PySide6
```

### Legacy GUI Won't Start

```bash
# Install Tkinter
pip install tk

# Or on Linux
sudo apt-get install python3-tk
```

### Sandbox Not Found

```bash
cd zencube
make clean
make
chmod +x sandbox  # Linux only
```

### WSL Issues on Windows

```bash
# Enable WSL
wsl --install

# Update WSL
wsl --update

# Check WSL version
wsl --version
```

### Terminal Not Showing Newlines

**Fixed in version 2.1** - Update to latest version:
```bash
git pull origin dev
```

### WSL Issues

```bash
# Verify WSL is working
wsl ls

# Check WSL version
wsl --version

# Restart WSL
wsl --shutdown
```

---

## 📝 Project Philosophy

**ZenCube** = **Zen** (simplicity, focus) + **Cube** (container, isolation)

The project demonstrates:
- **Incremental Development**: Built in clear phases
- **Educational Focus**: Each phase teaches core concepts
- **Production Quality**: Real-world applicable code
- **User-Friendly**: Both CLI and GUI interfaces
- **Well-Documented**: Comprehensive documentation

---

## 🚧 Roadmap

### Completed ✅
- [x] Phase 1: Process isolation
- [x] Phase 2: Resource limits
- [x] GUI application
- [x] Comprehensive testing
- [x] Full documentation

### Next Steps ⏳
- [ ] Phase 3: Filesystem restrictions (chroot, read-only mounts)
- [ ] Phase 4: Network control (isolation, filtering)
- [ ] Phase 5: Monitoring & logging
- [ ] Advanced GUI features (logs viewer, statistics)

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/YourFeature`)
3. Commit changes (`git commit -m 'Add YourFeature'`)
4. Push to branch (`git push origin feature/YourFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 🌟 Key Highlights

| Feature | CLI | Legacy GUI | Modern GUI |
|---------|-----|-----------|------------|
| Execute Commands | ✅ | ✅ | ✅ |
| CPU Limits | ✅ | ✅ | ✅ |
| Memory Limits | ✅ | ✅ | ✅ |
| Process Limits | ✅ | ✅ | ✅ |
| File Size Limits | ✅ | ✅ | ✅ |
| Real-time Output | ✅ | ✅ | ✅ |
| Colored Output | ❌ | ✅ | ✅ |
| User-Friendly | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| File Browser | ❌ | ✅ | ✅ |
| Presets | ❌ | ✅ | ✅ (4 types) |
| Stop Button | ❌ | ✅ | ✅ |
| Responsive Design | ❌ | ❌ | ✅ |
| Hide Terminal | ❌ | ❌ | ✅ |
| Material Design | ❌ | ❌ | ✅ |
| Resizable Splitter | ❌ | ❌ | ✅ |
| Quick Commands | ❌ | ✅ | ✅ (5 buttons) |
| Dependencies | None | Tkinter | PySide6 |

---

## 📚 Learning Resources

- **Modern GUI Guide**: [`MODERN_GUI_DOCUMENTATION.md`](MODERN_GUI_DOCUMENTATION.md) - Complete modern GUI documentation
- **For Beginners**: [`GUI_USAGE.md`](GUI_USAGE.md) - Legacy GUI usage guide
- **Responsive Features**: [`RESPONSIVE_FEATURES.md`](RESPONSIVE_FEATURES.md) - Responsive design details
- **For CLI Users**: [`zencube/QUICKSTART.md`](zencube/QUICKSTART.md) - Command-line quick start
- **For Developers**: [`zencube/README.md`](zencube/README.md) - Core sandbox documentation
- **For Testing**: [`zencube/TESTING_CHECKLIST.md`](zencube/TESTING_CHECKLIST.md) - Test procedures
- **Bug Fixes**: [`BUGFIX_LAYOUT_ISSUES.md`](BUGFIX_LAYOUT_ISSUES.md) - Layout fixes documentation

---

## 🎉 Get Started Now!

**Modern GUI (Recommended):**
```bash
pip install PySide6
cd zencube
python zencube_modern_gui.py
```

**Legacy GUI (No dependencies):**
```bash
cd zencube
python zencube_gui.py
```

**Command Line:**
```bash
cd zencube
make
./sandbox --help
```

---

## 📊 Project Statistics

- **Lines of Code**: ~1,500 (C) + ~1,100 (Python GUI)
- **Documentation**: ~2,000+ lines
- **Test Coverage**: 97%+ pass rate
- **Supported Platforms**: Windows (WSL2), Linux
- **GUI Versions**: 2 (Tkinter + PySide6)
- **Total Features**: 20+
- **Development Time**: Active development

---

## 🏆 Achievements

✅ **Fully functional sandbox** with 4 resource limits  
✅ **Two GUI interfaces** (Legacy + Modern)  
✅ **Material Design** implementation  
✅ **Responsive layout** with FlowLayout  
✅ **Cross-platform** Windows & Linux support  
✅ **Comprehensive documentation** (2000+ lines)  
✅ **97%+ test pass rate**  
✅ **Production-ready** code quality  

---

**🧊 ZenCube - Making Sandboxing Simple, Safe, Beautiful, and Accessible!**

---

*For issues, questions, or feedback, please open an issue on GitHub or contact the project maintainers.*

**Author**:Divyansh Uniyal
**Repository**: https://github.com/Divyansh-9/ZenC.git 
**Branch**: dev  
**Version**: 2.1  
**Last Updated**: October 13, 2025

