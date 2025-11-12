# GUI – File Restriction (File Jail)

This document describes the File Jail panel UI, API contract, and test steps for the GUI Task A implementation.

UI (File: `src/components/FileJailPanel.jsx`)
- Checkbox: Enable File Jail (default: unchecked)
- Text field: Jail path (default: `sandbox_jail`)
- Checkbox: Enforce (requires sudo) — shows sudo command but does not run it
- Text field: Command to run (default: `./tests/infinite_loop`)
- Buttons: Prepare Jail, Apply & Run
- Status area: last run status and optional sudo command

API
- POST `/api/sandbox/prepare_jail` — Body: `{ "jailPath": "<path>" }`.
  - Runs `scripts/build_jail_dev.sh <path>` synchronously and returns `{status, rc, stdout, stderr}`.

- POST `/api/sandbox/run` — Body: `{ "command", "jailPath", "useJail", "enforce" }`.
  - Validates inputs. If `useJail && !jailPath` or `jailPath == '/'` returns 400.
  - If `enforce == true` and server is not root, returns `{status: "need_sudo", sudo_command: "..."}`.
  - Dev-mode: spawns `monitor/jail_wrapper.py` asynchronously and returns `{status: "ok", runId, log}` where `log` is the path to a JSON log in `monitor/logs/`.

Test
- See `tests/test_gui_file_jail.sh` — requires server running at `http://127.0.0.1:8000`.

Safety
- The GUI never executes sudo. When enforcement is required the UI displays the required `sudo` command to the user. Do not run privileged commands via the UI.
