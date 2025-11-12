from __future__ import annotations

import json
import os
import pathlib
import subprocess
import time
from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, FastAPI, HTTPException
from pydantic import BaseModel

ROOT = pathlib.Path(__file__).resolve().parents[2]
LOG_DIR = ROOT / "monitor" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/api/sandbox")


class PrepareJailRequest(BaseModel):
    jailPath: str


class RunRequest(BaseModel):
    command: str
    jailPath: str | None = None
    useJail: bool = False
    enforce: bool = False


@router.post("/prepare_jail")
def prepare_jail(body: PrepareJailRequest) -> Dict[str, Any]:
    jail = body.jailPath
    script = ROOT / "scripts" / "build_jail_dev.sh"
    if not script.exists():
        raise HTTPException(status_code=500, detail="build_jail_dev.sh not found on server")

    try:
        proc = subprocess.run([str(script), jail], capture_output=True, text=True)
        return {
            "status": "ok" if proc.returncode == 0 else "error",
            "rc": proc.returncode,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/run")
def run_sandbox(body: RunRequest) -> Dict[str, Any]:
    # Validation
    if body.useJail and (not body.jailPath):
        raise HTTPException(status_code=400, detail="jailPath is required when useJail is true")
    if body.jailPath == "/":
        raise HTTPException(status_code=400, detail="Cannot use root as jail.")

    # If enforce requested but not running as root, return need_sudo
    try:
        euid = os.geteuid()
    except AttributeError:
        euid = 1000

    cmd = body.command.strip().split()

    if body.enforce and euid != 0:
        sudo_cmd = "sudo " + " ".join(["./zencube/sandbox"] + [f"--jail={body.jailPath}"] if body.useJail else ["./zencube/sandbox"]) + " -- " + " ".join(cmd)
        return {"status": "need_sudo", "sudo_command": sudo_cmd}

    # Dev-mode: spawn monitor wrapper asynchronously
    if body.useJail:
        wrapper = ROOT / "monitor" / "jail_wrapper.py"
        if not wrapper.exists():
            raise HTTPException(status_code=500, detail="jail_wrapper.py not found")
        launcher = ["python3", str(wrapper), "--jail", body.jailPath, "--"] + cmd
    else:
        # Direct run (non-jail): run command directly via sandbox without jail flags
        launcher = ["python3", str(ROOT / "monitor" / "jail_wrapper.py"), "--jail", ".", "--"] + cmd

    proc = subprocess.Popen(launcher, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)

    run_id = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ") + f"_{proc.pid}"
    log_entry = {
        "runId": run_id,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "cmd": launcher,
        "pid": proc.pid,
    }
    log_file = LOG_DIR / f"gui_run_{run_id}.json"
    with log_file.open("w", encoding="utf-8") as fh:
        json.dump(log_entry, fh)

    return {"status": "ok", "runId": run_id, "log": str(log_file)}


def create_app() -> FastAPI:
    app = FastAPI(title="ZenCube API (dev)")
    app.include_router(router)
    return app


app = create_app()
