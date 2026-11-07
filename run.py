"""Cross-platform task runner: python run.py <target> [args]. Mirrors the Makefile."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
VENV_PY = ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
PY = str(VENV_PY if VENV_PY.exists() else sys.executable)
NPM = shutil.which("npm") or "npm"
ENV = {**os.environ, "PYTHONIOENCODING": "utf-8"}


def sh(cmd: list[str], cwd: Path = ROOT) -> None:
    print(f"$ {' '.join(cmd)}", flush=True)
    r = subprocess.run(cmd, cwd=cwd, env=ENV)
    if r.returncode:
        sys.exit(r.returncode)


def setup() -> None:
    if shutil.which("uv"):
        if not VENV_PY.exists():
            sh(["uv", "venv", "--python", "3.12", ".venv"])
        sh(["uv", "pip", "install", "--python", str(VENV_PY), "-r", "requirements.txt"])
    else:
        sh([sys.executable, "-m", "venv", ".venv"])
        sh([str(VENV_PY), "-m", "pip", "install", "-r", "requirements.txt"])
    if (WEB / "package.json").exists():
        sh([NPM, "ci"], WEB)


TARGETS = {
    "setup": setup,
    "check": lambda: sh([PY, "-m", "pipeline.checks"]),
    "pipeline": lambda: sh([PY, "-m", "pipeline.run_all"]),
    "test": lambda: sh([PY, "-m", "pytest", "-q"]),
    "export": lambda: sh([PY, "-m", "pipeline.export_web"]),
    "web": lambda: sh([NPM, "run", "build"], WEB),
    "dev": lambda: sh([NPM, "run", "dev"], WEB),
    "build": lambda: (
        sh([NPM, "run", "typecheck"], WEB),
        sh([NPM, "run", "build"], WEB),
    ),
    "judge": lambda: sh([NPM, "run", "judge", "--", *sys.argv[2:]], WEB),
    "shots": lambda: sh([NPM, "run", "shots"], WEB),
}


def all_() -> None:
    for t in ("check", "pipeline", "test", "export", "build"):
        TARGETS[t]()


TARGETS["all"] = all_

if __name__ == "__main__":
    t = sys.argv[1] if len(sys.argv) > 1 else "all"
    if t not in TARGETS:
        sys.exit(f"unknown target {t!r}; choose from {', '.join(TARGETS)}")
    TARGETS[t]()
