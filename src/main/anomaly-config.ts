import * as fs from 'fs';
import * as path from 'path';

export interface AnomalyConfig {
  samplingWindowSeconds: number;
  cpuSpikePercent: number;
  memoryLeakGrowthMbPerSample: number;
  memoryLeakMinRssMb: number;
  threadsForkBombThreshold: number;
  threadsGrowthPerSample: number;
  openFilesExhaustion: number;
  whitelist?: string[];
  ioBytesPerSecondThreshold: number;
}

const DEFAULT_CONFIG: AnomalyConfig = {
  samplingWindowSeconds: 10,
  cpuSpikePercent: 85,
  memoryLeakGrowthMbPerSample: 10,
  memoryLeakMinRssMb: 128,
  threadsForkBombThreshold: 50,
  threadsGrowthPerSample: 0.5,
  openFilesExhaustion: 128,
  ioBytesPerSecondThreshold: 1024 * 1024,
  whitelist: [],
};

let cachedConfig: AnomalyConfig | null = null;
let cachedPath: string | null = null;

const stripJsonComments = (payload: string): string =>
  payload
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

export function getAnomalyConfig(customPath?: string): AnomalyConfig {
  const targetPath = customPath
    || process.env.ANOMALY_CONFIG_PATH
    || path.join(process.cwd(), 'config', 'anomaly.config.jsonc');

  if (cachedConfig && cachedPath === targetPath) {
    return cachedConfig;
  }

  try {
    if (fs.existsSync(targetPath)) {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      const parsed = JSON.parse(stripJsonComments(raw));
      cachedConfig = { ...DEFAULT_CONFIG, ...parsed };
      cachedPath = targetPath;
      console.log(`[ML][Config] Loaded anomaly config from ${targetPath}`);
  return cachedConfig!;
    }
  } catch (error) {
    console.warn(`[ML][Config] Failed to read anomaly config at ${targetPath}:`, error);
  }

  cachedConfig = DEFAULT_CONFIG;
  cachedPath = targetPath;
  return cachedConfig!;
}

export function resetAnomalyConfigCache(): void {
  cachedConfig = null;
  cachedPath = null;
}
