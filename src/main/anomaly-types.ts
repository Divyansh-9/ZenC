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
  anomalyType: string | null;
  explanation: string;
  confidence: number; // 0.0 - 1.0
  recommendations: string[];
}
