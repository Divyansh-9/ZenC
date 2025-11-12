import React, {useState} from 'react';

function FileJailPanel() {
  const [useJail, setUseJail] = useState(false);
  const [jailPath, setJailPath] = useState('sandbox_jail');
  const [enforce, setEnforce] = useState(false);
  const [command, setCommand] = useState('./tests/infinite_loop');
  const [status, setStatus] = useState(null);
  const [sudoCommand, setSudoCommand] = useState(null);

  function validatePath(p) {
    if (!p || p.trim() === '') return 'Path cannot be empty';
    if (p.trim() === '/') return 'Using / as jail is forbidden';
    return null;
  }

  async function prepareJail() {
    setStatus('Preparing...');
    try {
      const res = await fetch('/api/sandbox/prepare_jail', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({jailPath}),
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setStatus('Jail prepared');
      } else {
        setStatus('Prepare failed: ' + (data.detail || JSON.stringify(data)));
      }
    } catch (e) {
      setStatus('Error: ' + e.message);
    }
  }

  async function applyAndRun() {
    const err = validatePath(jailPath);
    if (useJail && err) {
      setStatus('Validation error: ' + err);
      return;
    }
    setStatus('Starting...');
    setSudoCommand(null);
    try {
      const res = await fetch('/api/sandbox/run', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({command, jailPath, useJail, enforce}),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.status === 'need_sudo') {
          setStatus('Requires sudo');
          setSudoCommand(data.sudo_command);
        } else if (data.status === 'ok') {
          setStatus('Started run: ' + data.runId);
        } else {
          setStatus(JSON.stringify(data));
        }
      } else {
        setStatus('Error: ' + (data.detail || JSON.stringify(data)));
      }
    } catch (e) {
      setStatus('Exception: ' + e.message);
    }
  }

  return (
    <div style={{padding: 12, maxWidth: 640}}>
      <h3>File Restriction (File Jail)</h3>
      <label>
        <input type="checkbox" checked={useJail} onChange={e => setUseJail(e.target.checked)} /> Enable File Jail
      </label>
      <div style={{marginTop: 8}}>
        <label>Jail path:
          <input type="text" value={jailPath} onChange={e => setJailPath(e.target.value)} style={{width: '100%'}} />
        </label>
        <div style={{color: 'red'}}>{useJail ? validatePath(jailPath) : ''}</div>
      </div>
      <div style={{marginTop: 8}}>
        <label>
          <input type="checkbox" checked={enforce} onChange={e => setEnforce(e.target.checked)} /> Enforce (requires sudo)
        </label>
        <div style={{fontSize: 12, color: '#666'}}>Requires root. GUI will display sudo command; it will not run privileged commands.</div>
      </div>
      <div style={{marginTop: 8}}>
        <label>Command:
          <input type="text" value={command} onChange={e => setCommand(e.target.value)} style={{width: '100%'}} />
        </label>
      </div>
      <div style={{marginTop: 12}}>
        <button onClick={prepareJail}>Prepare Jail</button>
        <button onClick={applyAndRun} style={{marginLeft: 8}}>Apply & Run</button>
      </div>

      <div style={{marginTop: 12}}>
        <strong>Status:</strong>
        <div>{status}</div>
        {sudoCommand && (
          <div style={{marginTop: 8, padding: 8, background: '#f4f4f4'}}>
            <div><strong>Sudo command (copy & run as needed):</strong></div>
            <pre>{sudoCommand}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default FileJailPanel;
