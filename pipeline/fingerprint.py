"""Reproducibility fingerprint: SHA-256 of every input table we load and every output we write, plus git commit and data release.

Writes outputs/fingerprint.json and a copy at web/public/data/fingerprint.json (shown on /evidence#reproduce). Before
overwriting, compares the new hashes with the previous file and prints MATCH or the files that differ; `--check` exits 1
on a mismatch without writing. meta.json is excluded because it carries the build time.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

from pipeline.config import OUTPUTS, ROOT, WEB_DATA, cfg, data_path
from pipeline.load import T

EXCLUDE = {"meta.json", "fingerprint.json"}


TEXT = {".json", ".csv", ".md", ".txt"}


def sha256(p: Path) -> str:
    """Hash of the file bytes; text files are hashed with CRLF normalized to LF so Windows and Linux reruns agree."""
    if p.suffix in TEXT:
        return hashlib.sha256(p.read_bytes().replace(b"\r\n", b"\n")).hexdigest()
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _rel(p: Path, base: Path) -> str:
    return p.relative_to(base).as_posix()


def _git(*args: str) -> str:
    try:
        return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def inputs() -> list[dict]:
    """Every table in load.T, hashed and checked against the release manifest's SHA-256."""
    base = cfg()["data_dir"] / "data"
    man = json.loads((base / "manifest.json").read_text(encoding="utf-8"))
    published = {f["path"]: f["sha256"] for f in man["files"]}
    out = []
    for rel in sorted(T.values()):
        p = data_path(rel)
        h = sha256(p)
        out.append({"path": _rel(p, base), "sha256": h, "matches_release": published.get(_rel(p, base)) == h})
    return out


def outputs() -> list[dict]:
    """Pipeline outputs (outputs/*.parquet, metrics.json) and every web data file except meta/fingerprint."""
    files = sorted(OUTPUTS.glob("*.parquet")) + [OUTPUTS / "metrics.json"]
    files += sorted(p for p in WEB_DATA.glob("*.json") if p.name not in EXCLUDE)
    return [{"path": _rel(p, ROOT), "sha256": sha256(p)} for p in files]


def build() -> dict:
    man = json.loads((cfg()["data_dir"] / "data" / "manifest.json").read_text(encoding="utf-8"))
    return {
        "about": "Verify these results: run python run.py all; your hashes should match these.",
        "git_commit": _git("rev-parse", "HEAD"),
        "git_dirty": bool(_git("status", "--porcelain", "--", "pipeline", "config.yaml", "run.py")),
        "data_release": {k: man.get(k) for k in ("dataset", "version", "world_id", "build_seed")},
        "manifest_sha256": sha256(cfg()["data_dir"] / "data" / "manifest.json"),
        "seed": cfg()["seed"],
        "inputs": inputs(),
        "outputs": outputs(),
    }


def diff(old: dict, new: dict) -> list[str]:
    """Paths whose hash changed, appeared or disappeared (inputs and outputs)."""
    bad = []
    for key in ("inputs", "outputs"):
        a = {f["path"]: f["sha256"] for f in old.get(key, [])}
        b = {f["path"]: f["sha256"] for f in new[key]}
        bad += sorted(p for p in a.keys() | b.keys() if a.get(p) != b.get(p))
    return bad


def main(check: bool = False) -> int:
    fp = build()
    prev = OUTPUTS / "fingerprint.json"
    bad = diff(json.loads(prev.read_text(encoding="utf-8")), fp) if prev.exists() else None
    off = [f["path"] for f in fp["inputs"] if not f["matches_release"]]
    print(
        f"fingerprint: {len(fp['inputs'])} inputs ({len(fp['inputs']) - len(off)} match the release manifest), {len(fp['outputs'])} outputs"
    )
    for p in off:
        print(f"  input differs from release: {p}")
    if bad is None:
        print("fingerprint: no previous file to compare")
    elif bad:
        print(f"fingerprint: MISMATCH in {len(bad)} file(s)")
        for p in bad:
            print(f"  {p}")
    else:
        print("fingerprint: MATCH (all hashes equal the previous fingerprint)")
    if check:
        return 1 if bad or off else 0
    for p in (prev, WEB_DATA / "fingerprint.json"):
        p.write_text(json.dumps(fp, indent=1) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(check="--check" in sys.argv))
