/** Client-side port of pipeline/budget.py line_cost + validate, so the allocator applies the same rules as the pipeline. */
export type CatalogRow = {
  action_type_id: string;
  name: string;
  unit: string;
  unit_cost_usd: number;
  recurring_usd_per_day: number;
  lead_days: number;
  live_days: number;
  unit_total_usd: number;
  downtime_minutes: number;
  quantity_limit: number;
  incompatibility_group: string | null;
  notes: string;
};
export type Rules = { total_usd: number; horizon_days: number; max_action_types: number };
export type AllocLine = { id: string; quantity: number; targets: string[] };

export const HOLD = "A-HOLD";

export function lineCost(c: CatalogRow, quantity: number): number {
  return quantity * (c.unit_cost_usd + c.recurring_usd_per_day * Math.max(0, c.live_days));
}

export function planTotal(lines: AllocLine[], cat: Map<string, CatalogRow>): number {
  return lines.filter((l) => l.id !== HOLD).reduce((s, l) => s + lineCost(cat.get(l.id)!, l.quantity), 0);
}

/** Rule violations (empty = valid): cap, <= max types, quantity limits, one comp policy action, no machine in two actions. */
export function validate(lines: AllocLine[], cat: Map<string, CatalogRow>, rules: Rules): string[] {
  const errs: string[] = [];
  const active = lines.filter((l) => l.quantity > 0 && l.id !== HOLD);
  if (active.length > rules.max_action_types) errs.push(`${active.length} action types; at most ${rules.max_action_types} allowed`);
  const total = planTotal(active, cat);
  if (total > rules.total_usd + 1e-6)
    errs.push(`total $${Math.round(total).toLocaleString("en-US")} exceeds $${rules.total_usd.toLocaleString("en-US")}`);
  for (const l of active) {
    const c = cat.get(l.id)!;
    if (l.quantity > c.quantity_limit) errs.push(`${l.id}: quantity ${l.quantity} > limit ${c.quantity_limit}`);
  }
  const groups = new Map<string, AllocLine[]>();
  for (const l of active) {
    const g = cat.get(l.id)!.incompatibility_group;
    if (g) groups.set(g, [...(groups.get(g) ?? []), l]);
  }
  for (const [g, ls] of groups) {
    if (ls.length < 2) continue;
    if (g === "comp_policy") {
      errs.push(`incompatible: ${ls.map((l) => l.id).join(" + ")} (one comp policy action)`);
      continue;
    }
    const seen = new Map<string, string>();
    for (const l of ls)
      for (const t of l.targets) {
        const prev = seen.get(t);
        if (prev && prev !== l.id) errs.push(`incompatible on ${t}: ${prev} + ${l.id}`);
        seen.set(t, l.id);
      }
  }
  return errs;
}
