import * as d3 from "d3";
import { Maximize2, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PERIOD_LONG } from "../components/shell/TopBar";
import { HeroBand, Kpi, KpiStrip } from "../components/ui/hero-band";
import { Num } from "../components/ui/num";
import { ErrorState, ScreenSkeleton } from "../components/ui/skeleton";
import { Button } from "../components/ui/button";
import { Tip } from "../components/ui/tooltip";
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
type Metric = "verdict" | "effect";

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
    const k = Math.min((W - 2 * PAD) / (xs[1] - xs[0]), (H - 2 * PAD) / (ys[1] - ys[0]));
    const ox = (W - (xs[1] - xs[0]) * k) / 2;
    const oy = (H - (ys[1] - ys[0]) * k) / 2;
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
  const zoomBy = (k: number) => svg.current && zoom.current && d3.select(svg.current).transition().duration(240).call(zoom.current.scaleBy, k);
  const reset = () => svg.current && zoom.current && d3.select(svg.current).transition().duration(240).call(zoom.current.transform, d3.zoomIdentity);

  if (error || floor.error) return <ErrorState what="floor" error={String(error ?? floor.error)} />;
  if (!geo || !all) return <ScreenSkeleton />;

  const inScope = (r: ScoreRow) => (!f.zone || r.zone_id === f.zone) && (!f.bank || r.bank_id === f.bank);
  const scoped = all.filter(inScope);
  const counts = d3.rollup(scoped, (v) => v.length, (r) => r.verdict);
  const notOk = scoped.length - (counts.get("ok") ?? 0) - (counts.get("truly_weak") ?? 0);
  const scope = f.bank ? `in ${f.bank}` : f.zone ? `in ${f.zone}` : "on the floor";
  const seq = d3.scaleQuantize<string>().domain([0.8, 1.2]).range([...scales.diverging].reverse());
  const fill = (r: ScoreRow) => (metric === "verdict" ? verdictColors[r.verdict] : seq(r.machine_effect_shrunk));
  const hoverBank = hover && geo.banks.some((b) => b.b === hover) ? hover : null;

  const pickBank = (b: string, zone: string) => {
    const prev = { zone: f.zone, bank: f.bank };
    const off = f.bank === b;
    setF(off ? { bank: null } : { bank: b, zone });
    toast(off ? `Cleared bank ${b}` : `Filtered every screen to bank ${b}`, {
      action: { label: "Undo", onClick: () => setF(prev) },
    });
  };
  const ids = all.filter(inScope).map((r) => r.machine_id).sort();

  return (
    <div>
      <HeroBand
        eyebrow={`Floor map · ${PERIOD_LONG[f.period] ?? f.period}`}
        title={
          <>
            {notOk} of {scoped.length} machines {scope} have a reason other than weak play
          </>
        }
        sub="Each mark is a machine at its last spot in the period. Click a bank to filter every screen; click a machine for its breakdown."
      >
        <KpiStrip testId="floor-kpis">
          {(["luck", "location", "downtime", "inspect_hold", "truly_weak"] as Verdict[]).map((v) => (
            <Kpi key={v} label={verdictLabels[v]} value={<Num value={counts.get(v) ?? 0} />} note={`${fmt.pct((counts.get(v) ?? 0) / Math.max(1, scoped.length))} of machines`} />
          ))}
        </KpiStrip>
      </HeroBand>

      <section id="map" aria-label="Floor map" className="relative mx-6 mt-6 overflow-hidden rounded-xl bg-surface-1 ring-1 ring-inset ring-ring md:mx-10">
        <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="relative block h-[min(68vh,640px)] w-full cursor-grab active:cursor-grabbing"
          role="img"
          aria-label="Casino floor with machines colored by verdict"
          onClick={() => setTip(null)}
        >
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          <g transform={t.toString()}>
            {geo.hulls.map((h) => (
              <g key={h.z} opacity={f.zone && f.zone !== h.z ? 0.3 : 1} className="transition-opacity duration-menu">
                <polygon points={h.hull.map((p) => p.join(",")).join(" ")} fill={colors.fg} fillOpacity={0.03} stroke={colors.fg} strokeOpacity={0.06} strokeWidth={36} strokeLinejoin="round" />
                <text x={h.c[0]} y={h.top - 26} textAnchor="middle" fill={colors["fg-subtle"]} fontSize={11 / Math.sqrt(t.k)} letterSpacing="0.08em" fontWeight={500}>
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
                  {sel && <circle cx={p[0]} cy={p[1]} r={10} fill={colors.gold} opacity={0.5} filter="url(#glow)" />}
                  <Glyph v={r.verdict} x={p[0]} y={p[1]} r={(sel ? 6 : 4.5) / Math.sqrt(t.k)} fill={fill(r)} ring={sel} />
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
              win {fmt.usdK(tip.r.house_win_usd)} · {fmt.usdK(tip.r.coin_in_per_avail_hr)}/hr · effect {fmt.num(tip.r.machine_effect_shrunk)}
            </p>
          </div>
        )}

        {/* floating color-by control */}
        <div className="float absolute left-4 top-4 flex items-center gap-0.5 p-0.5" role="radiogroup" aria-label="Color machines by">
          {(["verdict", "effect"] as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={metric === m}
              onClick={() => setMetric(m)}
              className={cn(
                "focus-ring h-7 rounded-sm px-2.5 text-xs font-medium transition-colors duration-hover",
                metric === m ? "bg-surface-3 text-fg ring-1 ring-inset ring-ring-strong" : "text-fg-muted hover:text-fg",
              )}
            >
              {m === "verdict" ? "Verdict" : "Machine effect"}
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
        <div className="float absolute bottom-4 left-4 flex max-w-[calc(100%-200px)] flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2" aria-label="Legend">
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
              0.80
              <span className="flex h-2 w-32 overflow-hidden rounded-full" aria-hidden>
                {[...scales.diverging].reverse().map((c) => (
                  <span key={c} className="flex-1" style={{ background: c }} />
                ))}
              </span>
              1.20 · play vs. location expectation (shape = verdict)
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 text-2xs text-fg-muted">
            <svg width="16" height="4" aria-hidden>
              <line x1="0" x2="16" y1="2" y2="2" stroke={verdictColors.downtime} strokeDasharray="4 3" />
            </svg>
            Closed walkway
          </span>
        </div>

        {/* minimap */}
        <Minimap geo={geo} t={t} />
      </section>
      <p className="mx-6 mt-2 text-2xs text-fg-subtle md:mx-10">Drag to pan · {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"} + scroll to zoom · Tab to reach banks, Enter to filter</p>
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
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="none" stroke={colors.gold} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Verdict glyph: color + shape (colorblind-safe pairing). */
function Glyph({ v, x, y, r, fill, ring = false }: { v: Verdict; x: number; y: number; r: number; fill: string; ring?: boolean }) {
  const common = { fill, stroke: ring ? colors.gold : colors.bg, strokeWidth: ring ? 2 : 0.75, vectorEffect: "non-scaling-stroke" as const };
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
