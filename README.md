# ZenCube 🧊

**A Lightweight Sandbox for Process Isolation and Resource Control**

---

## 📁 Project Structure

```
ZenCube/
├── zencube/              # Core C sandbox implementation
│   ├── sandbox.c         # Main sandbox program (Phase 1 & 2)
│   ├── Makefile          # Build system
│   ├── tests/            # Test programs
│   ├── README.md         # Detailed documentation
│   └── *.sh              # Test scripts
│
├── zencube_gui.py        # 🖥️ GUI Application (NEW!)
├── GUI_USAGE.md          # GUI documentation
└── README.md             # This file
```

---

## 🚀 Quick Start

### Option 1: Use the GUI (Recommended for Beginners)

```bash
# Launch the graphical interface
python zencube_gui.py
```

**GUI Features:**
- 🌍 **Cross-Platform**: Works on Windows (WSL) and Linux (native)
- 📁 Browse and select files
- ☑️ Toggle resource limits with checkboxes
- 🎯 Quick preset configurations
- 📺 Real-time terminal output
- ⏹️ Stop button for running processes
- 🔄 Automatic path conversion (Windows)

**See [`GUI_USAGE.md`](GUI_USAGE.md) for detailed instructions.**

---

### Option 2: Use the Command Line

```bash
# Navigate to core sandbox
cd zencube

# Build the sandbox
make

# Run a command with limits
./sandbox --cpu=5 --mem=256 /bin/echo "Hello, ZenCube!"

# Run test suite
make test-phase2
```

**See [`zencube/README.md`](zencube/README.md) for CLI documentation.**

---

## 📖 Documentation

| File | Description |
|------|-------------|
| **[GUI_USAGE.md](GUI_USAGE.md)** | Complete GUI user guide with examples |
| **[CROSS_PLATFORM_SUPPORT.md](CROSS_PLATFORM_SUPPORT.md)** | Cross-platform compatibility guide |
| **[BUGFIX_PATH_CONVERSION.md](BUGFIX_PATH_CONVERSION.md)** | Windows path conversion fix details |
| **[zencube/README.md](zencube/README.md)** | Full project documentation (450+ lines) |
| **[zencube/QUICKSTART.md](zencube/QUICKSTART.md)** | 5-minute quick start guide |
| **[zencube/PHASE2_COMPLETE.md](zencube/PHASE2_COMPLETE.md)** | Phase 2 implementation details |
| **[zencube/TEST_RESULTS.md](zencube/TEST_RESULTS.md)** | Testing results and analysis |
| **[zencube/TESTING_CHECKLIST.md](zencube/TESTING_CHECKLIST.md)** | Comprehensive testing guide |

---

## ✨ Key Features

### ✅ Phase 1: Process Isolation
- Fork/exec process creation
- Process lifecycle monitoring
- Signal handling
- High-precision timing

### ✅ Phase 2: Resource Limits
- **CPU Time** limiting (prevent infinite loops)
- **Memory** limiting (prevent memory exhaustion)
- **Process Count** limiting (prevent fork bombs)
- **File Size** limiting (prevent disk exhaustion)

### ✅ GUI Interface
- User-friendly graphical interface
- Visual file selection
- Interactive limit configuration
- Real-time output display
- Color-coded status messages

---

## 🎯 Use Cases

🔒 **Security**: Execute untrusted code safely  
🎓 **Education**: Learn containerization concepts  
🛡️ **Protection**: Prevent resource exhaustion attacks  
🧪 **Testing**: Test apps with resource constraints  
📚 **Learning**: Understand Linux process management  

---

## 📊 Current Status

| Component | Status | Version |
|-----------|--------|---------|
| Core Sandbox | ✅ Complete | 2.0 |
| Phase 1 | ✅ Complete | 100% |
| Phase 2 | ✅ Complete | 100% |
| GUI | ✅ Complete | 1.0 |
| Phase 3 (Filesystem) | ⏳ Planned | 0% |

**Last Updated**: December 2024  
**Branch**: `dev`

---

## 🛠️ System Requirements

### For GUI:
- Python 3.7+
- Tkinter (usually pre-installed)
- WSL2 (Windows) or Linux

### For Sandbox:
- Linux environment (WSL2 on Windows)
- GCC compiler
- Make build system
- POSIX-compliant system

---

## 💻 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/ZenCube.git
cd ZenCube
```

### 2. Build the Sandbox

```bash
cd zencube
make
```

### 3. Run the GUI

```bash
cd ..
python zencube_gui.py
```

---

## 🎓 Quick Examples

### Using the GUI

1. Launch: `python zencube_gui.py`
2. Click quick command: **"infinite_loop"**
3. Enable CPU limit: ✅ (3 seconds)
4. Click: **"▶ Execute Command"**
5. Watch terminal output show CPU limit violation!

### Using CLI

```bash
cd zencube

# Test CPU limit
./sandbox --cpu=3 ./tests/infinite_loop

# Test memory limit
./sandbox --mem=100 ./tests/memory_hog

# Test multiple limits
./sandbox --cpu=5 --mem=256 --procs=5 /bin/ls -la
```

---

## 🧪 Testing

### Automated Tests

```bash
cd zencube

# Run all Phase 2 tests
make test-phase2

# Run Phase 1 tests
make test-phase1

# Interactive demo
./demo.sh
```

### GUI Testing

1. Launch GUI
2. Try each quick command button
3. Test each preset (None, Light, Medium, Strict)
4. Toggle individual limits
5. Verify terminal output displays correctly

**Expected Results**: 97%+ success rate (see `zencube/TEST_RESULTS.md`)

---

## 🆘 Troubleshooting

### GUI Won't Start

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

| Feature | CLI | GUI |
|---------|-----|-----|
| Execute Commands | ✅ | ✅ |
| CPU Limits | ✅ | ✅ |
| Memory Limits | ✅ | ✅ |
| Process Limits | ✅ | ✅ |
| File Size Limits | ✅ | ✅ |
| Real-time Output | ✅ | ✅ |
| User-Friendly | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| File Browser | ❌ | ✅ |
| Presets | ❌ | ✅ |
| Stop Button | ❌ | ✅ |

---

## 📚 Learning Resources

- **For Beginners**: Start with [`GUI_USAGE.md`](GUI_USAGE.md)
- **For CLI Users**: Read [`zencube/QUICKSTART.md`](zencube/QUICKSTART.md)
- **For Developers**: Read [`zencube/README.md`](zencube/README.md)
- **For Testing**: See [`zencube/TESTING_CHECKLIST.md`](zencube/TESTING_CHECKLIST.md)

---

## 🎉 Get Started Now!

```bash
# Launch the GUI
python zencube_gui.py

# Or use the CLI
cd zencube && make && ./sandbox --help
```

**🧊 ZenCube - Making Sandboxing Simple, Safe, and Accessible!**

---

*For issues, questions, or feedback, please open an issue on GitHub or contact the project maintainers.*
