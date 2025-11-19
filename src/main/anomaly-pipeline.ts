import { ProcessMetrics, AnomalyAnalysis } from './anomaly-types';
import { GeminiAnalyzer } from './gemini-analyzer';
import { MLDatabase } from './ml-database';
import { runLocalHeuristicAnalysis, buildFeatureSnapshot, FeatureSnapshot } from './local-heuristics';

export interface PipelineContext {
  runId: string;
  mlDatabase: MLDatabase;
  geminiAnalyzer?: GeminiAnalyzer | null;
  command?: string;
}

export interface PipelineResult {
  analysisId: number;
  analysis: AnomalyAnalysis;
  snapshot: FeatureSnapshot;
  source: 'gemini' | 'local';
  processingTimeMs: number;
}

export async function analyzeAndPersistBatch(params: {
  samples: ProcessMetrics[];
  context: PipelineContext;
}): Promise<PipelineResult> {
  const { samples, context } = params;
  const snapshot = buildFeatureSnapshot(samples);

  console.debug('[ML][Pipeline] Batch summary', {
    runId: context.runId,
    sampleCount: snapshot.sampleCount,
    sampleRateHz: Number(snapshot.sampleRateHz.toFixed(2)),
    windowMs: snapshot.durationMs,
    cpuAverage: Number(snapshot.cpuAverage.toFixed(2)),
    memoryAverageMb: Number(snapshot.memoryAverageMb.toFixed(2)),
    memoryTrendMbPerSample: Number(snapshot.memoryTrendMbPerSample.toFixed(2)),
    threadsMax: snapshot.threadsMax,
    openFilesMax: snapshot.openFilesMax,
  });

  let analysis: AnomalyAnalysis;
  let provider: 'gemini' | 'local';
  const processingStart = Date.now();

  if (context.geminiAnalyzer) {
    analysis = await context.geminiAnalyzer.analyzeMetrics(samples, {
      command: context.command,
    });
    provider = 'gemini';
  } else {
    const heuristicResult = runLocalHeuristicAnalysis(samples);
    analysis = heuristicResult.analysis;
    provider = 'local';
  }

  const recommendations = Array.isArray(analysis.recommendations)
    ? analysis.recommendations
    : [];
  const processingTimeMs = Date.now() - processingStart;

  const analysisId = context.mlDatabase.insertMLAnalysis({
    run_id: context.runId,
    timestamp: new Date().toISOString(),
    metrics_snapshot: JSON.stringify(samples),
    anomaly_score: analysis.anomalyScore,
    is_anomalous: analysis.isAnomalous,
    anomaly_type: analysis.anomalyType,
    explanation: analysis.explanation,
    confidence: analysis.confidence,
    recommendations: JSON.stringify(recommendations),
    api_provider: provider === 'gemini' ? 'gemini' : 'local_heuristic',
    processing_time_ms: processingTimeMs,
  });

  console.debug('[ML][Pipeline] Analysis stored', {
    runId: context.runId,
    analysisId,
    provider,
    anomalyScore: analysis.anomalyScore,
    isAnomalous: analysis.isAnomalous,
    processingTimeMs,
  });

  return {
    analysisId,
    analysis: { ...analysis, recommendations },
    snapshot,
    source: provider,
    processingTimeMs,
  };
}
