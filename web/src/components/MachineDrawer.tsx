import { m } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Drawer } from "vaul";
import type { ScoreRow } from "../lib/data";
import { fmt } from "../lib/format";
import { useDrawerList, useMachineParam } from "../lib/uiStore";
import { useJson, useScorecard } from "../lib/useData";
import { GameSettingChip } from "./ui/game-setting-chip";
import { useFilters } from "../lib/urlState";
import { Button } from "./ui/button";
import { Kbd } from "./ui/kbd";
import { StatusPill } from "./ui/status-pill";
import { Tabs, TabsContent, TabsList } from "./ui/tabs";
import { Tip } from "./ui/tooltip";

/** Global right drawer for one machine (?machine=). ←/→ step through the list that opened it. */
export function MachineDrawer() {
  const [f] = useFilters();
  const { all } = useScorecard(f);
  const meta = useJson<{ rules?: { low_hold_design: number; floor_median_hold: number } }>("meta.json");
  const lab = useJson<{ alternatives: { moved: { moves: Move[] } } | null }>("model_lab.json");
  const floorCarded = useMemo(() => {
    const ci = (all ?? []).reduce((t, r) => t + r.coin_in_usd, 0);
    return ci ? (all ?? []).reduce((t, r) => t + r.carded_coin_in_usd, 0) / ci : null;
  }, [all]);
  const [id, setId] = useMachineParam();
  const list = useDrawerList();
  const row = useMemo(() => all?.find((r) => r.machine_id === id) ?? null, [all, id]);
  const seq = list.length ? list : (all ?? []).map((r) => r.machine_id).sort();
  const i = id ? seq.indexOf(id) : -1;
  const step = (d: number) => i >= 0 && seq[i + d] && setId(seq[i + d]);

  useEffect(() => {
    if (!row) return;
    const k = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  return (
    <Drawer.Root open={!!row} onOpenChange={(o) => !o && setId(null)} direction="right">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-bg/40" />
        <Drawer.Content
          data-testid="machine-drawer"
          aria-describedby={undefined}
          className="fixed bottom-2 right-2 top-2 z-50 flex w-[520px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-xl bg-surface-3 shadow-float outline-none"
        >
          {row && (
            <Body
              row={row}
              pos={i}
              n={seq.length}
              step={step}
              close={() => setId(null)}
              floorCarded={floorCarded}
              rules={meta.data?.rules}
              moves={(lab.data?.alternatives?.moved.moves ?? []).filter((mv) => mv.machine_id === row.machine_id)}
            />
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function Body({
  row,
  pos,
  n,
  step,
  close,
  floorCarded,
  moves,
  rules,
}: {
  row: ScoreRow;
  pos: number;
  n: number;
  step: (d: number) => void;
  close: () => void;
  floorCarded: number | null;
  moves: Move[];
  rules?: { low_hold_design: number; floor_median_hold: number };
}) {
  return (
    <>
      <div className="sticky top-0 border-b border-divider px-5 pb-0 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Drawer.Title asChild>
              <m.h2 layoutId={`id-${row.machine_id}`} className="mono text-xl font-semibold text-fg">
                {row.machine_id}
              </m.h2>
            </Drawer.Title>
            <m.span layoutId={`pill-${row.machine_id}`}>
              <StatusPill verdict={row.verdict} />
            </m.span>
          </div>
          <div className="flex items-center gap-1">
            {pos >= 0 && (
              <span className="mono mr-1 text-2xs text-fg-subtle">
                {pos + 1} / {n}
              </span>
            )}
            <Tip label="Previous" keys={["←"]}>
              <Button variant="ghost" size="icon-sm" aria-label="Previous machine" onClick={() => step(-1)}>
                <ChevronLeft size={16} strokeWidth={1.5} aria-hidden />
              </Button>
            </Tip>
            <Tip label="Next" keys={["→"]}>
              <Button variant="ghost" size="icon-sm" aria-label="Next machine" onClick={() => step(1)}>
                <ChevronRight size={16} strokeWidth={1.5} aria-hidden />
              </Button>
            </Tip>
            <Tip label="Close" keys={["Esc"]}>
              <Button variant="ghost" size="icon-sm" aria-label="Close drawer" onClick={close}>
                <X size={16} strokeWidth={1.5} aria-hidden />
              </Button>
            </Tip>
          </div>
        </div>
        <p className="mt-1 text-sm text-fg-muted">
          <span className="mono text-xs">{row.zone_id}</span> › <span className="mono text-xs">{row.bank_id}</span> ›{" "}
          <span className="mono text-xs">{row.location_id}</span> · {row.theme} · {String(row.volatility_class ?? "")} volatility
          {rules && row.hold_expected <= rules.low_hold_design && (
            <span className="ml-2 inline-block align-middle">
              <GameSettingChip hold={row.hold_expected} median={rules.floor_median_hold} />
            </span>
          )}
        </p>
        <Tabs defaultValue="breakdown" className="mt-3">
          <TabsList
            tabs={[
              { value: "breakdown", label: "Breakdown" },
              { value: "hold", label: "Hold & luck" },
              { value: "location", label: "Location" },
            ]}
          />
          <div className="-mx-5 max-h-[calc(100vh-170px)] overflow-y-auto px-5 py-5">
            <TabsContent value="breakdown">
              <p className="max-w-prose text-base text-fg">{row.verdict_reason}</p>
              <Waterfall row={row} />
            </TabsContent>
            <TabsContent value="hold">
              <Stats
                items={[
                  ["Hold observed", fmt.pct(row.hold_obs)],
                  ["90% CI", `${fmt.pct(row.hold_ci_lo)} – ${fmt.pct(row.hold_ci_hi)}`],
                  ["Hold configured", fmt.pct(row.hold_expected)],
                  ["Luck residual", fmt.usd(row.luck_resid_usd)],
                  ["Luck z", fmt.num(row.luck_z, 2)],
                  ["Hold flag (BH-FDR)", row.hold_flag ? "Inspect" : "No"],
                ]}
              />
            </TabsContent>
            <TabsContent value="location">
              <Stats
                items={[
                  ["Coin-in / avail hr", fmt.usd(row.coin_in_per_avail_hr)],
                  ["Location expects", `${fmt.usd(row.location_expected_per_hr)}/hr`],
                  ["Machine effect (shrunk)", fmt.num(row.machine_effect_shrunk)],
                  ["90% CI", `${fmt.num(row.effect_shrunk_lo)} – ${fmt.num(row.effect_shrunk_hi)}`],
                  ["Availability", fmt.pct(row.availability)],
                  ["Days on floor", String(row.days_on_floor)],
                  ["Carded share of coin-in", `${fmt.pct(row.carded_share)} (floor ${fmt.pct(floorCarded)})`],
                ]}
              />
              {moves.map((mv) => (
                <p key={mv.moved_on} className="mt-3 text-xs text-fg-muted" data-testid="drawer-move">
                  Moved {mv.moved_on}, {mv.from_zone} → {mv.to_zone}: spot expected {fmt.usd(mv.spot_before)} → {fmt.usd(mv.spot_after)}
                  /hr, actual {fmt.usd(mv.rate_before)} → {fmt.usd(mv.rate_after)}/hr.
                </p>
              ))}
            </TabsContent>
          </div>
        </Tabs>
      </div>
      <p className="mt-auto flex items-center gap-2 border-t border-divider px-5 py-2 text-2xs text-fg-subtle">
        <Kbd>←</Kbd>
        <Kbd>→</Kbd> step through list · <Kbd>Esc</Kbd> close
      </p>
    </>
  );
}

type Move = {
  machine_id: string;
  moved_on: string;
  from_zone: string;
  to_zone: string;
  spot_before: number;
  spot_after: number;
  rate_before: number;
  rate_after: number;
};

/** Theo → downtime → luck → house win, as horizontal bars from a common zero. */
function Waterfall({ row }: { row: ScoreRow }) {
  // house win = theo + luck residual; theo itself is what was left after downtime
  const items: [string, number, string][] = [
    ["Theo if always available", row.theo_usd + row.lost_theo_usd, "bg-fg-subtle"],
    ["Lost to downtime", -row.lost_theo_usd, "bg-verdict-downtime"],
    ["Theo (expected win)", row.theo_usd, "bg-fg-muted"],
    ["Luck vs. theo", row.luck_resid_usd, "bg-verdict-luck"],
    ["House win", row.house_win_usd, "bg-gold"],
  ];
  const max = Math.max(...items.map(([, v]) => Math.abs(v)), 1);
  return (
    <dl className="mt-5 space-y-2.5" aria-label="House win breakdown">
      {items.map(([k, v, c]) => (
        <div key={k} className="grid grid-cols-[150px_1fr_88px] items-center gap-3 text-sm">
          <dt className="text-fg-muted">{k}</dt>
          <dd className="h-2 rounded-full bg-surface-2">
            <div className={`h-2 rounded-full ${c}`} style={{ width: `${(Math.abs(v) / max) * 100}%` }} />
          </dd>
          <dd className="mono text-right text-xs text-fg">{fmt.usd(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Stats({ items }: { items: [string, string][] }) {
  return (
    <dl className="divide-y divide-divider">
      {items.map(([k, v]) => (
        <div key={k} className="flex h-row items-center justify-between text-sm">
          <dt className="text-fg-muted">{k}</dt>
          <dd className="mono text-xs text-fg">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
