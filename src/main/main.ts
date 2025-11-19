import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { spawn, ChildProcessWithoutNullStreams, ChildProcess } from 'child_process';
import { Worker } from 'worker_threads';
import * as path from 'path';
import * as process from 'process';
import * as fs from 'fs';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import * as https from 'https';
import * as http from 'http';
import * as dotenv from 'dotenv';
import { GeminiAnalyzer } from './gemini-analyzer';
import { MLDatabase } from './ml-database';
import { getAnomalyConfig } from './anomaly-config';

// Load environment variables (API keys)
dotenv.config();

// DEMO MODE - Set to true for realistic fake data
const DEMO_MODE = false; // DISABLED - use real process execution

let mainWindow: BrowserWindow | null = null;
let sandboxProcess: ChildProcessWithoutNullStreams | null = null;
let samplerProcess: ChildProcess | null = null;
let prometheusProcess: ChildProcess | null = null;
let fileJailMonitor: NodeJS.Timeout | null = null;
let monitoringWorker: Worker | null = null; // Worker thread for monitoring

// ML Engine instances (global)
let geminiAnalyzer: GeminiAnalyzer | null = null;
let mlDatabase: MLDatabase | null = null;
let currentRunId: string | null = null;

// Demo mode state
let demoDataInterval: NodeJS.Timeout | null = null;
let demoProcessRunning = false;
let demoStartTime = 0;
let demoTestProgram = ''; // Track which test program is running
let demoTestType: 'normal' | 'anomaly' | 'default' = 'default';
let demoMLAnalyses: any[] = []; // Store ML analyses for demo mode

/**
 * Create the main application window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    titleBarStyle: 'default',
    icon: path.join(__dirname, '../../resources/icon.png'),
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Initialize ML engine (if enabled)
  initializeMLEngine();
}

/**
 * Initialize ML analysis engine
 */
function initializeMLEngine(): void {
  const mlEnabled = process.env.ML_ENABLED === 'true';
  
  if (!mlEnabled) {
    console.log('[ML] ML engine disabled in environment config');
    return;
  }
  
  try {
    // Initialize Gemini analyzer
    const geminiKeys = [
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4,
      process.env.GEMINI_API_KEY_5,
      process.env.GEMINI_API_KEY_6,
      process.env.GEMINI_API_KEY_7,
      process.env.GEMINI_API_KEY_8,
      process.env.GEMINI_API_KEY_9,
      process.env.GEMINI_API_KEY_10,
      process.env.GEMINI_API_KEY_11,
      process.env.GEMINI_API_KEY_12,
      process.env.GEMINI_API_KEY_13,
      process.env.GEMINI_API_KEY_14,
      process.env.GEMINI_API_KEY_15,
      process.env.GEMINI_API_KEY_16,
    ].filter(Boolean) as string[];
    
    if (geminiKeys.length === 0) {
      console.warn('[ML] No Gemini API keys found in .env, ML engine disabled');
      return;
    }
    
    geminiAnalyzer = new GeminiAnalyzer(geminiKeys);
    mlDatabase = new MLDatabase();
    
    console.log(`[ML] Initialized with ${geminiKeys.length} Gemini API keys`);
  } catch (error) {
    console.error('[ML] Failed to initialize ML engine:', error);
  }
}

/**
 * Determine if running on Windows
 */
function isWindows(): boolean {
  return process.platform === 'win32';
}

/**
 * Get the path to the sandbox binary
 */
function getSandboxPath(): string {
  const binaryName = 'sampler';
  return path.join(app.getAppPath(), 'core_c', 'bin', binaryName);
}

/**
 * File jail monitoring: Check /proc/{pid}/fd for violations
 */
function startFileJailMonitor(pid: number, jailPath: string, absoluteJailPath: string): void {
  // Whitelist of safe paths that should not trigger violations
  const whitelist = ['/dev/', '/proc/', '/sys/', '/usr/lib/', '/lib/', '/lib64/', '/tmp/'];
  
  fileJailMonitor = setInterval(() => {
    const fdDir = `/proc/${pid}/fd`;
    
    try {
      if (!fs.existsSync(fdDir)) {
        // Process has ended
        stopFileJailMonitor();
        return;
      }

      const fds = fs.readdirSync(fdDir);
      
      for (const fd of fds) {
        try {
          const fdPath = path.join(fdDir, fd);
          const link = fs.readlinkSync(fdPath);
          const targetPath = path.resolve(link);
          
          // Check if this is a whitelisted path
          const isWhitelisted = whitelist.some(prefix => targetPath.startsWith(prefix));
          
          // Check for violation
          if (!isWhitelisted && !targetPath.startsWith(absoluteJailPath)) {
            // Send violation to renderer
            if (mainWindow) {
              mainWindow.webContents.send('file-jail-violation', {
                path: targetPath
              });
            }
          }
        } catch (err) {
          // Ignore errors (fd might have closed, etc.)
        }
      }
    } catch (err) {
      // Process dir doesn't exist or can't be read
      stopFileJailMonitor();
    }
  }, 500); // Poll every 500ms
}

function stopFileJailMonitor(): void {
  if (fileJailMonitor) {
    clearInterval(fileJailMonitor);
    fileJailMonitor = null;
  }
}

/**
 * Start the sampler process and worker thread for monitoring
 */
function startSamplerMonitoring(pid: number): void {
  const samplerPath = path.join(app.getAppPath(), 'core_c', 'bin', 'sampler');
  const outputPath = path.join(app.getPath('temp'), `zencube_samples_${pid}.jsonl`);
  
  console.log(`[Sampler] Starting monitoring for PID ${pid}`);
  console.log(`[Sampler] Sampler binary: ${samplerPath}`);
  console.log(`[Sampler] Output file: ${outputPath}`);
  
  // Ensure the output file doesn't exist from a previous run
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
    console.log(`[Sampler] Removed old output file`);
  }
  
  const runId = `zencube_${Date.now()}`;
  
  const args = [
    '--pid', pid.toString(),
    '--interval', '1.0',
    '--run-id', runId,
    '--out', outputPath
  ];
  
  console.log(`[Sampler] Spawning with args:`, args);
  
  samplerProcess = spawn(samplerPath, args, {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  // Create monitoring run record in ML database
  if (mlDatabase) {
    try {
      mlDatabase.insertMonitoringRun({
        run_id: runId,
        pid,
        command: '', // Will be updated later if available
        start_time: new Date().toISOString(),
        end_time: null,
        exit_code: null,
      });
      currentRunId = runId as any; // Store run_id for ML analyses
      console.log(`[ML] Created monitoring run record: ${currentRunId}`);
    } catch (error) {
      console.error('[ML] Failed to create monitoring run:', error);
    }
  }

  // Attempt to read the monitored process command and update the monitoring run record
  // (some processes may start slowly; try after a short delay)
  setTimeout(() => {
    try {
      if (mlDatabase) {
        const cmdPath = `/proc/${pid}/cmdline`;
        if (fs.existsSync(cmdPath)) {
          const raw = fs.readFileSync(cmdPath, 'utf-8');
          const cmd = raw.split('\0')[0] || '';
          const basename = path.basename(cmd);
          if (basename) {
            mlDatabase.updateMonitoringRunCommand(runId, basename);
            console.log(`[ML] Updated monitoring run ${runId} command -> ${basename}`);
          }
        }
      }
    } catch (err) {
      // Non-fatal: process may have exited or /proc inaccessible
    }
  }, 500);
  
  if (samplerProcess) {
    console.log(`[Sampler] Process spawned with PID ${samplerProcess.pid}`);
    
    samplerProcess.stdout?.on('data', (data) => {
      console.log(`[Sampler stdout] ${data.toString()}`);
    });
    
    samplerProcess.stderr?.on('data', (data) => {
      console.error(`[Sampler stderr] ${data.toString()}`);
    });
    
    samplerProcess.on('error', (err) => {
      console.error('[Sampler] Process error:', err);
    });
    
    samplerProcess.on('exit', (code, signal) => {
      console.log(`[Sampler] Process exited with code ${code}, signal ${signal}`);
    });
  }
  
  // Start the monitoring worker thread
  const workerPath = path.join(__dirname, 'monitoring-worker.js');
  console.log(`[MonitoringWorker] Starting worker thread: ${workerPath}`);
  
  monitoringWorker = new Worker(workerPath);
  
  // Send start message to worker
  monitoringWorker.postMessage({
    type: 'start',
    pid,
    path: outputPath
  });
  
  // Listen for data batches from worker
  monitoringWorker.on('message', (msg) => {
    if (msg.type === 'data-batch' && mainWindow) {
      console.log(`[MonitoringWorker] Received batch with ${msg.data.length} data points`);
      
      // Send pre-batched data to renderer
      mainWindow.webContents.send('monitoring-data-batch', msg.data);
      
      // Trigger ML analysis every 10 batches (~10 seconds worth of data)
      // Don't analyze every batch (too slow, too expensive)
      if (msg.data.length >= 10) {
        triggerMLAnalysis(msg.data).catch(err => {
          console.error('[ML] Analysis trigger failed:', err);
        });
      }
    } else if (msg.type === 'stopped') {
      console.log('[MonitoringWorker] Worker confirmed shutdown');
    }
  });
  
  monitoringWorker.on('error', (err) => {
    console.error('[MonitoringWorker] Worker error:', err);
  });
  
  monitoringWorker.on('exit', (code) => {
    console.log(`[MonitoringWorker] Worker exited with code ${code}`);
    monitoringWorker = null;
  });
}

function stopSamplerMonitoring(): void {
  if (samplerProcess) {
    samplerProcess.kill();
    samplerProcess = null;
  }
  
  if (monitoringWorker) {
    console.log('[MonitoringWorker] Stopping worker thread');
    monitoringWorker.postMessage({ type: 'stop' });
    
    // Give worker 500ms to shut down gracefully, then terminate
    setTimeout(() => {
      if (monitoringWorker) {
        monitoringWorker.terminate();
        monitoringWorker = null;
      }
    }, 500);
  }
}

/**
 * Generate realistic mock monitoring data for demo
 */
function generateMockMonitoringData(testType: string, program: string, elapsed: number) {
  const timestamp = Date.now();
  let cpu = 0, memory = 0, threads = 1, open_files = 12;
  
  if (testType === 'normal') {
    // Normal tests: low CPU, stable memory
    cpu = 5 + Math.random() * 15; // 5-20%
    memory = (64 + Math.random() * 32) * 1024 * 1024; // 64-96MB
    threads = 1;
    open_files = 8 + Math.floor(Math.random() * 8);
  } else if (testType === 'anomaly') {
    // Anomaly tests: test-specific patterns
    switch (program) {
      case 'cpu_spike_attack':
        // Phase 1 (0-5s): Normal (15-25%)
        // Phase 2 (5-15s): Spike (85-95%)
        if (elapsed < 5) {
          cpu = 15 + Math.random() * 10;
        } else {
          cpu = 85 + Math.random() * 10;
        }
        memory = (128 + elapsed * 5) * 1024 * 1024;
        threads = 1;
        break;
        
      case 'memory_leak_progressive':
        // Progressive memory growth: 10MB/s
        cpu = 20 + Math.random() * 15;
        memory = (128 + elapsed * 10) * 1024 * 1024; // +10MB/s
        threads = 1;
        break;
        
      case 'fork_bomb_gradual':
        // Gradual thread explosion
        cpu = 30 + elapsed * 3 + Math.random() * 15;
        memory = (128 + elapsed * 8) * 1024 * 1024;
        threads = Math.floor(1 + elapsed * 3); // 3 threads/s
        break;
        
      case 'io_storm_writer':
        // High I/O, moderate CPU
        cpu = 35 + Math.random() * 20;
        memory = (256 + elapsed * 5) * 1024 * 1024;
        threads = 2 + Math.floor(elapsed / 2);
        open_files = 50 + Math.floor(elapsed * 5);
        break;
        
      case 'resource_exhaustion_combo':
        // Combined: high CPU + memory leak + threads
        cpu = 70 + Math.random() * 20;
        memory = (256 + elapsed * 12) * 1024 * 1024;
        threads = Math.floor(5 + elapsed * 2);
        open_files = 100 + Math.floor(elapsed * 10);
        break;
        
      case 'ml_test_pattern':
        // Variable pattern
        cpu = 40 + Math.sin(elapsed) * 30 + Math.random() * 15;
        memory = (180 + elapsed * 8) * 1024 * 1024;
        threads = Math.floor(2 + elapsed / 3);
        break;
        
      default:
        // Default anomaly pattern
        cpu = 60 + Math.random() * 25;
        memory = (200 + elapsed * 6) * 1024 * 1024;
        threads = Math.floor(2 + elapsed);
    }
  } else {
    // Default/unknown: moderate activity
    cpu = 30 + Math.sin(elapsed) * 20 + Math.random() * 15;
    memory = (128 + elapsed * 4) * 1024 * 1024;
    threads = Math.floor(1 + elapsed / 5);
    open_files = 12 + Math.floor(Math.random() * 8);
  }
  
  return {
    timestamp,
    cpu: parseFloat(Math.min(99, Math.max(0, cpu)).toFixed(1)),
    memory: Math.floor(memory),
    threads: Math.max(1, threads),
    open_files: Math.max(1, open_files)
  };
}

/**
 * Get test-specific startup message
 */
function getTestStartupMessage(program: string): string {
  const messages: { [key: string]: string } = {
    'cpu_spike_attack': '\x1b[33m⚡ CPU Spike Attack Test\x1b[0m\n\x1b[90mPhase 1: Normal operation (5s)\x1b[0m\n\x1b[90mPhase 2: CPU spike to 95% (10s)\x1b[0m\n',
    'memory_leak_progressive': '\x1b[35m💧 Memory Leak Test\x1b[0m\n\x1b[90mAllocating 10MB/second without freeing...\x1b[0m\n',
    'fork_bomb_gradual': '\x1b[31m💣 Fork Bomb Test\x1b[0m\n\x1b[90mGradually increasing thread count...\x1b[0m\n',
    'io_storm_writer': '\x1b[36m🌀 I/O Storm Test\x1b[0m\n\x1b[90mWriting 10MB/s to disk...\x1b[0m\n',
    'resource_exhaustion_combo': '\x1b[91m🔥 Resource Exhaustion Test\x1b[0m\n\x1b[90mCombined attack: CPU + Memory + Threads\x1b[0m\n',
    'ml_test_pattern': '\x1b[96m🧪 ML Test Pattern\x1b[0m\n\x1b[90mGenerating test patterns...\x1b[0m\n'
  };
  return messages[program] || '\x1b[36mStarting test program...\x1b[0m\n';
}

/**
 * Send test-specific terminal output
 */
function sendTestSpecificOutput(program: string, elapsed: number, data: any) {
  if (!mainWindow || mainWindow.isDestroyed() || !demoProcessRunning) return;
  
  const elapsedInt = Math.floor(elapsed);
  
  // Send progress updates every 5 seconds
  if (elapsedInt % 5 === 0 && elapsed > 0 && elapsed < elapsedInt + 0.5) {
    const messages: { [key: string]: string } = {
      'cpu_spike_attack': getCpuSpikeMessages(elapsedInt, data),
      'memory_leak_progressive': getMemoryLeakMessages(elapsedInt, data),
      'fork_bomb_gradual': getForkBombMessages(elapsedInt, data),
      'io_storm_writer': getIoStormMessages(elapsedInt, data),
      'resource_exhaustion_combo': getResourceExhaustionMessages(elapsedInt, data),
      'infinite_loop': getNormalTestMessages(elapsedInt, data, 'CPU test'),
      'memory_hog': getNormalTestMessages(elapsedInt, data, 'Memory test'),
      'fork_bomb': getNormalTestMessages(elapsedInt, data, 'Process test'),
      'file_writer': getNormalTestMessages(elapsedInt, data, 'File I/O test'),
      'network_test': getNormalTestMessages(elapsedInt, data, 'Network test')
    };
    
    const message = messages[program] || `\x1b[90m[${elapsedInt}s] Running... CPU: ${data.cpu.toFixed(1)}% | Memory: ${(data.memory / 1024 / 1024).toFixed(1)}MB\x1b[0m\n`;
    
    try {
      mainWindow.webContents.send('sandbox-output', {
        type: 'stdout',
        data: message
      });
    } catch (err) {
      // Ignore EPIPE errors
      if ((err as any).code === 'EPIPE') {
        demoProcessRunning = false;
      }
    }
  }
}

// Test-specific message generators
function getCpuSpikeMessages(elapsed: number, data: any): string {
  if (elapsed === 5) return '\x1b[33m⚡ Phase 1 complete: Normal baseline established\x1b[0m\n';
  if (elapsed === 10) return `\x1b[31m⚠ Phase 2: CPU SPIKE INITIATED - ${data.cpu.toFixed(1)}%\x1b[0m\n`;
  if (elapsed === 15) return `\x1b[31m🔥 Peak CPU usage: ${data.cpu.toFixed(1)}%\x1b[0m\n`;
  return `\x1b[90m[${elapsed}s] CPU: ${data.cpu.toFixed(1)}% | Memory: ${(data.memory / 1024 / 1024).toFixed(1)}MB\x1b[0m\n`;
}

function getMemoryLeakMessages(elapsed: number, data: any): string {
  const memMB = (data.memory / 1024 / 1024).toFixed(1);
  if (elapsed === 5) return `\x1b[35m💧 Memory leak detected: ${memMB}MB (growing +10MB/s)\x1b[0m\n`;
  if (elapsed === 10) return `\x1b[35m⚠ Memory usage: ${memMB}MB - leak persisting\x1b[0m\n`;
  if (elapsed === 15) return `\x1b[31m🔥 Critical memory: ${memMB}MB\x1b[0m\n`;
  return `\x1b[90m[${elapsed}s] Memory: ${memMB}MB (leaked: +${(elapsed * 10).toFixed(0)}MB)\x1b[0m\n`;
}

function getForkBombMessages(elapsed: number, data: any): string {
  const threads = Math.floor(data.cpu / 2 + elapsed * 2);
  if (elapsed === 5) return `\x1b[31m💣 Thread explosion detected: ${threads} threads\x1b[0m\n`;
  if (elapsed === 10) return `\x1b[31m⚠ ${threads} threads spawned - fork bomb pattern\x1b[0m\n`;
  if (elapsed === 15) return `\x1b[91m🔥 Critical: ${threads}+ threads\x1b[0m\n`;
  return `\x1b[90m[${elapsed}s] Threads: ${threads} | CPU: ${data.cpu.toFixed(1)}%\x1b[0m\n`;
}

function getIoStormMessages(elapsed: number, data: any): string {
  const writtenMB = elapsed * 10;
  if (elapsed === 5) return `\x1b[36m🌀 I/O storm active: ${writtenMB}MB written\x1b[0m\n`;
  if (elapsed === 10) return `\x1b[33m⚠ Excessive I/O: ${writtenMB}MB in ${elapsed}s (${(writtenMB/elapsed).toFixed(1)}MB/s)\x1b[0m\n`;
  if (elapsed === 15) return `\x1b[31m🔥 ${writtenMB}MB written - disk saturation\x1b[0m\n`;
  return `\x1b[90m[${elapsed}s] Written: ${writtenMB}MB | Rate: ${(writtenMB/elapsed).toFixed(1)}MB/s\x1b[0m\n`;
}

function getResourceExhaustionMessages(elapsed: number, data: any): string {
  const memMB = (data.memory / 1024 / 1024).toFixed(1);
  if (elapsed === 5) return `\x1b[91m🔥 Multi-vector attack: CPU ${data.cpu.toFixed(1)}% + Memory ${memMB}MB\x1b[0m\n`;
  if (elapsed === 10) return `\x1b[91m⚠ CRITICAL: All resources under stress\x1b[0m\n`;
  if (elapsed === 15) return `\x1b[91m💥 System limits approaching\x1b[0m\n`;
  return `\x1b[90m[${elapsed}s] CPU: ${data.cpu.toFixed(1)}% | Mem: ${memMB}MB | Threads: ${Math.floor(elapsed * 3)}\x1b[0m\n`;
}

function getNormalTestMessages(elapsed: number, data: any, testType: string): string {
  const memMB = (data.memory / 1024 / 1024).toFixed(1);
  if (elapsed === 5) return `\x1b[32m✓ ${testType} running normally\x1b[0m\n`;
  if (elapsed === 10) return `\x1b[36mℹ Status: Stable | CPU: ${data.cpu.toFixed(1)}% | Memory: ${memMB}MB\x1b[0m\n`;
  return `\x1b[90m[${elapsed}s] CPU: ${data.cpu.toFixed(1)}% | Memory: ${memMB}MB\x1b[0m\n`;
}

/**
 * Start demo mode with realistic fake data
 */
function startDemoMode(command: string = '') {
  if (!DEMO_MODE || demoProcessRunning) return;
  
  demoProcessRunning = true;
  demoStartTime = Date.now();
  
  // Extract program name from command
  const basename = path.basename(command || '');
  demoTestProgram = basename;
  
  console.log(`[DEMO MODE] Received command: ${command}`);
  console.log(`[DEMO MODE] Extracted basename: ${basename}`);
  
  // Determine test type
  const ML_ANOMALY_TESTS = ['cpu_spike_attack', 'memory_leak_progressive', 'fork_bomb_gradual', 'io_storm_writer', 'resource_exhaustion_combo', 'ml_test_pattern'];
  const UI_TEST_PROGRAMS = ['infinite_loop', 'memory_hog', 'fork_bomb', 'file_writer', 'network_test'];
  
  if (ML_ANOMALY_TESTS.includes(basename)) {
    demoTestType = 'anomaly';
  } else if (UI_TEST_PROGRAMS.includes(basename)) {
    demoTestType = 'normal';
  } else {
    demoTestType = 'default';
  }
  
  console.log(`[DEMO MODE] Test type: ${demoTestType}, Program: ${basename}`);
  
  // Send initial startup message
  if (mainWindow) {
    mainWindow.webContents.send('sandbox-output', {
      type: 'stdout',
      data: `\x1b[36mStarting process...\x1b[0m\n`
    });
    
    // Generate test-specific startup messages
    setTimeout(() => {
      if (!mainWindow) return;
      
      if (demoTestType === 'anomaly') {
        mainWindow.webContents.send('sandbox-output', {
          type: 'stdout',
          data: getTestStartupMessage(basename)
        });
      } else if (demoTestType === 'normal') {
        mainWindow.webContents.send('sandbox-output', {
          type: 'stdout',
          data: '\x1b[36mInitializing resources...\x1b[0m\n'
        });
      } else {
        mainWindow.webContents.send('sandbox-output', {
          type: 'stdout',
          data: '\x1b[36mStarting process...\x1b[0m\n'
        });
      }
    }, 500);
    
    setTimeout(() => {
      if (!mainWindow) return;
      mainWindow.webContents.send('sandbox-output', {
        type: 'stdout',
        data: '\x1b[32m✓ Process initialized\x1b[0m\n'
      });
    }, 1500);
  }
  
  // Send realistic monitoring data every 1 second
  let mlAnalysisTriggered = false;
  demoDataInterval = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed() || !demoProcessRunning) {
      if (demoDataInterval) {
        clearInterval(demoDataInterval);
        demoDataInterval = null;
      }
      return;
    }
    
    try {
      const elapsed = (Date.now() - demoStartTime) / 1000;
      const data = generateMockMonitoringData(demoTestType, demoTestProgram, elapsed);
      const batch = [data];
      
      mainWindow.webContents.send('monitoring-data-batch', batch);
      
      // Send test-specific terminal output
      sendTestSpecificOutput(demoTestProgram, elapsed, data);
      
      // Trigger ML analysis for anomaly tests at 12 seconds (once)
      if (demoTestType === 'anomaly' && elapsed >= 12 && !mlAnalysisTriggered) {
        mlAnalysisTriggered = true;
        console.log(`[ML] Triggering analysis for ${demoTestProgram} at ${elapsed.toFixed(1)}s`);
        triggerMockMLAnalysis(data, demoTestProgram);
      }
      
      // Auto-stop after 30 seconds
      if (elapsed >= 30) {
        console.log('[System] Process time limit reached (30s)');
        stopDemoMode();
      }
    } catch (err) {
      // Stop on any error to prevent EPIPE spam
      console.error('[DEMO MODE] Error in interval, stopping:', err);
      demoProcessRunning = false;
      if (demoDataInterval) {
        clearInterval(demoDataInterval);
        demoDataInterval = null;
      }
    }
  }, 1000);
}

/**
 * Stop demo mode
 */
function stopDemoMode() {
  if (!demoProcessRunning) return;
  
  demoProcessRunning = false;
  
  if (demoDataInterval) {
    clearInterval(demoDataInterval);
    demoDataInterval = null;
  }
  
  const elapsed = ((Date.now() - demoStartTime) / 1000).toFixed(1);
  
  // Safe send with window validation
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sandbox-output', {
        type: 'stdout',
        data: `\n\x1b[32m[Process completed]\x1b[0m Execution finished in ${elapsed}s\n`
      });
      
      mainWindow.webContents.send('sandbox-exit', {
        code: 0,
        signal: null,
        finalStdout: `Process completed successfully in ${elapsed}s`,
        finalStderr: ''
      });
    }
  } catch (err) {
    // Ignore EPIPE errors during cleanup
    if ((err as any).code !== 'EPIPE') {
      console.error('[DEMO MODE] Error during cleanup:', err);
    }
  }
  
  // Reset test state
  demoTestProgram = '';
  demoTestType = 'default';
}

/**
 * Generate fake alert
 */
function triggerMockAlert(ruleId: string, data: any) {
  if (!mainWindow) return;
  
  const alerts = [
    {
      rule_id: 'high_cpu',
      triggered: true,
      timestamp: new Date().toISOString(),
      message: `CPU usage ${data.cpu.toFixed(1)}% exceeds threshold 80%`,
      severity: 'warning',
      value: data.cpu,
      threshold: 80
    }
  ];
  
  mainWindow.webContents.send('sandbox-output', {
    type: 'stdout',
    data: `\x1b[1;31m⚠ ALERT:\x1b[0m \x1b[33m${alerts[0].message}\x1b[0m\n`
  });
}

/**
 * Generate fake ML analysis
 */
function triggerMockMLAnalysis(data: any, program: string = '') {
  if (!mainWindow) return;
  
  console.log(`[ML] triggerMockMLAnalysis called for program: ${program}`);
  
  setTimeout(() => {
    console.log(`[ML] Generating analysis for ${program}...`);
    // Test-specific anomaly analysis
    const analyses: { [key: string]: any } = {
      'cpu_spike_attack': {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        isAnomalous: true,
        anomalyScore: 0.89,
        anomalyType: 'cpu_spike',
        explanation: `CPU Spike Attack detected: Process spiked from 15% baseline to ${data.cpu.toFixed(1)}% sustained usage. This attack pattern indicates a deliberate resource exhaustion attempt through computational loops. The spike occurred at 5-second mark and persisted, consistent with malicious CPU-intensive operations.`,
        confidence: 0.94,
        recommendations: [
          'Terminate process immediately - confirmed malicious CPU spike',
          'Set strict CPU time limit (5-10 seconds) for future executions',
          'Enable CPU throttling or cgroups for better resource control',
          'Add process to watchlist for repeated attack patterns'
        ],
        apiProvider: 'gemini',
        processingTimeMs: 1156
      },
      'memory_leak_progressive': {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        isAnomalous: true,
        anomalyScore: 0.82,
        anomalyType: 'memory_leak',
        explanation: `Progressive Memory Leak detected: Memory consumption increased linearly from 128MB to ${(data.memory / 1024 / 1024).toFixed(1)}MB at a rate of 10MB/second without corresponding deallocation. This pattern is consistent with uncontrolled memory allocation attacks designed to exhaust system memory.`,
        confidence: 0.91,
        recommendations: [
          'Terminate process to prevent memory exhaustion',
          'Set memory limit to 256MB for untrusted processes',
          'Enable swap monitoring to detect memory pressure',
          'Investigate memory allocation patterns in process'
        ],
        apiProvider: 'gemini',
        processingTimeMs: 1423
      },
      'fork_bomb_gradual': {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        isAnomalous: true,
        anomalyScore: 0.95,
        anomalyType: 'fork_bomb',
        explanation: `Fork Bomb Attack detected: Process spawned ${data.threads} threads in rapid succession (3 threads/second rate). This exponential growth pattern is characteristic of fork bomb attacks designed to exhaust process table entries and crash the system.`,
        confidence: 0.97,
        recommendations: [
          'CRITICAL: Kill process tree immediately',
          'Set strict process limit (max 5-10) for untrusted code',
          'Enable cgroups with process limits',
          'Monitor for similar fork bomb patterns'
        ],
        apiProvider: 'gemini',
        processingTimeMs: 981
      },
      'io_storm_writer': {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        isAnomalous: true,
        anomalyScore: 0.76,
        anomalyType: 'io_storm',
        explanation: `I/O Storm Attack detected: Process is writing approximately 10MB/second to disk with ${data.open_files} open file handles. This sustained high I/O rate can saturate disk bandwidth, slow system performance, and potentially fill disk space to cause denial of service.`,
        confidence: 0.88,
        recommendations: [
          'Terminate process to prevent disk saturation',
          'Set file size limits (100-500MB) for untrusted processes',
          'Enable I/O bandwidth throttling',
          'Monitor disk space usage proactively'
        ],
        apiProvider: 'gemini',
        processingTimeMs: 1367
      },
      'resource_exhaustion_combo': {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        isAnomalous: true,
        anomalyScore: 0.93,
        anomalyType: 'resource_exhaustion',
        explanation: `Multi-Vector Resource Exhaustion Attack: Process is simultaneously attacking CPU (${data.cpu.toFixed(1)}%), memory (${(data.memory / 1024 / 1024).toFixed(1)}MB, growing 12MB/s), threads (${data.threads}), and file handles (${data.open_files}). This coordinated attack pattern is highly sophisticated and designed to overwhelm all system resources.`,
        confidence: 0.96,
        recommendations: [
          'CRITICAL: Immediate termination required',
          'Enable all resource limits: CPU (10s), Memory (256MB), Processes (10), Files (100MB)',
          'Use containerization (Docker/cgroups) for strong isolation',
          'Flag this executable as high-risk malware'
        ],
        apiProvider: 'gemini',
        processingTimeMs: 1789
      },
      'ml_test_pattern': {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        isAnomalous: true,
        anomalyScore: 0.71,
        anomalyType: 'suspicious_pattern',
        explanation: `Anomalous Pattern detected: Process exhibits variable resource usage with CPU oscillating between 25-70% and memory growing at 8MB/s. While not as aggressive as other attacks, this behavior is consistent with evasion techniques that alternate between high and low resource usage to avoid detection.`,
        confidence: 0.79,
        recommendations: [
          'Continue monitoring for escalating behavior',
          'Enable stricter resource limits as precaution',
          'Log pattern for behavioral analysis',
          'Consider sandboxing in isolated environment'
        ],
        apiProvider: 'gemini',
        processingTimeMs: 1534
      }
    };
    
    const analysis = analyses[program] || {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      isAnomalous: true,
      anomalyScore: 0.65,
      anomalyType: 'unknown_anomaly',
      explanation: `Suspicious behavior detected: CPU at ${data.cpu.toFixed(1)}%, memory at ${(data.memory / 1024 / 1024).toFixed(1)}MB. Resource usage patterns deviate from normal baseline.`,
      confidence: 0.72,
      recommendations: [
        'Review process behavior manually',
        'Enable resource limits as precaution',
        'Monitor for escalating resource usage'
      ],
      apiProvider: 'gemini',
      processingTimeMs: 1211
    };
    
    // Store analysis in demo array
    demoMLAnalyses.unshift(analysis); // Add to beginning
    if (demoMLAnalyses.length > 10) {
      demoMLAnalyses = demoMLAnalyses.slice(0, 10); // Keep only last 10
    }
    
    console.log(`[ML] Analysis stored. Total analyses: ${demoMLAnalyses.length}`);
    
    mainWindow?.webContents.send('ml-analysis', analysis);
    mainWindow?.webContents.send('sandbox-output', {
      type: 'stdout',
      data: `\x1b[1;35m🤖 AI Analysis Complete:\x1b[0m \x1b[91m${analysis.anomalyType.toUpperCase()} detected (score: ${analysis.anomalyScore})\x1b[0m\n`
    });
    
    // Send terminal recommendations
    if (analysis.recommendations && analysis.recommendations.length > 0) {
      const recsText = analysis.recommendations.slice(0, 2).map((r: string) => `  • ${r}`).join('\n');
      mainWindow?.webContents.send('sandbox-output', {
        type: 'stdout',
        data: `\x1b[33m[Recommendations]\x1b[0m\n${recsText}\n`
      });
    }
  }, 1500);
}

/**
 * Execute the C sandbox binary with platform awareness and security features
 */
ipcMain.handle('execute-sandbox', async (event, options: {
  command: string;
  args: string[];
  cpuLimit?: number;
  memLimit?: number;
  procLimit?: number;
  fileSizeLimit?: number;
  isJailEnabled?: boolean;
  jailPath?: string;
  isNetworkDisabled?: boolean;
}) => {
  try {
    // Stop any existing process
    if (sandboxProcess) {
      sandboxProcess.kill();
      sandboxProcess = null;
    }
    
    stopFileJailMonitor();
    stopSamplerMonitoring();

    let spawnCommand: string;
    let spawnArgs: string[] = [];
    let spawnOptions: any = {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    };

    // Validate and prepare file jail
    let absoluteJailPath = '';
    if (options.isJailEnabled && options.jailPath) {
      absoluteJailPath = path.resolve(options.jailPath);
      
      if (!fs.existsSync(absoluteJailPath)) {
        return {
          success: false,
          message: `File jail path does not exist: ${absoluteJailPath}`
        };
      }
      
      if (!fs.statSync(absoluteJailPath).isDirectory()) {
        return {
          success: false,
          message: `File jail path is not a directory: ${absoluteJailPath}`
        };
      }
      
      // Set CWD to jail path
      spawnOptions.cwd = absoluteJailPath;
    }

    // Prepare the command
    const finalCommand = options.command;
    const finalArgs = [...options.args];

    // Handle network isolation
    if (options.isNetworkDisabled) {
      if (isWindows()) {
        // Windows/WSL: wsl unshare -n {command} {args}
        spawnCommand = 'wsl';
        spawnArgs = ['unshare', '-n', finalCommand, ...finalArgs];
      } else {
        // Linux: unshare -n {command} {args}
        spawnCommand = 'unshare';
        spawnArgs = ['-n', finalCommand, ...finalArgs];
      }
    } else {
      // No network isolation
      if (isWindows()) {
        // Windows/WSL: wsl {command} {args}
        spawnCommand = 'wsl';
        spawnArgs = [finalCommand, ...finalArgs];
      } else {
        // Linux: {command} {args}
        spawnCommand = finalCommand;
        spawnArgs = finalArgs;
      }
    }

    // Spawn the process
    sandboxProcess = spawn(spawnCommand, spawnArgs, spawnOptions);

    const pid = sandboxProcess.pid;
    
    if (!pid) {
      return {
        success: false,
        message: 'Failed to get process PID'
      };
    }

    // Start file jail monitoring if enabled
    if (options.isJailEnabled && absoluteJailPath && !isWindows()) {
      // File jail monitoring only works on native Linux (not WSL from Windows)
      startFileJailMonitor(pid, options.jailPath!, absoluteJailPath);
    }

    // Start sampler monitoring
    if (!isWindows()) {
      // Sampler monitoring only works on native Linux
      startSamplerMonitoring(pid);
    }

    // Output buffering to handle race conditions AND prevent IPC flooding
    let stdoutBuffer = '';
    let stderrBuffer = '';
    let terminalBuffer = ''; // Batching buffer for IPC sends
    const MAX_BUFFER_SIZE = 65536; // 64KB max per batch

    // Batched IPC sender - sends buffered data every 300ms to prevent UI lag
    const ipcSender = setInterval(() => {
      if (terminalBuffer.length > 0 && mainWindow) {
        // Split large buffers into chunks to prevent overwhelming the renderer
        const chunk = terminalBuffer.substring(0, MAX_BUFFER_SIZE);
        mainWindow.webContents.send('sandbox-output', {
          type: 'stdout',
          data: chunk,
        });
        terminalBuffer = terminalBuffer.substring(MAX_BUFFER_SIZE); // Keep remainder
      }
    }, 300); // 300ms batching interval for smoother performance

    // Accumulate stdout data (DON'T send immediately)
    sandboxProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      stdoutBuffer += output;      // Keep for final flush
      terminalBuffer += output;     // Add to batching buffer
    });

    // Accumulate stderr data (DON'T send immediately)
    sandboxProcess.stderr.on('data', (data: Buffer) => {
      const output = data.toString();
      stderrBuffer += output;       // Keep for final flush
      terminalBuffer += output;     // Add to batching buffer (merged with stdout)
    });

    // Handle process exit - CRITICAL for race condition fix
    sandboxProcess.on('exit', (code: number | null, signal: string | null) => {
      // STOP the batching interval
      clearInterval(ipcSender);
      
      // Send any final remaining buffered data
      if (terminalBuffer.length > 0 && mainWindow) {
        mainWindow.webContents.send('sandbox-output', {
          type: 'stdout',
          data: terminalBuffer,
        });
      }
      
      if (mainWindow) {
        // Send final buffered output with exit event
        mainWindow.webContents.send('sandbox-exit', {
          code,
          signal,
          finalStdout: stdoutBuffer,
          finalStderr: stderrBuffer,
        });
      }
      
      stopFileJailMonitor();
      stopSamplerMonitoring();
      sandboxProcess = null;
    });

    // Handle process errors
    sandboxProcess.on('error', (err: Error) => {
      // STOP the batching interval on error
      clearInterval(ipcSender);
      
      if (mainWindow) {
        mainWindow.webContents.send('sandbox-error', {
          message: err.message,
        });
      }
      
      stopFileJailMonitor();
      stopSamplerMonitoring();
      sandboxProcess = null;
    });

    return { success: true, message: 'Sandbox process started' };
  } catch (error) {
    stopFileJailMonitor();
    stopSamplerMonitoring();
    
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

/**
 * Stop the running sandbox process
 */
ipcMain.handle('stop-sandbox', async () => {
  // DEMO MODE: Stop fake data
  if (DEMO_MODE && demoProcessRunning) {
    console.log('[DEMO MODE] Stopping simulated execution...');
    stopDemoMode();
    return { success: true, message: 'Demo process stopped (simulated)' };
  }
  
  if (sandboxProcess) {
    sandboxProcess.kill('SIGTERM');
    sandboxProcess = null;
    stopFileJailMonitor();
    stopSamplerMonitoring();
    return { success: true, message: 'Sandbox process stopped' };
  }
  return { success: false, message: 'No process running' };
});

/**
 * Get system information
 */
ipcMain.handle('get-system-info', async () => {
  return {
    platform: process.platform,
    isWindows: isWindows(),
    sandboxPath: getSandboxPath(),
  };
});

/**
 * Get alerts from alertd
 */
ipcMain.handle('get-alerts', async () => {
  // DEMO MODE: Return fake alerts
  if (DEMO_MODE && demoProcessRunning) {
    const elapsed = (Date.now() - demoStartTime) / 1000;
    const mockData = generateMockMonitoringData(demoTestType, demoTestProgram, elapsed);
    
    const alerts = [];
    
    if (elapsed > 8) {
      alerts.push({
        rule_id: 'high_cpu',
        triggered: true,
        timestamp: new Date(demoStartTime + 10000).toISOString(),
        message: `CPU usage ${mockData.cpu.toFixed(1)}% exceeds threshold 80%`,
        severity: 'warning'
      });
    }
    
    if (elapsed > 15 && mockData.memory > 200 * 1024 * 1024) {
      alerts.push({
        rule_id: 'high_memory',
        triggered: true,
        timestamp: new Date(demoStartTime + 15000).toISOString(),
        message: `Memory usage ${(mockData.memory / 1024 / 1024).toFixed(0)}MB exceeds threshold 200MB`,
        severity: 'critical'
      });
    }
    
    return JSON.stringify(alerts, null, 2);
  }
  
  return new Promise<string>((resolve) => {
    const alertdPath = path.join(app.getAppPath(), 'core_c', 'bin', 'alertd');
    const alertsFile = path.join(app.getPath('temp'), 'test_alerts.jsonl');
    
    // Check if alerts file exists
    if (!fs.existsSync(alertsFile)) {
      resolve('No alerts file found. Run the sampler first to generate data.');
      return;
    }
    
    const args = ['--in', alertsFile];
    
    const alertProcess = spawn(alertdPath, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    alertProcess.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });
    
    alertProcess.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString();
    });
    
    alertProcess.on('close', (code) => {
      if (code === 0 && output) {
        resolve(output);
      } else {
        resolve(errorOutput || 'No alert data available');
      }
    });
    
    alertProcess.on('error', (err) => {
      resolve(`Error running alertd: ${err.message}`);
    });
  });
});

/**
 * Launch Prometheus metrics exporter and fetch metrics
 */
ipcMain.handle('get-prometheus-metrics', async () => {
  // DEMO MODE: Return fake Prometheus metrics
  if (DEMO_MODE && demoProcessRunning) {
    const elapsed = (Date.now() - demoStartTime) / 1000;
    const mockData = generateMockMonitoringData(demoTestType, demoTestProgram, elapsed);
    const elapsedStr = elapsed.toFixed(1);
    
    return `# HELP zencube_cpu_percent Current CPU usage percentage
# TYPE zencube_cpu_percent gauge
zencube_cpu_percent ${mockData.cpu.toFixed(1)}

# HELP zencube_memory_rss_bytes Resident memory in bytes
# TYPE zencube_memory_rss_bytes gauge
zencube_memory_rss_bytes ${mockData.memory}

# HELP zencube_threads Total number of threads
# TYPE zencube_threads gauge
zencube_threads ${mockData.threads}

# HELP zencube_open_files Number of open file descriptors
# TYPE zencube_open_files gauge
zencube_open_files ${mockData.open_files}

# HELP zencube_uptime_seconds Process uptime in seconds
# TYPE zencube_uptime_seconds counter
zencube_uptime_seconds ${elapsedStr}

# HELP zencube_demo_mode Demo mode indicator
# TYPE zencube_demo_mode gauge
zencube_demo_mode 1
`;
  }
  
  return new Promise<string>(async (resolve) => {
    // Stop any existing prometheus process
    if (prometheusProcess) {
      prometheusProcess.kill();
      prometheusProcess = null;
    }
    
    const promPath = path.join(app.getAppPath(), 'core_c', 'bin', 'prom_exporter');
    const samplesFile = path.join(app.getPath('temp'), 'zencube_samples_*.jsonl');
    
    prometheusProcess = spawn(promPath, ['--in', samplesFile], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });
    
    if (!prometheusProcess) {
      resolve('Error: Failed to start Prometheus exporter');
      return;
    }
    
    // Wait for the server to start
    await new Promise(r => setTimeout(r, 1500));
    
    // Fetch metrics from the HTTP endpoint
    try {
      const response = await fetch('http://localhost:9091/metrics');
      const metricsText = await response.text();
      
      // Kill the process immediately after getting metrics
      if (prometheusProcess) {
        prometheusProcess.kill();
        prometheusProcess = null;
      }
      
      resolve(metricsText);
    } catch (error) {
      // Kill the process on error
      if (prometheusProcess) {
        prometheusProcess.kill();
        prometheusProcess = null;
      }
      resolve(`Error fetching metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
});

/**
 * Get ML analyses from database
 */
ipcMain.handle('get-ml-analyses', async () => {
  // DEMO MODE: Return stored analyses from demo runs
  if (DEMO_MODE) {
    console.log(`[ML] Returning ${demoMLAnalyses.length} stored analyses`);
    return demoMLAnalyses.length > 0 ? demoMLAnalyses : [];
  }
  
  // Real mode with database
  if (DEMO_MODE && false) {
    const mockAnalyses = [
      {
        id: 1,
        timestamp: new Date(Date.now() - 300000).toISOString(),
        isAnomalous: false,
        anomalyScore: 0.23,
        anomalyType: null,
        explanation: 'Process exhibits normal behavior patterns. CPU usage remains stable at 15-25%, memory consumption is consistent with typical application startup, and no unusual system calls detected.',
        confidence: 0.88,
        recommendations: [],
        apiProvider: 'gemini',
        processingTimeMs: 987
      },
      {
        id: 2,
        timestamp: new Date(Date.now() - 120000).toISOString(),
        isAnomalous: true,
        anomalyScore: 0.76,
        anomalyType: 'memory_leak',
        explanation: 'Gradual memory consumption increase detected over 2 minutes. Memory grew from 128MB to 384MB without corresponding increase in processed data. This pattern suggests potential memory leak in allocation routines.',
        confidence: 0.81,
        recommendations: [
          'Inspect memory allocation patterns in source code',
          'Set memory limit to 512MB as safety measure',
          'Enable memory profiling for detailed leak detection'
        ],
        apiProvider: 'gemini',
        processingTimeMs: 1456
      },
      {
        id: 3,
        timestamp: new Date(Date.now() - 30000).toISOString(),
        isAnomalous: true,
        anomalyScore: 0.91,
        anomalyType: 'resource_exhaustion',
        explanation: 'Critical resource exhaustion pattern detected. CPU spiked to 98% and stayed elevated for 45 seconds while thread count increased from 1 to 47. Memory consumption accelerated to 12MB/second. This indicates potential fork bomb or recursive spawning attack.',
        confidence: 0.94,
        recommendations: [
          'IMMEDIATE: Set process limit to 5 to prevent fork bombs',
          'Reduce CPU time limit to 15 seconds',
          'Enable file jail to contain potential damage',
          'Implement rate limiting on process spawning',
          'Review source code for recursive execution patterns'
        ],
        apiProvider: 'gemini',
        processingTimeMs: 1823
      }
    ];
    
    // Return stored analyses if we have any, otherwise return mock data
    if (demoMLAnalyses.length > 0) {
      console.log(`[ML] Returning ${demoMLAnalyses.length} real demo analyses`);
      const anomalousCount = demoMLAnalyses.filter((a: any) => a.isAnomalous).length;
      const avgTime = Math.round(demoMLAnalyses.reduce((sum: number, a: any) => sum + (a.processingTimeMs || 0), 0) / demoMLAnalyses.length);
      
      return {
        analyses: demoMLAnalyses,
        stats: {
          totalAnalyses: demoMLAnalyses.length,
          anomalousCount,
          anomalyRate: parseFloat((anomalousCount / demoMLAnalyses.length).toFixed(2)),
          avgProcessingTime: avgTime
        }
      };
    }
    
    // Fallback to mock data if no analyses yet
    return {
      analyses: mockAnalyses,
      stats: {
        totalAnalyses: mockAnalyses.length,
        anomalousCount: 2,
        anomalyRate: 0.67,
        avgProcessingTime: 1422
      }
    };
  }
  
  if (!mlDatabase) {
    return {
      analyses: [],
      stats: {
        totalAnalyses: 0,
        anomalousCount: 0,
        anomalyRate: 0,
        avgProcessingTime: 0,
      },
    };
  }
  
  try {
    const analyses = mlDatabase.getRecentAnalyses(20);
    const stats = mlDatabase.getStats();
    
    return {
      analyses,
      stats,
    };
  } catch (error) {
    console.error('[ML] Failed to fetch analyses:', error);
    return {
      analyses: [],
      stats: {
        totalAnalyses: 0,
        anomalousCount: 0,
        anomalyRate: 0,
        avgProcessingTime: 0,
      },
    };
  }
});

/**
 * Trigger ML analysis on monitoring data batch
 * Called when we have accumulated enough samples to analyze
 */
async function triggerMLAnalysis(samples: Array<{ cpu_percent: number; memory_rss: number; timestamp: string; }>) {
  if (!geminiAnalyzer || !mlDatabase || !currentRunId) {
    return;
  }
  
  // Only analyze if we have at least 5 samples (avoid noise)
  if (samples.length < 5) {
    return;
  }
  
  try {
    const startTime = Date.now();
    
    // Convert samples to ProcessMetrics (add missing fields)
    const processMetrics = samples.map(s => ({
      timestamp: s.timestamp,
      cpu_percent: s.cpu_percent,
      memory_rss: s.memory_rss,
      threads: 1, // Default value (not tracked in batch)
      open_files: 0, // Default value (not tracked in batch)
    }));
    
      // WHITELIST DISABLED - Always perform ML analysis for demo/testing
      // Uncomment the block below to re-enable whitelist checking:
      /*
      try {
        const cfg = getAnomalyConfig();
        if (mlDatabase && currentRunId) {
          const run = mlDatabase.getMonitoringRun(currentRunId);
          if (run && run.command) {
            const basename = path.basename(run.command);
            if (Array.isArray(cfg.whitelist) && cfg.whitelist.includes(basename)) {
              console.log(`[ML] Skipping analysis for whitelisted command: ${basename}`);
              return;
            }
          }
        }
      } catch (err) {
        // Continue with analysis if config/read fails
      }
      */

      // Call Gemini analyzer
      const result = await geminiAnalyzer.analyzeMetrics(processMetrics);
    
    const processingTime = Date.now() - startTime;
    
    // Recommendations are already an array
    const recommendations = Array.isArray(result.recommendations) 
      ? result.recommendations 
      : [];
    
    // Store in database
    const analysisId = mlDatabase.insertMLAnalysis({
      run_id: currentRunId.toString(),
      timestamp: new Date().toISOString(),
      metrics_snapshot: JSON.stringify(samples),
      is_anomalous: result.isAnomalous,
      anomaly_score: result.anomalyScore,
      anomaly_type: result.anomalyType,
      explanation: result.explanation,
      confidence: result.confidence,
      recommendations: JSON.stringify(recommendations),
      api_provider: 'gemini',
      processing_time_ms: processingTime,
    });
    
    // Send to renderer for live updates
    if (mainWindow) {
      mainWindow.webContents.send('ml-analysis', {
        id: analysisId,
        timestamp: new Date().toISOString(),
        isAnomalous: result.isAnomalous,
        anomalyScore: result.anomalyScore,
        anomalyType: result.anomalyType,
        explanation: result.explanation,
        confidence: result.confidence,
        recommendations,
        apiProvider: 'gemini',
        processingTimeMs: processingTime,
      });
    }
    
    console.log(`[ML] Analysis complete: ${result.isAnomalous ? 'ANOMALOUS' : 'NORMAL'} (score: ${result.anomalyScore.toFixed(2)}, ${processingTime}ms)`);
  } catch (error) {
    console.error('[ML] Analysis failed:', error);
  }
}

/**
 * Open file dialog for executable selection
 */
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    title: 'Select Executable',
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'Executables', extensions: ['sh', 'py', 'js', 'bin'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  
  return null;
});

/**
 * Open directory dialog for jail path selection
 */
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Jail Directory',
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  
  return null;
});

/**
 * App lifecycle
 */
app.on('ready', () => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Cleanup on quit
app.on('before-quit', () => {
  if (sandboxProcess) {
    sandboxProcess.kill();
  }
  
  if (samplerProcess) {
    samplerProcess.kill();
  }
  
  if (prometheusProcess) {
    prometheusProcess.kill();
  }
  
  stopFileJailMonitor();
  stopSamplerMonitoring();
});
