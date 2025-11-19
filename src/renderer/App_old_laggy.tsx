import React, { useState, useEffect, useRef } from 'react';
import Terminal from './components/Terminal';
import ResourceLimits from './components/ResourceLimits';
import CommandInput from './components/CommandInput';
import Header from './components/Header';
import FileJailControls from './components/FileJailControls';
import NetworkControls from './components/NetworkControls';
import MonitoringDashboard from './components/MonitoringDashboard';
import { AIInsights } from './components/AIInsights';
import StatusBar from './components/StatusBar';
import { SandboxAPI } from '../preload/preload';

// Extend the Window interface to include our API
declare global {
  interface Window {
    sandboxAPI: SandboxAPI;
  }
}

type TabType = 'execute' | 'security' | 'monitoring' | 'ai-insights';

interface SystemInfo {
  platform: string;
  isWindows: boolean;
  sandboxPath: string;
}

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('execute');
  
  // Resource limits state
  const [cpuLimit, setCpuLimit] = useState<number | undefined>(5);
  const [memLimit, setMemLimit] = useState<number | undefined>(256);
  const [procLimit, setProcLimit] = useState<number | undefined>(undefined);
  const [fileSizeLimit, setFileSizeLimit] = useState<number | undefined>(undefined);

  // Security features state
  const [isJailEnabled, setIsJailEnabled] = useState<boolean>(false);
  const [jailPath, setJailPath] = useState<string>('');
  const [isNetworkDisabled, setIsNetworkDisabled] = useState<boolean>(false);

  const terminalRef = useRef<{ clear: () => void; write: (data: string) => void }>(null);

  useEffect(() => {
    // Load system information
    window.sandboxAPI.getSystemInfo().then(setSystemInfo);

    // Set up listeners for sandbox output
    window.sandboxAPI.onOutput((data) => {
      const output = data.data;
      if (terminalRef.current) {
        if (data.type === 'stderr') {
          terminalRef.current.write(`\x1b[31m${output}\x1b[0m`); // Red for stderr
        } else {
          terminalRef.current.write(output);
        }
      }
    });

    window.sandboxAPI.onExit((data) => {
      setIsRunning(false);
      if (terminalRef.current) {
        // Write any final buffered output that might have been missed
        if (data.finalStdout && data.finalStdout.length > 0) {
          terminalRef.current.write(data.finalStdout);
        }
        if (data.finalStderr && data.finalStderr.length > 0) {
          terminalRef.current.write(`\x1b[31m${data.finalStderr}\x1b[0m`);
        }
        
        // Display exit status
        const exitMsg = data.signal
          ? `\n\x1b[33m[Process terminated with signal: ${data.signal}]\x1b[0m\n`
          : `\n\x1b[32m[Process exited with code: ${data.code}]\x1b[0m\n`;
        terminalRef.current.write(exitMsg);
      }
    });

    window.sandboxAPI.onError((data) => {
      setIsRunning(false);
      if (terminalRef.current) {
        terminalRef.current.write(`\x1b[31m[Error: ${data.message}]\x1b[0m\n`);
      }
    });

    // File jail violation listener
    window.sandboxAPI.onFileJailViolation((data) => {
      if (terminalRef.current) {
        terminalRef.current.write(`\x1b[31m[FILE JAIL VIOLATION] Access to: ${data.path}\x1b[0m\n`);
      }
    });
  }, []);

  const handleExecute = async (command: string, args: string[]) => {
    if (!command.trim()) {
      return;
    }

    setIsRunning(true);
    
    if (terminalRef.current) {
      terminalRef.current.write(`\x1b[36m$ ${command} ${args.join(' ')}\x1b[0m\n`);
    }

    const result = await window.sandboxAPI.executeSandbox({
      command,
      args,
      cpuLimit,
      memLimit,
      procLimit,
      fileSizeLimit,
      isJailEnabled,
      jailPath,
      isNetworkDisabled,
    });

    if (!result.success && terminalRef.current) {
      terminalRef.current.write(`\x1b[31m${result.message}\x1b[0m\n`);
      setIsRunning(false);
    }
  };

  const handleStop = async () => {
    const result = await window.sandboxAPI.stopSandbox();
    if (terminalRef.current) {
      if (result.success) {
        terminalRef.current.write(`\x1b[33m[Stopped by user]\x1b[0m\n`);
      } else {
        terminalRef.current.write(`\x1b[31m${result.message}\x1b[0m\n`);
      }
    }
    setIsRunning(false);
  };

  const handleClear = () => {
    if (terminalRef.current) {
      terminalRef.current.clear();
    }
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pb-16 backdrop-blur-lg">
        <Header 
          darkMode={darkMode} 
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          systemInfo={systemInfo}
        />
        
        {/* Tab Navigation */}
        <div className="bg-white/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 backdrop-blur-md">
          <div className="container mx-auto px-4 max-w-7xl">
            <nav className="flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('execute')}
                className={`${
                  activeTab === 'execute'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Execute
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`${
                  activeTab === 'security'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Security
                {(isJailEnabled || isNetworkDisabled) && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                    Active
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('monitoring')}
                className={`${
                  activeTab === 'monitoring'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Monitoring
                {isRunning && (
                  <span className="flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('ai-insights')}
                className={`${
                  activeTab === 'ai-insights'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI Insights
              </button>
            </nav>
          </div>
        </div>

        <main className="container mx-auto px-4 py-6 max-w-7xl">
            {/* Tab 1: Execute */}
            {activeTab === 'execute' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Panel - Controls */}
              <div className="lg:col-span-1 space-y-6">
                <CommandInput 
                  onExecute={handleExecute}
                  isRunning={isRunning}
                  onStop={handleStop}
                />
                
                <ResourceLimits
                  cpuLimit={cpuLimit}
                  memLimit={memLimit}
                  procLimit={procLimit}
                  fileSizeLimit={fileSizeLimit}
                  onCpuLimitChange={setCpuLimit}
                  onMemLimitChange={setMemLimit}
                  onProcLimitChange={setProcLimit}
                  onFileSizeLimitChange={setFileSizeLimit}
                  disabled={isRunning}
                />
              </div>

              {/* Right Panel - Terminal */}
              <div className="lg:col-span-2">
                <Terminal 
                  ref={terminalRef}
                  onClear={handleClear}
                  isRunning={isRunning}
                />
              </div>
            </div>
          )}

          {/* Tab 2: Security */}
          {activeTab === 'security' && (
            <div className="max-w-6xl mx-auto space-y-6">
            
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 backdrop-blur-sm">
                <div className="flex gap-3">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                      Advanced Security Controls
                    </h3>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Configure security isolation layers before executing commands. Changes apply to next execution.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <FileJailControls
                  isJailEnabled={isJailEnabled}
                  jailPath={jailPath}
                  onJailEnabledChange={setIsJailEnabled}
                  onJailPathChange={setJailPath}
                  disabled={isRunning}
                />

                <NetworkControls
                  isNetworkDisabled={isNetworkDisabled}
                  onNetworkDisabledChange={setIsNetworkDisabled}
                  disabled={isRunning}
                />
              </div>
            </div>
          )}

          {/* Tab 3: Monitoring */}
          {activeTab === 'monitoring' && (
            <div>
              <MonitoringDashboard isRunning={isRunning} />
            </div>
          )}

          {/* Tab 4: AI Insights */}
          {activeTab === 'ai-insights' && (
            <div>
              <AIInsights isRunning={isRunning} />
            </div>
          )}
        </main>

        {/* StatusBar Footer */}
        <StatusBar
          isRunning={isRunning}
          systemInfo={systemInfo}
          isJailEnabled={isJailEnabled}
          isNetworkDisabled={isNetworkDisabled}
        />
      </div>
    </div>
  );
}

export default App;
