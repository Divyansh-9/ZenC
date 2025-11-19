import React, { useState } from 'react';
import { Play, StopCircle, Folder, Cpu, Database, Network, FileText, Loader2, GitFork, Zap } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';

interface CommandInputProps {
  onExecute: (command: string, args: string[]) => void;
  isRunning: boolean;
  onStop: () => void;
}

const QUICK_COMMANDS = [
  { label: 'CPU Test', icon: Cpu, command: 'ui_test_programs/bin/infinite_loop', args: [] },
  { label: 'Memory Test', icon: Database, command: 'ui_test_programs/bin/memory_hog', args: [] },
  { label: 'Process Test', icon: GitFork, command: 'ui_test_programs/bin/fork_bomb', args: [] },
  { label: 'File Write Test', icon: FileText, command: 'ui_test_programs/bin/file_writer', args: [] },
  { label: 'Network Test', icon: Network, command: 'ui_test_programs/bin/network_test', args: [] },
];

const CommandInput: React.FC<CommandInputProps> = ({ onExecute, isRunning, onStop }) => {
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');

  const handleExecute = () => {
    if (!command.trim()) return;
    
    const argArray = args.trim() ? args.trim().split(/\s+/) : [];
    onExecute(command, argArray);
  };

  const handleQuickCommand = (cmd: string, cmdArgs: string[]) => {
    setCommand(cmd);
    setArgs(cmdArgs.join(' '));
    onExecute(cmd, cmdArgs);
  };

  const handleBrowse = async () => {
    const path = await window.sandboxAPI.openFileDialog();
    if (path) {
      setCommand(path);
    }
  };

  return (
    <div>
      <Card className="bg-gradient-to-br from-navy-900 to-slate-900 shadow-xl border-2 border-gold-600/40">
        <CardHeader className="pb-3 border-b border-gold-600/30">
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-white">
            <Play className="w-5 h-5 text-gold-400" />
            Command Execution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gold-300 mb-2">
              Executable Path
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="ui_test_programs/bin/infinite_loop"
                disabled={isRunning}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="default"
                onClick={handleBrowse}
                disabled={isRunning}
                className="px-3"
              >
                <Folder className="w-5 h-5 mr-1" />
                Browse
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gold-300 mb-2">
              Arguments (space-separated)
            </label>
            <Input
              type="text"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder="arg1 arg2 arg3"
              disabled={isRunning}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleExecute}
              disabled={isRunning || !command.trim()}
              className="flex-1 bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-400 text-navy-900 font-bold shadow-lg disabled:opacity-50 h-11"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Execute
                </>
              )}
            </Button>

            <Button
              variant="destructive"
              onClick={onStop}
              disabled={!isRunning}
              className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold shadow-lg disabled:opacity-50 h-11"
            >
              <StopCircle className="w-5 h-5 mr-2" />
              Stop
            </Button>
          </div>

          <div className="pt-4 border-t border-gold-600/30">
            <h3 className="text-sm font-semibold text-gold-300 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-gold-400" />
              Quick Commands
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {QUICK_COMMANDS.map((qc, idx) => {
                const IconComponent = qc.icon;
                return (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickCommand(qc.command, qc.args)}
                    disabled={isRunning}
                    className="justify-start w-full transition-colors bg-slate-800 hover:bg-slate-700 border-gold-600/30 hover:border-gold-500 text-gray-200 hover:text-white"
                  >
                    <IconComponent className="w-4 h-4 mr-2" />
                    {qc.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CommandInput;
