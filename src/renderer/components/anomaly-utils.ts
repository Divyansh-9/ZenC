import { Line } from '../services/terminalSession';

/**
 * Anomaly Detection Utilities (UI-Only Simulation)
 * 
 * Purpose: Process start detection and simulated anomaly generation
 * Constraint: Read-only detection, no global state mutation, no backend changes
 */

// Executable whitelists for anomaly vs normal behavior
const ML_ANOMALY_EXECUTABLES = [
  'cpu_spike_attack',
  'fork_bomb_gradual',
  'io_storm_writer',
  'memory_leak_progressive',
  'memory_leak', // Alias
  'ml_test_pattern',
  'resource_exhaustion_combo'
];

const UI_TEST_EXECUTABLES = [
  'file_writer',
  'fork_bomb',
  'infinite_loop',
  'memory_hog',
  'network_test'
];

export type GenerationMode = 'anomaly' | 'normal' | 'default';

interface Anomaly {
  id: string;
  type: string;
  title: string;
  description: string;
  score: number; // 0-100
  confidence: number; // 0-100
  recommendations: string[];
  timestamp: string;
  detector: string;
}

interface Analysis {
  id: string;
  timestamp: string;
  anomalies: Anomaly[];
  score: number; // Average of anomaly scores
  detector: string;
  latencyMs: number; // Simulated response time
}

/**
 * Determine generation mode based on executable path
 * @param executablePath Full path or basename of executable
 * @returns 'anomaly' for ml_anomaly_tests, 'normal' for ui_test_programs, 'default' otherwise
 */
export function chooseGenerationMode(executablePath: string): GenerationMode {
  if (!executablePath) return 'default';
  
  // Extract basename from path
  const basename = executablePath.split('/').pop()?.split('\\').pop() || '';
  
  // Check if path contains anomaly folders OR basename matches ml list
  if (executablePath.includes('/ml_anomaly_tests/') || 
      executablePath.includes('\\ml_anomaly_tests\\') ||
      executablePath.includes('/ai_anomaly_test/') || 
      executablePath.includes('\\ai_anomaly_test\\') ||
      ML_ANOMALY_EXECUTABLES.includes(basename)) {
    return 'anomaly';
  }
  
  // Check if path contains normal folders OR basename matches ui list
  if (executablePath.includes('/ui_test_programs/') || 
      executablePath.includes('\\ui_test_programs\\') ||
      executablePath.includes('/ui_implementation_test/') || 
      executablePath.includes('\\ui_implementation_test\\') ||
      UI_TEST_EXECUTABLES.includes(basename)) {
    return 'normal';
  }
  
  return 'default';
}

// Seeded random number generator for reproducible variety
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  choice<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }
}

/**
 * Detect process start/stop events using priority-based fallback detection
 * Priority: A) Global state → B) DOM observation → C) Metrics polling
 * 
 * IMPORTANT: Only fires on TRUE TRANSITIONS (not-running → running).
 * Initial mount reads state but does NOT emit onStart until a change occurs.
 * 
 * @param onStart Called with startTimestamp when a new distinct process starts
 * @param onStop Called when process stops (optional)
 * @returns Cleanup function to release resources
 */
export function detectProcessStart(
  onStart: (startTimestamp: number) => void, 
  onStop?: () => void
): () => void {
  let lastState: boolean | null = null; // null = uninitialized
  let cleanupFns: (() => void)[] = [];

  // Method A: Global state detection (read-only)
  const tryGlobalDetection = (): boolean | null => {
    if (typeof window === 'undefined') return null;
    
    const w = window as any;
    
    // Check common global state locations (read-only)
    if (w.__EXECUTING__ !== undefined) return !!w.__EXECUTING__;
    if (w.executionState?.executing !== undefined) return !!w.executionState.executing;
    if (w.appState?.executing !== undefined) return !!w.appState.executing;
    if (w.execution?.isRunning !== undefined) return !!w.execution.isRunning;
    
    return null; // Not available
  };

  // Method B: DOM observation (read-only, no mutation)
  const setupDOMDetection = (): boolean => {
    if (typeof document === 'undefined') return false;

    // Look for status indicators
    const statusEl = 
      document.querySelector('.status-bar') ||
      document.querySelector('#execution-status') ||
      Array.from(document.querySelectorAll('*')).find(el => 
        el.textContent?.includes('EXECUTING') || 
        el.textContent?.includes('Running')
      );

    if (!statusEl) return false;

    const checkState = () => {
      const text = (statusEl.textContent || '').toLowerCase();
      const attrs = Array.from(statusEl.attributes).map(a => a.value.toLowerCase()).join(' ');
      
      const isRunning = 
        text.includes('executing') || 
        text.includes('running') ||
        attrs.includes('running') ||
        attrs.includes('executing');
      
      // Only emit on transitions, not initial state
      if (lastState !== null) {
        if (isRunning && !lastState) {
          // Start detected (transition: false → true)
          onStart(Date.now());
        } else if (!isRunning && lastState && onStop) {
          // Stop detected (transition: true → false)
          onStop();
        }
      }
      
      lastState = isRunning;
    };

    // Initial check (sets lastState, does NOT emit)
    checkState();

    // Observe changes (read-only, no DOM mutation)
    const observer = new MutationObserver(checkState);
    observer.observe(statusEl, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    cleanupFns.push(() => observer.disconnect());
    return true;
  };

  // Method C: Metrics polling fallback (read-only HTTP GET)
  const setupMetricsPolling = () => {
    let lastSeenData = '';

    const checkMetrics = async () => {
      try {
        // Try /metrics first, fallback to /api/metrics
        const response = await fetch('/metrics').catch(() => fetch('/api/metrics'));
        
        if (response.ok) {
          const text = await response.text();
          
          // Check for Prometheus metrics or numeric data or JSON array
          const hasMetrics = 
            text.includes('process_cpu_seconds_total') ||
            /zencube_\w+/.test(text) ||
            /\d+\.\d+/.test(text) ||
            (text.startsWith('[') && text.includes('datapoints'));

          const isRunning = hasMetrics && text !== lastSeenData;
          
          // Only emit on transitions, not initial state
          if (lastState !== null) {
            if (isRunning && !lastState) {
              // New start detected (transition: false → true)
              onStart(Date.now());
              lastSeenData = text;
            } else if (!isRunning && lastState && onStop) {
              // Stop detected (transition: true → false)
              onStop();
            }
          } else {
            // Initial state: just set lastSeenData, don't emit
            if (isRunning) {
              lastSeenData = text;
            }
          }
          
          lastState = isRunning;
        }
      } catch {
        // Silently fail - endpoint may not exist
      }
    };

    // Poll every 2 seconds
    const interval = setInterval(checkMetrics, 2000);
    checkMetrics(); // Initial check (sets lastState, doesn't emit)

    cleanupFns.push(() => clearInterval(interval));
  };

  // Try detection methods in priority order
  const globalState = tryGlobalDetection();
  
  if (globalState !== null) {
    // Method A: Monitor global state
    // Set initial state without emitting
    lastState = globalState;
    
    const interval = setInterval(() => {
      const currentState = tryGlobalDetection();
      
      // Only emit on transitions
      if (currentState && !lastState) {
        onStart(Date.now());
      } else if (!currentState && lastState && onStop) {
        onStop();
      }
      lastState = !!currentState;
    }, 500);
    
    cleanupFns.push(() => clearInterval(interval));
  } else if (!setupDOMDetection()) {
    // Method B failed, use Method C
    setupMetricsPolling();
  }

  // Return cleanup function
  return () => {
    cleanupFns.forEach(fn => fn());
  };
}

/**
 * Generate a simulated analysis with mode-specific behavior
 * Uses seeded randomness for reproducible variety between runs
 * 
 * @param startTimestamp Used as seed for generation
 * @param mode 'anomaly' for anomalous behavior, 'normal' for benign telemetry, 'default' for mixed
 * @returns Complete analysis object with anomalies array
 */
export function generateSimulatedAnalysis(startTimestamp: number, mode: GenerationMode = 'default'): Analysis {
  const rng = new SeededRandom(startTimestamp);
  
  // Generate realistic latency (500-2000ms)
  const latencyMs = Math.floor(rng.range(500, 2000));
  
  if (mode === 'normal') {
    // Normal mode: benign telemetry only, no anomalies
    return {
      id: `analysis-${startTimestamp}-${Math.floor(rng.range(1000, 9999))}`,
      timestamp: new Date(startTimestamp).toISOString(),
      anomalies: [], // No anomalies for normal mode
      score: Math.floor(rng.range(0, 25)), // Low score (0-25)
      detector: 'simulated-generator',
      latencyMs
    };
  }
  
  // Anomaly or default mode: generate 1-3 anomalies
  const anomalyCount = Math.floor(rng.range(1, 4)); // 1, 2, or 3
  const anomalies: Anomaly[] = [];
  
  const anomalyTypes = mode === 'anomaly' 
    ? ['cpu_spike', 'memory_leak', 'resource_exhaustion', 'io_stall', 'network_spike'] // Only anomalous types
    : ['cpu_spike', 'memory_leak', 'resource_exhaustion', 'io_stall', 'network_spike', 'normal_behavior']; // Mixed
  
  for (let i = 0; i < anomalyCount; i++) {
    const type = rng.choice(anomalyTypes);
    anomalies.push(generateAnomaly(type, startTimestamp, i, rng));
  }
  
  // Calculate average score
  const avgScore = anomalies.reduce((sum, a) => sum + a.score, 0) / anomalies.length;
  
  return {
    id: `analysis-${startTimestamp}-${Math.floor(rng.range(1000, 9999))}`,
    timestamp: new Date(startTimestamp).toISOString(),
    anomalies,
    score: Math.round(avgScore),
    detector: 'simulated-generator',
    latencyMs
  };
}

// Anomaly generation templates
function generateAnomaly(type: string, timestamp: number, index: number, rng: SeededRandom): Anomaly {
  const id = `anom-${timestamp}-${index}-${Math.floor(rng.range(1000, 9999))}`;
  const ts = new Date(timestamp + index * 1000).toISOString();
  
  switch (type) {
    case 'cpu_spike':
      const cpuFrom = Math.floor(rng.range(5, 25));
      const cpuTo = Math.floor(rng.range(85, 99));
      const cpuDuration = Math.floor(rng.range(15, 180));
      return {
        id,
        type: 'cpu_spike',
        title: 'CPU Spike Detected',
        description: `CPU usage spiked from ${cpuFrom}% to ${cpuTo}% over ${cpuDuration} seconds, indicating possible runaway computation or inefficient loop.`,
        score: Math.floor(rng.range(65, 95)),
        confidence: Math.floor(rng.range(75, 95)),
        recommendations: [
          'Profile CPU hotspots with a profiler',
          'Check for infinite loops or recursive calls',
          'Consider implementing rate limiting',
          'Review algorithm complexity'
        ].slice(0, Math.floor(rng.range(2, 5))),
        timestamp: ts,
        detector: 'simulated-generator'
      };
      
    case 'memory_leak':
      const memFrom = Math.floor(rng.range(48, 120));
      const memTo = Math.floor(rng.range(250, 480));
      const memDuration = Math.floor(rng.range(60, 300));
      return {
        id,
        type: 'memory_leak',
        title: 'Potential Memory Leak',
        description: `Memory grew from ${memFrom}MB to ${memTo}MB in ${memDuration}s without corresponding deallocation, suggesting a memory leak pattern.`,
        score: Math.floor(rng.range(60, 95)),
        confidence: Math.floor(rng.range(70, 95)),
        recommendations: [
          'Use memory profiler to identify leak source',
          'Check for unreleased references or closures',
          'Review object lifecycle management',
          'Implement periodic garbage collection'
        ].slice(0, Math.floor(rng.range(2, 5))),
        timestamp: ts,
        detector: 'simulated-generator'
      };
      
    case 'resource_exhaustion':
      const threads = Math.floor(rng.range(45, 128));
      const handles = Math.floor(rng.range(512, 2048));
      return {
        id,
        type: 'resource_exhaustion',
        title: 'Resource Exhaustion Risk',
        description: `Process spawned ${threads} threads and opened ${handles} file handles, approaching system limits and risking resource exhaustion.`,
        score: Math.floor(rng.range(70, 98)),
        confidence: Math.floor(rng.range(80, 98)),
        recommendations: [
          'Implement resource pooling',
          'Add connection/thread limits',
          'Review resource cleanup code',
          'Monitor resource usage proactively'
        ].slice(0, Math.floor(rng.range(3, 5))),
        timestamp: ts,
        detector: 'simulated-generator'
      };
      
    case 'io_stall':
      const ioWait = Math.floor(rng.range(450, 1800));
      const ops = Math.floor(rng.range(1200, 8000));
      return {
        id,
        type: 'io_stall',
        title: 'I/O Performance Stall',
        description: `I/O operations stalled with ${ioWait}ms average latency across ${ops} operations, indicating disk bottleneck or network congestion.`,
        score: Math.floor(rng.range(55, 85)),
        confidence: Math.floor(rng.range(65, 90)),
        recommendations: [
          'Check disk I/O with iostat',
          'Implement async I/O where possible',
          'Review file access patterns',
          'Consider caching strategy'
        ].slice(0, Math.floor(rng.range(2, 4))),
        timestamp: ts,
        detector: 'simulated-generator'
      };
      
    case 'network_spike':
      const bandwidth = Math.floor(rng.range(45, 250));
      const connections = Math.floor(rng.range(128, 512));
      return {
        id,
        type: 'network_spike',
        title: 'Network Activity Spike',
        description: `Network traffic spiked to ${bandwidth}MB/s across ${connections} concurrent connections, potentially indicating data exfiltration or DDoS behavior.`,
        score: Math.floor(rng.range(60, 90)),
        confidence: Math.floor(rng.range(70, 92)),
        recommendations: [
          'Review network activity logs',
          'Check for unauthorized connections',
          'Implement rate limiting',
          'Monitor outbound traffic patterns'
        ].slice(0, Math.floor(rng.range(2, 4))),
        timestamp: ts,
        detector: 'simulated-generator'
      };
      
    case 'normal_behavior':
    default:
      return {
        id,
        type: 'normal_behavior',
        title: 'Normal Behavior Pattern',
        description: `Process exhibited normal resource usage patterns with CPU at ${Math.floor(rng.range(2, 15))}% and memory stable at ${Math.floor(rng.range(32, 96))}MB over the monitoring period.`,
        score: Math.floor(rng.range(0, 25)),
        confidence: Math.floor(rng.range(60, 85)),
        recommendations: [
          'Continue monitoring for pattern changes',
          'No immediate action required'
        ],
        timestamp: ts,
        detector: 'simulated-generator'
      };
  }
}

/**
 * Generate simulated terminal output lines based on mode
 * @param seedMs Timestamp seed
 * @param mode Generation mode ('anomaly' | 'normal' | 'default')
 * @param execPath Executable path
 * @returns Array of terminal output Lines
 */
export function generateTerminalLines(seedMs: number, mode: GenerationMode, execPath: string): Line[] {
  const lines: Line[] = [];
  const rng = new SeededRandom(seedMs);
  const baseId = `line-${seedMs}`;
  
  if (mode === 'normal') {
    // Normal mode: benign telemetry only with LOW CPU
    // Typical: 5-25% (most of the time), occasional spike: 30-50%
    const cpu = Math.random() < 0.7 
      ? Math.floor(rng.range(5, 25))    // 70% of time: 5-25%
      : Math.floor(rng.range(30, 50));   // 30% of time: 30-50%
    const mem = Math.floor(rng.range(32, 96));
    const io = Math.floor(rng.range(5, 25));
    
    lines.push({ id: `${baseId}-1`, ts: seedMs, text: `\x1b[36m[INFO]\x1b[0m Process running normally`, stream: 'stdout' });
    lines.push({ id: `${baseId}-2`, ts: seedMs + 10, text: `\x1b[36m[TELEMETRY]\x1b[0m CPU: ${cpu}%, Memory: ${mem}MB, I/O: ${io}MB/s`, stream: 'stdout' });
    lines.push({ id: `${baseId}-3`, ts: seedMs + 20, text: `\x1b[36m[TELEMETRY]\x1b[0m Process stable, no anomalies detected`, stream: 'stdout' });
    lines.push({ id: `${baseId}-4`, ts: seedMs + 30, text: `\x1b[32m[STATUS]\x1b[0m All metrics within normal thresholds`, stream: 'stdout' });
    
    return lines;
  }
  
  // Anomaly or default mode: show alerts and AI analysis
  lines.push({ id: `${baseId}-1`, ts: seedMs, text: `\x1b[36m[TELEMETRY]\x1b[0m Process monitoring active`, stream: 'stdout' });
  
  // Generate analysis to get anomalies
  const analysis = generateSimulatedAnalysis(seedMs, mode);

  // Add anomaly alerts if present
  if (analysis.anomalies.length > 0) {
    let idx = 2;
    analysis.anomalies.forEach(anomaly => {
      if (anomaly.score > 50) {
        lines.push({ id: `${baseId}-${idx++}`, ts: seedMs + idx * 10, text: `\x1b[31m[ALERT]\x1b[0m ${anomaly.title} (Score: ${anomaly.score})`, stream: 'stderr' });
        lines.push({ id: `${baseId}-${idx++}`, ts: seedMs + idx * 10, text: `\x1b[33m[WARN]\x1b[0m ${anomaly.description.substring(0, 80)}...`, stream: 'stderr' });
      }
    });
    
    // AI Analysis summary
    const avgScore = (analysis.score / 100).toFixed(2);
    lines.push({ id: `${baseId}-${idx++}`, ts: seedMs + idx * 10, text: `\x1b[35m[AI Analysis]\x1b[0m Anomalous behavior detected (score: ${avgScore})`, stream: 'stdout' });
    lines.push({ id: `${baseId}-${idx++}`, ts: seedMs + idx * 10, text: `\x1b[35m[AI Analysis]\x1b[0m ${analysis.anomalies.length} anomal${analysis.anomalies.length === 1 ? 'y' : 'ies'} identified - review recommended`, stream: 'stdout' });
  }
  
  return lines;
}

/**
 * Generate simulated terminal output lines based on mode
 * @param mode Generation mode ('anomaly' | 'normal' | 'default')
 * @param analysis The generated analysis object
 * @returns Array of terminal output strings with ANSI color codes
 */
export function generateTerminalOutput(mode: GenerationMode, analysis: Analysis): string[] {
  const lines: string[] = [];
  const rng = new SeededRandom(Date.now());
  
  if (mode === 'normal') {
    // Normal mode: benign telemetry only with LOW CPU
    // Typical: 5-25% (most of the time), occasional spike: 30-50%
    const cpu = Math.random() < 0.7 
      ? Math.floor(rng.range(5, 25))    // 70% of time: 5-25%
      : Math.floor(rng.range(30, 50));   // 30% of time: 30-50%
    const mem = Math.floor(rng.range(32, 96));
    const io = Math.floor(rng.range(5, 25));
    
    lines.push(`\x1b[36m[INFO]\x1b[0m Process running normally`);
    lines.push(`\x1b[36m[TELEMETRY]\x1b[0m CPU: ${cpu}%, Memory: ${mem}MB, I/O: ${io}MB/s`);
    lines.push(`\x1b[36m[TELEMETRY]\x1b[0m Process stable, no anomalies detected`);
    lines.push(`\x1b[32m[STATUS]\x1b[0m All metrics within normal thresholds`);
    
    return lines;
  }
  
  // Anomaly or default mode: show alerts and AI analysis
  lines.push(`\x1b[36m[TELEMETRY]\x1b[0m Process monitoring active`);
  
  // Add anomaly alerts if present
  if (analysis.anomalies.length > 0) {
    analysis.anomalies.forEach(anomaly => {
      if (anomaly.score > 50) {
        lines.push(`\x1b[31m[ALERT]\x1b[0m ${anomaly.title} (Score: ${anomaly.score})`);
        lines.push(`\x1b[33m[WARN]\x1b[0m ${anomaly.description.substring(0, 80)}...`);
      }
    });
    
    // AI Analysis summary
    const avgScore = (analysis.score / 100).toFixed(2);
    lines.push(`\x1b[35m[AI Analysis]\x1b[0m Anomalous behavior detected (score: ${avgScore})`);
    lines.push(`\x1b[35m[AI Analysis]\x1b[0m ${analysis.anomalies.length} anomal${analysis.anomalies.length === 1 ? 'y' : 'ies'} identified - review recommended`);
  }
  
  return lines;
}
