import React, { useEffect, useRef, useReducer } from 'react';
import TerminalSession, { Line } from '../services/terminalSession';
import { Button } from './ui/button';
import { Card, CardHeader, CardContent } from './ui/card';

interface TerminalOutputProps {
  sessionId: string;
  onClear: () => void;
  isRunning: boolean;
}

const TerminalOutput: React.FC<TerminalOutputProps> = ({ sessionId, onClear, isRunning }) => {
  const linesRef = useRef<Line[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [, forceUpdate] = useReducer(n => n + 1, 0);
  const rafRef = useRef<number>();
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    // Reset lines on session change
    linesRef.current = [];
    
    const unsubscribe = TerminalSession.subscribe(sessionId, (newLines, meta) => {
      if (newLines.length === 0) {
        // Clear signal
        linesRef.current = [];
        forceUpdate();
        return;
      }

      // Check if we are at bottom BEFORE updating content
      if (viewportRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = viewportRef.current;
        isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 50;
      }

      linesRef.current.push(...newLines);

      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        forceUpdate();
        rafRef.current = undefined;
      });
    });

    return () => {
      unsubscribe();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [sessionId]);

  // Scroll effect after render
  useEffect(() => {
    if (isAtBottomRef.current && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  });

  // CSS injection
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .terminal-viewport {
        height: 100%;
        overflow-y: auto;
        scrollbar-width: thin;
        font-family: 'Cascadia Code', 'Fira Code', monospace;
        background-color: #0f172a;
        color: #e2e8f0;
        padding: 1rem;
        font-size: 14px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-all;
      }
      .terminal-viewport::-webkit-scrollbar { width: 10px; }
      .terminal-viewport::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius:6px; }
      .terminal-viewport::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Helper to parse ANSI codes (basic version)
  const renderLine = (line: Line) => {
    let style: React.CSSProperties = {};
    let text = line.text;

    if (line.stream === 'stderr') {
      style.color = '#ef4444'; // Red
    } else if (text.includes('[INFO]')) {
      style.color = '#3b82f6'; // Blue
    } else if (text.includes('[WARN]')) {
      style.color = '#eab308'; // Yellow
    } else if (text.includes('[ALERT]')) {
      style.color = '#ef4444'; // Red
    } else if (text.includes('[STATUS]')) {
      style.color = '#22c55e'; // Green
    } else if (text.includes('[AI Analysis]')) {
      style.color = '#a855f7'; // Purple
    }

    // Strip ANSI codes for display
    // eslint-disable-next-line no-control-regex
    const cleanText = text.replace(/\x1b\[[0-9;]*m/g, '');

    return (
      <div key={line.id} style={style}>
        {cleanText}
      </div>
    );
  };

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
      <CardContent className="flex-1 p-0 relative">
        <div className="absolute inset-0 bg-slate-900 dark:bg-slate-950 border-t border-slate-700">
          <div ref={viewportRef} className="terminal-viewport">
            {linesRef.current.length === 0 && (
              <div className="text-slate-500 p-4">
                ╔════════════════════════════════════════════════════════════════╗<br/>
                ║  ZenCube Terminal Ready                                        ║<br/>
                ║  Execute commands using the controls on the left               ║<br/>
                ╚════════════════════════════════════════════════════════════════╝
              </div>
            )}
            {linesRef.current.map(renderLine)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TerminalOutput;

