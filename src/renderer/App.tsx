import React, { useState, useEffect, useRef } from 'react';
import TerminalOutput from './components/TerminalOutput';
import ResourceLimits from './components/ResourceLimits';
import CommandInput from './components/CommandInput';
import Header from './components/Header';
import FileJailControls from './components/FileJailControls';
import NetworkControls from './components/NetworkControls';
import MonitoringDashboard from './components/MonitoringDashboard';
import { AIInsights } from './components/AIInsights';
import StatusBar from './components/StatusBar';
import { PerformanceProvider } from './contexts/PerformanceContext';
import { SandboxAPI } from '../preload/preload';
import { executionService } from './services/executionService';
import TerminalSession from './services/terminalSession';
import { chooseGenerationMode, generateSimulatedAnalysis, generateTerminalLines } from './components/anomaly-utils';

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
  const [darkMode, setDarkMode] = useState(true); // Default dark mode
  const [isRunning, setIsRunning] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('execute');
  
  const [cpuLimit, setCpuLimit] = useState<number | undefined>(5);
  const [memLimit, setMemLimit] = useState<number | undefined>(256);
  const [procLimit, setProcLimit] = useState<number | undefined>(undefined);
  const [fileSizeLimit, setFileSizeLimit] = useState<number | undefined>(undefined);

  const [isJailEnabled, setIsJailEnabled] = useState<boolean>(false);
  const [jailPath, setJailPath] = useState<string>('');
  const [isNetworkDisabled, setIsNetworkDisabled] = useState<boolean>(false);

  const [sessionId, setSessionId] = useState<string>('default-session');
  const currentSessionId = useRef<string>('default-session');

  // Expose terminalSession to global window for auto-stop functionality
  useEffect(() => {
    (window as any).terminalSession = TerminalSession;
  }, []);

  useEffect(() => {
    window.sandboxAPI.getSystemInfo().then(setSystemInfo);

    window.sandboxAPI.onOutput((data) => {
      const output = data.data;
      const line = {
        id: `real-${Date.now()}-${Math.random()}`,
        ts: Date.now(),
        text: output,
        stream: data.type as 'stdout' | 'stderr'
      };
      TerminalSession.pushLines(currentSessionId.current, line);
    });

    window.sandboxAPI.onExit((data) => {
      setIsRunning(false);
      TerminalSession.setRunning(currentSessionId.current, false);
      
      // Route final output through terminal session manager
      if (data.finalStdout && data.finalStdout.length > 0) {
        TerminalSession.pushLines(currentSessionId.current, {
          id: `exit-out-${Date.now()}`,
          ts: Date.now(),
          text: data.finalStdout,
          stream: 'stdout'
        });
      }
      if (data.finalStderr && data.finalStderr.length > 0) {
        TerminalSession.pushLines(currentSessionId.current, {
          id: `exit-err-${Date.now()}`,
          ts: Date.now(),
          text: data.finalStderr,
          stream: 'stderr'
        });
      }
      
      const exitMsg = data.signal
        ? `\n\x1b[33m[Process terminated with signal: ${data.signal}]\x1b[0m\n`
        : `\n\x1b[32m[Process exited with code: ${data.code}]\x1b[0m\n`;
      
      TerminalSession.pushLines(currentSessionId.current, {
        id: `exit-msg-${Date.now()}`,
        ts: Date.now(),
        text: exitMsg,
        stream: 'stdout'
      });
    });

    window.sandboxAPI.onError((data) => {
      setIsRunning(false);
      TerminalSession.setRunning(currentSessionId.current, false);
      TerminalSession.pushLines(currentSessionId.current, {
        id: `error-${Date.now()}`,
        ts: Date.now(),
        text: `\x1b[31m[Error: ${data.message}]\x1b[0m\n`,
        stream: 'stderr'
      });
    });

    window.sandboxAPI.onFileJailViolation((data) => {
      TerminalSession.pushLines(currentSessionId.current, {
        id: `jail-${Date.now()}`,
        ts: Date.now(),
        text: `\x1b[31m[FILE JAIL VIOLATION] Access to: ${data.path}\x1b[0m\n`,
        stream: 'stderr'
      });
    });
  }, []);

  const handleExecute = async (command: string, args: string[]) => {
    if (!command.trim()) return;

    const newSessionId = `session-${Date.now()}`;
    setSessionId(newSessionId);
    currentSessionId.current = newSessionId;
    
    TerminalSession.initSession(newSessionId, { command });
    TerminalSession.clear(newSessionId);
    TerminalSession.setRunning(newSessionId, true);
    
    setIsRunning(true);

    // Register process in Execution Manager
    const processId = executionService.startProcess({
      id: `exec-${Date.now()}`,
      executable: command,
      args,
      metadata: {
        cpuLimit,
        memLimit,
        procLimit,
        fileSizeLimit,
        isJailEnabled,
        jailPath,
        isNetworkDisabled
      }
    });

    try {
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

      if (!result.success) {
        TerminalSession.pushLines(newSessionId, {
          id: `start-error-${Date.now()}`,
          ts: Date.now(),
          text: `\x1b[31m[Error] ${result.message}\x1b[0m\n`,
          stream: 'stderr'
        });
        setIsRunning(false);
        TerminalSession.setRunning(newSessionId, false);
        executionService.stopProcess(processId, 'error');
      } else {
        // Generate simulated terminal output based on executable type after 2-4 seconds
        const delay = 2000 + Math.random() * 2000;
        setTimeout(() => {
          const mode = chooseGenerationMode(command);
          const terminalLines = generateTerminalLines(Date.now(), mode, command);
          
          // Write simulated telemetry/alerts to terminal
          TerminalSession.pushLines(newSessionId, terminalLines);
        }, delay);
      }
    } catch (error) {
      TerminalSession.pushLines(newSessionId, {
        id: `catch-error-${Date.now()}`,
        ts: Date.now(),
        text: `\x1b[31m[Error] ${error instanceof Error ? error.message : 'Unknown error'}\x1b[0m\n`,
        stream: 'stderr'
      });
      setIsRunning(false);
      TerminalSession.setRunning(newSessionId, false);
      executionService.errorProcess(processId, error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleStop = async () => {
    await window.sandboxAPI.stopSandbox();
    setIsRunning(false);
    TerminalSession.setRunning(currentSessionId.current, false);
    
    // Stop all running processes in Execution Manager
    const runningProcesses = executionService.getRunningProcesses();
    runningProcesses.forEach(process => {
      executionService.stopProcess(process.id, 'user-stop');
    });
  };

  const handleClear = () => {
    TerminalSession.clear(currentSessionId.current);
  };

  return (
    <PerformanceProvider>
      <div className={darkMode ? 'dark' : ''}>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
        <Header 
          darkMode={darkMode} 
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          systemInfo={systemInfo}
        />
        
        {/* Professional Tab Navigation - Clear Hierarchy */}
        <div className="bg-gradient-to-r from-navy-700 via-navy-600 to-navy-700 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border-b-3 border-gold-500">
          <div className="container mx-auto px-6 max-w-7xl">
            <nav className="flex space-x-2" aria-label="Main Navigation" role="tablist">
              <button
                onClick={() => setActiveTab('execute')}
                role="tab"
                aria-selected={activeTab === 'execute'}
                className={`px-8 py-4 font-bold text-sm uppercase tracking-wide border-b-4 transition-all duration-200 ${
                  activeTab === 'execute'
                    ? 'border-gold-500 text-white bg-navy-800 dark:bg-slate-700 shadow-lg'
                    : 'border-transparent text-navy-200 dark:text-slate-400 hover:text-white hover:bg-navy-800/50 dark:hover:bg-slate-800/50'
                }`}
              >
                <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Execute Command
              </button>
              
              <button
                onClick={() => setActiveTab('security')}
                role="tab"
                aria-selected={activeTab === 'security'}
                className={`px-8 py-4 font-bold text-sm uppercase tracking-wide border-b-4 transition-all duration-200 ${
                  activeTab === 'security'
                    ? 'border-gold-500 text-white bg-navy-800 dark:bg-slate-700 shadow-lg'
                    : 'border-transparent text-navy-200 dark:text-slate-400 hover:text-white hover:bg-navy-800/50 dark:hover:bg-slate-800/50'
                }`}
              >
                <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Security Controls
                {(isJailEnabled || isNetworkDisabled) && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-black bg-gold-500 text-navy-900 rounded shadow-md">ACTIVE</span>
                )}
              </button>
              
              <button
                onClick={() => setActiveTab('monitoring')}
                role="tab"
                aria-selected={activeTab === 'monitoring'}
                className={`px-8 py-4 font-bold text-sm uppercase tracking-wide border-b-4 transition-all duration-200 ${
                  activeTab === 'monitoring'
                    ? 'border-gold-500 text-white bg-navy-800 dark:bg-slate-700 shadow-lg'
                    : 'border-transparent text-navy-200 dark:text-slate-400 hover:text-white hover:bg-navy-800/50 dark:hover:bg-slate-800/50'
                }`}
              >
                <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Real-Time Metrics
                {isRunning && (
                  <span className="ml-2 w-2 h-2 bg-green-400 rounded-full inline-block animate-pulse shadow-lg shadow-green-400/50"></span>
                )}
              </button>
              
              <button
                onClick={() => setActiveTab('ai-insights')}
                role="tab"
                aria-selected={activeTab === 'ai-insights'}
                className={`px-8 py-4 font-bold text-sm uppercase tracking-wide border-b-4 transition-all duration-200 ${
                  activeTab === 'ai-insights'
                    ? 'border-gold-500 text-white bg-navy-800 dark:bg-slate-700 shadow-lg'
                    : 'border-transparent text-navy-200 dark:text-slate-400 hover:text-white hover:bg-navy-800/50 dark:hover:bg-slate-800/50'
                }`}
              >
                <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI Anomaly Detection
              </button>
            </nav>
          </div>
        </div>

        <main className="container mx-auto px-6 py-8 max-w-7xl flex-1">
          <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${activeTab !== 'execute' ? 'hidden' : ''}`}>
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

            <div className="lg:col-span-2">
              <TerminalOutput 
                sessionId={sessionId}
                onClear={handleClear}
                isRunning={isRunning}
              />
            </div>
          </div>

          <div className={`max-w-6xl mx-auto space-y-6 ${activeTab !== 'security' ? 'hidden' : ''}`}>
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-l-4 border-gold-500 p-5 shadow-lg">
              <div className="flex gap-4">
                <svg className="w-7 h-7 text-gold-600 dark:text-gold-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div>
                  <h3 className="text-base font-black text-navy-900 dark:text-gold-300 mb-2 uppercase tracking-wide">
                    ⚠️ Isolation Enforcement Layer
                  </h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    Configure filesystem and network isolation boundaries before execution. 
                    Changes apply to the <span className="font-bold text-navy-700 dark:text-gold-400">next sandbox instance</span> only.
                    Active processes remain unaffected.
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

          <div className={activeTab !== 'monitoring' ? 'hidden' : ''}>
            <MonitoringDashboard isRunning={isRunning} />
          </div>

          <div className={activeTab !== 'ai-insights' ? 'hidden' : ''}>
            <AIInsights />
          </div>
        </main>

        <StatusBar
          isRunning={isRunning}
          systemInfo={systemInfo}
          isJailEnabled={isJailEnabled}
          isNetworkDisabled={isNetworkDisabled}
        />
        </div>
      </div>
    </PerformanceProvider>
  );
}

export default App;

