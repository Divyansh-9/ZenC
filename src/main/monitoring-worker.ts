/**
 * Monitoring Worker Thread
 * 
 * This worker runs in a separate Node.js thread to offload all file I/O,
 * JSON parsing, and data batching from the main Electron thread.
 * This prevents blocking the UI during heavy monitoring operations.
 */

import { parentPort } from 'worker_threads';
import * as fs from 'fs';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

interface WorkerMessage {
  type: 'start' | 'stop';
  pid?: number;
  path?: string;
}

interface MonitoringDataPoint {
  cpu: number;
  memory: number;
  timestamp: number;
}

let dataBuffer: MonitoringDataPoint[] = [];
let senderInterval: NodeJS.Timeout | null = null;
let fileWatcher: fs.FSWatcher | null = null;
let lastSize = 0;

parentPort?.on('message', (msg: WorkerMessage) => {
  if (msg.type === 'start' && msg.pid && msg.path) {
    console.log(`[MonitoringWorker] Starting monitoring for PID ${msg.pid}, file: ${msg.path}`);
    
    // Batched sender - sends accumulated data once per second
    senderInterval = setInterval(() => {
      if (dataBuffer.length > 0) {
        parentPort?.postMessage({ 
          type: 'data-batch', 
          data: [...dataBuffer] // Send copy
        });
        dataBuffer = []; // Clear buffer
      }
    }, 1000); // Send every 1 second (max 1 IPC message/sec)

    // Wait for file to exist
    const waitForFile = (retries = 10) => {
      if (fs.existsSync(msg.path!)) {
        console.log(`[MonitoringWorker] File found, starting watcher`);
        
        // Watch file for changes
        fileWatcher = fs.watch(msg.path!, (eventType) => {
          if (eventType === 'change') {
            fs.stat(msg.path!, (err, stats) => {
              if (err || stats.size <= lastSize) return;
              
              console.log(`[MonitoringWorker] Reading new data from ${lastSize} to ${stats.size}`);
              
              // Read new lines
              const stream = createReadStream(msg.path!, {
                start: lastSize,
                end: stats.size
              });
              
              lastSize = stats.size;
              
              const rl = createInterface({
                input: stream,
                crlfDelay: Infinity
              });
              
              rl.on('line', (line) => {
                try {
                  const sample = JSON.parse(line);
                  
                  if (sample.event === 'sample') {
                    // Add to buffer (will be sent in next batch)
                    dataBuffer.push({
                      cpu: sample.cpu_percent || 0,
                      memory: (sample.memory_rss || 0) / 1024 / 1024, // Convert to MB
                      timestamp: Date.now()
                    });
                  }
                } catch (err) {
                  // Ignore invalid JSON
                }
              });
            });
          }
        });
      } else if (retries > 0) {
        setTimeout(() => waitForFile(retries - 1), 200);
      } else {
        console.error(`[MonitoringWorker] File never appeared: ${msg.path}`);
      }
    };
    
    setTimeout(() => waitForFile(), 500);
  } 
  else if (msg.type === 'stop') {
    console.log('[MonitoringWorker] Stopping monitoring');
    
    // Clean up
    if (senderInterval) {
      clearInterval(senderInterval);
      senderInterval = null;
    }
    
    if (fileWatcher) {
      fileWatcher.close();
      fileWatcher = null;
    }
    
    // Send any remaining data
    if (dataBuffer.length > 0) {
      parentPort?.postMessage({ 
        type: 'data-batch', 
        data: dataBuffer 
      });
      dataBuffer = [];
    }
    
    // Signal we're done
    parentPort?.postMessage({ type: 'stopped' });
  }
});
