import { ProcessMetrics, AnomalyAnalysis } from './anomaly-types';
import { AnomalyConfig, getAnomalyConfig } from './anomaly-config';

export interface FeatureSnapshot {
  sampleCount: number;
  startTimestamp: string;
  endTimestamp: string;
  durationMs: number;
  sampleRateHz: number;
  cpuAverage: number;
  cpuMax: number;
  memoryAverageMb: number;
  memoryMaxMb: number;
  memoryTrendMbPerSample: number;
  threadsAverage: number;
  threadsMax: number;
  threadsTrend: number;
  openFilesMax: number;
  ioBytesPerSecond: number;
}

const bytesToMb = (value?: number) => (value ?? 0) / (1024 * 1024);

const calculateTrend = (values: number[]): number => {
  if (values.length < 2) return 0;
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((sum, v) => sum + v, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += (i - xMean) ** 2;
  }
  return denominator === 0 ? 0 : numerator / denominator;
};

const average = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0);

export const buildFeatureSnapshot = (metrics: ProcessMetrics[]): FeatureSnapshot => {
  const safeMetrics = metrics.length ? metrics : [{
    timestamp: new Date().toISOString(),
    cpu_percent: 0,
    memory_rss: 0,
    threads: 0,
    open_files: 0,
  }];

  const startTimestamp = safeMetrics[0].timestamp;
  const endTimestamp = safeMetrics[safeMetrics.length - 1].timestamp;
  const startMs = new Date(startTimestamp).getTime();
  const endMs = new Date(endTimestamp).getTime();
  const durationMs = Math.max(endMs - startMs, 1);

  const cpuValues = safeMetrics.map(m => m.cpu_percent ?? 0);
  const memoryValuesMb = safeMetrics.map(m => bytesToMb(m.memory_rss));
  const threadValues = safeMetrics.map(m => m.threads ?? 0);
  const openFilesValues = safeMetrics.map(m => m.open_files ?? 0);
  const ioValues = safeMetrics.map(m => (m.read_bytes ?? 0) + (m.write_bytes ?? 0));
  const ioDelta = ioValues[ioValues.length - 1] - ioValues[0];
  const ioBytesPerSecond = ioDelta / (durationMs / 1000);

  return {
    sampleCount: safeMetrics.length,
    startTimestamp,
    endTimestamp,
    durationMs,
    sampleRateHz: safeMetrics.length / (durationMs / 1000),
    cpuAverage: average(cpuValues),
    cpuMax: Math.max(...cpuValues),
    memoryAverageMb: average(memoryValuesMb),
    memoryMaxMb: Math.max(...memoryValuesMb),
    memoryTrendMbPerSample: calculateTrend(memoryValuesMb),
    threadsAverage: average(threadValues),
    threadsMax: Math.max(...threadValues),
    threadsTrend: calculateTrend(threadValues),
    openFilesMax: Math.max(...openFilesValues),
    ioBytesPerSecond,
  };
};

export const runLocalHeuristicAnalysis = (
  metrics: ProcessMetrics[],
  overrides?: Partial<AnomalyConfig>
): { analysis: AnomalyAnalysis; snapshot: FeatureSnapshot } => {
  const config = { ...getAnomalyConfig(), ...overrides };
  const snapshot = buildFeatureSnapshot(metrics);

  let analysis: AnomalyAnalysis = {
    isAnomalous: false,
    anomalyScore: 0,
    anomalyType: 'normal',
    explanation: 'Process behaviour appears normal.',
    confidence: 0.5,
    recommendations: [],
  };

  if (snapshot.cpuAverage > config.cpuSpikePercent) {
    analysis = {
      isAnomalous: true,
      anomalyScore: Math.min(snapshot.cpuAverage / 100, 1),
      anomalyType: 'cpu_spike',
      explanation: `Sustained high CPU usage averaging ${snapshot.cpuAverage.toFixed(1)}%.`,
      confidence: 0.7,
      recommendations: ['Inspect CPU-bound loops', 'Consider lowering CPU limit or optimizing workload'],
    };
  } else if (
    snapshot.memoryTrendMbPerSample > config.memoryLeakGrowthMbPerSample &&
    snapshot.memoryMaxMb > config.memoryLeakMinRssMb
  ) {
    analysis = {
      isAnomalous: true,
      anomalyScore: Math.min(snapshot.memoryTrendMbPerSample / 100, 1),
      anomalyType: 'memory_leak',
      explanation: `Memory trend indicates growth of ~${snapshot.memoryTrendMbPerSample.toFixed(1)} MB per sample (max ${snapshot.memoryMaxMb.toFixed(1)} MB).`,
      confidence: 0.68,
      recommendations: ['Validate memory allocations', 'Use leak detection tooling like valgrind'],
    };
  } else if (
    snapshot.threadsMax > config.threadsForkBombThreshold ||
    snapshot.threadsTrend > config.threadsGrowthPerSample
  ) {
    analysis = {
      isAnomalous: true,
      anomalyScore: Math.min(snapshot.threadsMax / (config.threadsForkBombThreshold * 2), 1),
      anomalyType: 'fork_bomb',
      explanation: `Thread count peaked at ${snapshot.threadsMax} with upward trend ${snapshot.threadsTrend.toFixed(2)}.`,
      confidence: 0.65,
      recommendations: ['Set stricter process/thread limits', 'Inspect code for runaway forking'],
    };
  } else if (snapshot.openFilesMax > config.openFilesExhaustion) {
    analysis = {
      isAnomalous: true,
      anomalyScore: Math.min(snapshot.openFilesMax / (config.openFilesExhaustion * 2), 1),
      anomalyType: 'resource_exhaustion',
      explanation: `Detected ${snapshot.openFilesMax} open file descriptors.`,
      confidence: 0.6,
      recommendations: ['Ensure file handles are closed', 'Audit file I/O paths'],
    };
  } else if (snapshot.ioBytesPerSecond > config.ioBytesPerSecondThreshold) {
    analysis = {
      isAnomalous: true,
      anomalyScore: Math.min(snapshot.ioBytesPerSecond / (config.ioBytesPerSecondThreshold * 4), 1),
      anomalyType: 'io_storm',
      explanation: `High IO throughput ~${(snapshot.ioBytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s detected.`,
      confidence: 0.55,
      recommendations: ['Throttle disk IO', 'Verify workload is expected to write heavily'],
    };
  }

  return { analysis, snapshot };
};
