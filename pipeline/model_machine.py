"""Model 1: expected coin-in per available hour from location + game + calendar (no machine identity).

Validation: train Jan-Mar, validate Apr (early stopping picks rounds), final fit Jan-Apr, test May-Jun.
Baseline: zone x weekday coin-in per available hour (ratio of sums over the fit window).
Scorecard expectation: out-of-fold predictions grouped by machine, so a machine's own play never
sets its own expectation (otherwise slot-level features could absorb the machine effect).
"""

from __future__ import annotations

from datetime import date
from functools import cache

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold

from pipeline.config import cfg
from pipeline.load import machine_days, table

CAT = ["zone_id", "local_weekday", "volatility_class", "manufacturer", "lease_class"]
NUM = [
    "bank_x",
    "bank_y",
    "dist_entrance_m",
    "end_cap",
    "bank_capacity",
    "is_weekend",
    "holiday",
    "event",
    "day_index",
    "entrance_path_m",
    "configured_rtp",
    "hit_probability",
    "max_multiplier",
    "min_bet_usd",
    "max_bet_usd",
]
FEATURES = CAT + NUM
# Identity-like columns that must never be features (each pins down one machine or its own history).
FORBIDDEN = {
    "machine_id",
    "location_id",
    "bank_id",
    "theme",
    "config_id",
    "lag_coin_in_7d_mean_usd",
    "lag_downtime_7d_hours",
    "lag_house_win_28d_usd",
}
MIN_HOURS = 1.0
ENTRANCE_ZONE = "Z-ENT"


def _d(s: str) -> pd.Timestamp:
    return pd.Timestamp(s)


def slot_features() -> pd.DataFrame:
    """Per location_id: bank centroid, distance to nearest entrance, end-cap flag, bank capacity."""
    fl = table("floor_locations")
    slots = fl[fl.node_type == "slot"][["location_id", "bank_id", "x_m", "y_m"]]
    banks = fl[fl.node_type == "bank"].set_index("bank_id")[["x_m", "y_m", "capacity"]]
    ent = fl[fl.node_type == "entrance"][["x_m", "y_m"]].to_numpy()
    s = slots.join(banks.add_prefix("bank_"), on="bank_id")
    s = s.rename(columns={"bank_x_m": "bank_x", "bank_y_m": "bank_y"})
    xy = s[["x_m", "y_m"]].to_numpy()
    s["dist_entrance_m"] = np.sqrt(((xy[:, None, :] - ent[None, :, :]) ** 2).sum(-1)).min(1)
    # End cap = the two slots farthest from their bank centroid.
    s["_r"] = np.hypot(s.x_m - s.bank_x, s.y_m - s.bank_y)
    s["end_cap"] = (s.groupby("bank_id")["_r"].rank(ascending=False, method="first") <= 2).astype(int)
    return s.set_index("location_id")[["bank_x", "bank_y", "dist_entrance_m", "end_cap", "bank_capacity"]]


def entrance_paths() -> pd.DataFrame:
    """Shortest walkway distance (m) from the entrance zone to each zone, per gaming date, honoring closures."""
    w = table("floor_walkways")
    zones = sorted(set(w.zone_a) | set(w.zone_b))
    rows = []
    for d in pd.date_range("2025-01-01", "2025-06-30"):
        closed = w.closed_from_utc.notna() & (w.closed_from_utc.dt.normalize() <= d) & (w.closed_to_utc.dt.normalize() >= d)
        e = w[~closed]
        dist = {z: np.inf for z in zones}
        dist[ENTRANCE_ZONE] = 0.0
        todo = set(zones)
        while todo:
            u = min(todo, key=dist.get)
            todo.remove(u)
            for _, r in e[(e.zone_a == u) | (e.zone_b == u)].iterrows():
                v = r.zone_b if r.zone_a == u else r.zone_a
                dist[v] = min(dist[v], dist[u] + r.length_m)
        rows += [(z, d, dist[z]) for z in zones]
    return pd.DataFrame(rows, columns=["zone_id", "gaming_date", "entrance_path_m"])


def features(md: pd.DataFrame) -> pd.DataFrame:
    gm = table("game_math").set_index("config_id")[["hit_probability", "max_multiplier", "min_bet_cents", "max_bet_cents"]]
    X = md.join(slot_features(), on="location_id").join(gm, on="config_id")
    X["min_bet_usd"] = X.pop("min_bet_cents") / 100
    X["max_bet_usd"] = X.pop("max_bet_cents") / 100
    X["is_weekend"] = X["is_weekend"].astype(int)
    X["holiday"] = X["federal_holiday"].notna().astype(int)
    X["event"] = X["events_active"].notna().astype(int)
    X["day_index"] = (X["gaming_date"] - _d("2025-01-01")).dt.days
    X = X.merge(entrance_paths(), on=["zone_id", "gaming_date"], how="left").set_axis(X.index)
    for c in CAT:
        X[c] = X[c].astype("category")
    return X


@cache
def dataset() -> pd.DataFrame:
    """Machine-days with >= 1 available hour, features, target rate and weight."""
    md = machine_days()
    md = md[md.available_hours >= MIN_HOURS].copy()
    X = features(md)
    X["rate"] = X["coin_in_usd"] / X["available_hours"]
    cats = {c: sorted(X[c].dropna().unique()) for c in CAT}
    for c in CAT:
        X[c] = pd.Categorical(X[c].astype(str), categories=cats[c])
    return X.reset_index(drop=True)


def params() -> dict:
    return {
        "objective": "regression",
        "learning_rate": 0.05,
        "num_leaves": 31,
        "min_child_samples": 400,
        "feature_fraction": 0.9,
        "lambda_l2": 1.0,
        "seed": cfg()["seed"],
        "deterministic": True,
        "force_row_wise": True,
        "num_threads": 4,
        "verbose": -1,
    }


def _fit(d: pd.DataFrame, rounds: int, valid: pd.DataFrame | None = None) -> lgb.Booster:
    assert not FORBIDDEN & set(FEATURES)
    tr = lgb.Dataset(d[FEATURES], d["rate"], weight=d["available_hours"], categorical_feature=CAT, free_raw_data=False)
    kw: dict = {}
    if valid is not None:
        va = lgb.Dataset(valid[FEATURES], valid["rate"], weight=valid["available_hours"], reference=tr)
        kw = {"valid_sets": [va], "callbacks": [lgb.early_stopping(100, verbose=False)]}
    return lgb.train(params(), tr, num_boost_round=rounds, **kw)


def zone_weekday_baseline(fit: pd.DataFrame, apply: pd.DataFrame) -> np.ndarray:
    g = fit.groupby(["zone_id", "local_weekday"], observed=True)[["coin_in_usd", "available_hours"]].sum()
    r = (g["coin_in_usd"] / g["available_hours"]).rename("b")
    return apply.join(r, on=["zone_id", "local_weekday"])["b"].to_numpy()


def scores(d: pd.DataFrame, rate_pred: np.ndarray) -> dict:
    """Errors in coin-in USD per machine-day (rate x available hours)."""
    pred = rate_pred * d["available_hours"].to_numpy()
    act = d["coin_in_usd"].to_numpy()
    err = np.abs(pred - act)
    return {"mae_usd": float(err.mean()), "wmape": float(err.sum() / act.sum()), "bias_usd": float((pred - act).mean())}


def split(d: pd.DataFrame) -> dict[str, pd.DataFrame]:
    s = cfg()["split"]
    t = d["gaming_date"]
    return {
        "inner": d[t <= _d(s["inner_train_end"])],
        "valid": d[(t > _d(s["inner_train_end"])) & (t <= _d(s["inner_valid_end"]))],
        "fit": d[t <= _d(s["train_end"])],
        "test": d[t >= _d(s["test_start"])],
    }


@cache
def run() -> dict:
    d = dataset()
    sp = split(d)
    inner = _fit(sp["inner"], 3000, valid=sp["valid"])
    best = int(inner.best_iteration or inner.current_iteration())
    final = _fit(sp["fit"], best)
    test = sp["test"]
    m = scores(test, final.predict(test[FEATURES]))
    b = scores(test, zone_weekday_baseline(sp["fit"], test))
    imp = pd.Series(final.feature_importance("gain"), index=FEATURES)
    imp = (imp / imp.sum()).sort_values(ascending=False)
    metrics = {
        "best_iteration": best,
        "n_train": len(sp["fit"]),
        "n_test": len(test),
        "mae_model": m["mae_usd"],
        "mae_baseline": b["mae_usd"],
        "wmape_model": m["wmape"],
        "wmape_baseline": b["wmape"],
        "bias_model": m["bias_usd"],
        "improvement_pct": 1 - m["mae_usd"] / b["mae_usd"],
        "importance": {k: round(float(v), 4) for k, v in imp.items()},
    }
    return {"metrics": metrics, "model": final, "best_iteration": best}


@cache
def oof_rates() -> pd.Series:
    """Expected rate per (machine_id, gaming_date), predicted by models that never saw that machine."""
    d = dataset()
    rounds = run()["best_iteration"]
    pred = np.empty(len(d))
    for tr, te in GroupKFold(n_splits=5).split(d, groups=d["machine_id"]):
        pred[te] = _fit(d.iloc[tr], rounds).predict(d.iloc[te][FEATURES])
    return pd.Series(pred, index=pd.MultiIndex.from_frame(d[["machine_id", "gaming_date"]]), name="rate")


def expected_rate_model(md: pd.DataFrame) -> pd.Series:
    """Model 1 expectation for each machine-day in md (days below MIN_HOURS fall back to the zone-day mean).

    config location_calibration 'zone_day_loo': scale by peers' actual/expected coin-in in the same zone and
    day, excluding the machine itself, so zone-day shocks (walkway closure, zone events) stay in location.
    """
    r = oof_rates()
    key = pd.MultiIndex.from_frame(md[["machine_id", "gaming_date"]])
    out = pd.Series(r.reindex(key).to_numpy(), index=md.index)
    zd = out.groupby([md["zone_id"], md["gaming_date"]]).transform("mean")
    out = out.fillna(zd).clip(lower=0)
    if cfg().get("location_calibration") == "zone_day_loo":
        out = out * zone_day_loo_factor(md, out)
    return out


def zone_day_loo_factor(md: pd.DataFrame, rate: pd.Series) -> pd.Series:
    """sum(actual) / sum(expected) over the other machines in the same zone and day (1.0 if no peers)."""
    exp = rate * md["available_hours"]
    keys = [md["zone_id"], md["gaming_date"]]
    a = md["coin_in_usd"].groupby(keys).transform("sum") - md["coin_in_usd"]
    e = exp.groupby(keys).transform("sum") - exp
    return (a / e.where(e > 0)).fillna(1.0)


def persistence(train_sc: pd.DataFrame, test_sc: pd.DataFrame, k: int = 10) -> dict:
    """Do Jan-Apr machine effects predict May-Jun? Spearman (Fisher CI) and precision@k (Wilson CI)."""
    from scipy import stats

    n_min = cfg()["persistence"]["min_days_each_window"]
    a = train_sc.set_index("machine_id")
    b = test_sc.set_index("machine_id")
    ids = a.index[(a.days_on_floor >= n_min)].intersection(b.index[b.days_on_floor >= n_min])
    x, y = a.loc[ids, "machine_effect_shrunk"], b.loc[ids, "machine_effect_shrunk"]
    ok = x.notna() & y.notna()
    x, y = x[ok], y[ok]
    n = len(x)
    rho = float(stats.spearmanr(x, y).statistic)
    z, se = np.arctanh(rho), 1 / np.sqrt(n - 3)
    zc = stats.norm.ppf(0.5 + cfg()["bootstrap"]["ci"] / 2)
    hits = len(set(x.nsmallest(k).index) & set(y.nsmallest(k).index))
    p = hits / k
    den = 1 + zc**2 / k
    c = (p + zc**2 / (2 * k)) / den
    h = zc * np.sqrt(p * (1 - p) / k + zc**2 / (4 * k**2)) / den
    return {
        "n": n,
        "spearman": rho,
        "spearman_lo": float(np.tanh(z - zc * se)),
        "spearman_hi": float(np.tanh(z + zc * se)),
        "precision_at_k": p,
        "precision_lo": float(max(0, c - h)),
        "precision_hi": float(min(1, c + h)),
        "k": k,
        "random_precision": k / n,
        "bottom_train": list(x.nsmallest(k).index),
        "bottom_test": list(y.nsmallest(k).index),
    }


def as_of_split() -> tuple[date, date]:
    s = cfg()["split"]
    return _d(s["train_end"]).date(), _d(s["test_start"]).date()
