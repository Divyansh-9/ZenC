#!/usr/bin/env python3
"""Development-friendly wrapper that simulates the production file jail.

This helper works without root by running a target command inside a chosen
working directory and monitoring for file accesses that escape that subtree.
If `strace` is available it is used to inspect `open*` syscalls. Otherwise the
wrapper falls back to inspecting `/proc/<pid>/fd` while the command runs.
The wrapper exits with a non-zero status when a violation is detected so tests
can assert the behaviour.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import re
import signal
import shutil
import subprocess
import sys
import time
from typing import Iterable, Sequence, Set

try:
    from monitor.ml_guard import MLGuard
except Exception:  # pragma: no cover - guard optional
    MLGuard = None  # type: ignore

LOG_DIR = pathlib.Path(__file__).resolve().parent / "logs"
ALLOWED_PREFIXES_STATIC: Sequence[str] = (
    "/usr/lib",
    "/usr/lib64",
    "/usr/libexec",
    "/usr/local/lib",
    "/lib",
    "/lib64",
    "/lib/x86_64-linux-gnu",
    "/usr/lib/x86_64-linux-gnu",
    "/usr/bin",
    "/usr/local/bin",
    "/usr/local/sbin",
    "/usr/sbin",
    "/usr/share/locale",
    "/usr/share/zoneinfo",
    "/proc",
    "/dev",
)
ALLOWED_EXACT: Sequence[str] = (
    "/etc/ld.so.cache",
    "/etc/ld.so.preload",
    "/etc/localtime",
    "/etc/locale.alias",
    "/etc/resolv.conf",
    "/etc/python3.12/sitecustomize.py",
    "/usr/pyvenv.cfg",
)

USER_HOME = pathlib.Path.home()
ALLOWED_USER_PREFIXES: Sequence[str] = (
    str(USER_HOME / ".local"),
    str(USER_HOME / ".cache"),
)
VIOLATION_EXIT_CODE = 2

_GUARD_INSTANCE = None


def _get_guard():
    global _GUARD_INSTANCE
    if MLGuard is None:
        return None
    if _GUARD_INSTANCE is None:
        _GUARD_INSTANCE = MLGuard()
    return _GUARD_INSTANCE


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run a command inside a development jail with filesystem monitoring."
    )
    parser.add_argument(
        "--jail",
        required=True,
        help="Path to the development jail directory. Created if it does not exist.",
    )
    parser.add_argument(
        "cmd",
        nargs=argparse.REMAINDER,
        help="Command to execute (use -- to separate wrapper flags from the command)",
    )
    args = parser.parse_args(argv)
    if not args.cmd:
        parser.error("No command provided. Use -- to separate wrapper flags from the command.")
    if args.cmd[0] == "--":
        args.cmd = args.cmd[1:]
        if not args.cmd:
            parser.error("Command segment after -- is empty.")
    return args


def ensure_jail_directory(path: pathlib.Path) -> pathlib.Path:
    path.mkdir(parents=True, exist_ok=True)
    return path.resolve()


def is_allowed_path(candidate: str, jail_root: pathlib.Path) -> bool:
    if not candidate:
        return True
    if candidate.startswith("pipe:[") or candidate.startswith("socket:["):
        return True
    if candidate.startswith("anon_inode:"):
        return True

    # Resolve the candidate to an absolute path
    if os.path.isabs(candidate):
        resolved = os.path.realpath(candidate)
    else:
        resolved = os.path.realpath(jail_root / candidate)

    jail_root_str = str(jail_root)
    try:
        common_prefix = os.path.commonpath([jail_root_str, resolved])
    except ValueError:
        common_prefix = ""

    if common_prefix == jail_root_str:
        return True
    if any(resolved.startswith(prefix) for prefix in ALLOWED_PREFIXES_STATIC):
        return True
    if resolved in ALLOWED_EXACT:
        return True
    if any(resolved.startswith(prefix) for prefix in ALLOWED_USER_PREFIXES):
        return True

    return False


def extract_paths_from_strace(line: str) -> Iterable[str]:
    for path in re.findall(r'"([^"\\]+(?:\\.[^"\\]*)*)"', line):
        yield path.replace("\\\"", "\"")


def parse_strace_log(log_path: pathlib.Path, jail_root: pathlib.Path) -> Set[str]:
    violations: Set[str] = set()
    if not log_path.exists():
        return violations

    with log_path.open("r", encoding="utf-8", errors="ignore") as handle:
        for raw_line in handle:
            for path in extract_paths_from_strace(raw_line):
                if not is_allowed_path(path, jail_root):
                    if os.path.isabs(path):
                        resolved = os.path.realpath(path)
                    else:
                        resolved = os.path.realpath(os.path.join(str(jail_root), path))
                    violations.add(resolved)
    return violations


def snapshot_fd_violations(pid: int, jail_root: pathlib.Path) -> Set[str]:
    fd_dir = pathlib.Path(f"/proc/{pid}/fd")
    if not fd_dir.exists():
        return set()

    found: Set[str] = set()
    for fd_entry in fd_dir.iterdir():
        try:
            target = os.readlink(fd_entry)
        except OSError:
            continue
        if not target or target.startswith("pipe:") or target.startswith("socket:"):
            continue
        if target.startswith("anon_inode:"):
            continue
        resolved = os.path.realpath(target)
        if not is_allowed_path(resolved, jail_root):
            found.add(resolved)
    return found


def monitor_with_proc_fd(proc: subprocess.Popen[str], jail_root: pathlib.Path) -> Set[str]:
    violations: Set[str] = set()
    while True:
        violations.update(snapshot_fd_violations(proc.pid, jail_root))
        if proc.poll() is not None:
            break
        time.sleep(0.1)
    violations.update(snapshot_fd_violations(proc.pid, jail_root))
    return violations


def run_command(args: argparse.Namespace) -> int:
    jail_root = ensure_jail_directory(pathlib.Path(args.jail))
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    strace_path = shutil.which("strace")
    timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    log_entry: dict = {
        "timestamp": timestamp,
        "jail": str(jail_root),
        "command": args.cmd,
        "method": "proc_fd",
        "strace_available": bool(strace_path),
        "command_exit_code": None,
        "violations": [],
    }

    guard = _get_guard()
    guard_run_id_base = f"wrapper-{timestamp}"
    guard_run_id = None

    print(f"[jail-wrapper] Jail root: {jail_root}")
    print(f"[jail-wrapper] Command: {' '.join(args.cmd)}")

    if strace_path:
        strace_log = LOG_DIR / f"strace_{timestamp}.log"
        cmd = [strace_path, "-f", "-e", "trace=file", "-o", str(strace_log)] + list(args.cmd)
        log_entry["method"] = "strace"
    else:
        strace_log = None
        cmd = list(args.cmd)
        print("[jail-wrapper] strace not available, falling back to /proc fd monitoring (best effort).")

    try:
        proc = subprocess.Popen(
            cmd,
            cwd=str(jail_root),
            env=os.environ.copy(),
        )
        if guard is not None:
            guard_run_id = f"{guard_run_id_base}-{proc.pid}"
            try:
                guard.watch(proc.pid, jail_root, args.cmd, run_id=guard_run_id)
                print(f"[jail-wrapper] ML guard active (run {guard_run_id}).")
            except Exception as guard_error:  # pragma: no cover - defensive degrade
                print(f"[jail-wrapper] ML guard disabled: {guard_error}", file=sys.stderr)
                guard_run_id = None
                log_entry["ml_guard_active"] = False
    except FileNotFoundError as exc:
        print(f"[jail-wrapper] Error: {exc}", file=sys.stderr)
        return 127

    try:
        if strace_log is not None:
            return_code = proc.wait()
            violations = parse_strace_log(strace_log, jail_root)
        else:
            violations = monitor_with_proc_fd(proc, jail_root)
            return_code = proc.wait()
    finally:
        if guard is not None:
            guard.stop(proc.pid)

    log_entry["command_exit_code"] = return_code
    log_entry["violations"] = sorted(violations)
    log_entry["ml_guard_run_id"] = guard_run_id
    log_entry["ml_guard_active"] = guard_run_id is not None
    log_entry["ml_guard_terminated"] = guard_run_id is not None and return_code == -signal.SIGKILL

    if violations:
        print("[jail-wrapper] Detected filesystem violations:")
        for path in sorted(violations):
            print(f"  - {path}")
    else:
        print("[jail-wrapper] No filesystem violations detected.")

    wrapper_exit = return_code
    if violations:
        wrapper_exit = VIOLATION_EXIT_CODE

    log_entry["wrapper_exit_code"] = wrapper_exit
    if strace_log is not None:
        log_entry["strace_log"] = str(strace_log)

    log_file = LOG_DIR / f"jail_run_{timestamp}.json"
    with log_file.open("w", encoding="utf-8") as handle:
        json.dump(log_entry, handle, indent=2)
        handle.write("\n")
    print(f"[jail-wrapper] Log written to {log_file}")

    return wrapper_exit


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    return run_command(args)


if __name__ == "__main__":
    sys.exit(main())
