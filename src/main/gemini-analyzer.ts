/**
 * Gemini API Analyzer
 * 
 * Purpose: Analyze process metrics for anomalies using Gemini AI
 * Features:
 * - Structured prompting for consistent responses
 * - JSON mode for reliable parsing
 * - Error handling with fallback
 * - JSONL logging for audit trail
 * 
 * Rating: 7/10 - Solid but latency may impact real-time monitoring
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { APIKeyRotator } from './api-key-rotator';
import * as fs from 'fs';
import * as path from 'path';

export interface ProcessMetrics {
  timestamp: string;
  cpu_percent: number;
  memory_rss: number;
  memory_vms?: number;
  threads: number;
  open_files: number;
  read_bytes?: number;
  write_bytes?: number;
}

export interface AnomalyAnalysis {
  isAnomalous: boolean;
  anomalyScore: number; // 0.0 - 1.0
  anomalyType: string | null; // 'cpu_spike', 'memory_leak', 'fork_bomb', 'normal', etc.
  explanation: string;
  confidence: number; // 0.0 - 1.0
  recommendations: string[];
}

interface GeminiAnalyzerConfig {
  model?: string;
  logDir?: string;
  temperature?: number;
  maxTokens?: number;
}

export class GeminiAnalyzer {
  private keyRotator: APIKeyRotator;
  private model: string;
  private logDir: string;
  private temperature: number;
  private maxTokens: number;
  private genAI: GoogleGenerativeAI | null = null;

  constructor(apiKeys: string[], config?: GeminiAnalyzerConfig) {
    if (apiKeys.length === 0) {
      throw new Error('GeminiAnalyzer: At least one API key required');
    }

    this.keyRotator = new APIKeyRotator(apiKeys, {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 16000,
    });

    this.model = config?.model || 'gemini-1.5-flash';
    this.logDir = config?.logDir || path.join(process.cwd(), 'logs');
    this.temperature = config?.temperature ?? 0.3; // Low temperature for consistent analysis
    this.maxTokens = config?.maxTokens || 2048;

    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Analyze process metrics for anomalies
   */
  async analyzeMetrics(
    metrics: ProcessMetrics[],
    context?: {
      command?: string;
      cpuLimit?: number;
      memLimit?: number;
    }
  ): Promise<AnomalyAnalysis> {
    const startTime = Date.now();

    try {
      const prompt = this.buildAnalysisPrompt(metrics, context);
      
      const response = await this.keyRotator.callWithRotation(async (apiKey) => {
        return await this.callGeminiAPI(apiKey, prompt);
      });

      const analysis = this.parseGeminiResponse(response);
      
      // Log analysis
      await this.logAnalysis({
        metrics,
        analysis,
        processingTimeMs: Date.now() - startTime,
        apiProvider: 'gemini',
      });

      return analysis;

    } catch (error) {
      console.error('[GeminiAnalyzer] Analysis failed:', error);
      
      // Fallback to basic heuristic analysis
      const fallbackAnalysis = this.fallbackHeuristicAnalysis(metrics, context);
      
      await this.logAnalysis({
        metrics,
        analysis: fallbackAnalysis,
        processingTimeMs: Date.now() - startTime,
        apiProvider: 'fallback_heuristic',
        error: error instanceof Error ? error.message : String(error),
      });

      return fallbackAnalysis;
    }
  }

  /**
   * Build analysis prompt for Gemini
   */
  private buildAnalysisPrompt(
    metrics: ProcessMetrics[],
    context?: {
      command?: string;
      cpuLimit?: number;
      memLimit?: number;
    }
  ): string {
    const latestMetric = metrics[metrics.length - 1];
    const metricsWindow = metrics.slice(-10); // Last 10 samples

    const prompt = `You are a security analyst examining process behavior in a sandbox environment.

**Context:**
${context?.command ? `- Command: ${context.command}` : ''}
${context?.cpuLimit ? `- CPU Limit: ${context.cpuLimit} seconds` : ''}
${context?.memLimit ? `- Memory Limit: ${context.memLimit} MB` : ''}

**Recent Metrics (last 10 samples):**
${metricsWindow.map((m, i) => `
Sample ${i + 1}:
  - CPU: ${m.cpu_percent.toFixed(1)}%
  - Memory RSS: ${(m.memory_rss / 1024 / 1024).toFixed(1)} MB
  - Threads: ${m.threads}
  - Open Files: ${m.open_files}
`).join('')}

**Analyze this process for:**
1. **CPU Abuse**: Sustained high CPU (>80%) or infinite loops
2. **Memory Leak**: Gradual memory growth over time
3. **Fork Bomb**: Rapid thread/process creation
4. **Resource Exhaustion**: Excessive file descriptors or I/O
5. **Normal Behavior**: Legitimate activity within expected bounds

**Respond in JSON format:**
{
  "isAnomalous": boolean,
  "anomalyScore": number (0.0-1.0),
  "anomalyType": "cpu_spike" | "memory_leak" | "fork_bomb" | "resource_exhaustion" | "normal",
  "explanation": "Brief explanation of behavior",
  "confidence": number (0.0-1.0),
  "recommendations": ["action1", "action2"]
}

**Be concise and precise. Focus on actionable insights.**`;

    return prompt;
  }

  /**
   * Call Gemini API
   */
  private async callGeminiAPI(apiKey: string, prompt: string): Promise<string> {
    this.genAI = new GoogleGenerativeAI(apiKey);
    const model = this.genAI.getGenerativeModel({ 
      model: this.model,
      generationConfig: {
        temperature: this.temperature,
        maxOutputTokens: this.maxTokens,
        responseMimeType: 'application/json', // JSON mode
      },
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new Error('Empty response from Gemini API');
    }

    return text;
  }

  /**
   * Parse Gemini JSON response
   */
  private parseGeminiResponse(responseText: string): AnomalyAnalysis {
    try {
      const parsed = JSON.parse(responseText);

      return {
        isAnomalous: parsed.isAnomalous ?? false,
        anomalyScore: this.clamp(parsed.anomalyScore ?? 0, 0, 1),
        anomalyType: parsed.anomalyType || null,
        explanation: parsed.explanation || 'No explanation provided',
        confidence: this.clamp(parsed.confidence ?? 0.5, 0, 1),
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      };
    } catch (error) {
      console.error('[GeminiAnalyzer] Failed to parse response:', error);
      throw new Error(`Invalid JSON response from Gemini: ${responseText.substring(0, 200)}`);
    }
  }

  /**
   * Fallback heuristic analysis (if API fails)
   */
  private fallbackHeuristicAnalysis(
    metrics: ProcessMetrics[],
    context?: {
      cpuLimit?: number;
      memLimit?: number;
    }
  ): AnomalyAnalysis {
    const latestMetric = metrics[metrics.length - 1];
    const metricsWindow = metrics.slice(-10);

    // CPU spike detection
    const avgCPU = metricsWindow.reduce((sum, m) => sum + m.cpu_percent, 0) / metricsWindow.length;
    const isCPUSpike = avgCPU > 85;

    // Memory leak detection (gradual increase)
    const memoryTrend = this.calculateTrend(metricsWindow.map(m => m.memory_rss));
    const isMemoryLeak = memoryTrend > 0.1 && latestMetric.memory_rss > 100 * 1024 * 1024; // >100MB

    // Fork bomb detection
    const threadsTrend = this.calculateTrend(metricsWindow.map(m => m.threads));
    const isForkBomb = threadsTrend > 0.5 || latestMetric.threads > 50;

    // Resource exhaustion
    const isResourceExhaustion = latestMetric.open_files > 100;

    let anomalyType: string | null = 'normal';
    let isAnomalous = false;
    let anomalyScore = 0;
    let explanation = 'Process behavior appears normal.';
    const recommendations: string[] = [];

    if (isCPUSpike) {
      isAnomalous = true;
      anomalyType = 'cpu_spike';
      anomalyScore = Math.min(avgCPU / 100, 1.0);
      explanation = `Sustained high CPU usage (${avgCPU.toFixed(1)}%). Possible infinite loop or CPU-intensive computation.`;
      recommendations.push('Consider reducing CPU limit', 'Check for infinite loops in code');
    } else if (isMemoryLeak) {
      isAnomalous = true;
      anomalyType = 'memory_leak';
      anomalyScore = Math.min(memoryTrend, 1.0);
      explanation = `Memory usage increasing over time (${(latestMetric.memory_rss / 1024 / 1024).toFixed(1)} MB). Possible memory leak.`;
      recommendations.push('Investigate memory allocations', 'Use valgrind or memory profiler');
    } else if (isForkBomb) {
      isAnomalous = true;
      anomalyType = 'fork_bomb';
      anomalyScore = Math.min(latestMetric.threads / 100, 1.0);
      explanation = `Rapid thread/process creation (${latestMetric.threads} threads). Possible fork bomb.`;
      recommendations.push('Enforce process limit', 'Investigate fork() calls');
    } else if (isResourceExhaustion) {
      isAnomalous = true;
      anomalyType = 'resource_exhaustion';
      anomalyScore = Math.min(latestMetric.open_files / 200, 1.0);
      explanation = `Excessive open file descriptors (${latestMetric.open_files}). Possible file descriptor leak.`;
      recommendations.push('Check for unclosed files', 'Review file I/O operations');
    }

    return {
      isAnomalous,
      anomalyScore,
      anomalyType,
      explanation,
      confidence: 0.6, // Heuristic confidence is lower than ML
      recommendations,
    };
  }

  /**
   * Calculate linear trend (positive = increasing, negative = decreasing)
   */
  private calculateTrend(values: number[]): number {
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

    return denominator === 0 ? 0 : numerator / denominator / yMean; // Normalized slope
  }

  /**
   * Clamp value between min and max
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Log analysis to JSONL file
   */
  private async logAnalysis(data: {
    metrics: ProcessMetrics[];
    analysis: AnomalyAnalysis;
    processingTimeMs: number;
    apiProvider: string;
    error?: string;
  }): Promise<void> {
    const logFile = path.join(this.logDir, 'ml_analyses.jsonl');
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      metricsCount: data.metrics.length,
      latestMetric: data.metrics[data.metrics.length - 1],
      analysis: data.analysis,
      processingTimeMs: data.processingTimeMs,
      apiProvider: data.apiProvider,
      error: data.error || null,
    };

    try {
      await fs.promises.appendFile(logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('[GeminiAnalyzer] Failed to log analysis:', error);
    }
  }

  /**
   * Get usage statistics from key rotator
   */
  getStats() {
    return this.keyRotator.getStats();
  }
}
