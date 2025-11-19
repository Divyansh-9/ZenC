import React, { useState, useEffect } from 'react';
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

const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({ isRunning }) => {
  const [chartData, setChartData] = useState<MonitoringData[]>([]);
  const [alerts, setAlerts] = useState<string>('');
  const [metricsText, setMetricsText] = useState<string>('');
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);

  useEffect(() => {
    // Register IPC listener for monitoring data
    if (window.sandboxAPI && window.sandboxAPI.onMonitoringData) {
      window.sandboxAPI.onMonitoringData((data: { cpu: number; memory: number }) => {
        const now = Date.now();
        const time = new Date(now).toLocaleTimeString();
        
        setChartData((currentData) => {
          const newData = [...currentData, { timestamp: now, cpu: data.cpu, memory: data.memory, time }];
          // Keep only last 100 data points
          if (newData.length > 100) {
            newData.shift();
          }
          return newData;
        });
      });
    }

    // Clear chart when not running
    if (!isRunning) {
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

  const latestData = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isRunning ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                <svg className={`w-6 h-6 ${isRunning ? 'text-green-600 dark:text-green-400 animate-pulse' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <CardTitle>
                  {isRunning ? 'Process Monitoring Active' : 'No Active Process'}
                </CardTitle>
                <CardDescription>
                  {isRunning ? 'Real-time metrics streaming every second' : 'Execute a command to start monitoring'}
                </CardDescription>
              </div>
            </div>
            {latestData && (
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">CPU Usage</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {latestData.cpu.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Memory</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {latestData.memory.toFixed(0)} MB
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* CPU Chart */}
      <Card>
        <CardHeader>
          <CardTitle>CPU Usage Over Time</CardTitle>
          <CardDescription>Real-time CPU percentage (0-100%)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis 
                dataKey="time" 
                className="text-xs text-gray-600 dark:text-gray-400"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis 
                className="text-xs text-gray-600 dark:text-gray-400"
                tick={{ fill: 'currentColor' }}
                domain={[0, 100]}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem'
                }}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="cpu" 
                stroke="#3b82f6" 
                fill="url(#cpuGradient)"
                strokeWidth={2}
                isAnimationActive={true}
                name="CPU %"
              />
              <Brush dataKey="time" height={30} stroke="#3b82f6" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Memory Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Memory Usage Over Time</CardTitle>
          <CardDescription>Real-time memory consumption in MB</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="memoryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis 
                dataKey="time" 
                className="text-xs text-gray-600 dark:text-gray-400"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis 
                className="text-xs text-gray-600 dark:text-gray-400"
                tick={{ fill: 'currentColor' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem'
                }}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="memory" 
                stroke="#10b981" 
                fill="url(#memoryGradient)"
                strokeWidth={2}
                isAnimationActive={true}
                name="Memory MB"
              />
              <Brush dataKey="time" height={30} stroke="#10b981" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Alerts Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Alerts & Anomalies</CardTitle>
              <CardDescription>CPU and memory threshold violations detected by alertd</CardDescription>
            </div>
            <Button
              onClick={handleGetAlerts}
              disabled={isLoadingAlerts}
              size="sm"
            >
              {isLoadingAlerts ? 'Loading...' : 'Fetch Alerts'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-64 overflow-auto">
            <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
              {alerts || 'No alerts fetched yet. Click "Fetch Alerts" to retrieve alert data.'}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Prometheus Metrics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Prometheus Metrics</CardTitle>
              <CardDescription>Metrics in Prometheus exposition format</CardDescription>
            </div>
            <Button
              onClick={handleRefreshMetrics}
              disabled={isLoadingMetrics}
              size="sm"
            >
              {isLoadingMetrics ? 'Loading...' : 'Refresh Metrics'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-96 overflow-auto">
            <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
              {metricsText || 'No metrics loaded. Click "Refresh Metrics" to fetch current metrics from the exporter.'}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonitoringDashboard;
