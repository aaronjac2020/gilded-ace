"""Orchestrates the pipeline and prints the headline metrics block."""

from __future__ import annotations

import json
import time

import pandas as pd

from pipeline import model_floor, model_machine, verdicts
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


def expectation_change(full: pd.DataFrame, mgr: pd.DataFrame) -> dict:
    """Full-period verdicts under the provisional zone x weekday expectation vs the current (Model 1) one."""
    c = cfg()
    saved = (c.get("location_expectation"), c.get("location_calibration"))
    c["location_expectation"], c["location_calibration"] = "zone_weekday", None
    try:
        a, b = period("full")
        before = build_scorecard(a, b).set_index("machine_id")
    finally:
        c["location_expectation"], c["location_calibration"] = saved
    ours_b, _ = verdicts.truly_weak_list(before)
    ours_a, _ = verdicts.truly_weak_list(full)
    return {
        "truly_weak_before": int((before.verdict == "truly_weak").sum()),
        "truly_weak_after": int((full.verdict == "truly_weak").sum()),
        "themes_before": int(ours_b.theme.nunique()),
        "themes_after": int(ours_a.theme.nunique()),
        "overlap_before": len(set(ours_b.index) & set(mgr.index)),
        "overlap_after": len(set(ours_a.index) & set(mgr.index)),
        "our10_kept": len(set(ours_b.index) & set(ours_a.index)),
        "verdicts_before": before.verdict.value_counts().to_dict(),
    }


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
    # Game setting: machines configured to pay back more (low expected hold) earn less house win on the same play
    lh, med = cfg()["verdicts"]["low_hold_design"], float(full["hold_expected"].median())
    low = mgr[mgr["hold_expected"] <= lh]
    n_floor = int((full["hold_expected"] <= lh).sum())
    from scipy import stats

    metrics["low_hold"] = {
        "threshold": lh,
        "floor_median_hold": med,
        "manager_n": len(low),
        "manager_ids": list(low.index),
        "floor_n": n_floor,
        "floor_total": len(full),
        "p_value": float(stats.hypergeom.sf(len(low) - 1, len(full), n_floor, len(mgr))),
        "manager_theo_usd": float(low["theo_usd"].sum()),
        "manager_theo_at_median_usd": float((low["coin_in_usd"] * med).sum()),
    }
    lw = metrics["low_hold"]
    print(
        f"Game setting: {lw['manager_n']}/{len(mgr)} of the manager's list configured at hold <= {lh:.0%} "
        f"(floor {n_floor}/{len(full)}, median {med:.0%}; hypergeometric p = {lw['p_value']:.4f}); "
        f"their theo ${lw['manager_theo_usd']:,.0f} vs ${lw['manager_theo_at_median_usd']:,.0f} at median hold"
    )
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
    mf = model_floor.run()
    mm = mf["metrics"]
    mf["holdout"][["gaming_date", "actual", "pred_model", "pred_baseline"]].to_parquet(
        OUTPUTS / "forecast_holdout.parquet", index=False
    )
    print("\n=== Model 2: daily floor coin-in, train Jan-Apr -> test May-Jun ===")
    print(f"  MAE model (weekday mean x citywide-event uplift {mm['event_uplift']:.3f}): ${mm['mae_model']:,.0f}")
    print(f"  MAE weekday-only: ${mm['mae_weekday_only']:,.0f}   MAE baseline (constant mean): ${mm['mae_baseline']:,.0f}")
    print(
        f"  improvement vs baseline: {mm['improvement_pct']:.1%}; WAPE {mm['wape_model']:.1%} vs {mm['wape_baseline']:.1%}; "
        f"model bias {mm['bias_model']:+,.0f}/day"
    )
    metrics["model2"] = mm

    m1 = model_machine.run()["metrics"]
    print("\n=== Model 1: coin-in / avail hr per machine-day, fit Jan-Apr (rounds from Apr validation) -> test May-Jun ===")
    print(
        f"  MAE ${m1['mae_model']:,.0f} vs zone x weekday ${m1['mae_baseline']:,.0f} ({m1['improvement_pct']:.1%} better); "
        f"WMAPE {m1['wmape_model']:.1%} vs {m1['wmape_baseline']:.1%}; rounds {m1['best_iteration']}"
    )
    print("  top features: " + ", ".join(f"{k} {v:.0%}" for k, v in list(m1["importance"].items())[:6]))
    sc = scs.set_index("period")
    pers = model_machine.persistence(sc.loc["train"].reset_index(), sc.loc["test"].reset_index())
    print(
        f"  rank persistence Jan-Apr -> May-Jun (n={pers['n']}): Spearman {pers['spearman']:.2f} "
        f"[{pers['spearman_lo']:.2f}, {pers['spearman_hi']:.2f}]; precision@10 {pers['precision_at_k']:.0%} "
        f"[{pers['precision_lo']:.0%}, {pers['precision_hi']:.0%}] vs random {pers['random_precision']:.0%}"
    )
    pc = model_machine.persistence_compare(sc.loc["train"].reset_index(), sc.loc["test"].reset_index())
    # What the manager's Jan-Apr ranking tracks: the spot's expected play vs. machine effect (Spearman, all train rows)
    tr = sc.loc["train"]
    pc["train_house_win_rho"] = {
        "spot": float(tr["house_win_usd"].corr(tr["loc_expected_coin_in_usd"], method="spearman")),
        "effect": float(tr["house_win_usd"].corr(tr["machine_effect_shrunk"], method="spearman")),
        "n": len(tr),
    }
    print(
        f"  Jan-Apr house win vs spot expectation rho {pc['train_house_win_rho']['spot']:.2f}, "
        f"vs machine effect {pc['train_house_win_rho']['effect']:.2f}"
    )
    for o, res in pc["outcomes"].items():
        mg, ou = res["manager"], res["ours"]
        print(
            f"  vs May-Jun {o} (n={pc['n']}): manager rho {mg['spearman']:.2f} [{mg['spearman_lo']:.2f}, {mg['spearman_hi']:.2f}] "
            f"P@10 {mg['precision_at_k']:.0%} | ours rho {ou['spearman']:.2f} [{ou['spearman_lo']:.2f}, {ou['spearman_hi']:.2f}] "
            f"P@10 {ou['precision_at_k']:.0%} | delta rho {res['delta_rho']:+.2f} [{res['delta_rho_lo']:+.2f}, {res['delta_rho_hi']:+.2f}]"
        )
    metrics["model1"] = m1
    metrics["persistence"] = pers
    metrics["persistence_compare"] = pc
    from pipeline import alternatives

    alt = alternatives.run(full, list(mgr.index), *period("full"))
    mv, vol = alt["moved"], alt["volatility"]
    print("\n=== Competing explanations ===")
    print(
        f"  moved machines ({mv['n_moves']} moves, >= {mv['min_days']} days each side): pooled slope of play change on spot change "
        f"model {mv['beta_model']:.2f} [{mv['beta_model_lo']:.2f}, {mv['beta_model_hi']:.2f}], "
        f"bank peers {mv['beta_peer']:.2f} [{mv['beta_peer_lo']:.2f}, {mv['beta_peer_hi']:.2f}] (1 = follows spot, 0 = stays with machine) "
        f"-> {mv['decision']}"
    )
    for g, c in alt["carded"]["groups"].items():
        print(
            f"  carded share {g} (n={c['n']}): {c['share']:.1%} vs rest {c['rest']:.1%}, diff {c['diff']:+.1%} [{c['diff_lo']:+.1%}, {c['diff_hi']:+.1%}]"
        )
    print(
        f"  volatility: manager's 10 high/very-high {vol['manager_high']}/{vol['manager_n']} vs floor {vol['floor_high_share']:.0%}; "
        f"Fisher one-sided p = {vol['p_value']:.2f} (OR {vol['odds_ratio']:.2f})"
    )
    metrics["alternatives"] = alt
    from pipeline import budget

    mt = budget.move_test(full, alt)
    _, cmp = budget.with_move_test(budget.recommend(full), mt, budget.catalog())
    pk, a, b = mt["pick"], cmp["move_test"], cmp["lowest"]
    print(
        f"  move test sizing: {pk['swaps']} swaps / {pk['moves']} moves (${pk['cost_usd']:,.0f}), planned 90% CI on beta "
        f"+/-{pk['halfwidth']:.2f} (noise only +/-{pk['halfwidth_noise_only']:.2f}; peer-calibrated tau +/-{pk['halfwidth_tau_peer']:.2f}); "
        f"theo ${pk['theo_lo_usd']:,.0f} / ${pk['theo_mid_usd']:,.0f} / ${pk['theo_hi_usd']:,.0f}; VOI ${mt['voi_usd']:,.0f}"
    )
    print(
        f"  move test vs lowest-value line {b['action_type_id']} (${b['cost_usd']:,.0f}): theo+VOI ${a['value_usd']:,.0f} vs "
        f"${b['value_usd']:,.0f} -> {'included' if cmp['included'] else 'not included'}"
    )
    metrics["move_test"] = {**mt, "comparison": cmp}
    metrics["model1_change"] = expectation_change(full, mgr)
    ch = metrics["model1_change"]
    print(
        f"  what changed vs zone x weekday expectation: truly_weak {ch['truly_weak_before']} -> {ch['truly_weak_after']}; "
        f"our-10 themes {ch['themes_before']} -> {ch['themes_after']}; overlap with manager {ch['overlap_before']} -> {ch['overlap_after']}; "
        f"our-10 kept {ch['our10_kept']}/10"
    )

    (OUTPUTS / "metrics.json").write_text(json.dumps(metrics, indent=2, default=str), encoding="utf-8")
    print(f"\nwrote outputs/machine_scorecard.parquet, outputs/metrics.json in {time.time() - t0:.0f}s")
    return metrics


if __name__ == "__main__":
    main()
