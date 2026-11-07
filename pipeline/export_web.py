"""Export outputs to web/public/data/*.json (columnar). No player-level rows ever leave this module.

Columnar format: {"columns": [...], "data": {col: [...]}, "dicts": {col: [values]}}.
Columns listed in "dicts" hold integer codes into that list (dictionary encoding keeps the
machine-day table small). Money rounded to cents, rates to 4 dp.
"""

from __future__ import annotations

import json
import math
from datetime import UTC, datetime

import numpy as np
import pandas as pd

from pipeline import budget, verdicts
from pipeline.config import OUTPUTS, WEB_DATA, cfg, periods
from pipeline.load import machine_days, table

RATE_COLS = ("availability", "hold", "luck_z", "effect", "share", "_z", "weight", "tau", "rtp", "_p", "wape", "pct", "uplift")
PENDING = {
    "demand.json": "M9",
    "downtime.json": "M9",
    "players_segments.json": "M10",
    "comps.json": "M10",
    "claims.json": "M12",
}


def _round(col: str, s: pd.Series) -> pd.Series:
    if not pd.api.types.is_float_dtype(s):
        return s
    nd = 4 if any(k in col for k in RATE_COLS) else 2
    return s.round(nd)


def _clean(v):
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    if isinstance(v, (np.floating,)):
        return None if not np.isfinite(v) else float(v)
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    if isinstance(v, (pd.Timestamp, datetime)):
        return v.strftime("%Y-%m-%d")
    return v


def columnar(df: pd.DataFrame, encode: tuple[str, ...] = ()) -> dict:
    """DataFrame -> columnar dict; `encode` columns are dictionary-encoded."""
    out: dict = {"columns": list(df.columns), "data": {}}
    dicts = {}
    for c in df.columns:
        s = df[c]
        if pd.api.types.is_datetime64_any_dtype(s):
            s = s.dt.strftime("%Y-%m-%d")
        if c in encode:
            cat = pd.Categorical(s)
            dicts[c] = [_clean(x) for x in cat.categories]
            out["data"][c] = cat.codes.tolist()
            continue
        out["data"][c] = [_clean(x) for x in _round(c, s).tolist()]
    if dicts:
        out["dicts"] = dicts
    return out


def write(name: str, obj) -> int:
    WEB_DATA.mkdir(parents=True, exist_ok=True)
    p = WEB_DATA / name
    p.write_text(json.dumps(obj, separators=(",", ":"), default=_clean, allow_nan=False), encoding="utf-8")
    return p.stat().st_size


def floor() -> dict:
    loc = table("floor_locations")
    slots = loc[loc.node_type == "slot"][["location_id", "zone_id", "bank_id", "x_m", "y_m"]]
    banks = loc[loc.node_type == "bank"][["location_id", "zone_id", "x_m", "y_m", "capacity"]].rename(
        columns={"location_id": "bank_id"}
    )
    zones = loc[loc.node_type == "zone"][["location_id", "name", "x_m", "y_m"]].rename(columns={"location_id": "zone_id"})
    other = loc[loc.node_type.isin(["entrance", "outlet"])][["location_id", "node_type", "zone_id", "name", "x_m", "y_m"]]
    ww = table("floor_walkways").copy()
    return {
        "slots": columnar(slots),
        "banks": columnar(banks),
        "zones": columnar(zones),
        "landmarks": columnar(other),
        "walkways": columnar(ww),
    }


def machine_day_slim() -> dict:
    md = machine_days()
    d0 = pd.Timestamp(cfg_start())
    slim = pd.DataFrame(
        {
            "machine_id": md["machine_id"],
            "d": (md["gaming_date"] - d0).dt.days.astype(int),
            "location_id": md["location_id"],
            "zone": md["zone_id"],
            "bank": md["bank_id"],
            "coin_in": md["coin_in_usd"],
            "house_win": md["house_win_usd"],
            "theo": md["theo_usd"],
            "available_hours": md["available_hours"],
            "scheduled_hours": md["scheduled_hours"],
        }
    ).sort_values(["d", "machine_id"])
    out = columnar(slim, encode=("machine_id", "location_id", "zone", "bank"))
    out["date0"] = str(d0.date())
    return out


def cfg_start() -> str:
    return str(periods()["full"][0])


def lists(full: pd.DataFrame) -> dict:
    keep = [
        "machine_id",
        "zone_id",
        "bank_id",
        "theme",
        "house_win_usd",
        "theo_usd",
        "hold_obs",
        "hold_expected",
        "machine_effect_shrunk",
        "verdict",
        "verdict_reason",
    ]
    mgr = verdicts.manager_list(full).reset_index()
    ours, _ = verdicts.truly_weak_list(full)
    return {"period": "full", "manager": columnar(mgr[keep]), "ours": columnar(ours.reset_index()[keep])}


def model_lab() -> dict:
    m = json.loads((OUTPUTS / "metrics.json").read_text(encoding="utf-8"))
    fh = pd.read_parquet(OUTPUTS / "forecast_holdout.parquet")
    s = cfg()["split"]
    return {
        "split": s,
        "model2": {
            k: m["model2"][k]
            for k in (
                "mae_model",
                "mae_weekday_only",
                "mae_baseline",
                "wape_model",
                "wape_baseline",
                "improvement_pct",
                "event_uplift",
                "bias_model",
                "peak_days",
                "trough_days",
            )
        },
        "model2_holdout": columnar(fh),
        "model1": m.get("model1"),
        "persistence": m.get("persistence"),
        "persistence_compare": m.get("persistence_compare"),
        # resampling pools stay in metrics.json; the page only needs their spread
        "alternatives": {
            k: ({kk: vv for kk, vv in v.items() if not kk.endswith("draws")} if k == "move_noise" else v)
            for k, v in (m.get("alternatives") or {}).items()
        },
        "move_test_pick": (m.get("move_test") or {}).get("pick"),
        "model1_change": m.get("model1_change"),
    }


def budget_json(full: pd.DataFrame) -> dict:
    cat = budget.catalog().reset_index()
    keep = [
        "action_type_id",
        "name",
        "unit",
        "unit_cost_usd",
        "recurring_usd_per_day",
        "lead_days",
        "live_days",
        "unit_total_usd",
        "downtime_minutes",
        "quantity_limit",
        "incompatibility_group",
        "notes",
    ]
    m = json.loads((OUTPUTS / "metrics.json").read_text(encoding="utf-8"))
    s = budget.plan_summary(full, m.get("alternatives"))
    return {
        "rules": {k: cfg()["budget"][k] for k in ("total_usd", "horizon_days", "max_action_types")},
        "formula": "cost = quantity x (unit_cost + recurring_per_day x max(0, horizon_days - lead_days))",
        "catalog": columnar(cat[keep]),
        "recommended": columnar(s["lines"]),
        "total_usd": s["total_usd"],
        "kept_usd": s["kept_usd"],
        "effect": s["effect"],
        "errors": s["errors"],
        "move_test": m.get("move_test"),
        "version": "v0",
    }


def run() -> dict[str, int]:
    """Write every web JSON; returns {file: bytes}. Raises if the total exceeds web.max_total_mb."""
    sizes: dict[str, int] = {}
    sc = pd.read_parquet(OUTPUTS / "machine_scorecard.parquet")
    for name in periods():
        p = sc[sc.period == name].drop(columns=["period"])
        sizes[f"scorecard_{name}.json"] = write(f"scorecard_{name}.json", columnar(p))
    full = sc[sc.period == "full"].set_index("machine_id")

    mach = table("machines").merge(
        full[["config_id", "volatility_class", "configured_rtp"]].reset_index(), on="machine_id", how="left"
    )
    sizes["machines.json"] = write("machines.json", columnar(mach))
    sizes["floor.json"] = write("floor.json", floor())
    pl = table("placements")[["machine_id", "location_id", "config_id", "effective_from_utc", "effective_to_utc"]]
    sizes["placements.json"] = write("placements.json", columnar(pl))
    sizes["machine_day_slim.json"] = write("machine_day_slim.json", machine_day_slim())
    sizes["lists.json"] = write("lists.json", lists(full))
    sizes["model_lab.json"] = write("model_lab.json", model_lab())
    sizes["budget.json"] = write("budget.json", budget_json(full))
    for f, ms in PENDING.items():
        if not (WEB_DATA / f).exists() or json.loads((WEB_DATA / f).read_text(encoding="utf-8")).get("pending"):
            sizes[f] = write(f, {"pending": ms})
        else:
            sizes[f] = (WEB_DATA / f).stat().st_size

    meta = {
        "build_time": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "data_version": json.loads((cfg()["data_dir"] / "data" / "manifest.json").read_text(encoding="utf-8"))["version"],
        "seed": cfg()["seed"],
        "periods": {k: [str(a), str(b)] for k, (a, b) in periods().items()},
        "row_counts": {"machines": int(len(mach)), "machine_days": int(len(machine_days())), "scorecard": int(len(sc))},
        "rules": {
            "low_hold_design": cfg()["verdicts"]["low_hold_design"],
            "floor_median_hold": float(full["hold_expected"].median()),
        },
    }
    sizes["meta.json"] = write("meta.json", meta)
    total = sum(sizes.values())
    cap = cfg()["web"]["max_total_mb"] * 1024 * 1024
    if total > cap:
        raise SystemExit(f"web export {total / 1e6:.1f} MB exceeds {cfg()['web']['max_total_mb']} MB")
    return sizes


if __name__ == "__main__":
    s = run()
    for k, v in sorted(s.items(), key=lambda kv: -kv[1]):
        print(f"  {k:<28} {v / 1024:>9.1f} KB")
    print(f"  {'TOTAL':<28} {sum(s.values()) / 1024 / 1024:>9.2f} MB  (cap {cfg()['web']['max_total_mb']} MB)")
