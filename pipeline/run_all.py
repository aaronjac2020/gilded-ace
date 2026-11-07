"""Orchestrates the pipeline and prints the headline metrics block."""

from __future__ import annotations

import json
import time

import pandas as pd

from pipeline import verdicts
from pipeline.config import OUTPUTS, cfg, period, periods
from pipeline.load import path
from pipeline.scorecard import FROZEN_COLUMNS, build_scorecard

pd.set_option("display.width", 200)
pd.set_option("display.max_columns", 20)

MANAGER_SQL = """
SELECT machine_id, SUM(house_win_usd) AS house_win, SUM(theo_usd) AS expected_win,
       SUM(house_win_usd)/NULLIF(SUM(coin_in_usd),0) AS observed_hold,
       SUM(available_hours)/(SUM(c.scheduled_seconds)/3600.0) AS availability
FROM '{pdv}' d
JOIN '{cal}' c USING (gaming_date)
WHERE d.active GROUP BY machine_id ORDER BY house_win LIMIT 10
"""


def manager_sql() -> pd.DataFrame:
    """The guide's query, verbatim apart from file paths."""
    import duckdb

    return duckdb.sql(MANAGER_SQL.format(pdv=path("pdv"), cal=path("calendar_day"))).df()


def build_all_scorecards() -> pd.DataFrame:
    frames = []
    for name in periods():
        a, b = period(name)
        frames.append(build_scorecard(a, b))
    return pd.concat(frames, ignore_index=True)


def main() -> dict:
    t0 = time.time()
    OUTPUTS.mkdir(exist_ok=True)
    metrics: dict = {"seed": cfg()["seed"]}

    mgr_sql = manager_sql()
    scs = build_all_scorecards()
    scs.to_parquet(OUTPUTS / "machine_scorecard.parquet", index=False)
    full = scs[scs.period == "full"].set_index("machine_id")

    mgr = verdicts.manager_list(full)
    assert list(mgr.index) == list(mgr_sql.machine_id), "scorecard manager list != guide SQL"
    ours, excluded = verdicts.truly_weak_list(full)

    print("\n=== (a) Manager's bottom 10 (guide SQL, verbatim) ===")
    print(mgr_sql.to_string(index=False))
    print(
        f"\n=== (b) Scorecard rows: {len(scs):,} ({scs.period.nunique()} periods x machines); full period: {len(full)} machines"
    )
    n_flags = int(full["hold_flag"].sum())
    print(
        f"=== (c) Hold-gap flags after BH-FDR q={cfg()['holdgap']['fdr_q']} + split-half sign: {n_flags} "
        f"({', '.join(full.index[full.hold_flag])})"
    )
    vc = verdicts.verdict_counts(full)
    print("=== (d) Verdict distribution (full period) ===")
    print(vc.to_string())
    print("=== (e) Manager's machines: verdict + reason ===")
    for mid, r in mgr.iterrows():
        print(f"  {mid}  win ${r.house_win_usd:>9,.0f}  [{r.verdict}] {r.verdict_reason}")
    print("=== Our truly-weak 10 ===")
    for mid, r in ours.iterrows():
        print(
            f"  {mid}  effect {r.machine_effect_shrunk:.2f} (hi {r.effect_shrunk_hi:.2f})  {r.zone_id} {r.theme}  [{r.verdict}]"
        )
    overlap = sorted(set(mgr.index) & set(ours.index))
    print(f"Overlap manager vs ours: {len(overlap)} {overlap}; truly_weak excluded for eligibility: {len(excluded)}")

    metrics.update(
        {
            "scorecard_rows": len(scs),
            "hold_flags_full": n_flags,
            "verdicts_full": vc.to_dict(),
            "manager_10": list(mgr.index),
            "our_10": list(ours.index),
            "overlap": overlap,
            "frozen_columns": FROZEN_COLUMNS,
        }
    )
    (OUTPUTS / "metrics.json").write_text(json.dumps(metrics, indent=2, default=str), encoding="utf-8")
    print(f"\nwrote outputs/machine_scorecard.parquet, outputs/metrics.json in {time.time() - t0:.0f}s")
    return metrics


if __name__ == "__main__":
    main()
