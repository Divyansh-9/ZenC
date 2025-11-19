import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { Button } from './ui/button';
import { Card, CardHeader, CardContent } from './ui/card';
import { terminalSession } from '../services/terminalSession';

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
  const isInitializedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current && !xtermRef.current) {
      const term = new XTerm({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", "Courier New", monospace',
        theme: {
          background: '#0f172a',
          foreground: '#e2e8f0',
          cursor: '#d4af37',
          cursorAccent: '#1e293b',
          selectionBackground: '#3f72b640',
          black: '#1e293b',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#f59e0b',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#06b6d4',
          white: '#f1f5f9',
          brightBlack: '#475569',
          brightRed: '#f87171',
          brightGreen: '#4ade80',
          brightYellow: '#fbbf24',
          brightBlue: '#60a5fa',
          brightMagenta: '#c084fc',
          brightCyan: '#22d3ee',
          brightWhite: '#f8fafc',
        },
        rows: 28,
        cols: 100,
        scrollback: 5000,
        convertEol: true,
        allowTransparency: false,
        fontWeight: '500',
        fontWeightBold: '700',
      });

      term.open(terminalRef.current);
      
      xtermRef.current = term;
      isInitializedRef.current = true;

      // Show welcome banner if buffer is empty BEFORE subscribing
      if (terminalSession.isEmpty()) {
        term.writeln('\x1b[1;33m╔════════════════════════════════════════════════════════════════╗\x1b[0m');
        term.writeln('\x1b[1;33m║\x1b[0m  \x1b[1;36mZenCube Terminal Ready\x1b[0m                                      \x1b[1;33m║\x1b[0m');
        term.writeln('\x1b[1;33m║\x1b[0m  \x1b[90mExecute commands using the controls on the left\x1b[0m            \x1b[1;33m║\x1b[0m');
        term.writeln('\x1b[1;33m╚════════════════════════════════════════════════════════════════╝\x1b[0m');
        term.writeln('');
      }

      // Subscribe to terminal session - will immediately receive current buffer + new lines
      const unsubscribe = terminalSession.subscribe((line) => {
        if (!xtermRef.current || !isInitializedRef.current) return;
        
        if (line.type === 'system' && line.data === '') {
          // Clear signal
          term.clear();
          term.writeln('\x1b[1;33m╔════════════════════════════════════════════════════════════════╗\x1b[0m');
          term.writeln('\x1b[1;33m║\x1b[0m  \x1b[1;36mZenCube Terminal Ready\x1b[0m                                      \x1b[1;33m║\x1b[0m');
          term.writeln('\x1b[1;33m║\x1b[0m  \x1b[90mExecute commands using the controls on the left\x1b[0m            \x1b[1;33m║\x1b[0m');
          term.writeln('\x1b[1;33m╚════════════════════════════════════════════════════════════════╝\x1b[0m');
          term.writeln('');
        } else {
          // Regular output - write immediately to terminal
          if (line.type === 'stderr') {
            term.write(`\x1b[31m${line.data}\x1b[0m`);
          } else {
            term.write(line.data);
          }
          
          // Auto-scroll to bottom on new content
          term.scrollToBottom();
        }
      });

      // Handle container resize (fixes tab switching issue)
      const resizeObserver = new ResizeObserver(() => {
        if (xtermRef.current && isInitializedRef.current) {
          // Force terminal to refresh its dimensions
          setTimeout(() => {
            xtermRef.current?.refresh(0, xtermRef.current.rows - 1);
          }, 0);
        }
      });

      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      return () => {
        isInitializedRef.current = false;
        unsubscribe();
        resizeObserver.disconnect();
      };
    }

    return () => {
      if (xtermRef.current) {
        isInitializedRef.current = false;
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, []);

  useImperativeHandle(ref, () => ({
    write: (data: string) => {
      // Write to session manager instead of directly to xterm
      // Session manager will notify all subscribers (including this component)
      terminalSession.append(data, 'stdout');
    },
    clear: () => {
      // Clear session manager (which will notify subscribers)
      terminalSession.clear();
    },
  }));

  return (
    <Card className="overflow-hidden flex flex-col h-full" ref={containerRef}>
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
          className="h-full w-full p-3 bg-slate-900 dark:bg-slate-950 border-t border-slate-700"
          style={{ minHeight: '500px', maxHeight: '100%', position: 'relative' }}
        />
      </CardContent>
    </Card>
  );
});

Terminal.displayName = 'Terminal';

export default Terminal;
