/**
 * One primary reason per machine, picked in a fixed order; every other reason that applies becomes a secondary tag.
 *
 * Order (documented on /evidence#method): check the payout → truly weak → set to pay back more → often down →
 * quiet spot → unlucky stretch → no clear problem. Truly weak comes before the game setting because a machine that
 * draws less play than its spot predicts is weak regardless of its payback setting.
 *
 * Rule masks re-derive pipeline/verdicts.py (same quantiles, same thresholds from meta.json); scripts/consistency.mjs
 * checks that first-match in the pipeline's order reproduces the exported verdict for every machine and period.
 * No runtime imports, so Node can load this file directly for that check.
 */

export type Reason = "inspect" | "weak" | "setting" | "downtime" | "location" | "luck" | "none";

export const REASON_ORDER: Reason[] = ["inspect", "weak", "setting", "downtime", "location", "luck", "none"];

/** The pipeline's own first-match order (verdict names), used only to verify the masks. */
export const PIPELINE_ORDER = ["inspect_hold", "downtime", "location", "luck", "truly_weak", "ok"] as const;
export type PipelineVerdict = (typeof PIPELINE_ORDER)[number];

export const REASON: Record<Reason, { label: string; sub?: string; color: string; short: string }> = {
  inspect: { label: "Check the payout", sub: "worth a look, not a finding", color: "#5E534F", short: "Payout" },
  weak: { label: "Truly weak", color: "#1F1716", short: "Weak" },
  setting: { label: "Set to pay back more", color: "#7A5AA8", short: "Setting" },
  downtime: { label: "Often down", color: "#A3434F", short: "Downtime" },
  location: { label: "Quiet spot", color: "#8A5A1E", short: "Location" },
  luck: { label: "Unlucky stretch", color: "#2F6EA3", short: "Luck" },
  none: { label: "No clear problem", sub: "earned less, but within normal range", color: "#6F655F", short: "None" },
};

/** Ch 2 section anchor each reason chip links to. */
export const REASON_ANCHOR: Record<Reason, string> = {
  inspect: "payout",
  weak: "ours",
  setting: "game-setting",
  downtime: "downtime",
  location: "location",
  luck: "luck",
  none: "ours",
};

export type ReasonRow = {
  machine_id: string;
  verdict: string;
  hold_flag: boolean | null;
  hold_expected: number;
  availability: number;
  lost_theo_usd: number;
  gap_to_zone_median_theo_usd: number;
  effect_shrunk_lo: number;
  effect_shrunk_hi: number;
  location_expected_per_hr: number;
  luck_z: number;
  luck_resid_usd: number;
  theo_per_avail_hr: number;
};

export type VerdictRules = {
  luck_z: number;
  downtime_avail_quantile: number;
  downtime_gap_share: number;
  location_quantile: number;
  theo_hr_low_quantile: number;
};

export type Rules = { low_hold_design: number; floor_median_hold: number };

/** pandas Series.quantile default (linear interpolation), NaN-skipping. */
export function quantile(xs: number[], q: number): number {
  const s = xs.filter((x) => x != null && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export type Flags = Record<Exclude<Reason, "none">, boolean>;

/** Every reason that applies to each machine in this period's floor (the cutoffs are floor-wide quantiles). */
export function flagsFor<T extends ReasonRow>(all: T[], vr: VerdictRules, rules: Rules): Map<string, Flags> {
  const avail = quantile(
    all.map((r) => r.availability),
    vr.downtime_avail_quantile,
  );
  const loc = quantile(
    all.map((r) => r.location_expected_per_hr),
    vr.location_quantile,
  );
  const theo = quantile(
    all.map((r) => r.theo_per_avail_hr),
    vr.theo_hr_low_quantile,
  );
  const out = new Map<string, Flags>();
  for (const r of all) {
    const gap = r.gap_to_zone_median_theo_usd;
    const f: Flags = {
      inspect: !!r.hold_flag,
      weak: r.effect_shrunk_hi < 1,
      setting: r.hold_expected <= rules.low_hold_design + 1e-9,
      downtime: r.availability <= avail && gap > 0 && r.lost_theo_usd >= vr.downtime_gap_share * gap,
      location: r.effect_shrunk_lo <= 1 && r.effect_shrunk_hi >= 1 && r.location_expected_per_hr <= loc,
      luck: Math.abs(r.luck_z) >= vr.luck_z && r.luck_resid_usd < 0 && r.theo_per_avail_hr > theo,
    };
    // The exported values are rounded (an upper bound of 0.99995 reads 1.0), so the pipeline's own verdict is
    // authoritative for its rule; the masks supply every other reason that applies.
    const own = FROM_VERDICT[r.verdict];
    if (own) f[own] = true;
    out.set(r.machine_id, f);
  }
  return out;
}

const FROM_VERDICT: Record<string, Exclude<Reason, "none" | "setting">> = {
  inspect_hold: "inspect",
  downtime: "downtime",
  location: "location",
  luck: "luck",
  truly_weak: "weak",
};

/** First match in the pipeline's order; must equal the exported verdict. */
export function pipelineVerdict(f: Flags): PipelineVerdict {
  if (f.inspect) return "inspect_hold";
  if (f.downtime) return "downtime";
  if (f.location) return "location";
  if (f.luck) return "luck";
  if (f.weak) return "truly_weak";
  return "ok";
}

export function primary(f: Flags): Reason {
  return REASON_ORDER.find((k) => k === "none" || f[k]) ?? "none";
}

export function secondary(f: Flags): Reason[] {
  const p = primary(f);
  return REASON_ORDER.filter((k) => k !== "none" && k !== p && f[k]);
}

export type Tally = { counts: Record<Reason, number>; notProblem: number; weak: number; setting: number; n: number };

/** Chip counts (sum = n), headline (n − truly weak) and the game-setting flag count for a list of machines. */
export function tally(ids: string[], flags: Map<string, Flags>): Tally {
  const counts = Object.fromEntries(REASON_ORDER.map((k) => [k, 0])) as Record<Reason, number>;
  let setting = 0;
  for (const id of ids) {
    const f = flags.get(id);
    if (!f) continue;
    counts[primary(f)]++;
    if (f.setting) setting++;
  }
  return { counts, weak: counts.weak, notProblem: ids.length - counts.weak, setting, n: ids.length };
}

const REST: Record<Reason, string> = {
  inspect: "need a payout check",
  weak: "are truly weak",
  setting: "are set to pay back more",
  downtime: "are often down",
  location: "sit in quiet spots",
  luck: "had an unlucky stretch",
  none: "show no clear problem",
};

/**
 * Ch 1 supporting sentence, true for any period: the game-setting count, then the biggest primary reason among
 * the rest. E.g. "5 are set to pay back more; 2 of the other 5 sit in quiet spots."
 */
export function supportSentence(ids: string[], flags: Map<string, Flags>): string {
  const set = ids.filter((id) => flags.get(id)?.setting);
  const rest = ids.filter((id) => !flags.get(id)?.setting);
  if (!rest.length) return `All ${ids.length} are set to pay back more.`;
  const t = tally(rest, flags);
  const top = REASON_ORDER.filter((k) => t.counts[k] > 0).sort((a, b) => t.counts[b] - t.counts[a])[0];
  const k = t.counts[top];
  const both = set.filter((id) => flags.get(id)?.weak).length;
  const lead = set.length
    ? `${set.length} are set to pay back more${both ? ` (${both} of them also truly weak)` : ""}; `
    : "None are set to pay back more; ";
  if (!set.length) return `${lead}${k === rest.length ? "all" : k} of the ${rest.length} ${REST[top]}.`;
  return `${lead}${k === rest.length ? `the other ${k}` : `${k} more`} ${REST[top]}.`;
}
