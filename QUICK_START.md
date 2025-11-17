# ZenCube Desktop - Quick Start Guide

**Version:** 3.0.0  
**Last Updated:** November 17, 2025

---

## ⚡ 60-Second Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build C engine
npm run build:core

# 3. Run the app
npm run dev
```

That's it! The app will launch with hot reload enabled.

---

## 📦 Installation (First Time)

### Prerequisites Check

```bash
# Verify Node.js (need 18+)
node --version

# Verify npm (need 9+)
npm --version

# Verify GCC compiler
gcc --version

# Verify Make
make --version
```

### Install Steps

```bash
# Clone repository
git clone https://github.com/your-org/zencube.git
cd zencube

# Install Node.js dependencies
npm install
# This installs React, Electron, TypeScript, Tailwind, Xterm.js, etc.

# Build C sandbox engine
npm run build:core
# This compiles sampler, alertd, prom_exporter binaries

# Build TypeScript & React
npm run build
# Compiles main.ts, preload.ts, and React app

# Start the application
npm start
```

---

## 🎮 Usage Examples

### Example 1: Run a Simple Command

1. Launch app: `npm run dev`
2. Click **"📋 List Files"** quick command
3. Watch output in terminal

**Expected:**
```
$ /bin/ls -la
total 64
drwxr-xr-x  8 user user 4096 Nov 17 10:30 .
drwxr-xr-x 20 user user 4096 Nov 17 10:25 ..
...
[Process exited with code: 0]
```

### Example 2: Test CPU Limit

1. Set CPU limit to **3 seconds**
2. Click **"⏱️ CPU Test"** (infinite loop)
3. Watch process get killed after 3 seconds

**Expected:**
```
$ /bin/bash -c while true; do :; done
[Process terminated with signal: SIGXCPU]
```

### Example 3: Custom Command

1. Enter path: `/bin/echo`
2. Enter args: `Hello from ZenCube!`
3. Click **Execute**

**Expected:**
```
$ /bin/echo Hello from ZenCube!
Hello from ZenCube!
[Process exited with code: 0]
```

### Example 4: Use a Preset

1. Click **"Strict"** preset
2. Notice all limits are configured:
   - CPU: 5s
   - Memory: 256MB
   - Processes: 5
   - File Size: 100MB
3. Execute any command with these limits

---

## 🛠️ Development Workflow

### Daily Development

```bash
# Start dev mode (rebuilds on file changes)
npm run dev

# Edit files in src/renderer/components/
# Save → Vite hot reloads → See changes instantly
```

### Build for Production

```bash
# Full build
npm run build

# Package for Linux
npm run package:linux

# Package for Windows
npm run package:win

# Find packages in:
ls -lh release/
```

---

## 🎨 Customization

### Change Terminal Colors

Edit `src/renderer/components/Terminal.tsx`:

```typescript
theme: {
  background: '#1e1e1e',    // Dark background
  foreground: '#d4d4d4',    // Light text
  cursor: '#aeafad',        // Cursor color
  // ... more colors
}
```

### Add a Quick Command

Edit `src/renderer/components/CommandInput.tsx`:

```typescript
const QUICK_COMMANDS = [
  // ... existing commands
  { label: '🔍 Find Files', command: '/usr/bin/find', args: ['.', '-name', '*.ts'] },
];
```

### Add a New Preset

Edit `src/renderer/components/ResourceLimits.tsx`:

```typescript
const PRESETS = [
  // ... existing presets
  { name: 'Ultra', cpu: 60, mem: 2048, proc: 20, fsize: 500 },
];
```

### Change Theme Colors

Edit `tailwind.config.js`:

```javascript
colors: {
  primary: {
    500: '#0ea5e9',  // Change to your color
    600: '#0284c7',
    700: '#0369a1',
  },
}
```

---

## 🐛 Troubleshooting

### Issue: "Cannot find module 'electron'"

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: C binaries not found

**Solution:**
```bash
cd core_c
make clean
make all
ls -l bin/  # Verify binaries exist
chmod +x bin/*  # Ensure executable
```

### Issue: WSL not working (Windows)

**Solution:**
```bash
# Install WSL2
wsl --install

# Set WSL2 as default
wsl --set-default-version 2

# Restart computer
# Then try npm run dev again
```

### Issue: Port 5173 already in use

**Solution:**
```bash
# Kill existing Vite server
pkill -f vite

# Or change port in vite.config.ts
server: { port: 3000 }
```

### Issue: TypeScript errors

**Solution:**
```bash
# These are expected until dependencies are installed
npm install

# If persists, clear build cache
rm -rf dist node_modules
npm install
npm run build
```

---

## 📚 Project Commands Reference

| Command | Description |
|---------|-------------|
| `npm install` | Install all dependencies |
| `npm run build:core` | Build C binaries |
| `npm run build:main` | Compile main process (TypeScript) |
| `npm run build:preload` | Compile preload script (TypeScript) |
| `npm run build:renderer` | Build React app (Vite) |
| `npm run build` | Build everything |
| `npm run dev` | Development mode with hot reload |
| `npm start` | Run production build |
| `npm run package` | Package for all platforms |
| `npm run package:linux` | Package for Linux only |
| `npm run package:win` | Package for Windows only |
| `npm run clean` | Remove all build artifacts |

---

## 📂 Important Files

| File | Purpose |
|------|---------|
| `src/main/main.ts` | Electron main process (spawn C binary) |
| `src/preload/preload.ts` | IPC bridge (security) |
| `src/renderer/App.tsx` | Main React app |
| `src/renderer/components/Terminal.tsx` | Terminal component |
| `core_c/Makefile` | C engine build system |
| `package.json` | Dependencies & scripts |
| `electron-builder.yml` | Packaging configuration |
| `vite.config.ts` | React bundler config |
| `tailwind.config.js` | CSS framework config |

---

## 🎯 Common Tasks

### Task: Add a new React component

```bash
# 1. Create file
touch src/renderer/components/MyComponent.tsx

# 2. Write component
cat > src/renderer/components/MyComponent.tsx << 'EOF'
import React from 'react';

interface MyComponentProps {
  title: string;
}

const MyComponent: React.FC<MyComponentProps> = ({ title }) => {
  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
      <h2 className="text-lg font-bold">{title}</h2>
    </div>
  );
};

export default MyComponent;
EOF

# 3. Import in App.tsx
# Add: import MyComponent from './components/MyComponent';
# Use: <MyComponent title="Hello" />

# 4. See changes (if dev mode running)
# Changes appear instantly!
```

### Task: Change app window size

Edit `src/main/main.ts`:

```typescript
mainWindow = new BrowserWindow({
  width: 1600,   // Change from 1400
  height: 1000,  // Change from 900
  // ...
});
```

### Task: Debug the app

```bash
# Development mode includes DevTools
npm run dev

# In app window:
# Press F12 or Ctrl+Shift+I to open DevTools
```

---

## 🚀 Production Deployment

### Build Distribution Packages

```bash
# 1. Clean build
npm run clean
npm install
npm run build

# 2. Package for Linux
npm run package:linux

# Output:
# release/ZenCube-3.0.0.AppImage        (portable)
# release/zencube_3.0.0_amd64.deb       (Debian/Ubuntu)
# release/ZenCube-3.0.0.tar.gz          (generic)

# 3. Package for Windows (on Windows machine with WSL)
npm run package:win

# Output:
# release/ZenCube-Setup-3.0.0.exe      (installer)
# release/ZenCube-3.0.0-win.zip        (portable)
```

### Test the Package

```bash
# Linux AppImage
chmod +x release/ZenCube-3.0.0.AppImage
./release/ZenCube-3.0.0.AppImage

# Debian/Ubuntu
sudo dpkg -i release/zencube_3.0.0_amd64.deb
zencube

# Portable
tar -xzf release/ZenCube-3.0.0.tar.gz
cd ZenCube-3.0.0
./ZenCube
```

---

## 💡 Pro Tips

1. **Use Quick Commands** - Fastest way to test functionality
2. **Try Presets First** - Before custom limits
3. **Watch Terminal Colors** - Green = success, Red = error
4. **Use Dark Mode** - Easier on eyes for long sessions
5. **Stop Long Processes** - Red stop button always available
6. **Check Core Binaries** - Run `ls -l core_c/bin/` to verify
7. **Dev Mode for Testing** - Hot reload saves time
8. **Build Mode for Performance** - Optimize before packaging

---

## 📞 Getting Help

- **Documentation:** See `README.md` and `MIGRATION_SUMMARY.md`
- **C Engine Docs:** See `core_c/README.md`
- **Project Docs:** See `docs/` directory
- **Issues:** https://github.com/your-org/zencube/issues

---

## ✅ Verification Checklist

Before considering setup complete:

- [ ] `node --version` shows 18+
- [ ] `npm install` completes without errors
- [ ] `npm run build:core` creates `core_c/bin/sampler`
- [ ] `npm run dev` launches app window
- [ ] Quick commands execute successfully
- [ ] Terminal shows colored output
- [ ] Dark mode toggle works
- [ ] Stop button terminates processes
- [ ] Resource limit presets apply correctly

---

**🧊 You're ready to use ZenCube Desktop!**

For questions, check `README.md` or open an issue.
