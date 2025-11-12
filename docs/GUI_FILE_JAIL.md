# GUI – File Restriction (Native PySide6 Panel)

This document describes the native (PySide6) File Jail panel introduced for Phase 3 Task A.

## Locations
- Panel logic: `gui/file_jail_panel.py`
- Integration point: `zencube/zencube_modern_gui.py` (calls `attach_file_jail_panel` inside the command/limits column)

## UI Elements
- Checkbox: **Enable File Jail** (default unchecked; disables other controls when false)
- Text field + browse button: **Jail path** (defaults to `sandbox_jail`)
- Checkbox: **Enforce (requires sudo)** – displays the exact `sudo` command and aborts execution when non-root
- Button: **Prepare Jail** – runs `scripts/build_jail_dev.sh <path>` in a worker thread and streams output to the status box
- Button: **Apply & Run** – launches `python3 monitor/jail_wrapper.py --jail <path> -- <command...>` asynchronously and shows wrapper output
- Status area: read-only log of progress plus a hyperlink to the most recent `monitor/logs/gui_run_*.json`

## Behaviour & Safety
- Dev-safe by default: all commands run through `monitor/jail_wrapper.py` using the active Python interpreter.
- Input validation: jail path must be non-empty and cannot be `/`.
- Enforce mode never executes privileged commands; it only surfaces a copyable `sudo` command.
- Wrapper output is streamed live and the most recent log is parsed for a short summary (method, exit code, violations count).

## Testing
- Script: `tests/test_gui_file_jail_py.sh`
  - Runs headlessly with `QT_QPA_PLATFORM=offscreen`.
  - Instantiates `FileJailPanel`, prepares a test jail, triggers a run, and verifies that a log file is generated and references the chosen jail path.
- Run manually from repository root:

```bash
./tests/test_gui_file_jail_py.sh
```

## Notes
- The panel expects the rest of the GUI to supply command/argument inputs (`ZenCubeModernGUI.command_input` and `.args_input`).
- Log directory (`monitor/logs/`) is created on import so that runs on clean workspaces succeed without manual setup.
- For production, replace the wrapper invocation with the privileged `sudo` command surfaced to the user.
