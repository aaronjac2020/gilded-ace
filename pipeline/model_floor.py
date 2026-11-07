"""Model 2: daily floor coin-in forecast (staffing / promo timing).

Candidate = Jan-Apr weekday mean x citywide-event uplift. Baseline = constant Jan-Apr daily mean.
Both are frozen at the train cutoff; only events announced by then are used. Test = May-Jun.
"""

from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd

from pipeline.config import cfg
from pipeline.load import sql, table

WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def floor_daily() -> pd.DataFrame:
    """Gaming-date grain: floor coin-in (USD, all play) + weekday from property_day."""
    d = sql("select gaming_date, local_weekday, coin_in_usd, theo_usd, house_win_usd from {property_day} order by 1")
    d["gaming_date"] = pd.to_datetime(d["gaming_date"])
    return d


def known_events(as_of: date) -> pd.DataFrame:
    """Events announced on/before as_of (what a forecaster could know). Day grain with event_type."""
    ev = table("events")
    ev = ev[ev["announced_date"] <= pd.Timestamp(as_of)]
    rows = [
        {"gaming_date": d, "event_id": r.event_id, "event_type": r.event_type, "local_scope": r.local_scope}
        for r in ev.itertuples()
        for d in pd.date_range(r.start_date, r.end_date)
    ]
    return pd.DataFrame(rows, columns=["gaming_date", "event_id", "event_type", "local_scope"])


def fit(train: pd.DataFrame, as_of: date) -> dict:
    """Frozen parameters from training days only."""
    wk = train.groupby("local_weekday")["coin_in_usd"].mean()
    ev = known_events(as_of)
    city_days = set(ev.loc[ev.local_scope == "citywide", "gaming_date"])
    t = train.assign(base=train["local_weekday"].map(wk))
    on = t[t["gaming_date"].isin(city_days)]
    uplift = float(on["coin_in_usd"].sum() / on["base"].sum()) if len(on) else 1.0
    return {
        "weekday_mean": wk.reindex(WEEKDAYS).to_dict(),
        "event_uplift": uplift,
        "event_days_in_train": len(on),
        "constant_mean": float(train["coin_in_usd"].mean()),
        "city_event_days": sorted(city_days),
        "as_of": as_of,
    }


def predict(params: dict, days: pd.DataFrame) -> pd.DataFrame:
    out = days[["gaming_date", "local_weekday"]].copy()
    base = out["local_weekday"].map(params["weekday_mean"])
    is_ev = out["gaming_date"].isin(params["city_event_days"])
    out["pred_model"] = base * np.where(is_ev, params["event_uplift"], 1.0)
    out["pred_weekday_only"] = base
    out["pred_baseline"] = params["constant_mean"]
    out["event_day"] = is_ev
    return out


def mae(a: pd.Series, p: pd.Series) -> float:
    return float((a - p).abs().mean())


def wape(a: pd.Series, p: pd.Series) -> float:
    return float((a - p).abs().sum() / a.abs().sum())


def run() -> dict:
    """Fit on Jan-Apr, test on May-Jun. Returns metrics + the holdout frame."""
    s = cfg()["split"]
    train_end, test_start = date.fromisoformat(s["train_end"]), date.fromisoformat(s["test_start"])
    d = floor_daily()
    train = d[d["gaming_date"] <= pd.Timestamp(train_end)]
    test = d[d["gaming_date"] >= pd.Timestamp(test_start)]
    params = fit(train, train_end)
    pr = predict(params, test).merge(test[["gaming_date", "coin_in_usd"]], on="gaming_date")
    pr = pr.rename(columns={"coin_in_usd": "actual"})
    m = {
        "train_range": [str(train.gaming_date.min().date()), str(train.gaming_date.max().date())],
        "test_range": [str(test.gaming_date.min().date()), str(test.gaming_date.max().date())],
        "mae_model": mae(pr.actual, pr.pred_model),
        "mae_weekday_only": mae(pr.actual, pr.pred_weekday_only),
        "mae_baseline": mae(pr.actual, pr.pred_baseline),
        "wape_model": wape(pr.actual, pr.pred_model),
        "wape_baseline": wape(pr.actual, pr.pred_baseline),
        "event_uplift": params["event_uplift"],
        "event_days_in_train": params["event_days_in_train"],
        "test_event_days": int(pr.event_day.sum()),
        "weekday_mean": params["weekday_mean"],
        "bias_model": float((pr.pred_model - pr.actual).mean()),
    }
    m["improvement_pct"] = 1 - m["mae_model"] / m["mae_baseline"]
    wk = pd.Series(params["weekday_mean"])
    m["peak_days"] = wk.sort_values(ascending=False).index[:2].tolist()
    m["trough_days"] = wk.sort_values().index[:2].tolist()
    m["peak_to_trough"] = float(wk.max() / wk.min())
    return {"metrics": m, "holdout": pr, "train": train}
