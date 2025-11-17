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

let mainWindow: BrowserWindow | null = null;
let sandboxProcess: ChildProcessWithoutNullStreams | null = null;
let samplerProcess: ChildProcess | null = null;
let prometheusProcess: ChildProcess | null = null;
let fileJailMonitor: NodeJS.Timeout | null = null;
let monitoringWorker: Worker | null = null; // Worker thread for monitoring

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
  
  const args = [
    '--pid', pid.toString(),
    '--interval', '1.0',
    '--run-id', `zencube_${Date.now()}`,
    '--out', outputPath
  ];
  
  console.log(`[Sampler] Spawning with args:`, args);
  
  samplerProcess = spawn(samplerPath, args, {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
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
