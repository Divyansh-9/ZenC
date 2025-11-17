import React from 'react';
import { WifiOff } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Switch } from './ui/switch';

interface NetworkControlsProps {
  isNetworkDisabled: boolean;
  onNetworkDisabledChange: (disabled: boolean) => void;
  disabled: boolean;
}

const NetworkControls: React.FC<NetworkControlsProps> = ({
  isNetworkDisabled,
  onNetworkDisabledChange,
  disabled,
}) => {
  return (
    <Card>
    
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WifiOff className="w-6 h-6 text-red-600" />
            Network Restrictions
          </CardTitle>
        <CardDescription>
          Launches the process in an isolated network namespace, disabling all incoming and outgoing internet access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Disable Network Access
          </label>
          <Switch
            checked={isNetworkDisabled}
            onCheckedChange={onNetworkDisabledChange}
            disabled={disabled}
          />
        </div>

        {isNetworkDisabled && (
          <div className="space-y-3 animate-fadeIn pt-2">
            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">How it works:</h4>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Uses Linux network namespaces (<code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-800 rounded font-mono">unshare -n</code>)</li>
                <li>• Process runs with no network interfaces</li>
                <li>• All network calls fail (localhost, internet, etc.)</li>
                <li>• Works on native Linux and WSL</li>
              </ul>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1">Requirements:</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Requires <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900 rounded font-mono">unshare</code> utility (util-linux package)
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NetworkControls;
