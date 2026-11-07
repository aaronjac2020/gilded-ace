import { m } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, type ReactNode } from "react";
import { Drawer } from "vaul";
import type { ScoreRow } from "../lib/data";
import { fmt } from "../lib/format";
import { useDrawerList, useMachineParam } from "../lib/uiStore";
import { useJson, useScorecard } from "../lib/useData";
import { GameSettingChip } from "./ui/game-setting-chip";
import { useFilters } from "../lib/urlState";
import { Button } from "./ui/button";
import { Kbd } from "./ui/kbd";
import { EvidenceLink } from "./EvidenceLink";
import { VerdictStamp } from "./theme/VerdictStamp";
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
          className="fixed bottom-2 right-2 top-2 z-50 flex w-[520px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-xl border-l border-gold/50 bg-lacquer shadow-float outline-none ring-1 ring-gold/15"
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
          <p className="label-sc text-gold-soft/80">Case file</p>
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
        <div className="mt-1 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Drawer.Title asChild>
              <m.h2 layoutId={`id-${row.machine_id}`} className="mono text-3xl font-semibold tracking-tight text-ivory">
                {row.machine_id}
              </m.h2>
            </Drawer.Title>
            <p className="mono mt-1 text-xs text-fg-muted">
              {row.zone_id} › {row.bank_id} › {row.location_id}
            </p>
          </div>
          <VerdictStamp key={row.machine_id} verdict={row.verdict} surface="dark" animate className="mt-2 text-[13px]" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="rounded-sm border border-divider px-1.5 py-0.5 text-2xs text-fg-muted">{row.theme}</span>
          <span className="rounded-sm border border-divider px-1.5 py-0.5 text-2xs text-fg-muted">
            {String(row.volatility_class ?? "")} volatility
          </span>
          {rules && row.hold_expected <= rules.low_hold_design && (
            <GameSettingChip hold={row.hold_expected} median={rules.floor_median_hold} />
          )}
        </div>
        <Tabs defaultValue="call" className="mt-4">
          <TabsList
            tabs={[
              { value: "call", label: "The call" },
              { value: "breakdown", label: "Breakdown" },
              { value: "hold", label: "Hold & luck" },
              { value: "location", label: "Location" },
            ]}
          />
          <div className="-mx-5 max-h-[calc(100vh-230px)] overflow-y-auto px-5 py-5">
            <TabsContent value="call">
              <TheCall row={row} rules={rules} />
            </TabsContent>
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

/** Next step and its falsifier, per verdict. Neutral: a lead to verify, never a finding about intent. */
const NEXT: Record<ScoreRow["verdict"], [string, string]> = {
  luck: ["Keep it. Short-run payouts ran against the house; theo is in line.", "House win still below theo after another 60 days of play."],
  location: ["Keep the machine; test the spot. A candidate for the controlled move test.", "Play stays low after a move to a busier spot."],
  downtime: ["Fix availability first: open tickets, parts, response time.", "Play per available hour stays low once uptime recovers."],
  inspect_hold: [
    "Inspect and verify the paytable and meter readings.",
    "Verification matches the configured setting; the hold variance then reads as chance.",
  ],
  truly_weak: [
    "A replace or lease-swap candidate in the plan.",
    "The effect interval moves above zero with more days, or a move test lifts play.",
  ],
  ok: ["No action. Performs in line with its spot and game.", "The effect interval drops below zero in a later period."],
};

/** Numbered evidence with dotted leaders, each line linked to the chart behind it, then the call in one sentence. */
function TheCall({ row, rules }: { row: ScoreRow; rules?: { low_hold_design: number; floor_median_hold: number } }) {
  const low = !!rules && row.hold_expected <= rules.low_hold_design;
  const items: { k: string; v: string; link: ReactNode; note?: string }[] = [
    {
      k: "Expected play at this spot",
      v: `${fmt.usd(row.location_expected_per_hr)}/hr`,
      link: <EvidenceLink to="/floor" focus="map" filters={{ bank: row.bank_id }} label="Floor" />,
    },
    {
      k: "Actual play · effect",
      v: `${fmt.usd(row.coin_in_per_avail_hr)}/hr · ${fmt.num(row.machine_effect_shrunk)} [${fmt.num(row.effect_shrunk_lo)}–${fmt.num(row.effect_shrunk_hi)}]`,
      link: <EvidenceLink to="/model" focus="persistence" label="Model" />,
    },
    {
      k: "Availability · lost theo",
      v: `${fmt.pct(row.availability)} · ${fmt.usd(row.lost_theo_usd)}`,
      link: <EvidenceLink to="/downtime" focus="lost" label="Downtime" />,
    },
    {
      k: "Luck · z",
      v: `${fmt.usd(row.luck_resid_usd)} · ${fmt.num(row.luck_z, 2)}`,
      link: <EvidenceLink to="/floor" focus="map" label="Floor" />,
    },
    {
      k: "Hold vs. configured",
      v: `${fmt.pct(row.hold_obs)} vs. ${fmt.pct(row.hold_expected)}`,
      link: <EvidenceLink to="/model" focus="ranking-compare" label="Model" />,
      note: low ? "Game setting: pays back more by design. Low win here is partly game math." : undefined,
    },
  ];
  return (
    <div data-testid="the-call">
      <p className="mb-6 border-b border-gold/25 pb-5 text-base leading-relaxed text-ivory">
        <span className="label-sc mb-1.5 block text-gold-soft">The call</span>
        {row.verdict_reason}
      </p>
      <p className="label-sc mb-3 text-fg-muted">Evidence</p>
      <ol className="space-y-3">
        {items.map((it, i) => (
          <li key={it.k} className="text-sm">
            <div className="flex items-baseline gap-2">
              <span className="serif w-4 shrink-0 text-gold-soft">{i + 1}</span>
              <span className="shrink-0 text-fg-muted">{it.k}</span>
              <span className="mb-1 min-w-4 flex-1 border-b border-dotted border-fg-subtle/60" aria-hidden />
              <span className="mono shrink-0 text-xs text-fg">{it.v}</span>
              <span className="w-[72px] shrink-0 text-right [&_a]:text-fg-muted [&_a:hover]:text-gold">{it.link}</span>
            </div>
            {it.note && <p className="ml-6 mt-1 text-xs text-gold-soft">{it.note}</p>}
          </li>
        ))}
      </ol>
      <dl className="mt-8 grid gap-6 border-t border-divider pt-6 sm:grid-cols-2">
        <div>
          <dt className="label-sc text-fg-muted">What we’d do</dt>
          <dd className="mt-2 text-sm text-fg">{NEXT[row.verdict][0]}</dd>
        </div>
        <div>
          <dt className="label-sc text-fg-muted">What would change the call</dt>
          <dd className="mt-2 text-sm text-fg">{NEXT[row.verdict][1]}</dd>
        </div>
      </dl>
    </div>
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
