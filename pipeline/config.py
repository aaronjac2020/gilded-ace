"""Loads config.yaml; DATA_DIR env var overrides data_dir."""

from __future__ import annotations

import os
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parent.parent
OUTPUTS = ROOT / "outputs"
WEB_DATA = ROOT / "web" / "public" / "data"
DOCS = ROOT / "docs"


@lru_cache(maxsize=1)
def cfg() -> dict[str, Any]:
    with open(ROOT / "config.yaml", encoding="utf-8") as f:
        c = yaml.safe_load(f)
    raw = os.environ.get("DATA_DIR", c["data_dir"])
    p = Path(raw)
    c["data_dir"] = (p if p.is_absolute() else (ROOT / p)).resolve()
    return c


def data_path(rel: str) -> Path:
    """Path of a parquet table, e.g. data_path('2_machine_decision/machines')."""
    return cfg()["data_dir"] / "data" / f"{rel}.parquet"


def period(name: str) -> tuple[date, date]:
    a, b = cfg()["periods"][name]
    return date.fromisoformat(a), date.fromisoformat(b)


def periods() -> dict[str, tuple[date, date]]:
    return {k: period(k) for k in cfg()["periods"]}
