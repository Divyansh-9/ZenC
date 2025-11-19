#!/usr/bin/env ts-node
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { analyzeAndPersistBatch } from '../src/main/anomaly-pipeline';
import { MLDatabase } from '../src/main/ml-database';
import { ProcessMetrics } from '../src/main/anomaly-types';

async function run(): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zencube-ml-smoke-'));
  const dbPath = path.join(tempDir, 'smoke.db');
  const mlDatabase = new MLDatabase(dbPath);

  const baseTimestamp = Date.now() - 12000;
  const samples: ProcessMetrics[] = Array.from({ length: 12 }).map((_, idx) => ({
    timestamp: new Date(baseTimestamp + idx * 1000).toISOString(),
    cpu_percent: 70 + idx * 2.5,
    memory_rss: (200 + idx * 12) * 1024 * 1024,
    threads: 4 + idx,
    open_files: 24 + idx,
    read_bytes: idx * 50_000,
    write_bytes: idx * 120_000,
  }));

  const result = await analyzeAndPersistBatch({
    samples,
    context: {
      runId: `smoke_${Date.now()}`,
      mlDatabase,
      geminiAnalyzer: null,
    },
  });

  if (!result.analysisId) {
    throw new Error('ML smoke test failed: analysis ID missing');
  }

  if (result.analysis.anomalyScore === undefined) {
    throw new Error('ML smoke test failed: anomaly score missing');
  }

  console.log('[ML Smoke Test] Analysis stored:', result.analysisId);
  console.log('[ML Smoke Test] Provider:', result.source);
  console.log('[ML Smoke Test] Snapshot:', JSON.stringify(result.snapshot, null, 2));
  console.log('[ML Smoke Test] Analysis:', JSON.stringify(result.analysis, null, 2));

  fs.rmSync(tempDir, { recursive: true, force: true });
}

run().catch((error) => {
  console.error('[ML Smoke Test] Failed:', error);
  process.exit(1);
});
