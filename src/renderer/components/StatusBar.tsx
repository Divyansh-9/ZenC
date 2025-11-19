import React from 'react';
import { Badge } from './ui/badge';
import { Shield, WifiOff, Activity, Cpu } from 'lucide-react';
import { usePerformance } from '../contexts/PerformanceContext';
import { useAdaptiveStyles } from '../lib/adaptive-styles';

interface SystemInfo {
  platform: string;
  isWindows: boolean;
  sandboxPath: string;
}

interface StatusBarProps {
  isRunning: boolean;
  systemInfo: SystemInfo | null;
  isJailEnabled: boolean;
  isNetworkDisabled: boolean;
}

const StatusBar: React.FC<StatusBarProps> = ({
  isRunning,
  systemInfo,
  isJailEnabled,
  isNetworkDisabled,
}) => {
  const { profile } = usePerformance();
  const styles = useAdaptiveStyles(profile);

  const statusBarBg = styles?.statusBarBg || 'bg-white/80 dark:bg-gray-800/80';
  const pulse = styles?.pulse || '';

  return (
    <footer className={`fixed bottom-0 left-0 right-0 ${statusBarBg} border-t-2 border-navy-500 dark:border-gold-500 py-2 px-6 z-50 shadow-2xl`}>
      <div className="container mx-auto max-w-7xl flex justify-between items-center text-sm">
        {/* Left: Status Indicators */}
        <div className="flex items-center gap-4">
          {/* Execution Status */}
          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${isRunning ? 'text-green-500' : 'text-slate-400'}`} />
            <span className={`font-semibold ${isRunning ? 'text-green-600 dark:text-green-400' : 'text-slate-600 dark:text-slate-400'}`}>
              {isRunning ? 'EXECUTING' : 'STANDBY'}
            </span>
            {isRunning && (
              <span className={`ml-1 w-2 h-2 bg-green-500 rounded-full ${pulse}`}></span>
            )}
          </div>

          {/* Security Controls Active */}
          {(isJailEnabled || isNetworkDisabled) && (
            <div className="h-4 w-px bg-slate-300 dark:bg-slate-600"></div>
          )}

          {/* File Jail Status */}
          {isJailEnabled && (
            <div className="flex items-center gap-2 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded border border-amber-400 dark:border-amber-600">
              <Shield className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                JAIL ENFORCED
              </span>
            </div>
          )}

          {/* Network Isolation Status */}
          {isNetworkDisabled && (
            <div className="flex items-center gap-2 px-2 py-1 bg-red-100 dark:bg-red-900/30 rounded border border-red-400 dark:border-red-600">
              <WifiOff className="w-3 h-3 text-red-600 dark:text-red-400" />
              <span className="text-xs font-bold text-red-700 dark:text-red-300">
                NETWORK ISOLATED
              </span>
            </div>
          )}

          {/* Platform Info */}
          {systemInfo && (
            <>
              <div className="h-4 w-px bg-slate-300 dark:bg-slate-600"></div>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {systemInfo.isWindows ? '🪟 Windows/WSL' : '🐧 Linux/Native'}
              </span>
            </>
          )}
        </div>

        {/* Right: Performance & Version */}
        <div className="flex items-center gap-4 text-xs">
          {/* Performance Mode */}
          {profile && (
            <div className="flex items-center gap-2 px-2 py-1 bg-navy-100 dark:bg-navy-900/30 rounded border border-navy-400 dark:border-navy-600">
              <svg className="w-3 h-3 text-navy-600 dark:text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="font-bold text-navy-700 dark:text-gold-300 uppercase">
                {profile.tier === 'ultra' && '⚡ ULTRA'}
                {profile.tier === 'high' && '🚀 HIGH'}
                {profile.tier === 'medium' && '⚙️ BALANCED'}
                {profile.tier === 'low' && '🔋 ECO'}
                {profile.tier === 'potato' && '🥔 SAVER'}
              </span>
            </div>
          )}

          {/* Version */}
          <div className="font-mono font-bold text-slate-700 dark:text-slate-300">
            ZenCube v3.0.0
          </div>
        </div>
      </div>
    </footer>
  );
};

export default StatusBar;
