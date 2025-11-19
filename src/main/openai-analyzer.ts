/**
 * OpenAI Analyzer (GPT-4o)
 * 
 * Purpose: Structured extraction and analysis using OpenAI models
 * Use case: Complex pattern recognition, natural language explanations
 * 
 * Rating: 6/10 - More expensive than Gemini, better reasoning but slower
 */

import OpenAI from 'openai';
import { APIKeyRotator } from './api-key-rotator';
import { ProcessMetrics, AnomalyAnalysis } from './gemini-analyzer';
import * as fs from 'fs';
import * as path from 'path';

interface OpenAIAnalyzerConfig {
  model?: string;
  logDir?: string;
  temperature?: number;
  maxTokens?: number;
}

export class OpenAIAnalyzer {
  private keyRotator: APIKeyRotator;
  private model: string;
  private logDir: string;
  private temperature: number;
  private maxTokens: number;

  constructor(apiKeys: string[], config?: OpenAIAnalyzerConfig) {
    if (apiKeys.length === 0) {
      throw new Error('OpenAIAnalyzer: At least one API key required');
    }

    this.keyRotator = new APIKeyRotator(apiKeys, {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 16000,
    });

    this.model = config?.model || 'gpt-4o-mini'; // Cheaper, faster
    this.logDir = config?.logDir || path.join(process.cwd(), 'logs');
    this.temperature = config?.temperature ?? 0.3;
    this.maxTokens = config?.maxTokens || 2048;

    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Analyze process metrics using OpenAI
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
      const response = await this.keyRotator.callWithRotation(async (apiKey) => {
        return await this.callOpenAIAPI(apiKey, metrics, context);
      });

      const analysis = this.parseOpenAIResponse(response);

      await this.logAnalysis({
        metrics,
        analysis,
        processingTimeMs: Date.now() - startTime,
        apiProvider: 'openai',
      });

      return analysis;

    } catch (error) {
      console.error('[OpenAIAnalyzer] Analysis failed:', error);
      throw error; // Let caller handle fallback
    }
  }

  /**
   * Call OpenAI API with structured output
   */
  private async callOpenAIAPI(
    apiKey: string,
    metrics: ProcessMetrics[],
    context?: {
      command?: string;
      cpuLimit?: number;
      memLimit?: number;
    }
  ): Promise<any> {
    const openai = new OpenAI({ apiKey });

    const metricsWindow = metrics.slice(-10);
    const latestMetric = metrics[metrics.length - 1];

    const completion = await openai.chat.completions.create({
      model: this.model,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a security analyst examining sandboxed process behavior. Analyze metrics and detect anomalies like CPU spikes, memory leaks, fork bombs, or resource exhaustion. Respond in JSON format with: isAnomalous (boolean), anomalyScore (0-1), anomalyType (string), explanation (string), confidence (0-1), recommendations (array).`,
        },
        {
          role: 'user',
          content: `Context:
${context?.command ? `Command: ${context.command}` : ''}
${context?.cpuLimit ? `CPU Limit: ${context.cpuLimit}s` : ''}
${context?.memLimit ? `Memory Limit: ${context.memLimit} MB` : ''}

Recent Metrics (last 10 samples):
${metricsWindow.map((m, i) => `
Sample ${i + 1}: CPU=${m.cpu_percent.toFixed(1)}%, MEM=${(m.memory_rss / 1024 / 1024).toFixed(1)}MB, Threads=${m.threads}, Files=${m.open_files}`).join('')}

Analyze for anomalies.`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    return JSON.parse(content);
  }

  /**
   * Parse OpenAI response
   */
  private parseOpenAIResponse(response: any): AnomalyAnalysis {
    return {
      isAnomalous: response.isAnomalous ?? false,
      anomalyScore: this.clamp(response.anomalyScore ?? 0, 0, 1),
      anomalyType: response.anomalyType || null,
      explanation: response.explanation || 'No explanation',
      confidence: this.clamp(response.confidence ?? 0.5, 0, 1),
      recommendations: Array.isArray(response.recommendations) ? response.recommendations : [],
    };
  }

  /**
   * Log analysis
   */
  private async logAnalysis(data: {
    metrics: ProcessMetrics[];
    analysis: AnomalyAnalysis;
    processingTimeMs: number;
    apiProvider: string;
  }): Promise<void> {
    const logFile = path.join(this.logDir, 'ml_analyses.jsonl');

    const logEntry = {
      timestamp: new Date().toISOString(),
      metricsCount: data.metrics.length,
      analysis: data.analysis,
      processingTimeMs: data.processingTimeMs,
      apiProvider: data.apiProvider,
    };

    try {
      await fs.promises.appendFile(logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('[OpenAIAnalyzer] Failed to log:', error);
    }
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  getStats() {
    return this.keyRotator.getStats();
  }
}
