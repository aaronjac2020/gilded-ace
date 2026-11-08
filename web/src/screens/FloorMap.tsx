import * as d3 from "d3";
import { Maximize2, Minus, Pause, Play, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { MONTHS } from "../components/shell/nav";
import { PERIOD_LABELS, PERIOD_LONG } from "../components/shell/nav";
import { HeroBand, Kpi, KpiStrip } from "../components/ui/hero-band";
import { Num } from "../components/ui/num";
import { ErrorState, ScreenSkeleton } from "../components/ui/skeleton";
import { Button } from "../components/ui/button";
import { Tip } from "../components/ui/tooltip";
import { Chip } from "../components/theme/Chip";
import { GoldNumber } from "../components/theme/GoldNumber";
import { CardIndex } from "../components/theme/Deco";
import { cn } from "../lib/cn";
import { rows as decode, type Columnar, type ScoreRow } from "../lib/data";
import { fmt } from "../lib/format";
import { hoverStore, useHover, useMachineParam } from "../lib/uiStore";
import { useJson, useScorecard } from "../lib/useData";
import { useFilters } from "../lib/urlState";
import { colors, scales, verdictColors, verdictLabels, verdictOrder, type Verdict } from "../theme/tokens";

type Floor = { slots: Columnar; banks: Columnar; zones: Columnar; landmarks: Columnar; walkways: Columnar };
type Slot = { location_id: string; zone_id: string; bank_id: string; x_m: number; y_m: number };
type Zone = { zone_id: string; name: string; x_m: number; y_m: number };
type Walk = { walkway_id: string; zone_a: string; zone_b: string; closed_from_utc: string | null };
type Metric = "verdict" | "effect" | "win" | "downtime";

const METRICS: { id: Metric; label: string; legend: string }[] = [
  { id: "verdict", label: "Verdict", legend: "" },
  { id: "effect", label: "Machine effect", legend: "play vs. spot and game expectation" },
  { id: "win", label: "House win", legend: "house win, period quintiles" },
  { id: "downtime", label: "Downtime", legend: "theo lost to downtime" },
];

const W = 1000;
const H = 640;
const PAD = 32;

export default function FloorMap() {
  const [f, setF] = useFilters();
  const floor = useJson<Floor>("floor.json");
  const { all, error } = useScorecard(f);
  const [machine, open] = useMachineParam();
  const hover = useHover();
  const [tip, setTip] = useState<{ r: ScoreRow; x: number; y: number } | null>(null);
  const [metric, setMetric] = useState<Metric>("verdict");
  const [t, setT] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const svg = useRef<SVGSVGElement>(null);
  const zoom = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const geo = useMemo(() => {
    if (!floor.data) return null;
    const slots = decode<Slot>(floor.data.slots);
    const zones = decode<Zone>(floor.data.zones);
    const walks = decode<Walk>(floor.data.walkways);
    const xs = d3.extent(slots, (s) => s.x_m) as [number, number];
    const ys = d3.extent(slots, (s) => s.y_m) as [number, number];
    const k = Math.min((W - 2 * PAD) / (xs[1] - xs[0]), (H - 2 * PAD - 48) / (ys[1] - ys[0]));
    const ox = (W - (xs[1] - xs[0]) * k) / 2;
    const oy = (H - (ys[1] - ys[0]) * k) / 2 + 12;
    const sx = (x: number) => ox + (x - xs[0]) * k;
    const sy = (y: number) => oy + (y - ys[0]) * k;
    const hulls = [...d3.group(slots, (s) => s.zone_id)].map(([z, ss]) => {
      const pts = ss.map((s) => [sx(s.x_m), sy(s.y_m)] as [number, number]);
      const hull = d3.polygonHull(pts) ?? pts;
      const ys2 = d3.extent(pts, (p) => p[1]) as [number, number];
      return { z, hull, c: d3.polygonCentroid(hull), top: ys2[0], name: zones.find((q) => q.zone_id === z)?.name ?? z };
    });
    const banks = [...d3.group(slots, (s) => s.bank_id)].map(([b, ss]) => {
      const x = d3.extent(ss, (s) => sx(s.x_m)) as [number, number];
      const y = d3.extent(ss, (s) => sy(s.y_m)) as [number, number];
      return { b, zone: ss[0].zone_id, x0: x[0] - 8, y0: y[0] - 8, x1: x[1] + 8, y1: y[1] + 8 };
    });
    const center = new Map(hulls.map((h) => [h.z, h.c]));
    const pos = new Map(slots.map((s) => [s.location_id, [sx(s.x_m), sy(s.y_m)] as [number, number]]));
    return { hulls, banks, walks, center, pos };
  }, [floor.data]);

  useEffect(() => {
    if (!svg.current || !geo) return;
    const z = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 6])
      .translateExtent([
        [0, 0],
        [W, H],
      ])
      .filter((e: Event) => (e.type === "wheel" ? (e as WheelEvent).ctrlKey || (e as WheelEvent).metaKey : !(e as MouseEvent).button))
      .on("zoom", (e) => setT(e.transform));
    zoom.current = z;
    d3.select(svg.current).call(z).on("dblclick.zoom", null);
    return () => {
      d3.select(svg.current).on(".zoom", null);
    };
  }, [geo]);
  const zoomBy = (k: number) =>
    svg.current && zoom.current && d3.select(svg.current).transition().duration(240).call(zoom.current.scaleBy, k);
  const reset = () =>
    svg.current && zoom.current && d3.select(svg.current).transition().duration(240).call(zoom.current.transform, d3.zoomIdentity);

  if (error || floor.error) return <ErrorState what="floor" error={String(error ?? floor.error)} />;
  if (!geo || !all) return <ScreenSkeleton />;

  const inScope = (r: ScoreRow) => (!f.zone || r.zone_id === f.zone) && (!f.bank || r.bank_id === f.bank);
  const scoped = all.filter(inScope);
  const counts = d3.rollup(
    scoped,
    (v) => v.length,
    (r) => r.verdict,
  );
  const notOk = scoped.length - (counts.get("ok") ?? 0) - (counts.get("truly_weak") ?? 0);
  const scope = f.bank ? `in ${f.bank}` : f.zone ? `in ${f.zone}` : "on the floor";
  const div = d3
    .scaleQuantize<string>()
    .domain([0.8, 1.2])
    .range([...scales.diverging].reverse());
  const winQ = d3
    .scaleQuantile<string>()
    .domain(all.map((r) => r.house_win_usd))
    .range(scales.sequential.slice(1, 6));
  const lostMax = d3.max(all, (r) => r.lost_theo_usd) || 1;
  const lost = d3.scaleSqrt<string>().domain([0, lostMax]).range([scales.sequential[1], scales.sequential[6]]);
  const fill = (r: ScoreRow) =>
    metric === "verdict"
      ? verdictColors[r.verdict]
      : metric === "effect"
        ? div(r.machine_effect_shrunk)
        : metric === "win"
          ? winQ(r.house_win_usd)
          : r.lost_theo_usd > 0
            ? lost(r.lost_theo_usd)
            : scales.sequential[0];
  const ramp =
    metric === "effect"
      ? { lo: "0.80", hi: "1.20", stops: [...scales.diverging].reverse() }
      : metric === "win"
        ? {
            lo: fmt.usdK(d3.min(all, (r) => r.house_win_usd) ?? 0),
            hi: fmt.usdK(d3.max(all, (r) => r.house_win_usd) ?? 0),
            stops: scales.sequential.slice(1, 6),
          }
        : { lo: "$0", hi: fmt.usdK(lostMax), stops: scales.sequential.slice(1) };
  const hoverBank = hover && geo.banks.some((b) => b.b === hover) ? hover : null;

  const pickBank = (b: string, zone: string) => {
    const prev = { zone: f.zone, bank: f.bank };
    const off = f.bank === b;
    setF(off ? { bank: null } : { bank: b, zone });
    toast(off ? `Cleared bank ${b}` : `Filtered every screen to bank ${b}`, {
      action: { label: "Undo", onClick: () => setF(prev) },
    });
  };
  const ids = all
    .filter(inScope)
    .map((r) => r.machine_id)
    .sort();

  return (
    <div>
      <HeroBand
        eyebrow={`Floor map · ${PERIOD_LONG[f.period] ?? f.period}`}
        title={
          <>
            <GoldNumber className="font-semibold">{String(notOk)}</GoldNumber> of {scoped.length} machines
            {f.zone || f.bank ? ` ${scope}` : ""} have a reason besides weak play
          </>
        }
        sub="Each mark is a machine. Click a bank to filter every screen, a machine for its case file."
      />

      <section
        id="map"
        aria-label="Floor map"
        className="felt relative mx-6 mt-6 scroll-mt-24 overflow-hidden rounded-xl ring-1 ring-inset ring-gold/20 md:mx-10"
      >
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="relative block h-[min(56vh,540px)] w-full cursor-grab active:cursor-grabbing xl:w-[calc(100%-250px)]"
          role="img"
          aria-label="Casino floor with machines colored by verdict"
          onClick={() => setTip(null)}
        >
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
            <filter id="lamp" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>
          <g transform={t.toString()}>
            {geo.hulls.map((h) => (
              <g key={h.z} opacity={f.zone && f.zone !== h.z ? 0.3 : 1} className="transition-opacity duration-menu">
                <polygon
                  points={h.hull.map((p) => p.join(",")).join(" ")}
                  fill={colors.fg}
                  fillOpacity={0.03}
                  stroke={colors.fg}
                  strokeOpacity={0.06}
                  strokeWidth={36}
                  strokeLinejoin="round"
                />
                <text
                  x={h.top - 26 < 60 ? Math.max(...h.hull.map((q) => q[0])) + 14 : h.c[0]}
                  y={h.top - 26 < 60 ? h.top + 10 : h.top - 26}
                  textAnchor={h.top - 26 < 60 ? "start" : "middle"}
                  fill={colors["fg-muted"]}
                  fontSize={13 / Math.sqrt(t.k)}
                  letterSpacing="0.08em"
                  fontWeight={600}
                >
                  {h.name.toUpperCase()}
                </text>
              </g>
            ))}
            {geo.walks.map((w) => {
              const a = geo.center.get(w.zone_a);
              const b = geo.center.get(w.zone_b);
              if (!a || !b) return null;
              return (
                <line
                  key={w.walkway_id}
                  x1={a[0]}
                  y1={a[1]}
                  x2={b[0]}
                  y2={b[1]}
                  stroke={w.closed_from_utc ? verdictColors.downtime : colors["fg-subtle"]}
                  strokeOpacity={w.closed_from_utc ? 0.8 : 0.35}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                >
                  <title>{`${w.walkway_id}${w.closed_from_utc ? " (closed for renovation Mar 3 – Apr 7)" : ""}`}</title>
                </line>
              );
            })}
            {geo.banks.map((b) => {
              const on = f.bank === b.b;
              return (
                <rect
                  key={b.b}
                  x={b.x0}
                  y={b.y0}
                  width={b.x1 - b.x0}
                  height={b.y1 - b.y0}
                  rx={6}
                  fill={on ? colors.gold : colors.fg}
                  fillOpacity={on ? 0.08 : hoverBank === b.b ? 0.05 : 0.001}
                  stroke={on ? colors.gold : colors.fg}
                  strokeOpacity={on ? 1 : hoverBank === b.b ? 0.3 : 0.12}
                  strokeWidth={on ? 1.5 : 1}
                  vectorEffect="non-scaling-stroke"
                  className="cursor-pointer outline-none"
                  data-bank={b.b}
                  role="button"
                  tabIndex={0}
                  aria-label={`Filter to bank ${b.b}`}
                  aria-pressed={on}
                  onClick={(e) => {
                    e.stopPropagation();
                    pickBank(b.b, b.zone);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && pickBank(b.b, b.zone)}
                  onMouseEnter={() => hoverStore.set(b.b)}
                  onMouseLeave={() => hoverStore.set(null)}
                >
                  <title>{`Bank ${b.b}`}</title>
                </rect>
              );
            })}
            {metric === "verdict" && (
              <g filter="url(#lamp)" opacity={0.5} pointerEvents="none" aria-hidden>
                {all.map((r) => {
                  const p = geo.pos.get(r.location_id);
                  if (!p || r.verdict === "ok" || !inScope(r)) return null;
                  return (
                    <circle
                      key={r.machine_id}
                      r={7 / Math.sqrt(t.k)}
                      fill={verdictColors[r.verdict]}
                      style={{ transform: `translate(${p[0]}px, ${p[1]}px)` }}
                      className="transition-transform duration-700 ease-out motion-reduce:transition-none"
                    />
                  );
                })}
              </g>
            )}
            {all.map((r) => {
              const p = geo.pos.get(r.location_id);
              if (!p) return null;
              const sel = machine === r.machine_id;
              const dim = !inScope(r) || (hover != null && hover !== r.machine_id && hover !== r.bank_id && !hoverBank);
              return (
                <g
                  key={r.machine_id}
                  className="cursor-pointer transition-opacity duration-hover"
                  opacity={dim ? (inScope(r) ? 0.35 : 0.14) : 1}
                  data-machine={r.machine_id}
                  role="button"
                  tabIndex={inScope(r) ? 0 : -1}
                  aria-label={`${r.machine_id}: ${verdictLabels[r.verdict]}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    open(r.machine_id, ids);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && open(r.machine_id, ids)}
                  onMouseEnter={() => {
                    hoverStore.set(r.machine_id);
                    setTip({ r, x: t.applyX(p[0]), y: t.applyY(p[1]) });
                  }}
                  onMouseLeave={() => {
                    hoverStore.set(null);
                    setTip(null);
                  }}
                >
                  <g
                    style={{ transform: `translate(${p[0]}px, ${p[1]}px)` }}
                    className="transition-transform duration-700 ease-out motion-reduce:transition-none"
                  >
                    {sel && <circle r={12 / Math.sqrt(t.k)} fill={colors.gold} opacity={0.45} filter="url(#glow)" />}
                    {sel && (
                      <circle r={10 / Math.sqrt(t.k)} fill="none" stroke={colors.gold} strokeWidth={1} vectorEffect="non-scaling-stroke" />
                    )}
                    <Glyph v={r.verdict} x={0} y={0} r={(sel ? 6 : 4.5) / Math.sqrt(t.k)} fill={fill(r)} ring={sel} />
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        {tip && (
          <div
            className="float pointer-events-none absolute z-10 px-3 py-2 text-xs"
            style={{ left: `${(tip.x / W) * 100}%`, top: `${(tip.y / H) * 100}%`, transform: "translate(14px, -50%)" }}
          >
            <p className="flex items-center gap-2 font-medium text-fg">
              <span className="mono">{tip.r.machine_id}</span>
              <span className="text-fg-muted">{verdictLabels[tip.r.verdict]}</span>
            </p>
            <p className="mono mt-0.5 text-2xs text-fg-muted">
              win {fmt.usdK(tip.r.house_win_usd)} · {fmt.usdK(tip.r.coin_in_per_avail_hr)}/hr · effect{" "}
              {fmt.num(tip.r.machine_effect_shrunk)}
            </p>
          </div>
        )}

        {/* floating color-by control */}
        <div className="float absolute left-4 top-4 flex items-center gap-0.5 p-0.5" role="radiogroup" aria-label="Color machines by">
          {METRICS.map(({ id: m, label }) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={metric === m}
              data-metric={m}
              onClick={() => setMetric(m)}
              className={cn(
                "focus-ring h-7 rounded-sm px-2.5 text-xs font-medium transition-colors duration-hover",
                metric === m ? "bg-surface-3 text-fg ring-1 ring-inset ring-ring-strong" : "text-fg-muted hover:text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* zoom controls */}
        <div className="float absolute right-4 top-4 flex flex-col p-0.5">
          <Tip label="Zoom in" side="left">
            <Button variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={() => zoomBy(1.5)}>
              <Plus size={14} aria-hidden />
            </Button>
          </Tip>
          <Tip label="Zoom out" side="left">
            <Button variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.5)}>
              <Minus size={14} aria-hidden />
            </Button>
          </Tip>
          <Tip label="Reset view" side="left">
            <Button variant="ghost" size="icon-sm" aria-label="Reset view" onClick={reset}>
              <Maximize2 size={14} aria-hidden />
            </Button>
          </Tip>
        </div>

        {/* legend */}
        <div
          className="card-face absolute bottom-4 left-4 flex max-w-[calc(100%-200px)] flex-wrap items-center gap-x-3 gap-y-1 rounded-[8px] py-2 pl-8 pr-3 text-ink shadow-lg [&_.text-fg-muted]:text-ink/75 [&_.text-fg]:text-ink"
          aria-label="Legend"
        >
          <CardIndex card="K♠" className="!text-ink absolute left-2.5 top-1.5 text-xs" />
          {metric === "verdict" ? (
            verdictOrder.map((v) => (
              <span key={v} className="inline-flex items-center gap-1.5 text-2xs text-fg-muted">
                <svg width="12" height="12" aria-hidden>
                  <Glyph v={v} x={6} y={6} r={4} fill={verdictColors[v]} />
                </svg>
                {verdictLabels[v]} <span className="num text-fg">{counts.get(v) ?? 0}</span>
              </span>
            ))
          ) : (
            <span className="flex items-center gap-2 text-2xs text-fg-muted">
              <span className="mono">{ramp.lo}</span>
              <span className="flex h-2 w-32 overflow-hidden rounded-full" aria-hidden>
                {ramp.stops.map((c) => (
                  <span key={c} className="flex-1" style={{ background: c }} />
                ))}
              </span>
              <span className="mono">{ramp.hi}</span> · {METRICS.find((m) => m.id === metric)?.legend} (shape = verdict)
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 text-2xs text-fg-muted">
            <svg width="16" height="4" aria-hidden>
              <line x1="0" x2="16" y1="2" y2="2" stroke={verdictColors.downtime} strokeDasharray="4 3" />
            </svg>
            Closed walkway
          </span>
        </div>

        <ZoneLedger
          zones={geo.hulls.map((h) => {
            const zr = all.filter((r) => r.zone_id === h.z);
            return { z: h.z, name: h.name, n: zr.length, flag: zr.filter((r) => r.verdict !== "ok" && r.verdict !== "truly_weak").length };
          })}
          active={f.zone}
          onPick={(z) => setF({ zone: f.zone === z ? null : z, bank: null })}
        />
        {/* minimap */}
        <Minimap geo={geo} t={t} />
      </section>
      <div className="mx-6 mt-10 md:mx-10">
        <KpiStrip testId="floor-kpis">
          {(["location", "luck", "truly_weak"] as Verdict[]).map((v) => (
            <Kpi
              key={v}
              label={verdictLabels[v]}
              value={<Num value={counts.get(v) ?? 0} />}
              note={`${fmt.pct((counts.get(v) ?? 0) / Math.max(1, scoped.length))} of machines`}
            />
          ))}
        </KpiStrip>
      </div>
      <Scrubber period={f.period} onChange={(period) => setF({ period })} />
      <p className="mx-6 mt-2 text-2xs text-fg-subtle md:mx-10">
        Drag to pan · {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"} + scroll to zoom · Tab to reach banks, Enter to filter
      </p>
    </div>
  );
}

/** Month scrubber: click or arrow keys to step, play to walk Jan to Jun. Machines glide to their new spot when they moved. */
function Scrubber({ period, onChange }: { period: string; onChange: (p: string) => void }) {
  const [playing, setPlaying] = useState(false);
  const i = MONTHS.indexOf(period);
  const step = useRef(onChange);
  step.current = onChange;
  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => {
      if (i >= MONTHS.length - 1) setPlaying(false);
      else step.current(MONTHS[i + 1]);
    }, 1400);
    return () => clearTimeout(id);
  }, [playing, i]);
  const toggle = () => {
    if (!playing && (i < 0 || i === MONTHS.length - 1)) onChange(MONTHS[0]);
    setPlaying(!playing);
  };
  return (
    <div className="mx-6 mt-3 flex items-center gap-3 md:mx-10" data-testid="time-scrubber">
      <Button variant="ghost" size="icon-sm" aria-label={playing ? "Pause months" : "Play months"} onClick={toggle}>
        {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
      </Button>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Month"
        aria-valuemin={1}
        aria-valuemax={MONTHS.length}
        aria-valuenow={Math.max(1, i + 1)}
        aria-valuetext={i >= 0 ? PERIOD_LABELS[MONTHS[i]] : "Whole period"}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") onChange(MONTHS[Math.min(MONTHS.length - 1, i + 1)]);
          else if (e.key === "ArrowLeft") onChange(MONTHS[Math.max(0, i - 1)]);
        }}
        className="focus-ring relative flex flex-1 items-center rounded-sm py-2"
      >
        <div className="absolute inset-x-0 top-[12px] h-[3px] rounded-full bg-gold/15 ring-1 ring-inset ring-gold/25" aria-hidden />
        {i >= 0 && (
          <div
            className="absolute left-0 top-[12.5px] h-0.5 rounded-full bg-gold transition-[width] duration-menu"
            style={{ width: `${(i / (MONTHS.length - 1)) * 100}%` }}
            aria-hidden
          />
        )}
        <div className="relative flex w-full justify-between">
          {MONTHS.map((m, j) => (
            <button
              key={m}
              type="button"
              tabIndex={-1}
              data-scrub={m}
              onClick={() => onChange(m)}
              className="group flex flex-col items-center gap-1.5"
              aria-label={PERIOD_LABELS[m]}
            >
              {j === i ? (
                <Chip size={18} tone="gold" className="-my-[4px] drop-shadow" />
              ) : (
                <span
                  className={cn(
                    "size-2.5 rotate-45 rounded-[2px] ring-2 ring-bg transition-colors",
                    j < i ? "bg-gold" : "bg-surface-3 group-hover:bg-fg-subtle",
                  )}
                />
              )}
              <span className={cn("text-2xs", j === i ? "text-fg" : "text-fg-subtle")}>{PERIOD_LABELS[m]}</span>
            </button>
          ))}
        </div>
      </div>
      <span className="w-28 text-right text-2xs text-fg-muted">
        {i >= 0 ? "Month view" : `${PERIOD_LONG[period] ?? period}, press play`}
      </span>
    </div>
  );
}

function Minimap({ geo, t }: { geo: { hulls: { z: string; hull: [number, number][] }[] }; t: d3.ZoomTransform }) {
  if (t.k <= 1.01) return null;
  const [x0, y0] = t.invert([0, 0]);
  const [x1, y1] = t.invert([W, H]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="float absolute bottom-4 right-4 h-[90px] w-[140px] p-1" aria-hidden>
      {geo.hulls.map((h) => (
        <polygon key={h.z} points={h.hull.map((p) => p.join(",")).join(" ")} fill={colors.fg} fillOpacity={0.08} />
      ))}
      <rect
        x={x0}
        y={y0}
        width={x1 - x0}
        height={y1 - y0}
        fill="none"
        stroke={colors.gold}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Verdict glyph: color + shape (colorblind-safe pairing). */
function Glyph({ v, x, y, r, fill, ring = false }: { v: Verdict; x: number; y: number; r: number; fill: string; ring?: boolean }) {
  const common = {
    fill,
    stroke: ring ? colors.gold : colors.bg,
    strokeWidth: ring ? 2 : 0.75,
    vectorEffect: "non-scaling-stroke" as const,
  };
  switch (v) {
    case "inspect_hold":
      return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} transform={`rotate(45 ${x} ${y})`} {...common} />;
    case "downtime":
      return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} {...common} />;
    case "location":
      return <polygon points={`${x},${y - r * 1.15} ${x + r},${y + r * 0.85} ${x - r},${y + r * 0.85}`} {...common} />;
    case "truly_weak":
      return <polygon points={`${x - r},${y - r * 0.85} ${x + r},${y - r * 0.85} ${x},${y + r * 1.15}`} {...common} />;
    case "luck":
      return <circle cx={x} cy={y} r={r} {...common} />;
    default:
      return <circle cx={x} cy={y} r={r * 0.75} {...common} />;
  }
}

/** Right rail on wide screens: machines with a reason besides weak play, by zone. Click to filter every screen. */
function ZoneLedger({
  zones,
  active,
  onPick,
}: {
  zones: { z: string; name: string; n: number; flag: number }[];
  active: string | null;
  onPick: (z: string) => void;
}) {
  const max = Math.max(...zones.map((z) => z.flag), 1);
  return (
    <div className="absolute right-6 top-36 hidden w-[218px] min-[1440px]:block" data-testid="zone-ledger">
      <p className="label-sc mb-2 text-gold-soft">By zone · reason besides weak play</p>
      <ul className="flex flex-col gap-0.5">
        {[...zones]
          .sort((a, b) => b.flag - a.flag)
          .map((z) => (
            <li key={z.z}>
              <button
                type="button"
                onClick={() => onPick(z.z)}
                aria-pressed={active === z.z}
                className={cn(
                  "focus-ring grid w-full grid-cols-[1fr_auto] items-center gap-x-2 rounded-sm px-2 py-1 text-left text-xs transition-colors duration-hover",
                  active === z.z
                    ? "bg-black/35 text-ivory ring-1 ring-inset ring-gold/30"
                    : "text-ivory/85 hover:bg-black/20 hover:text-ivory",
                )}
              >
                <span className="truncate">{z.name}</span>
                <span className="mono text-ivory">
                  {z.flag}
                  <span className="text-fg-subtle">/{z.n}</span>
                </span>
                <span className="col-span-2 mt-1 h-[3px] rounded-full bg-black/30" aria-hidden>
                  <span className="block h-full rounded-full bg-gold-soft/60" style={{ width: `${(z.flag / max) * 100}%` }} />
                </span>
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}
