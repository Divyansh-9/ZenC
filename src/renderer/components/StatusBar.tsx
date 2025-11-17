import React from 'react';
import { Badge } from './ui/badge';
import { Shield, WifiOff, Activity } from 'lucide-react';

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
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 py-2 px-4 z-50">
      <div className="container mx-auto max-w-7xl flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-3">
          {/* Running Status */}
          <Badge variant={isRunning ? "success" : "secondary"} className="gap-1.5">
            <Activity className="w-3 h-3" />
            {isRunning ? 'Running' : 'Ready'}
          </Badge>

          {/* Platform Info */}
          {systemInfo && (
            <span className="text-xs">
              {systemInfo.isWindows ? '🪟 Windows (WSL)' : '🐧 Linux'}
            </span>
          )}

          {/* File Jail Status */}
          {isJailEnabled && (
            <Badge variant="warning" className="gap-1.5">
              <Shield className="w-3 h-3" />
              File Jail Active
            </Badge>
          )}

          {/* Network Status */}
          {isNetworkDisabled && (
            <Badge variant="destructive" className="gap-1.5">
              <WifiOff className="w-3 h-3" />
              Network Disabled
            </Badge>
          )}
        </div>

        <div className="text-xs font-medium">
          ZenCube v3.0.0
        </div>
      </div>
    </footer>
  );
};

export default StatusBar;
