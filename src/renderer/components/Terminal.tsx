import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { Button } from './ui/button';
import { Card, CardHeader, CardContent } from './ui/card';

interface TerminalProps {
  onClear: () => void;
  isRunning: boolean;
}

export interface TerminalHandle {
  write: (data: string) => void;
  clear: () => void;
}

const Terminal = forwardRef<TerminalHandle, TerminalProps>(({ onClear, isRunning }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (terminalRef.current && !xtermRef.current) {
      const term = new XTerm({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: '"Cascadia Code", "Fira Code", "Courier New", monospace',
        theme: {
          background: 'rgba(30, 30, 30, 0.8)',
          foreground: '#d4d4d4',
          cursor: '#aeafad',
          black: '#000000',
          red: '#cd3131',
          green: '#0dbc79',
          yellow: '#e5e510',
          blue: '#2472c8',
          magenta: '#bc3fbc',
          cyan: '#11a8cd',
          white: '#e5e5e5',
          brightBlack: '#666666',
          brightRed: '#f14c4c',
          brightGreen: '#23d18b',
          brightYellow: '#f5f543',
          brightBlue: '#3b8eea',
          brightMagenta: '#d670d6',
          brightCyan: '#29b8db',
          brightWhite: '#e5e5e5',
        },
        rows: 30,
        cols: 100,
        scrollback: 1000,
        convertEol: true,
        allowTransparency: true,
      });

      term.open(terminalRef.current);
      term.writeln('\x1b[1;36mZenCube Terminal Ready\x1b[0m');
      term.writeln('\x1b[2mExecute commands using the controls on the left\x1b[0m');
      term.writeln('');

      xtermRef.current = term;
    }

    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, []);

  useImperativeHandle(ref, () => ({
    write: (data: string) => {
      if (xtermRef.current) {
        xtermRef.current.write(data);
      }
    },
    clear: () => {
      if (xtermRef.current) {
        xtermRef.current.clear();
        xtermRef.current.writeln('\x1b[1;36mZenCube Terminal Ready\x1b[0m');
        xtermRef.current.writeln('\x1b[2mExecute commands using the controls on the left\x1b[0m');
        xtermRef.current.writeln('');
      }
    },
  }));

  return (
    <Card className="overflow-hidden flex flex-col h-full">
      <CardHeader className="flex-row items-center justify-between py-3 space-y-0">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Terminal Output
          </h2>
          {isRunning && (
            <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Running
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-8"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Clear
        </Button>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <div 
          ref={terminalRef} 
          className="h-full p-2 bg-gradient-to-br from-gray-900/90 to-gray-800/90 dark:from-gray-950/90 dark:to-gray-900/90 backdrop-blur-sm overflow-auto"
          style={{ minHeight: '500px' }}
        />
      </CardContent>
    </Card>
  );
});

Terminal.displayName = 'Terminal';

export default Terminal;
