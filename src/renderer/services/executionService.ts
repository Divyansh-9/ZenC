/**
 * Execution Manager Service
 * 
 * Purpose: Single source-of-truth for active process state across UI navigation
 * Constraint: Tracks state only - does NOT spawn/manage actual OS processes
 * Storage: sessionStorage (survives navigation but not browser close)
 */

const STORAGE_KEY = 'zencube_execution_state';
const HEARTBEAT_THRESHOLD = 60000; // 60 seconds

export interface ProcessInfo {
  id: string;
  executable?: string;
  args?: string[];
  startTime: number;
  status: 'running' | 'stopped' | 'error';
  pid?: number;
  token?: string;
  lastHeartbeat: number;
  metadata?: Record<string, any>;
}

type EventCallback = (processInfo: ProcessInfo) => void;

class ExecutionService {
  private processes: Map<string, ProcessInfo> = new Map();
  private listeners: Map<string, Set<EventCallback>> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load state from sessionStorage on initialization
   * Marks processes as running only if lastHeartbeat is recent
   */
  private loadFromStorage(): void {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const data = JSON.parse(stored);
      const now = Date.now();

      Object.entries(data.processes || {}).forEach(([id, info]: [string, any]) => {
        // Rehydrate only if heartbeat is recent
        const timeSinceHeartbeat = now - (info.lastHeartbeat || 0);
        
        if (timeSinceHeartbeat > HEARTBEAT_THRESHOLD) {
          // Mark as stopped if stale
          info.status = 'stopped';
        }

        this.processes.set(id, info as ProcessInfo);
      });
    } catch (err) {
      console.warn('[ExecutionService] Failed to load from storage:', err);
    }
  }

  /**
   * Persist current state to sessionStorage
   */
  private saveToStorage(): void {
    try {
      const data = {
        processes: Object.fromEntries(this.processes.entries()),
        lastUpdate: Date.now()
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('[ExecutionService] Failed to save to storage:', err);
    }
  }

  /**
   * Register a new process (does NOT spawn - just tracks)
   */
  startProcess(info: Omit<ProcessInfo, 'startTime' | 'lastHeartbeat' | 'status'>): string {
    const id = info.id || `proc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const processInfo: ProcessInfo = {
      ...info,
      id,
      startTime: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'running'
    };

    this.processes.set(id, processInfo);
    this.saveToStorage();
    this.emit('start', processInfo);
    this.emit('update', processInfo);

    return id;
  }

  /**
   * Update process heartbeat and metadata
   */
  updateProcess(id: string, updates: Partial<ProcessInfo>): void {
    const process = this.processes.get(id);
    if (!process) return;

    Object.assign(process, updates, {
      lastHeartbeat: Date.now()
    });

    this.saveToStorage();
    this.emit('update', process);
  }

  /**
   * Mark process as stopped (does NOT kill - just updates state)
   */
  stopProcess(id: string, reason?: string): void {
    const process = this.processes.get(id);
    if (!process) return;

    process.status = 'stopped';
    process.lastHeartbeat = Date.now();
    
    if (reason) {
      process.metadata = { ...process.metadata, stopReason: reason };
    }

    this.saveToStorage();
    this.emit('stop', process);
    this.emit('update', process);
  }

  /**
   * Mark process as error
   */
  errorProcess(id: string, error: string): void {
    const process = this.processes.get(id);
    if (!process) return;

    process.status = 'error';
    process.lastHeartbeat = Date.now();
    process.metadata = { ...process.metadata, error };

    this.saveToStorage();
    this.emit('error', process);
    this.emit('update', process);
  }

  /**
   * Get single process by ID
   */
  getProcess(id: string): ProcessInfo | undefined {
    return this.processes.get(id);
  }

  /**
   * Get all processes
   */
  getAllProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values());
  }

  /**
   * Get all running processes
   */
  getRunningProcesses(): ProcessInfo[] {
    return this.getAllProcesses().filter(p => p.status === 'running');
  }

  /**
   * Check if any process is running
   */
  hasRunningProcess(): boolean {
    return this.getRunningProcesses().length > 0;
  }

  /**
   * Clear all processes (useful for reset/cleanup)
   */
  clearAll(): void {
    const processes = Array.from(this.processes.values());
    
    processes.forEach(process => {
      if (process.status === 'running') {
        this.emit('stop', process);
      }
    });

    this.processes.clear();
    sessionStorage.removeItem(STORAGE_KEY);
    this.emit('clear', {} as ProcessInfo);
  }

  /**
   * Remove process from tracking
   */
  removeProcess(id: string): void {
    const process = this.processes.get(id);
    if (process && process.status === 'running') {
      this.stopProcess(id, 'removed');
    }
    
    this.processes.delete(id);
    this.saveToStorage();
  }

  /**
   * Subscribe to events
   */
  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Unsubscribe from events
   */
  off(event: string, callback: EventCallback): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: string, processInfo: ProcessInfo): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(processInfo);
        } catch (err) {
          console.error(`[ExecutionService] Error in ${event} listener:`, err);
        }
      });
    }
  }

  /**
   * Send heartbeat to keep process alive
   */
  heartbeat(id: string): void {
    const process = this.processes.get(id);
    if (process && process.status === 'running') {
      process.lastHeartbeat = Date.now();
      this.saveToStorage();
    }
  }
}

// Export singleton instance
export const executionService = new ExecutionService();
