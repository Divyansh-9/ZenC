import React from 'react';
import { Shield, FolderSearch } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Switch } from './ui/switch';
import { Input } from './ui/input';
import { Button } from './ui/button';

interface FileJailControlsProps {
  isJailEnabled: boolean;
  jailPath: string;
  onJailEnabledChange: (enabled: boolean) => void;
  onJailPathChange: (path: string) => void;
  disabled: boolean;
}

const FileJailControls: React.FC<FileJailControlsProps> = ({
  isJailEnabled,
  jailPath,
  onJailEnabledChange,
  onJailPathChange,
  disabled,
}) => {
  const handleBrowse = async () => {
    const path = await window.sandboxAPI.openDirectoryDialog();
    if (path) {
      onJailPathChange(path);
    }
  };

  return (
    <Card>
    
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-yellow-600" />
            File Jail
          </CardTitle>
          <CardDescription>
            Restricts all file access to a specific 'safe' directory. Monitors for and alerts on any escape attempts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="jail-switch" className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Enable File Jail
            </label>
            <Switch
              checked={isJailEnabled}
              onCheckedChange={onJailEnabledChange}
              disabled={disabled}
            />
          </div>

          {isJailEnabled && (
            <div className="space-y-3 animate-fadeIn pt-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Jail Root Directory
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={jailPath}
                    onChange={(e) => onJailPathChange(e.target.value)}
                    placeholder="/home/user/safe-dir"
                    disabled={disabled || !isJailEnabled}
                    className="flex-1 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="default"
                    onClick={handleBrowse}
                    disabled={disabled || !isJailEnabled}
                    className="px-3"
                  >
                    <FolderSearch className="w-5 h-5 mr-1" />
                    Browse
                  </Button>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  The process will be restricted to accessing files within this directory tree.
                </p>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">How it works:</h4>
                <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Process CWD set to jail directory</li>
                  <li>• File descriptors monitored via /proc/{'{'}pid{'}'}/fd</li>
                  <li>• Safe paths whitelisted: /dev, /proc, /usr/lib, etc.</li>
                  <li>• Monitoring runs every 500ms</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
  );
};

export default FileJailControls;
