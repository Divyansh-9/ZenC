import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RefreshCw, AlertTriangle, Activity, Trash2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';

interface MonitoringData {
  timestamp: number;
  cpu: number;
  memory: number;
  time: string;
}

interface MonitoringDashboardProps {
  isRunning: boolean;
}

const MonitoringDashboard: React.FC<MonitoringDashboardProps> = React.memo(({ isRunning }) => {
  const [chartData, setChartData] = useState<MonitoringData[]>([]);
  const [alerts, setAlerts] = useState<string>('');
  const [metricsText, setMetricsText] = useState<string>('');
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);

  useEffect(() => {
    // Register IPC listener for BATCHED monitoring data - ONLY ONCE
    console.log('[MonitoringDashboard] Registering monitoring-data-batch listener');
    
    if (!window.sandboxAPI || !window.sandboxAPI.onMonitoringDataBatch) {
      console.error('[MonitoringDashboard] sandboxAPI.onMonitoringDataBatch not available!');
      return;
    }
    
    // Listen for batches of data from the worker thread
    window.sandboxAPI.onMonitoringDataBatch((batch: Array<{ cpu: number; memory: number; timestamp: number }>) => {
      console.log(`[MonitoringDashboard] Received batch with ${batch.length} data points`);
      
      setChartData((currentData) => {
        // Add all batch items with formatted timestamps
        const newPoints = batch.map(point => ({
          timestamp: point.timestamp,
          cpu: point.cpu,
          memory: point.memory,
          time: new Date(point.timestamp).toLocaleTimeString()
        }));
        
        const newData = [...currentData, ...newPoints];
        
        // Keep only last 60 data points
        while (newData.length > 60) {
          newData.shift();
        }
        
        return newData;
      });
    });
    
    // No cleanup needed - IPC listener persists for app lifetime
  }, []); // Empty array - register ONCE on mount

  // Clear chart data when process stops
  useEffect(() => {
    if (!isRunning) {
      console.log('[MonitoringDashboard] Process stopped, clearing chart data');
      setChartData([]);
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

  // Show "No Active Process" message when not running
  if (!isRunning && chartData.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 flex items-center justify-center mb-6">
              <Activity className="w-12 h-12 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Run a process to begin monitoring
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
      {/* Professional Grid Layout: 3 columns, 2 rows */}
      <div className="grid grid-cols-3 grid-rows-2 gap-6">
        
        {/* CPU Chart - spans 2 columns, 1 row */}
        <div className="col-span-2 row-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                CPU Usage
              </CardTitle>
              <CardDescription>
                {latestData ? `Current: ${latestData.cpu.toFixed(1)}%` : 'Waiting for data...'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-700" />
                    <XAxis 
                      dataKey="time" 
                      className="text-xs text-gray-600 dark:text-gray-400"
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      className="text-xs text-gray-600 dark:text-gray-400"
                      tick={{ fontSize: 12 }}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                        borderRadius: '8px',
                        border: '1px solid rgba(75, 85, 99, 0.5)',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      }}
                      labelStyle={{ color: '#e5e7eb' }}
                      itemStyle={{ color: '#93c5fd' }}
                    />
                    <Legend />
                    <Brush 
                      dataKey="time" 
                      height={30} 
                      stroke="#3b82f6"
                      fill="rgba(59, 130, 246, 0.1)"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="cpu" 
                      stroke="#3b82f6" 
                      fill="url(#cpuGradient)"
                      strokeWidth={2}
                      isAnimationActive={true}
                      animationDuration={300}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                  Run a process to begin monitoring
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Memory Chart - spans 1 column, 1 row */}
        <div className="col-span-1 row-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-600" />
                Memory
              </CardTitle>
              <CardDescription>
                {latestData ? `${latestData.memory.toFixed(1)} MB` : 'Waiting...'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-700" />
                    <XAxis 
                      dataKey="time" 
                      className="text-xs text-gray-600 dark:text-gray-400"
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis 
                      className="text-xs text-gray-600 dark:text-gray-400"
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                        borderRadius: '8px',
                        border: '1px solid rgba(75, 85, 99, 0.5)',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      }}
                      labelStyle={{ color: '#e5e7eb' }}
                      itemStyle={{ color: '#6ee7b7' }}
                    />
                    <Brush 
                      dataKey="time" 
                      height={25} 
                      stroke="#10b981"
                      fill="rgba(16, 185, 129, 0.1)"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="memory" 
                      stroke="#10b981" 
                      fill="url(#memGradient)"
                      strokeWidth={2}
                      isAnimationActive={true}
                      animationDuration={300}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
                  No data
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alerts Log - spans 1 column, 1 row */}
        <div className="col-span-1 row-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Alerts & Anomalies
              </CardTitle>
              <CardDescription>
                System violations and threshold breaches
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGetAlerts}
                  disabled={isLoadingAlerts}
                  className="flex-1"
                >
                  {isLoadingAlerts ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Fetch
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClearAlerts}
                  disabled={!alerts}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </div>
              <div className="max-h-64 overflow-auto rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3 border border-gray-200 dark:border-gray-700">
                <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
                  {alerts || 'No alerts yet. Click "Fetch" to load alert logs.'}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Prometheus Metrics - spans 3 columns, 1 row */}
        <div className="col-span-3 row-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-purple-600" />
                    Prometheus Metrics
                  </CardTitle>
                  <CardDescription>
                    Real-time metrics in Prometheus format
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={handleRefreshMetrics}
                  disabled={isLoadingMetrics}
                >
                  {isLoadingMetrics ? (
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-5 h-5 mr-2" />
                  )}
                  Refresh Metrics
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-96 overflow-auto rounded-lg bg-gradient-to-br from-gray-900 to-gray-800 p-4 border border-gray-700">
                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                  {metricsText || '# Click "Refresh Metrics" to fetch Prometheus data\n# Metrics will appear here in Prometheus exposition format'}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
});

MonitoringDashboard.displayName = 'MonitoringDashboard';

export default MonitoringDashboard;
