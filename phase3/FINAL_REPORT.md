# Task A – Final Report

## Overview
- Added a `--jail=<path>` flag to `zencube/sandbox.c`. When the sandbox runs as root the child process now chroots into the specified directory before executing the target command. Non-root runs emit a warning and skip the chroot call (per requirements) without aborting the execution.
- The new path validation (realpath + `stat` + `access`) surfaces configuration mistakes immediately, preventing half-configured jails from silently failing at runtime.
- Implemented `setup_chroot_jail()` helper for clarity and reuse. The helper ensures we `chdir` into the jail prior to `chroot(".")` and moves to `/` afterwards so relative paths behave predictably.

## Developer Tooling
- Delivered `monitor/jail_wrapper.py` to emulate the file jail without root access. It prefers `strace` to capture `open*` syscalls and falls back to `/proc/<pid>/fd` monitoring when `strace` is unavailable. Detected escapes trigger exit code `2` and are logged to JSON artefacts in `monitor/logs/`.
- Added `scripts/build_jail_dev.sh` to assemble a minimal non-root jail tree (`sandbox_jail/`) containing `/bin/sh`, its loader dependencies, and a stub `/etc/passwd`.
- Created `tests/test_jail_dev.sh` which builds the jail if needed, stages a proof-of-escape Python script, runs it through the wrapper, and asserts the wrapper fails with exit code `2` while logging `/etc/hosts`.

## Validation
- Test command: `./tests/test_jail_dev.sh`
- Result: PASS (wrapper exit code `2`, JSON log includes `/etc/hosts`). See `phase3/TEST_RUNS.md` for timestamped entry and `monitor/logs/jail_run_20251112T035719Z.json` for full trace.

## Limitations & Follow-ups
- Without root the wrapper cannot *prevent* the read, only detect and mark the run as failed. Production deployments must execute the sandbox binary with the new `--jail` flag under root to obtain a real chroot.
- The fallback `/proc` watcher is best-effort; it may miss extremely short-lived file descriptors when `strace` is absent. Documented in `phase3/NOTES.md` with guidance to install `strace` for stronger guarantees.
- Additional filesystem-hardening goals listed in the master checklist remain open (mount namespaces, read-only mounts, etc.) and are out of scope for this task.

## Artefacts
- Code: `zencube/sandbox.c`, `monitor/jail_wrapper.py`
- Scripts: `scripts/build_jail_dev.sh`, `tests/test_jail_dev.sh`
- Documentation & Logs: `phase3/NOTES.md`, `phase3/TEST_RUNS.md`, `phase3/SCORES.md`, `monitor/logs/jail_run_*.json`

## GUI Work (in-progress)

- Added API stubs under `server/api/sandbox.py` to support `prepare_jail` and `run` endpoints for the GUI.
- Added a React component placeholder at `src/components/FileJailPanel.jsx` implementing the UI and safety behavior for the File Restriction panel.
- Added an integration test script `tests/test_gui_file_jail.sh` (requires the API server to be running) and `docs/GUI_FILE_JAIL.md` describing usage.

