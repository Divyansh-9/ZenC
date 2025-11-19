/**
 * ML Analysis Database Schema
 * 
 * Purpose: Store ML analysis results, track API usage, audit trail
 * Technology: SQLite (embedded, zero-config)
 * 
 * Rating: 8/10 - Clean schema, efficient for desktop app
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

export interface MLAnalysisRecord {
  id?: number;
  run_id: string;
  timestamp: string;
  metrics_snapshot: string; // JSON
  anomaly_score: number;
  is_anomalous: boolean;
  anomaly_type: string | null;
  explanation: string;
  confidence: number;
  recommendations: string; // JSON array
  api_provider: string;
  processing_time_ms: number;
}

export interface MonitoringRun {
  run_id: string;
  pid: number;
  command: string;
  start_time: string;
  end_time: string | null;
  exit_code: number | null;
}

export interface APIKeyUsage {
  id?: number;
  key_hash: string;
  provider: string;
  requests_count: number;
  last_used: string;
  rate_limit_reset: string | null;
}

export class MLDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'zencube.db');

    // Ensure directory exists
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.initialize();
  }

  /**
   * Initialize database schema
   */
  private initialize(): void {
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Create monitoring_runs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS monitoring_runs (
        run_id TEXT PRIMARY KEY,
        pid INTEGER NOT NULL,
        command TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        exit_code INTEGER
      )
    `);

    // Create ml_analyses table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ml_analyses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        metrics_snapshot TEXT NOT NULL,
        anomaly_score REAL NOT NULL,
        is_anomalous INTEGER NOT NULL,
        anomaly_type TEXT,
        explanation TEXT NOT NULL,
        confidence REAL NOT NULL,
        recommendations TEXT NOT NULL,
        api_provider TEXT NOT NULL,
        processing_time_ms INTEGER NOT NULL,
        FOREIGN KEY (run_id) REFERENCES monitoring_runs(run_id) ON DELETE CASCADE
      )
    `);

    // Create api_key_usage table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS api_key_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_hash TEXT NOT NULL,
        provider TEXT NOT NULL,
        requests_count INTEGER DEFAULT 0,
        last_used TEXT NOT NULL,
        rate_limit_reset TEXT,
        UNIQUE(key_hash, provider)
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_ml_analyses_run_id ON ml_analyses(run_id);
      CREATE INDEX IF NOT EXISTS idx_ml_analyses_timestamp ON ml_analyses(timestamp);
      CREATE INDEX IF NOT EXISTS idx_ml_analyses_is_anomalous ON ml_analyses(is_anomalous);
      CREATE INDEX IF NOT EXISTS idx_monitoring_runs_start_time ON monitoring_runs(start_time);
    `);

    console.log(`[MLDatabase] Initialized at ${this.dbPath}`);
  }

  /**
   * Insert monitoring run
   */
  insertMonitoringRun(run: MonitoringRun): void {
    const stmt = this.db.prepare(`
      INSERT INTO monitoring_runs (run_id, pid, command, start_time, end_time, exit_code)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      run.run_id,
      run.pid,
      run.command,
      run.start_time,
      run.end_time,
      run.exit_code
    );
  }

  /**
   * Update monitoring run end time
   */
  updateMonitoringRunEnd(run_id: string, end_time: string, exit_code: number): void {
    const stmt = this.db.prepare(`
      UPDATE monitoring_runs 
      SET end_time = ?, exit_code = ?
      WHERE run_id = ?
    `);

    stmt.run(end_time, exit_code, run_id);
  }

  /**
   * Insert ML analysis
   */
  insertMLAnalysis(analysis: MLAnalysisRecord): number {
    const stmt = this.db.prepare(`
      INSERT INTO ml_analyses (
        run_id, timestamp, metrics_snapshot, anomaly_score, is_anomalous,
        anomaly_type, explanation, confidence, recommendations,
        api_provider, processing_time_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      analysis.run_id,
      analysis.timestamp,
      analysis.metrics_snapshot,
      analysis.anomaly_score,
      analysis.is_anomalous ? 1 : 0,
      analysis.anomaly_type,
      analysis.explanation,
      analysis.confidence,
      analysis.recommendations,
      analysis.api_provider,
      analysis.processing_time_ms
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Get recent ML analyses
   */
  getRecentAnalyses(limit: number = 10): MLAnalysisRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM ml_analyses
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map(row => ({
      ...row,
      is_anomalous: row.is_anomalous === 1,
    }));
  }

  /**
   * Get analyses for specific run
   */
  getAnalysesByRun(run_id: string): MLAnalysisRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM ml_analyses
      WHERE run_id = ?
      ORDER BY timestamp ASC
    `);

    const rows = stmt.all(run_id) as any[];
    return rows.map(row => ({
      ...row,
      is_anomalous: row.is_anomalous === 1,
    }));
  }

  /**
   * Get anomalous analyses only
   */
  getAnomalousAnalyses(limit: number = 20): MLAnalysisRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM ml_analyses
      WHERE is_anomalous = 1
      ORDER BY anomaly_score DESC, timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map(row => ({
      ...row,
      is_anomalous: true,
    }));
  }

  /**
   * Track API key usage
   */
  trackAPIUsage(key_hash: string, provider: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO api_key_usage (key_hash, provider, requests_count, last_used)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(key_hash, provider) DO UPDATE SET
        requests_count = requests_count + 1,
        last_used = excluded.last_used
    `);

    stmt.run(key_hash, provider, new Date().toISOString());
  }

  /**
   * Get API usage stats
   */
  getAPIUsageStats(): APIKeyUsage[] {
    const stmt = this.db.prepare(`
      SELECT * FROM api_key_usage
      ORDER BY last_used DESC
    `);

    return stmt.all() as APIKeyUsage[];
  }

  /**
   * Get analysis statistics
   */
  getStats(): {
    totalAnalyses: number;
    anomalousCount: number;
    anomalyRate: number;
    avgAnomalyScore: number;
    avgProcessingTime: number;
  } {
    const row = this.db.prepare(`
      SELECT 
        COUNT(*) as totalAnalyses,
        SUM(CASE WHEN is_anomalous = 1 THEN 1 ELSE 0 END) as anomalousCount,
        AVG(anomaly_score) as avgAnomalyScore,
        AVG(processing_time_ms) as avgProcessingTime
      FROM ml_analyses
    `).get() as any;

    return {
      totalAnalyses: row.totalAnalyses || 0,
      anomalousCount: row.anomalousCount || 0,
      anomalyRate: row.totalAnalyses > 0 ? row.anomalousCount / row.totalAnalyses : 0,
      avgAnomalyScore: row.avgAnomalyScore || 0,
      avgProcessingTime: row.avgProcessingTime || 0,
    };
  }

  /**
   * Get a monitoring run record by run_id
   */
  getMonitoringRun(run_id: string): MonitoringRun | null {
    const stmt = this.db.prepare(`
      SELECT run_id, pid, command, start_time, end_time, exit_code
      FROM monitoring_runs
      WHERE run_id = ?
    `);

    const row = stmt.get(run_id) as any;
    if (!row) return null;

    return {
      run_id: row.run_id,
      pid: row.pid,
      command: row.command,
      start_time: row.start_time,
      end_time: row.end_time,
      exit_code: row.exit_code,
    };
  }

  /**
   * Update monitoring run command (useful if process started after db insert)
   */
  updateMonitoringRunCommand(run_id: string, command: string): void {
    const stmt = this.db.prepare(`
      UPDATE monitoring_runs
      SET command = ?
      WHERE run_id = ?
    `);

    stmt.run(command, run_id);
  }

  /**
   * Clean old records (data retention)
   */
  cleanOldRecords(daysToKeep: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffISO = cutoffDate.toISOString();

    const stmt = this.db.prepare(`
      DELETE FROM monitoring_runs
      WHERE start_time < ?
    `);

    const result = stmt.run(cutoffISO);
    console.log(`[MLDatabase] Cleaned ${result.changes} old records (older than ${daysToKeep} days)`);
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
    console.log('[MLDatabase] Database closed');
  }

  /**
   * Get database path
   */
  getPath(): string {
    return this.dbPath;
  }
}
