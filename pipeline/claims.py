"""Claims appendix: every headline claim with its source, result, the alternative explanation tested, its limitation and a
dashboard deep link. One list feeds web/public/data/claims.json (the /method page) and docs/claims_appendix.md.

Numbers are read from outputs/metrics.json and the web exports, so the text regenerates with the pipeline.
Run: python -m pipeline.claims  (rewrites docs/claims_appendix.md)
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from pipeline.config import OUTPUTS, WEB_DATA

ROOT = Path(__file__).resolve().parents[1]
APPROVED = (
    "The manager's ranking is consistent, but it tracks the spot, not the machine. Jan–Apr house win follows the spot's "
    "expected play (ρ 0.61), not machine effect (ρ 0.10). Our ranking is the one that predicts which machines underperform "
    "their spot (ρ 0.58 vs. 0.05)."
)
SITE = "https://gildedaces.netlify.app"


def _web(name: str) -> dict:
    return json.loads((WEB_DATA / name).read_text(encoding="utf-8"))


def _usd(v: float) -> str:
    a = abs(v)
    return f"${v / 1e6:.2f}M" if a >= 1e6 else f"${v / 1e3:.1f}k" if a >= 1e3 else f"${v:,.0f}"


def _pct(v: float, d: int = 1) -> str:
    return f"{v * 100:.{d}f}%"


def build() -> list[dict]:
    m = json.loads((OUTPUTS / "metrics.json").read_text(encoding="utf-8"))
    pc, lh, mv, alt = m["persistence_compare"], m["low_hold"], m["alternatives"]["moved"], m["alternatives"]
    eff = pc["outcomes"]["effect"]
    hw = pc["outcomes"]["house_win"]
    loo = mv["leave_one_out"]["M-1152"]
    sc = pd.read_parquet(OUTPUTS / "machine_scorecard.parquet")
    full = sc[sc.period == "full"].set_index("machine_id")
    ih = full[full["hold_flag"].fillna(False).astype(bool)]
    i0 = ih.iloc[0]
    v, m2, per, vol, car = m["verdicts_full"], m["model2"], m["persistence"], alt["volatility"], alt["carded"]["groups"]
    wd = m2["weekday_mean"]
    peak, trough = max(wd, key=wd.get), min(wd, key=wd.get)
    dem = _web("demand.json")
    cl = dem["closures"][0]
    zb = cl["share"]["Z-B40"]
    dt = _web("downtime.json")
    bd = pd.DataFrame(dt["bank_day"]["data"])
    tk = pd.DataFrame(dt["tickets"]["data"])
    st = pd.DataFrame(dt["staffing"]["data"])
    tk["shift"] = [dt["tickets"]["dicts"]["shift"][i] for i in tk["shift"]]
    waits = tk.groupby("shift")["wait_hours"].mean()
    gv = st.set_index("shift").loc["grave"]
    other_wait = waits.drop("grave").mean()
    n_sh = tk["shift"].value_counts().reindex(["day", "swing", "grave"])
    mh = full.loc[lh["manager_ids"], "hold_obs"]
    seg = pd.read_parquet(OUTPUTS / "players_segments.parquet")
    a = seg[(seg["period"] == "full") & (seg["segment"] == "all")].iloc[0]
    tiers = seg[(seg["period"] == "full") & seg["segment"].str.startswith("tier:")].set_index("segment")["top10_theo"]
    cp = _web("comps.json")
    rc = cp["change_points"]["reinvestment"]
    ppd = cp["change_points"]["points_per_dollar"]
    fnb = cp["fnb"]
    bj = _web("budget.json")
    rec = bj["recommended"]["data"]
    sens = pd.DataFrame(bj["sensitivity"]["data"])
    mt = m["move_test"]
    cmpm = mt["comparison"]
    claims = [
        {
            "id": "ranking-tracks-spot",
            "title": "The manager's ranking tracks the spot",
            "claim": APPROVED,
            "source": "outputs/metrics.json → persistence_compare (pipeline/verdicts.py, model_machine.py): Spearman ρ of Jan–Apr "
            "rankings vs. May–Jun outcomes, 2,000 bootstrap resamples of machines",
            "result": f"Jan–Apr house win vs. spot expectation ρ {pc['train_house_win_rho']['spot']:.2f}, vs. machine effect "
            f"ρ {pc['train_house_win_rho']['effect']:.2f} (n {pc['train_house_win_rho']['n']}). Predicting May–Jun machine effect: "
            f"ours ρ {eff['ours']['spearman']:.2f} [{eff['ours']['spearman_lo']:.2f}, {eff['ours']['spearman_hi']:.2f}], manager "
            f"ρ {eff['manager']['spearman']:.2f} [{eff['manager']['spearman_lo']:.2f}, {eff['manager']['spearman_hi']:.2f}].",
            "alternative": f"The manager's ranking is not noise: it predicts May–Jun house win (ρ {hw['manager']['spearman']:.2f}) "
            f"while ours does not (ρ {hw['ours']['spearman']:.2f}). That is what a spot-driven ranking should do, so both "
            "readings were tested on the same holdout.",
            "limitation": "Machine effect is our own model's estimate (play vs. spot expectation); synthetic data, one property.",
            "link": "/model?focus=ranking-compare",
        },
        {
            "id": "game-setting",
            "title": "Half the manager's list pays back more by design",
            "claim": f"{lh['manager_n']} of the manager's 10 are configured at {_pct(lh['threshold'], 0)} expected hold, the floor's "
            f"lowest setting ({lh['floor_n']} of {lh['floor_total']} machines; floor median {_pct(lh['floor_median_hold'], 0)}). At "
            f"the median setting the same play would carry about {lh['manager_theo_at_median_usd'] / lh['manager_theo_usd']:.0f}× "
            "the theo.",
            "source": "outputs/metrics.json → low_hold (pipeline/alternatives.py): game_math configured RTP per machine, "
            "hypergeometric test",
            "result": f"Hypergeometric p = {lh['p_value']:.4f}; theo {_usd(lh['manager_theo_usd'])} vs. "
            f"{_usd(lh['manager_theo_at_median_usd'])} at the median setting.",
            "alternative": f"Low theo could be unlucky variance instead of setting: observed hold on these {lh['manager_n']} is "
            f"{_pct(mh.min())}–{_pct(mh.max())}, around the {_pct(lh['threshold'], 0)} setting, so the low take is game math.",
            "limitation": "Low hold is a design choice that may attract play; this does not say those machines should be changed.",
            "link": "/?focus=game-setting",
        },
        {
            "id": "follows-spot",
            "title": "Play probably follows the spot, on thin evidence",
            "claim": f"Across the {mv['n_moves']} machines that moved, the pooled slope of play on spot is "
            f"{mv['beta_model']:.2f} [{mv['beta_model_lo']:.2f}, {mv['beta_model_hi']:.2f}] against the model and "
            f"{mv['beta_peer']:.2f} [{mv['beta_peer_lo']:.2f}, {mv['beta_peer_hi']:.2f}] against bank peers.",
            "source": "outputs/metrics.json → alternatives.moved (pipeline/alternatives.py): log play change vs. log spot "
            f"change, ≥ {mv['min_days']} days each side, leave-one-out",
            "result": f"Slope 0 (machine-only) rejected; decision '{mv['decision']}'. Without M-1152: {loo['model']:.2f} (model) / "
            f"{loo['peer']:.2f} (peer).",
            "alternative": "One move could drive the estimate: dropping M-1152 lowers the peer slope to "
            f"{loo['peer']:.2f}, near the 0.5 line. The 0.5 decision threshold was set after seeing these estimates, so it is "
            "not pre-registered.",
            "limitation": f"Only {mv['n_moves']} moves; the move test in the plan exists to settle this.",
            "link": "/model?focus=follows-spot",
        },
        {
            "id": "persistence",
            "title": "Our weak-machine ranking persists out of sample",
            "claim": f"Of our bottom {per['k']} machines by Jan–Apr effect, {round(per['precision_at_k'] * per['k'])} are still in "
            f"the bottom {per['k']} in May–Jun; rank correlation {per['spearman']:.2f}.",
            "source": "outputs/metrics.json → persistence (pipeline/model_machine.py, shrinkage.py)",
            "result": f"Precision@{per['k']} {per['precision_at_k']:.2f} [{per['precision_lo']:.2f}, {per['precision_hi']:.2f}] vs. "
            f"{per['random_precision']:.2f} by chance; ρ {per['spearman']:.2f} [{per['spearman_lo']:.2f}, {per['spearman_hi']:.2f}], "
            f"n {per['n']}.",
            "alternative": "Persistence could come from the spot, not the machine: effect is play divided by the spot "
            "expectation, so a pure spot ranking scores ρ ≈ 0 on it (the manager's list: "
            f"{eff['manager']['spearman']:.2f}).",
            "limitation": "Two months of holdout; 4 of 10 also means 6 of 10 moved out of the bottom.",
            "link": "/model?focus=persistence",
        },
        {
            "id": "verdict-mix",
            "title": "None of the manager's 10 is on our weak list",
            "claim": f"Of {sum(v.values())} machines over Jan–Jun, {v['truly_weak']} are truly weak, {v['location']} are held back "
            f"by their spot, {v['luck']} by luck and {v['inspect_hold']} needs an inspection; none of the manager's 10 is on our list.",
            "source": "machine_scorecard.parquet (period = full) → verdict (pipeline/verdicts.py decision order)",
            "result": f"Overlap with the manager's 10: {len(m['overlap'])}. Verdicts: {v}.",
            "alternative": "The count of weak machines depends on the play model: before themes and bet range were added it was "
            f"{m['model1_change']['truly_weak_before']}, after {m['model1_change']['truly_weak_after']}; the overlap with the "
            f"manager's list was {m['model1_change']['overlap_before']} before and {m['model1_change']['overlap_after']} after.",
            "limitation": "Thresholds (shrunk upper bound < 1, luck |z|) are conventions, not estimated.",
            "link": "/?focus=ours",
        },
        {
            "id": "inspect-hold",
            "title": f"{i0.name} holds far below its setting",
            "claim": f"{i0.name} held {_pct(i0['hold_obs'])} against a configured {_pct(i0['hold_expected'])} over Jan–Jun.",
            "source": "machine_scorecard.parquet → hold_obs, hold_expected, hold_gap_z, z_half1/2, bh_reject (pipeline/holdgap.py)",
            "result": f"z = {i0['hold_gap_z']:.1f}; {i0['z_half1']:.1f} and {i0['z_half2']:.1f} in each half; survives 10% FDR "
            f"across {len(full)} machines. {len(ih)} machine flagged.",
            "alternative": f"Bad luck: the same shortfall in both halves makes chance unlikely. A different paytable fits better "
            f"({i0['best_fit_config']}, z {i0['z_best']:.1f}), so the next step is to inspect and verify the configuration.",
            "limitation": "Hold variance is information, not a finding: verification may confirm a configuration difference or "
            "find nothing.",
            "link": f"/floor?machine={i0.name}&focus=map",
        },
        {
            "id": "volatility",
            "title": "Volatility does not explain the manager's list",
            "claim": f"{vol['manager_high']} of the manager's {vol['manager_n']} are high volatility vs. "
            f"{_pct(vol['floor_high_share'], 0)} of the floor.",
            "source": "outputs/metrics.json → alternatives.volatility (Fisher exact test)",
            "result": f"Odds ratio {vol['odds_ratio']:.2f}, p = {vol['p_value']:.2f}.",
            "alternative": "This was the alternative: high-volatility games swing more and could look weak by chance. Not "
            "supported.",
            "limitation": "Ten machines give little power; a modest volatility effect cannot be ruled out.",
            "link": "/model?focus=ranking-compare",
        },
        {
            "id": "carded-share",
            "title": "The manager's machines are not under-tracked",
            "claim": f"Carded share of coin-in on the manager's 10 is {_pct(car['manager_10']['share'])} vs. "
            f"{_pct(car['manager_10']['rest'])} on the rest.",
            "source": "outputs/metrics.json → alternatives.carded (sessions vs. machine_day coin-in)",
            "result": f"Difference {car['manager_10']['diff'] * 100:+.1f} pts [{car['manager_10']['diff_lo'] * 100:+.1f}, "
            f"{car['manager_10']['diff_hi'] * 100:+.1f}].",
            "alternative": "Low earners could be machines where guests skip the card, so tracked play understates them. The "
            "shares match.",
            "limitation": "Carded share only covers tracked play; uncarded behavior is not observed.",
            "link": "/players?focus=concentration",
        },
        {
            "id": "forecast",
            "title": "Daily floor coin-in is forecastable from weekday and events",
            "claim": f"On the May–Jun holdout ({m2['test_range'][0]} to {m2['test_range'][1]}), the weekday × event model misses "
            f"daily coin-in by {_usd(m2['mae_model'])} on average (WAPE {_pct(m2['wape_model'])}).",
            "source": "outputs/forecast_holdout.parquet; metrics.json → model2 (pipeline/model_floor.py), trained Jan–Apr only",
            "result": f"MAE {_usd(m2['mae_model'])} vs. {_usd(m2['mae_weekday_only'])} weekday-only and "
            f"{_usd(m2['mae_baseline'])} flat mean ({_pct(m2['improvement_pct'], 0)} better). Event uplift "
            f"×{m2['event_uplift']:.2f} from {m2['event_days_in_train']} training event days.",
            "alternative": "A flat mean or weekday-only model could do as well; both were scored on the same holdout.",
            "limitation": f"Only {m2['test_event_days']} event days in the holdout; bias {_usd(m2['bias_model'])}/day (underforecast).",
            "link": "/model?focus=model2",
        },
        {
            "id": "weekday",
            "title": f"{peak}s bring in {wd[peak] / wd[trough]:.2f}× a {trough}'s coin-in",
            "claim": f"Jan–Apr mean daily coin-in is {_usd(wd[peak])} on {peak} vs. {_usd(wd[trough])} on {trough}.",
            "source": "metrics.json → model2.weekday_mean (machine_day, gaming date 6 a.m. boundary)",
            "result": f"Peak-to-trough {m2['peak_to_trough']:.2f}×.",
            "alternative": f"Events could create the pattern; event-day uplift is only ×{m2['event_uplift']:.2f}, too small to "
            "produce the weekday gap.",
            "limitation": "Four months; summer patterns may differ.",
            "link": "/demand?focus=calendar",
        },
        {
            "id": "walkway",
            "title": "Back Forty lost traffic while its walkway was closed",
            "claim": f"Z-B40's share of floor door-counter traffic fell from {_pct(zb['outside'], 2)} to {_pct(zb['during'], 2)} "
            f"while walkway {cl['walkway_id']} was closed for {cl['reason']} (Mar 3 – Apr 7).",
            "source": "web/public/data/demand.json → closures (pipeline/demand.py; traffic with offline hours masked and filled)",
            "result": f"Z-ENT share {_pct(cl['share']['Z-ENT']['outside'], 1)} → {_pct(cl['share']['Z-ENT']['during'], 1)} over the "
            "same days.",
            "alternative": "A seasonal dip could explain it; shares are relative to floor traffic, so floor-wide swings cancel.",
            "limitation": "One closure; shares are descriptive, not a controlled comparison. Signage lift in the plan is an "
            "assumption.",
            "link": "/demand?zone=Z-B40&focus=closure-effect",
        },
        {
            "id": "downtime",
            "title": "Grave shift waits longest for a technician",
            "claim": f"Downtime cost about {_usd(bd['lost_mid'].sum())} of theo over Jan–Jun ({bd['unavailable_hours'].sum():,.0f} "
            f"unavailable hours, {len(tk):,} fault tickets). Grave-shift tickets wait {waits['grave']:.2f} h for a technician vs. "
            f"{other_wait:.2f} h on day and swing.",
            "source": "web/public/data/downtime.json → bank_day, tickets, staffing (pipeline/downtime.py)",
            "result": f"Lost theo range {_usd(bd['lost_lo'].sum())}–{_usd(bd['lost_hi'].sum())}. Grave is rostered "
            f"with {gv['planned']:.0f} technician (actual {gv['actual']:.2f}) vs. {st.set_index('shift').loc['swing', 'planned']:.0f} on swing.",
            "alternative": "Ticket volume could cause the waits, but grave has "
            + ("the fewest" if n_sh.idxmin() == "grave" else "not the most")
            + " tickets ("
            + ", ".join(f"{k} {v}" for k, v in n_sh.items())
            + "), so the longer wait lines up with its single rostered technician, not load.",
            "limitation": "Lost theo assumes the machine would have played at its own same-weekday rate; night tickets are an "
            "upper estimate.",
            "link": "/downtime?focus=shifts",
        },
        {
            "id": "concentration",
            "title": "A small share of carded players carries most theo",
            "claim": f"The top 10% of carded players produce {_pct(a['top10_theo'], 0)} of their theo; the top 1%, "
            f"{_pct(a['top1_theo'], 0)} (Gini {a['gini_theo']:.2f}).",
            "source": "player_period + players → web/public/data/players_segments.json (pipeline/players.py; aggregates only)",
            "result": f"{int(a['players']):,} players; {_pct(a['winners_share'], 0)} finished ahead; median net "
            f"{_usd(a['median_net'])}.",
            "alternative": "Concentration could just be the tier mix: within tiers it is weaker (top 10% share "
            + ", ".join(f"{k[5:]} {_pct(x, 0)}" for k, x in tiers.items())
            + "), so much of it is between tiers.",
            "limitation": "Carded play only. Not a basis for targeting heavy losers.",
            "link": "/players?focus=concentration",
        },
        {
            "id": "comps-change",
            "title": "Comp reinvestment stepped up in late April",
            "claim": f"Weekly comp cost ÷ theo moved from {_pct(rc['before'], 2)} to {_pct(rc['after'], 2)} the week of "
            f"{rc['week']} (90% CI {rc['week_lo']} to {rc['week_hi']}).",
            "source": "loyalty_ledger economic cost ÷ sessions theo by full week → comps.json (pipeline/comps.py: SSE split, "
            "moving-block bootstrap)",
            "result": f"Effect {rc['effect'] * 100:+.2f} pts [{rc['effect_lo'] * 100:+.2f}, {rc['effect_hi'] * 100:+.2f}]; "
            f"no-break null p = {rc['p_null']:.2f}. Points per $ redeemed {ppd['before']:.1f} → {ppd['after']:.1f} the week of "
            f"{ppd['week']}.",
            "alternative": "A shift in who plays could raise reinvestment; earn rate (points per $ wagered) and cost per $ of "
            "face are flat, so the step tracks the redemption price.",
            "limitation": "The ledger does not record why the redemption price changed; one split is assumed.",
            "link": "/comps?focus=change-point",
        },
        {
            "id": "counted-once",
            "title": "Comps are counted once",
            "claim": f"Comped F&B cost of goods ({_usd(fnb['comped_cogs'])}) equals the ledger's economic comp cost "
            f"({_usd(fnb['ledger_cost'])}), so comps are counted in cogs only.",
            "source": "fnb_transactions.cogs_cents vs. loyalty_ledger.economic_cost_cents (cost rule CR-FNB-COGS)",
            "result": f"Paid {_usd(fnb['paid_cogs'])} + comped {_usd(fnb['comped_cogs'])} = all cogs {_usd(fnb['all_cogs'])}.",
            "alternative": "Adding ledger cost to cogs would double-count; tested in tests/test_money_math.py and "
            "test_players_comps.py.",
            "limitation": "Face value is not cost; reinvestment uses economic cost.",
            "link": "/comps?focus=counted-once",
        },
        {
            "id": "move-test",
            "title": "The plan buys a controlled move test",
            "claim": f"Swap {mt['pick']['swaps']} of our low-effect machines in busier spots with {mt['pick']['swaps']} of the "
            f"manager's quiet-spot machines ({_usd(mt['pick']['cost_usd'])}), each against a matched unmoved control.",
            "source": "metrics.json → move_test (pipeline/budget.py move_test, with_move_test)",
            "result": f"Planned 90% interval on the slope ±{mt['pick']['halfwidth']:.2f}; information value "
            f"{_usd(cmpm['move_test']['voi_usd'])}; theo + information {_usd(cmpm['move_test']['value_usd'])} vs. "
            f"{_usd(cmpm['lowest']['value_usd'])} for {cmpm['lowest']['action_type_id']}, which it replaces.",
            "alternative": f"With the wider peer-calibrated variation (±{mt['pick']['halfwidth_tau_peer']:.2f}) information value "
            f"is {_usd(mt['voi_usd_tau_peer'])} and the test is still included.",
            "limitation": "Information value depends on the follow-on decision (90-day lease replacement) and its assumed "
            "new-title effect.",
            "link": "/plan?focus=plan",
        },
        {
            "id": "plan-robust",
            "title": "The recommended plan holds under most changes",
            "claim": f"Spend {_usd(bj['total_usd'])} on {' + '.join(rec['action_type_id'])} and keep {_usd(bj['kept_usd'])}; the "
            f"same plan wins in {int((~sens['changed']).sum())} of {len(sens)} sensitivity scenarios.",
            "source": "budget.json → recommended, sensitivity (pipeline/budget.py best_plan, sensitivity; tests/test_budget.py)",
            "result": f"Exhaustive search agrees with the plan; expected theo {_usd(bj['effect']['lo'])}–{_usd(bj['effect']['hi'])} "
            "within 30 days.",
            "alternative": "Every line at its low end, or inspection worth $0, drops inspection from the plan; nothing else "
            "changes the pick.",
            "limitation": "Signage lift (2–10%) and new-title effects are assumptions, not estimates.",
            "link": "/plan?focus=sensitivity",
        },
    ]
    return claims


def markdown(claims: list[dict]) -> str:
    def cell(s: str) -> str:
        return s.replace("|", "\\|").replace("\n", " ")

    out = [
        "# Claims appendix",
        "",
        "Generated by `python -m pipeline.claims` from outputs/metrics.json and the web exports; the /method page renders the "
        "same list. Synthetic data for the fictional Gilded Ace casino (Jan–Jun 2025); nothing here describes a real property.",
        "",
        "| # | Claim | Table / query | Result | Alternative explanation tested | Limitation | Dashboard |",
        "|---|---|---|---|---|---|---|",
    ]
    for i, c in enumerate(claims, 1):
        link = f"[{c['link']}]({SITE}{c['link']})"
        out.append(
            f"| {i} | **{cell(c['title'])}.** {cell(c['claim'])} | {cell(c['source'])} | {cell(c['result'])} | "
            f"{cell(c['alternative'])} | {cell(c['limitation'])} | {link} · [method]({SITE}/method?focus=claim-{c['id']}) |"
        )
    out += [
        "",
        "Notes",
        "",
        "- Claim 1 is the approved wording, verbatim.",
        "- Claim 3: the 0.5 slope threshold was set after seeing the data. Without M-1152 the slopes are "
        "0.77 (model) / 0.52 (peer).",
        "- Vocabulary: hold variance is something to inspect and verify; no claim asserts intent.",
        "",
    ]
    return "\n".join(out)


if __name__ == "__main__":
    c = build()
    (ROOT / "docs" / "claims_appendix.md").write_text(markdown(c), encoding="utf-8")
    print(f"{len(c)} claims -> docs/claims_appendix.md")
