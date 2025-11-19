import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { usePerformance } from '../contexts/PerformanceContext';
import { executionService } from '../services/executionService';

interface MonitoringData {
  timestamp: number;
  cpu: number;
  memory: number;
  time: string;
}

interface MonitoringDashboardProps {
  isRunning: boolean;
}

const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({ isRunning: isRunningProp }) => {
  const { profile } = usePerformance();
  const [chartData, setChartData] = useState<MonitoringData[]>([]);
  const [alerts, setAlerts] = useState<string>('');
  const [metricsText, setMetricsText] = useState<string>('');
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [isRunning, setIsRunning] = useState(isRunningProp);

  // Adaptive settings based on hardware capabilities
  const maxChartPoints = profile?.maxChartPoints || 100;

  // Subscribe to Execution Manager to detect process state across navigation
  useEffect(() => {
    // Check for existing running processes on mount
    const runningProcesses = executionService.getRunningProcesses();
    if (runningProcesses.length > 0) {
      setIsRunning(true);
    } else {
      setIsRunning(isRunningProp);
    }

    // Listen for process start/stop events
    const handleStart = () => setIsRunning(true);
    const handleStop = () => setIsRunning(false);

    executionService.on('start', handleStart);
    executionService.on('stop', handleStop);

    return () => {
      executionService.off('start', handleStart);
      executionService.off('stop', handleStop);
    };
  }, [isRunningProp]);

  useEffect(() => {
    // Register IPC listener for BATCHED monitoring data from worker thread
    console.log('[MonitoringDashboard] Registering monitoring-data-batch listener');
    
    if (!window.sandboxAPI || !window.sandboxAPI.onMonitoringDataBatch) {
      console.error('[MonitoringDashboard] onMonitoringDataBatch not available!');
      return;
    }
    
    // Listen for batches of data (sent every 1 second by worker thread)
    window.sandboxAPI.onMonitoringDataBatch((batch: Array<{ cpu: number; memory: number; timestamp: number }>) => {
      console.log(`[MonitoringDashboard] Received batch with ${batch.length} data points`);
      
      setChartData((currentData) => {
        // Map batch to chart format with formatted timestamps
        const newPoints = batch.map(point => ({
          timestamp: point.timestamp,
          cpu: point.cpu,
          memory: point.memory,
          time: new Date(point.timestamp).toLocaleTimeString()
        }));
        
        const combined = [...currentData, ...newPoints];
        
        // Keep only adaptive number of points based on hardware tier
        return combined.slice(-maxChartPoints);
      });
    });
    
    // No cleanup needed - IPC listener persists for app lifetime
  }, []); // Empty deps - register ONCE on mount

  // Separate effect to clear data when process stops
  useEffect(() => {
    if (!isRunning) {
      console.log('[MonitoringDashboard] Process stopped, preserving chart data for review');
      // Don't clear data - preserve for review after process stops
    }
  }, [isRunning]);

  const handleGetAlerts = async () => {
    setIsLoadingAlerts(true);
    try {
      if (window.sandboxAPI && window.sandboxAPI.getAlerts) {
        const alertData = await window.sandboxAPI.getAlerts();
        setAlerts(alertData);
      }
    } catch (error) {
      setAlerts(`Error fetching alerts: ${error}`);
    } finally {
      setIsLoadingAlerts(false);
    }
  };

  const handleRefreshMetrics = async () => {
    setIsLoadingMetrics(true);
    try {
      if (window.sandboxAPI && window.sandboxAPI.getPrometheusMetrics) {
        const metrics = await window.sandboxAPI.getPrometheusMetrics();
        setMetricsText(metrics);
      }
    } catch (error) {
      setMetricsText(`Error fetching metrics: ${error}`);
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  const handleClearAlerts = () => {
    setAlerts('');
  };

  const latestData = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  // Show "No Active Process" card when not running
  if (!isRunning && chartData.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Active Sandbox Process
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md">
              Execute a command in the Execute tab to start real-time monitoring. CPU and memory metrics will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className="bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isRunning ? 'bg-green-100 dark:bg-green-900/30 shadow-lg shadow-green-500/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
                <svg className={`w-7 h-7 ${isRunning ? 'text-green-600 dark:text-green-400 animate-gentlePulse' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <CardTitle className="text-xl">
                  {isRunning ? 'Process Monitoring Active' : 'Monitoring Paused'}
                </CardTitle>
                <CardDescription>
                  {isRunning 
                    ? `Real-time metrics • ${chartData.length} data points collected`
                    : 'Showing last captured data'}
                </CardDescription>
              </div>
            </div>
            {latestData && (
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">CPU Usage</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
                    {latestData.cpu.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Memory</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
                    {latestData.memory.toFixed(0)} KB
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPU Chart */}
        <Card className="hover-scale transition-smooth">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
              CPU Usage
            </CardTitle>
            <CardDescription>Real-time CPU percentage (0-100%)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" opacity={0.5} />
                <XAxis 
                  dataKey="time" 
                  className="text-xs text-gray-600 dark:text-gray-400"
                  tick={{ fill: 'currentColor', fontSize: 11 }}
                  stroke="currentColor"
                />
                <YAxis 
                  className="text-xs text-gray-600 dark:text-gray-400"
                  tick={{ fill: 'currentColor', fontSize: 11 }}
                  domain={[0, 100]}
                  stroke="currentColor"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  labelStyle={{ fontWeight: 'bold', color: '#374151' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="cpu" 
                  stroke="#3b82f6" 
                  fill="url(#cpuGradient)"
                  strokeWidth={2.5}
                  isAnimationActive={true}
                  animationDuration={300}
                  name="CPU %"
                />
                <Brush dataKey="time" height={30} stroke="#3b82f6" fill="rgba(59, 130, 246, 0.1)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Memory Chart */}
        <Card className="hover-scale transition-smooth">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
              Memory Usage
            </CardTitle>
            <CardDescription>Real-time memory consumption in KB</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="memoryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" opacity={0.5} />
                <XAxis 
                  dataKey="time" 
                  className="text-xs text-gray-600 dark:text-gray-400"
                  tick={{ fill: 'currentColor', fontSize: 11 }}
                  stroke="currentColor"
                />
                <YAxis 
                  className="text-xs text-gray-600 dark:text-gray-400"
                  tick={{ fill: 'currentColor', fontSize: 11 }}
                  stroke="currentColor"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  labelStyle={{ fontWeight: 'bold', color: '#374151' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="memory" 
                  stroke="#10b981" 
                  fill="url(#memoryGradient)"
                  strokeWidth={2.5}
                  isAnimationActive={true}
                  animationDuration={300}
                  name="Memory KB"
                />
                <Brush dataKey="time" height={30} stroke="#10b981" fill="rgba(16, 185, 129, 0.1)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      <Card className="hover-scale transition-smooth">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Alerts & Anomalies
              </CardTitle>
              <CardDescription>CPU and memory threshold violations detected by alertd</CardDescription>
            </div>
            <div className="flex gap-2">
              {alerts && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAlerts}
                  className="h-9"
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleGetAlerts}
                disabled={isLoadingAlerts}
                className="h-9"
              >
                {isLoadingAlerts ? (
                  <>
                    <svg className="w-4 h-4 mr-1.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Loading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Fetch Alerts
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-64 overflow-auto backdrop-blur-sm">
            <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
              {alerts || 'No alerts fetched yet. Click "Fetch Alerts" to retrieve alert data from the monitoring system.'}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Prometheus Metrics */}
      <Card className="hover-scale transition-smooth">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Prometheus Metrics
              </CardTitle>
              <CardDescription>Metrics in Prometheus exposition format</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshMetrics}
              disabled={isLoadingMetrics}
              className="h-9"
            >
              {isLoadingMetrics ? (
                <>
                  <svg className="w-4 h-4 mr-1.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Loading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Metrics
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900 border border-gray-700 rounded-lg p-4 h-96 overflow-auto backdrop-blur-sm">
            <pre className="text-xs text-green-400 dark:text-green-300 whitespace-pre-wrap font-mono leading-relaxed">
              {metricsText || '# No metrics loaded. Click "Refresh Metrics" to fetch current metrics from the exporter.\n# Metrics will appear in Prometheus exposition format.'}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonitoringDashboard;
