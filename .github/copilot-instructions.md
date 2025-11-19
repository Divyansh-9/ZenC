````instructions
# ZenCube AI Agent Instructions

## Project Overview
ZenCube is a **cross-platform process sandbox** combining a high-performance C monitoring core with an Electron/React GUI. It provides resource limiting (CPU, memory, processes, file size), file jail isolation, network restrictions, real-time monitoring with Prometheus metrics export, and **AI-powered anomaly detection**.

**Critical Context:** This is a hybrid architecture with performance-critical separation between C daemons and Electron frontend. The C core (`core_c/`) replaced a Python Phase-3 implementation for performance. Version 3.0.0 adds ML anomaly detection via Google Gemini API with local heuristics fallback.

## Architecture - The Big Picture

### Three-Layer System
```
┌─────────────────────────────────────────────────┐
│ Electron Frontend (TypeScript/React)           │
│ - src/main/main.ts: Process orchestration      │
│ - src/main/monitoring-worker.ts: Worker thread │
│ - src/renderer/: React UI with xterm.js        │
└─────────────────────────────────────────────────┘
                    ↓ IPC
┌─────────────────────────────────────────────────┐
│ C Monitoring Core (core_c/)                    │
│ - sampler: /proc parsing for metrics           │
│ - alertd: Rule evaluation engine                │
│ - prom_exporter: HTTP /metrics endpoint         │
│ - logrotate_core: Log rotation/compression      │
└─────────────────────────────────────────────────┘
                    ↓ JSONL
┌─────────────────────────────────────────────────┐
│ Sandboxed Process (user command)               │
│ - Monitored via /proc filesystem                │
│ - Limits enforced via setrlimit()               │
└─────────────────────────────────────────────────┘
```

**Key Insight:** The C core is POSIX-native (Linux-only), while Electron provides cross-platform support via WSL on Windows. Never assume direct Windows compatibility for C binaries.

### Critical Data Flow (Zero-Lag Architecture)
1. **Electron Main** spawns user process, then spawns `sampler` with `--pid`
2. **Sampler** writes JSONL to temp file (1 sample/second, non-blocking)
3. **Worker Thread** (`monitoring-worker.ts`) watches file, batches data every 1 second
4. **Renderer** receives pre-batched arrays via IPC, writes to xterm.js via **refs** (no React state)
5. **ML Pipeline** (if enabled): After 10 samples (configurable), triggers AI analysis
   - Checks whitelist (`config/anomaly.config.jsonc`) to skip test utilities
   - Calls Gemini API with feature snapshot OR uses local heuristics
   - Stores analysis in SQLite (`ml-database.ts`)
   - Renders in AI Insights tab with anomaly score, type, recommendations
6. **Result:** Zero UI lag, ~99% reduction in IPC messages

**Anti-Pattern to Avoid:** Do NOT use React state for terminal output or high-frequency monitoring updates. This causes lag. Use `useRef` + `useImperativeHandle` for direct DOM manipulation.

## Core C Implementation (`core_c/`)

### Build System
```bash
cd core_c && make clean && make all
```
Outputs to `core_c/bin/`: `sampler`, `alertd`, `logrotate_core`, `prom_exporter`

**Critical:** The Makefile uses `-D_GNU_SOURCE -D_POSIX_C_SOURCE=200809L` for Linux-specific features. Do NOT attempt macOS/BSD portability without major refactoring.

### ML Test Programs
```bash
cd ml_anomaly_tests && make all
```
Outputs to `ml_anomaly_tests/bin/`: `cpu_spike_attack`, `memory_leak_progressive`, `fork_bomb_gradual`, `io_storm_writer`, `resource_exhaustion_combo`

**Important:** Programs in `ui_test_programs/bin/` are whitelisted (infinite_loop, memory_hog, fork_bomb, file_writer, network_test) and skip ML analysis. Programs in `ml_anomaly_tests/bin/` are NOT whitelisted and should trigger anomaly detection.

### JSONL Schema (Shared Contract)
All C binaries read/write this format for GUI compatibility:
```json
{"event":"sample","timestamp":"2025-11-16T07:30:45Z","cpu_percent":45.2,"memory_rss":134217728,"threads":1,"open_files":12}
{"event":"stop","timestamp":"2025-11-16T07:31:00Z","samples":15,"duration_seconds":15.234,"exit_code":0}
```
**Key Files:** `core_c/sampler.c` (writes), `src/main/monitoring-worker.ts` (reads), `src/renderer/components/MonitoringDashboard.tsx` (consumes)

### Testing
```bash
cd core_c && make test  # Runs test_sampler.sh, test_alert_engine.sh, test_prom_exporter.sh
cd tests && ./test_gui_monitoring_py.sh  # Integration test with GUI
```

**Important:** Tests assume Linux `/proc` filesystem. WSL tests use `wsl` prefix in test scripts.

## Electron Frontend

### Development Workflow
```bash
npm install
npm run build:core      # Compile C binaries first
npm run build:tests     # Compile ui_test_programs (infinite_loop, memory_hog, etc.)
npm run dev             # Vite dev server + Electron with hot reload
```

**Port:** Vite runs on `http://localhost:5173` (configured in `vite.config.ts`)

### Critical Files & Patterns

#### `src/main/main.ts` (654 lines)
**Purpose:** Electron main process - orchestrates sandboxed execution, file jail, network isolation

**Key IPC Handlers:**
- `execute-sandbox`: Spawns process with optional `unshare -n` (network isolation), starts sampler/worker
- `stop-sandbox`: Terminates process + sampler + worker thread
- `get-alerts`, `get-prometheus-metrics`: On-demand daemon execution

**Pattern - WSL Detection:**
```typescript
function isWindows(): boolean {
  return process.platform === 'win32';
}

// In execute-sandbox:
if (isWindows()) {
  spawnCommand = 'wsl';
  spawnArgs = ['unshare', '-n', finalCommand, ...finalArgs];
} else {
  spawnCommand = 'unshare';
  spawnArgs = ['-n', finalCommand, ...finalArgs];
}
```

**Pattern - IPC Batching (Anti-Lag):**
```typescript
let terminalBuffer = '';
const ipcSender = setInterval(() => {
  if (terminalBuffer.length > 0 && mainWindow) {
    const chunk = terminalBuffer.substring(0, 65536); // 64KB chunks
    mainWindow.webContents.send('sandbox-output', { type: 'stdout', data: chunk });
    terminalBuffer = terminalBuffer.substring(65536);
  }
}, 300); // 300ms batching prevents flooding
```
**Critical:** Always batch high-frequency IPC. Individual sends cause Electron IPC queue saturation.

#### `src/main/monitoring-worker.ts` (133 lines)
**Purpose:** Worker thread for non-blocking file I/O and JSON parsing

**Pattern - Worker Thread Setup:**
```typescript
// In main.ts:
monitoringWorker = new Worker(path.join(__dirname, 'monitoring-worker.js'));
monitoringWorker.postMessage({ type: 'start', pid, path: outputPath });

monitoringWorker.on('message', (msg) => {
  if (msg.type === 'data-batch') {
    mainWindow.webContents.send('monitoring-data-batch', msg.data); // Pre-batched array
  }
});

// In monitoring-worker.ts:
setInterval(() => {
  if (dataBuffer.length > 0) {
    parentPort?.postMessage({ type: 'data-batch', data: [...dataBuffer] });
    dataBuffer = [];
  }
}, 1000); // 1 second batches
```
**Why:** Offloads `fs.watch`, `createReadStream`, `JSON.parse` from main thread. Reduces main thread load by ~90%.

#### `src/renderer/components/Terminal.tsx` (130 lines)
**Purpose:** Xterm.js terminal with ref-based API (zero React re-renders)

**Pattern - Ref-Based Updates:**
```typescript
export const Terminal = forwardRef<TerminalHandle>((props, ref) => {
  const xtermRef = useRef<XTerm | null>(null);
  
  useImperativeHandle(ref, () => ({
    write: (data: string) => {
      xtermRef.current?.write(data); // Direct DOM manipulation, no setState
    },
    clear: () => {
      xtermRef.current?.clear();
    }
  }));
  
  return <div ref={terminalContainerRef} />;
});

// In App.tsx:
const terminalRef = useRef<TerminalHandle>(null);
terminalRef.current?.write(data); // Bypasses React state completely
```
**Critical:** This eliminates 100% of terminal-induced re-renders. Do NOT revert to `useState` for terminal content.

#### `src/renderer/components/MonitoringDashboard.tsx` (381 lines)
**Purpose:** Real-time charts (Recharts) with batch processing

**Pattern - React.memo + Batch Updates:**
```typescript
export const MonitoringDashboard = React.memo(({ isRunning }: Props) => {
  const [data, setData] = useState<MetricData[]>([]);
  
  useEffect(() => {
    window.electron.onMonitoringDataBatch((batch: any[]) => {
      setData(prev => {
        const combined = [...prev, ...batch]; // Batch append
        return combined.slice(-60); // Keep last 60 points only
      });
    });
  }, []);
  
  return <ResponsiveContainer><LineChart data={data} /></ResponsiveContainer>;
});
```
**Why 60 points?** Reduced from 100 to minimize DOM manipulation. Recharts re-renders on every data change.

### Package.json Scripts
- `build:core`: Compiles C binaries via Makefile
- `build:main/preload/renderer`: TypeScript compilation (separate tsconfigs)
- `dev:electron`: Starts Vite dev server, waits for port 5173, launches Electron
- `package:linux/win`: electron-builder for AppImage, deb, NSIS installer

**Dependency Note:** `framer-motion` was removed for zero-lag. Do NOT re-add animation libraries.

## ML Anomaly Detection System

### Architecture
**Three-Tier Analysis Pipeline:**
1. **Feature Extraction** (`local-heuristics.ts`): Builds feature snapshots from metrics batches
   - CPU spike detection (>85% sustained)
   - Memory leak detection (>10MB/sample growth)
   - Fork bomb detection (>50 threads OR >0.5 threads/sample growth)
   - I/O storm detection (>1MB/s write rate)
2. **AI Analysis** (`gemini-analyzer.ts`): Sends feature snapshots to Google Gemini 1.5 Flash
   - Uses structured prompts with JSON mode for reliable parsing
   - API key rotation (up to 16 keys in `.env`)
   - Exponential backoff on rate limits
3. **Fallback** (`local-heuristics.ts`): If Gemini unavailable, uses rule-based heuristics
   - Deterministic scoring based on thresholds
   - Zero latency, no API costs

### Whitelist System
**Configuration:** `config/anomaly.config.jsonc`
```jsonc
{
  "whitelist": ["infinite_loop", "memory_hog", "fork_bomb", "file_writer", "network_test"]
}
```
**Purpose:** Skip ML analysis for known test utilities in `ui_test_programs/bin/`. Prevents false positives during development.

**Implementation:** `src/main/main.ts` line ~1050
```typescript
const cfg = getAnomalyConfig();
const basename = path.basename(run.command);
if (cfg.whitelist?.includes(basename)) {
  console.log(`[ML] Skipping analysis for whitelisted command: ${basename}`);
  return; // Skip ML analysis
}
```

**Critical:** Whitelist detection reads `/proc/<pid>/cmdline` to get actual executed binary name (not the command entered in GUI). Works natively on Linux, limited reliability on Windows/WSL.

### Database Storage
**SQLite Schema:** `ml-database.ts` → `~/.zencube/data/ml_database.sqlite`
```sql
CREATE TABLE monitoring_runs (run_id, command, pid, start_time, end_time);
CREATE TABLE ml_analyses (run_id, anomaly_score, is_anomalous, anomaly_type, explanation, recommendations, api_provider);
```
**Purpose:** Persist all analyses for historical review, audit trail, and model evaluation.

### Demo Mode
**Flag:** `DEMO_MODE=true` in `src/main/main.ts` (line 20)
**When Enabled:** Generates realistic fake data instead of calling Gemini API. Useful for UI development without API costs.
**To Disable:** Set `DEMO_MODE=false` and rebuild (`npm run build:main`).

## Testing Strategy

### C Core Tests
- **Location:** `core_c/tests/*.sh` and `tests/*.sh`
- **Pattern:** Bash scripts that spawn C binaries, verify JSONL output format
- **Example:** `test_sampler.sh` spawns `sleep 5`, verifies `sampler` writes samples with `cpu_percent`, `memory_rss`

### GUI Integration Tests
- **Location:** `tests/test_gui_*.sh`
- **Pattern:** Use `curl` to POST JSON to IPC endpoints (assumes running Electron app)
- **Example:** `test_gui_file_jail.sh` sends `{command:"./tests/test_jail_dev.sh", jailPath:"/tmp/jail", useJail:true}`

### UI Test Programs (`ui_test_programs/`)
- **Purpose:** Whitelisted utilities for testing sandbox limits (should NOT trigger ML)
- **Files:** `infinite_loop.c` (CPU test), `memory_hog.c` (memory test), `fork_bomb.c` (process test), `file_writer.c` (file size test)
- **Build:** `cd ui_test_programs && make` → outputs to `ui_test_programs/bin/`
- **Whitelist:** All binaries in this folder are whitelisted in `config/anomaly.config.jsonc`

### ML Anomaly Test Suite (`ml_anomaly_tests/`)
- **Purpose:** Programs designed to trigger ML anomaly detection (NOT whitelisted)
- **Files:** `cpu_spike_attack.c`, `memory_leak_progressive.c`, `fork_bomb_gradual.c`, `io_storm_writer.c`, `resource_exhaustion_combo.c`
- **Build:** `cd ml_anomaly_tests && make all`
- **Verification:** Run `./ml_anomaly_tests/verify_whitelist.sh` to confirm these are NOT whitelisted
- **Expected:** All should show `isAnomalous: true` with anomaly scores 0.6-0.95

**Usage in GUI:** Select `ui_test_programs/bin/infinite_loop` as executable, set CPU limit to 5 seconds, verify SIGXCPU termination. For ML testing, use `ml_anomaly_tests/bin/cpu_spike_attack` and check AI Insights tab.

## Cross-Platform Specifics

### Linux (Native)
- File jail: Uses `/proc/{pid}/fd` polling (`startFileJailMonitor` in `main.ts`)
- Network isolation: `unshare -n` command
- Sampler: Direct `/proc/{pid}/stat`, `/proc/{pid}/status` parsing

### Windows (WSL)
- All Linux binaries run via `wsl` prefix
- File jail monitoring disabled (WSL `/proc` unreliable)
- Sampler disabled (WSL PID namespace issues)
- Network isolation: `wsl unshare -n`

**Detection:** `process.platform === 'win32'` triggers WSL mode

## Common Pitfalls & Solutions

### IPC Message Flooding
**Symptom:** UI freezes when running high-output programs  
**Cause:** Sending 1000+ IPC messages/second  
**Solution:** Batch with `setInterval` (300ms for terminal, 1s for monitoring). See `main.ts` lines 180-190.

### Terminal Lag
**Symptom:** Terminal output delayed by 1-2 seconds  
**Cause:** React state updates triggering re-renders  
**Solution:** Use refs (`terminalRef.current.write()`), not `useState`. See `Terminal.tsx` lines 40-55.

### Worker Thread File Not Found
**Symptom:** `Error: Cannot find module 'monitoring-worker.js'`  
**Cause:** TypeScript compiles to `dist/main/monitoring-worker.js`  
**Solution:** Use `path.join(__dirname, 'monitoring-worker.js')` (already in `main.ts` line 144).

### C Binary Missing
**Symptom:** `Error: spawn ENOENT` when executing sandbox  
**Cause:** Forgot `npm run build:core`  
**Solution:** Always run `npm run build:core` before `npm run dev`

### JSONL Parse Errors
**Symptom:** Monitoring dashboard shows no data  
**Cause:** Malformed JSON from sampler  
**Solution:** Check sampler output manually: `cat /tmp/zencube_samples_*.jsonl | jq .` (validates JSON)

## Code Style Conventions

### TypeScript
- **Strict mode enabled** (`tsconfig.json`: `strict: true`)
- **IPC types:** Define interfaces for all IPC messages (e.g., `{ type: 'stdout', data: string }`)
- **Electron APIs:** Always check nullability (`mainWindow?.webContents.send()`)

### C Code
- **Style:** ANSI C11, no GNU extensions except where necessary (`_GNU_SOURCE` for `unshare`)
- **Error handling:** Check all system call return values, use `strerror(errno)`
- **Logging:** Timestamp all log messages (see `logutil.c` `write_log()`)

### React Components
- **No inline styles:** Use Tailwind classes exclusively
- **Memoization:** Wrap expensive components in `React.memo` (e.g., `MonitoringDashboard`)
- **Refs over state:** For high-frequency updates, prefer refs

## Key Files Reference

| File | Purpose | Lines | Critical Sections |
|------|---------|-------|-------------------|
| `core_c/sampler.c` | /proc parsing, metrics collection | 450 | `sample_process()` (line 120), JSONL writing (line 230) |
| `core_c/alert_engine.c` | Rule evaluation (CPU/mem thresholds) | 280 | `evaluate_rule()` (line 85) |
| `core_c/prom_exporter.c` | HTTP server for /metrics | 380 | `handle_metrics()` (line 150) |
| `src/main/main.ts` | Electron orchestration + ML pipeline | 1190 | `execute-sandbox` handler (line 85), ML whitelist check (line 1051), `triggerMLAnalysis()` (line 975) |
| `src/main/monitoring-worker.ts` | Worker thread I/O | 127 | File watch setup (line 45), batching (line 90) |
| `src/main/gemini-analyzer.ts` | Gemini API integration | 358 | `analyzeMetrics()` (line 69), prompt building (line 150), API call with rotation (line 90) |
| `src/main/local-heuristics.ts` | Fallback ML analysis | 200+ | `runLocalHeuristicAnalysis()`, feature extraction, scoring logic |
| `src/main/anomaly-pipeline.ts` | ML orchestration | 100 | `analyzeAndPersistBatch()` (line 20), provider selection (line 42) |
| `src/main/ml-database.ts` | SQLite persistence | 300+ | `insertMLAnalysis()`, schema definitions |
| `src/renderer/App.tsx` | Main UI router | 345 | Tab state (line 50), IPC listeners (line 120) |
| `src/renderer/components/Terminal.tsx` | Xterm.js wrapper | 130 | Ref API (line 40), write method (line 55) |
| `src/renderer/components/MonitoringDashboard.tsx` | Recharts integration | 381 | Batch processing (line 95), chart rendering (line 200) |
| `src/renderer/components/AIInsights.tsx` | ML results display | 200+ | Analysis rendering, anomaly score visualization |
| `config/anomaly.config.jsonc` | ML configuration | 20 | Whitelist array (line 15), detection thresholds (lines 3-11) |

## When Making Changes

### Adding a New C Daemon
1. Create `{name}_main.c` and `{name}.c/.h` in `core_c/`
2. Update `core_c/Makefile` with new target (follow `SAMPLER` pattern)
3. Add test script to `core_c/tests/test_{name}.sh`
4. Document JSONL schema if different from sampler
5. Update `src/main/main.ts` IPC handler if needed

### Adding UI Features
1. **DO NOT** add animations (framer-motion removed for performance)
2. Use Tailwind for styling (no CSS modules)
3. If high-frequency updates: Use refs, not state
4. Add IPC handler in `src/main/main.ts`, expose in `src/preload/preload.ts`
5. Update TypeScript interfaces for type safety

### Modifying Monitoring
1. **Always** batch data (1 second minimum interval)
2. Test with `ui_test_programs/infinite_loop` (high CPU stress test)
3. Verify worker thread handles file rotations gracefully
4. Check memory usage (should stay <100MB for renderer)

### Adding/Modifying ML Features
1. **Update Feature Extraction:** Modify `local-heuristics.ts` → `buildFeatureSnapshot()` to add new metrics
2. **Update Gemini Prompt:** Modify `gemini-analyzer.ts` → `buildAnalysisPrompt()` to include new context
3. **Update Whitelist:** Add binaries to `config/anomaly.config.jsonc` whitelist array
4. **Test Both Paths:** Verify with Gemini API (requires keys in `.env`) AND local heuristics (no keys)
5. **Create Test Program:** Add new test to `ml_anomaly_tests/` if adding anomaly detection type
6. **Update Database Schema:** If adding new analysis fields, update `ml-database.ts` schema + migration logic

## Useful Commands for Development

```bash
# Full clean build
npm run clean && npm run build:core && npm run build

# Build ML test programs
cd ml_anomaly_tests && make all

# Verify ML whitelist configuration
./ml_anomaly_tests/verify_whitelist.sh

# Watch C binary logs
tail -f /tmp/zencube_samples_*.jsonl | jq .

# Test WSL mode (Windows)
wsl ./core_c/bin/sampler --pid 1234 --interval 1.0 --run-id test --out /tmp/test.jsonl

# Debug Electron main process
npm run dev  # Then attach Chrome DevTools to main process

# Check IPC message frequency
# In renderer console: window.electron.onMonitoringDataBatch(() => console.count('batch'))

# Validate JSONL schema
cat /tmp/zencube_samples_*.jsonl | jq -s 'map(select(.event == "sample")) | length'

# Query ML database directly
sqlite3 ~/.zencube/data/ml_database.sqlite "SELECT run_id, anomaly_score, anomaly_type FROM ml_analyses ORDER BY timestamp DESC LIMIT 10;"

# Test ML pipeline with specific program
# 1. Start app: npm run dev
# 2. Execute ml_anomaly_tests/bin/cpu_spike_attack
# 3. Check AI Insights tab or console logs for "[ML]" messages

# Run quick ML tests (with timeouts)
./ml_anomaly_tests/run_quick_tests.sh
```

## Documentation
- **Architecture:** `docs/PROJECT_OVERVIEW.md` (complete technical overview)
- **C Core:** `core_c/README.md` (JSONL schema, CLI usage)
- **ML System:** `ML_WHITELIST_COMPLETE.txt` (whitelist implementation), `ml_anomaly_tests/README.md` (test suite guide)
- **Phase 3 Implementation:** `docs/ROLE_1_CORE_SANDBOX.md` (C internals), `docs/ROLE_3_INTEGRATION.md` (Electron-C bridge)
- **UI Performance:** `ZERO_LAG_UI_COMPLETE.md` (worker thread architecture, ref-based terminal)

## Environment Configuration

### Required for ML Features
Create `.env` in project root with Gemini API keys:
```bash
ML_ENABLED=true
DEMO_MODE=false  # Set true for fake data without API calls
GEMINI_API_KEY_1=your_key_here
GEMINI_API_KEY_2=your_key_here
# ... up to GEMINI_API_KEY_16
```

### Optional (if using OpenAI fallback)
```bash
OPENAI_API_KEY=your_openai_key
```

**Note:** If no API keys provided, system automatically falls back to local heuristics (zero-latency, rule-based).

**Last Updated:** November 19, 2025  
**Project Version:** 3.0.0 (Phase 3 Core C + ML Anomaly Detection Complete)
