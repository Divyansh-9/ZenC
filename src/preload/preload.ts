import { contextBridge, ipcRenderer } from 'electron';

/**
 * Sandbox API exposed to the renderer process
 */
export interface SandboxAPI {
  executeSandbox: (options: {
    command: string;
    args: string[];
    cpuLimit?: number;
    memLimit?: number;
    procLimit?: number;
    fileSizeLimit?: number;
    isJailEnabled?: boolean;
    jailPath?: string;
    isNetworkDisabled?: boolean;
  }) => Promise<{ success: boolean; message: string }>;
  
  stopSandbox: () => Promise<{ success: boolean; message: string }>;
  
  getSystemInfo: () => Promise<{
    platform: string;
    isWindows: boolean;
    sandboxPath: string;
  }>;
  
  getAlerts: () => Promise<string>;
  
  getPrometheusMetrics: () => Promise<string>;
  
  openFileDialog: () => Promise<string | null>;
  
  openDirectoryDialog: () => Promise<string | null>;
  
  getMLAnalyses: () => Promise<{
    analyses: Array<{
      id: number;
      timestamp: string;
      isAnomalous: boolean;
      anomalyScore: number;
      anomalyType: string | null;
      explanation: string;
      confidence: number;
      recommendations: string[];
      apiProvider: string;
      processingTimeMs: number;
    }>;
    stats: {
      totalAnalyses: number;
      anomalousCount: number;
      anomalyRate: number;
      avgProcessingTime: number;
    };
  }>;
  
  onOutput: (callback: (data: { type: 'stdout' | 'stderr'; data: string }) => void) => void;
  
  onExit: (callback: (data: { 
    code: number | null; 
    signal: string | null;
    finalStdout?: string;
    finalStderr?: string;
  }) => void) => void;
  
  onError: (callback: (data: { message: string }) => void) => void;
  
  onFileJailViolation: (callback: (data: { path: string }) => void) => void;
  
  onMonitoringData: (callback: (data: { cpu: number; memory: number }) => void) => void;
  
  onMonitoringDataBatch: (callback: (data: Array<{ cpu: number; memory: number; timestamp: number }>) => void) => void;
  
  onMLAnalysis?: (callback: (data: {
    id: number;
    timestamp: string;
    isAnomalous: boolean;
    anomalyScore: number;
    anomalyType: string | null;
    explanation: string;
    confidence: number;
    recommendations: string[];
    apiProvider: string;
    processingTimeMs: number;
  }) => void) => (() => void) | void;
}

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('sandboxAPI', {
  executeSandbox: (options: {
    command: string;
    args: string[];
    cpuLimit?: number;
    memLimit?: number;
    procLimit?: number;
    fileSizeLimit?: number;
    isJailEnabled?: boolean;
    jailPath?: string;
    isNetworkDisabled?: boolean;
  }) => ipcRenderer.invoke('execute-sandbox', options),
  
  stopSandbox: () => ipcRenderer.invoke('stop-sandbox'),
  
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  
  getAlerts: () => ipcRenderer.invoke('get-alerts'),
  
  getPrometheusMetrics: () => ipcRenderer.invoke('get-prometheus-metrics'),
  
  getMLAnalyses: () => ipcRenderer.invoke('get-ml-analyses'),
  
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
  
  onOutput: (callback: (data: { type: 'stdout' | 'stderr'; data: string }) => void) => {
    ipcRenderer.on('sandbox-output', (_event, data) => callback(data));
  },
  
  onExit: (callback: (data: { 
    code: number | null; 
    signal: string | null;
    finalStdout?: string;
    finalStderr?: string;
  }) => void) => {
    ipcRenderer.on('sandbox-exit', (_event, data) => callback(data));
  },
  
  onError: (callback: (data: { message: string }) => void) => {
    ipcRenderer.on('sandbox-error', (_event, data) => callback(data));
  },
  
  onFileJailViolation: (callback: (data: { path: string }) => void) => {
    ipcRenderer.on('file-jail-violation', (_event, data) => callback(data));
  },
  
  onMonitoringData: (callback: (data: { cpu: number; memory: number }) => void) => {
    ipcRenderer.on('monitoring-data', (_event, data) => callback(data));
  },
  
  onMonitoringDataBatch: (callback: (data: Array<{ cpu: number; memory: number; timestamp: number }>) => void) => {
    ipcRenderer.on('monitoring-data-batch', (_event, data) => callback(data));
  },
  
  onMLAnalysis: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on('ml-analysis', listener);
    return () => ipcRenderer.removeListener('ml-analysis', listener);
  },
} as SandboxAPI);
