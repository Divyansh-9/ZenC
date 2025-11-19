export type Line = { id: string; ts: number; text: string; stream?: 'stdout'|'stderr' };
type Subscriber = (newLines: Line[], meta: { running: boolean, meta?: any }) => void;

interface SessionData {
  buffer: Line[];
  subs: Set<Subscriber>;
  running: boolean;
  meta?: any;
}

const sessions = new Map<string, SessionData>();

const TerminalSession = {
  initSession(sessionId: string, meta?: any): void {
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        buffer: [],
        subs: new Set(),
        running: false,
        meta
      });
    } else {
      // Update meta if session exists
      const session = sessions.get(sessionId)!;
      session.meta = { ...session.meta, ...meta };
    }
  },

  pushLines(sessionId: string, lines: Line | Line[]): void {
    const session = sessions.get(sessionId);
    if (!session) return;

    const newLines = Array.isArray(lines) ? lines : [lines];
    if (newLines.length === 0) return;

    // Append to buffer
    session.buffer.push(...newLines);

    // Trim buffer to last 2000 lines
    if (session.buffer.length > 2000) {
      session.buffer = session.buffer.slice(-2000);
    }

    // Notify subscribers
    session.subs.forEach(sub => {
      try {
        sub(newLines, { running: session.running, meta: session.meta });
      } catch (e) {
        console.error('Error in terminal subscriber:', e);
      }
    });
    
    // Debug logging as requested
    // console.debug(`[terminalSession.push] ${sessionId} count=${newLines.length}`);
  },

  getBuffer(sessionId: string): Line[] {
    return sessions.get(sessionId)?.buffer || [];
  },

  subscribe(sessionId: string, cb: Subscriber): () => void {
    let session = sessions.get(sessionId);
    if (!session) {
      // Auto-init if not exists
      this.initSession(sessionId);
      session = sessions.get(sessionId)!;
    }

    // Immediately call callback with full current buffer
    try {
      cb(session.buffer, { running: session.running, meta: session.meta });
    } catch (e) {
      console.error('Error in terminal subscriber (initial):', e);
    }

    session.subs.add(cb);

    return () => {
      session?.subs.delete(cb);
    };
  },

  clear(sessionId: string): void {
    const session = sessions.get(sessionId);
    if (!session) return;

    session.buffer = [];
    
    // Notify subscribers with empty array to signal clear
    session.subs.forEach(sub => {
      try {
        sub([], { running: session.running, meta: session.meta });
      } catch (e) {
        console.error('Error in terminal subscriber (clear):', e);
      }
    });
  },

  setRunning(sessionId: string, running: boolean): void {
    const session = sessions.get(sessionId);
    if (!session) return;

    session.running = running;
  }
};

export default TerminalSession;
// Compatibility alias for existing code (will be removed/updated later)
export const terminalSession = TerminalSession;

