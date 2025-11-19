/**
 * AI Insights Tab Component (AnomalyPanel)
 * 
 * Purpose: Display simulated anomaly detection results (UI-only while ML backend integrates)
 * Constraint: Uses Execution Manager to preserve state across navigation
 */

import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle, Clock, Zap, Sparkles } from 'lucide-react';
import { detectProcessStart, generateSimulatedAnalysis, chooseGenerationMode } from './anomaly-utils';
import { executionService } from '../services/executionService';

interface Anomaly {
  id: string;
  type: string;
  title: string;
  description: string;
  score: number;
  confidence: number;
  recommendations: string[];
  timestamp: string;
  detector: string;
}

interface Analysis {
  id: string;
  timestamp: string;
  anomalies: Anomaly[];
  score: number;
  detector: string;
  latencyMs: number;
}

export const AIInsights: React.FC = () => {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [processingStopped, setProcessingStopped] = useState(false);
  const [lastAnalysisAt, setLastAnalysisAt] = useState<Date | null>(null);
  const [currentProcessId, setCurrentProcessId] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<string | null>(null);
  const [autoStopTimer, setAutoStopTimer] = useState<number | null>(null);
  const [autoStopMessage, setAutoStopMessage] = useState<string | null>(null);
  const autoStopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [cleared, setCleared] = useState<boolean>(() => {
    // Initialize from sessionStorage on mount
    return sessionStorage.getItem('zenc.anomaly.cleared') === '1';
  });

  // Computed stats
  const totalAnalyses = analyses.length;
  const totalAnomalies = analyses.reduce((sum, a) => sum + a.anomalies.length, 0);
  const anomalyRate = totalAnalyses > 0 ? (totalAnomalies / totalAnalyses) * 100 : 0;
  
  // Calculate avg response time from actual latencyMs values
  const avgResponse = analyses.length > 0 
    ? analyses.reduce((sum, a) => sum + a.latencyMs, 0) / analyses.length
    : 0;

  // Check Execution Manager on mount for existing processes (do NOT generate)
  useEffect(() => {
    const runningProcesses = executionService.getRunningProcesses();
    if (runningProcesses.length > 0) {
      setProcessingStopped(false);
      setCurrentProcessId(runningProcesses[0].id);
    }
  }, []);

  // Subscribe to Execution Manager events
  useEffect(() => {
    const handleStart = (processInfo: any) => {
      setProcessingStopped(false);
      setCurrentProcessId(processInfo.id);
    };

    const handleStop = (processInfo: any) => {
      if (processInfo.id === currentProcessId) {
        setProcessingStopped(true);
      }
    };

    executionService.on('start', handleStart);
    executionService.on('stop', handleStop);

    return () => {
      executionService.off('start', handleStart);
      executionService.off('stop', handleStop);
    };
  }, [currentProcessId]);

  // Subscribe to real ML analyses from main process
  useEffect(() => {
    if (!window.sandboxAPI?.onMLAnalysis) return;

    const cleanup = window.sandboxAPI.onMLAnalysis((mlData: any) => {
      console.log('[AIInsights] Received ML analysis:', mlData);
      
      // Convert main process ML analysis to UI format
      const analysis: Analysis = {
        id: mlData.id?.toString() || Date.now().toString(),
        timestamp: mlData.timestamp || new Date().toISOString(),
        anomalies: mlData.isAnomalous ? [{
          id: mlData.id?.toString() || Date.now().toString(),
          type: mlData.anomalyType || 'unknown',
          title: mlData.anomalyType?.replace(/_/g, ' ').toUpperCase() || 'ANOMALY DETECTED',
          description: mlData.explanation || 'Anomalous behavior detected',
          score: mlData.anomalyScore || 0.5,
          confidence: mlData.confidence || 0.5,
          recommendations: mlData.recommendations || [],
          timestamp: mlData.timestamp || new Date().toISOString(),
          detector: mlData.apiProvider || 'gemini'
        }] : [],
        score: mlData.anomalyScore || 0,
        detector: mlData.apiProvider || 'gemini',
        latencyMs: mlData.processingTimeMs || 0
      };

      // Add to analyses list
      setAnalyses(prev => [analysis, ...prev].slice(0, 20));
      setLastAnalysisAt(new Date());
      setProcessingStopped(false);
    });

    return cleanup;
  }, []);

  // Auto-detect process starts and stops (transition-based only)
  useEffect(() => {
    let lastStartTime = 0;

    const cleanup = detectProcessStart(
      (startTimestamp: number) => {
        // Debounce: ignore starts within 3 seconds
        if (startTimestamp - lastStartTime < 3000) {
          return;
        }

        lastStartTime = startTimestamp;
        setProcessingStopped(false);
        setAutoStopMessage(null);
        setAutoStopTimer(null);

        // Clear any existing auto-stop timer
        if (autoStopTimeoutRef.current) {
          clearTimeout(autoStopTimeoutRef.current);
          autoStopTimeoutRef.current = null;
        }

        // Clear the cleared flag on a real start event
        if (cleared) {
          setCleared(false);
          sessionStorage.setItem('zenc.anomaly.cleared', '0');
        }

        // Get the current running process to determine executable path
        const runningProcesses = executionService.getRunningProcesses();
        const executablePath = runningProcesses.length > 0 ? runningProcesses[0].executable || '' : '';
        
        // Determine generation mode based on executable path
        const mode = chooseGenerationMode(executablePath);
        setCurrentMode(mode);

        // Generate after 1-3 second delay (realistic)
        const delay = 1000 + Math.random() * 2000;
        
        setTimeout(() => {
          const analysis = generateSimulatedAnalysis(startTimestamp, mode);
          
          // Only add analysis to panel if it has anomalies (anomaly mode or default with anomalies)
          if (analysis.anomalies.length > 0) {
            setAnalyses(prev => [analysis, ...prev].slice(0, 20)); // Keep last 20
            setLastAnalysisAt(new Date());
            
            // AUTO-STOP LOGIC: If mode was 'normal' (ui_test_programs) but anomaly detected, start 10s countdown
            if (mode === 'normal') {
              setAutoStopMessage('Anomaly detected in ui_test_programs executable');
              setAutoStopTimer(10);
              
              // Countdown timer
              let countdown = 10;
              const countdownInterval = setInterval(() => {
                countdown--;
                setAutoStopTimer(countdown);
                
                if (countdown <= 0) {
                  clearInterval(countdownInterval);
                }
              }, 1000);
              
              // Auto-stop after 10 seconds
              autoStopTimeoutRef.current = setTimeout(() => {
                const runningProcs = executionService.getRunningProcesses();
                if (runningProcs.length > 0) {
                  // Stop the process
                  const procId = runningProcs[0].id;
                  executionService.stopProcess(procId, 'auto-stop-anomaly');
                  
                  // Call the UI stop API
                  if (window.sandboxAPI && window.sandboxAPI.stopSandbox) {
                    window.sandboxAPI.stopSandbox();
                  }
                  
                  // Update UI state
                  setProcessingStopped(true);
                  setAutoStopMessage('Stopped: anomaly detected after 10s — process terminated to protect the system');
                  setAutoStopTimer(null);
                  
                  // Add system message to terminal
                  const terminalSession = (window as any).terminalSession;
                  if (terminalSession) {
                    terminalSession.append(
                      '\x1b[31m[AUTO-STOP]\x1b[0m Stopped: anomaly detected after 10s — process terminated to protect the system\n',
                      'system'
                    );
                  }
                }
              }, 10000);
            }
          }
        }, delay);
      },
      () => {
        // Process stopped callback
        setProcessingStopped(true);
        setAutoStopTimer(null);
        
        // Clear auto-stop timer if process stopped manually
        if (autoStopTimeoutRef.current) {
          clearTimeout(autoStopTimeoutRef.current);
          autoStopTimeoutRef.current = null;
        }
      }
    );

    return () => {
      cleanup();
      if (autoStopTimeoutRef.current) {
        clearTimeout(autoStopTimeoutRef.current);
        autoStopTimeoutRef.current = null;
      }
    };
  }, [cleared]);

  // Clear analyses (persist cleared state)
  const handleClear = () => {
    setAnalyses([]);
    setProcessingStopped(false);
    setLastAnalysisAt(null);
    
    // Set and persist cleared flag
    setCleared(true);
    sessionStorage.setItem('zenc.anomaly.cleared', '1');
    
    // Stop current process in Execution Manager
    if (currentProcessId) {
      executionService.stopProcess(currentProcessId, 'cleared');
      setCurrentProcessId(null);
    }
  };

  // Format timestamp
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Analyses</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalAnalyses}</p>
            </div>
            <Zap className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Anomalies</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{totalAnomalies}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Anomaly Rate</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {anomalyRate.toFixed(1)}%
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Response</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {avgResponse > 0 ? avgResponse.toFixed(0) : '0'}ms
              </p>
            </div>
            <Clock className="w-8 h-8 text-gray-500" />
          </div>
        </div>
      </div>

      {/* Status Bar and Actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Simulated Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md">
            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
              Simulated anomalies (UI only)
            </span>
          </div>

          {/* Auto-stop countdown */}
          {autoStopTimer !== null && autoStopTimer > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md animate-pulse">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-xs font-bold text-red-700 dark:text-red-300">
                Auto-stopping in {autoStopTimer}s...
              </span>
            </div>
          )}

          {/* Auto-stop message after termination */}
          {autoStopMessage && autoStopTimer === null && (
            <div className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <span className="text-xs font-medium text-red-700 dark:text-red-300">
                {autoStopMessage}
              </span>
            </div>
          )}

          {/* Process Stopped Message */}
          {processingStopped && analyses.length > 0 && !autoStopMessage && (
            <div className="px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <span className="text-xs text-yellow-700 dark:text-yellow-300">
                Process stopped — last analysis preserved
              </span>
            </div>
          )}

          {/* Last analysis timestamp */}
          {lastAnalysisAt && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Last analysis: {lastAnalysisAt.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {analyses.length > 0 && (
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md transition-colors text-sm font-medium"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Analyses List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Recent Analyses
        </h3>

        {analyses.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
            <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              No analyses yet. Start a sandboxed process to generate anomaly insights automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {analyses.map((analysis) => (
              <div
                key={analysis.id}
                className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                {/* Analysis Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      analysis.score > 50 ? 'bg-red-500' : 'bg-green-500'
                    }`} />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Analysis #{analysis.id.split('-')[1]}
                    </span>
                    <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded">
                      {analysis.detector}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTime(analysis.timestamp)}
                  </span>
                </div>

                {/* Anomalies */}
                <div className="space-y-3">
                  {analysis.anomalies.map((anomaly) => (
                    <div
                      key={anomaly.id}
                      className="pl-4 border-l-2 border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                          {anomaly.title}
                        </h4>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`px-2 py-0.5 rounded ${
                            anomaly.score > 70
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                              : anomaly.score > 40
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          }`}>
                            Score: {anomaly.score}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">
                            Conf: {anomaly.confidence}%
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                        {anomaly.description}
                      </p>

                      {anomaly.recommendations.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Recommendations:
                          </p>
                          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5 list-disc list-inside">
                            {anomaly.recommendations.map((rec, idx) => (
                              <li key={idx}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
