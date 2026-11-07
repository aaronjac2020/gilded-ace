import * as d3 from "d3";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AssertionTitle } from "../components/AssertionTitle";
import { ErrorNote, Loading } from "../components/Loading";
import { MachineDrawer } from "../components/MachineDrawer";
import { rows as decode, type Columnar, type ScoreRow } from "../lib/data";
import { fmt } from "../lib/format";
import { useJson, useScorecard } from "../lib/useData";
import { useFilters } from "../lib/urlState";
import { colors, verdictColors, verdictLabels, verdictOrder, type Verdict } from "../theme/tokens";

type Floor = { slots: Columnar; banks: Columnar; zones: Columnar; landmarks: Columnar; walkways: Columnar };
type Slot = { location_id: string; zone_id: string; bank_id: string; x_m: number; y_m: number };
type Zone = { zone_id: string; name: string; x_m: number; y_m: number };
type Walk = { walkway_id: string; zone_a: string; zone_b: string; closed_from_utc: string | null };

const W = 1000;
const H = 640;
const PAD = 24;

export default function FloorMap() {
  const [f, setF] = useFilters();
  const [sp, setSp] = useSearchParams();
  const floor = useJson<Floor>("floor.json");
  const { all, error } = useScorecard(f);
  const [hover, setHover] = useState<{ r: ScoreRow; x: number; y: number } | null>(null);

  const geo = useMemo(() => {
    if (!floor.data) return null;
    const slots = decode<Slot>(floor.data.slots);
    const zones = decode<Zone>(floor.data.zones);
    const walks = decode<Walk>(floor.data.walkways);
    const xs = d3.extent(slots, (s) => s.x_m) as [number, number];
    const ys = d3.extent(slots, (s) => s.y_m) as [number, number];
    const k = Math.min((W - 2 * PAD) / (xs[1] - xs[0]), (H - 2 * PAD) / (ys[1] - ys[0]));
    const sx = (x: number) => PAD + (x - xs[0]) * k;
    const sy = (y: number) => PAD + (y - ys[0]) * k;
    const byZone = d3.group(slots, (s) => s.zone_id);
    const hulls = [...byZone].map(([z, ss]) => {
      const pts = ss.map((s) => [sx(s.x_m), sy(s.y_m)] as [number, number]);
      const hull = d3.polygonHull(pts) ?? pts;
      const c = d3.polygonCentroid(hull);
      return { z, hull, c, name: zones.find((q) => q.zone_id === z)?.name ?? z };
    });
    const banks = [...d3.group(slots, (s) => s.bank_id)].map(([b, ss]) => {
      const x = d3.extent(ss, (s) => sx(s.x_m)) as [number, number];
      const y = d3.extent(ss, (s) => sy(s.y_m)) as [number, number];
      return { b, zone: ss[0].zone_id, x0: x[0] - 7, y0: y[0] - 7, x1: x[1] + 7, y1: y[1] + 7 };
    });
    const center = new Map(hulls.map((h) => [h.z, h.c]));
    const pos = new Map(slots.map((s) => [s.location_id, [sx(s.x_m), sy(s.y_m)] as [number, number]]));
    return { hulls, banks, walks, center, pos };
  }, [floor.data]);

  const selected = useMemo(() => all?.find((r) => r.machine_id === sp.get("machine")) ?? null, [all, sp]);
  const close = useCallback(() => {
    setSp(
      (p) => {
        const n = new URLSearchParams(p);
        n.delete("machine");
        return n;
      },
      { replace: true },
    );
  }, [setSp]);
  const open = (id: string) =>
    setSp(
      (p) => {
        const n = new URLSearchParams(p);
        n.set("machine", id);
        return n;
      },
      { replace: true },
    );

  if (error || floor.error) return <ErrorNote what="floor" error={String(error ?? floor.error)} />;
  if (!geo || !all) return <Loading />;

  const inScope = (r: ScoreRow) => (!f.zone || r.zone_id === f.zone) && (!f.bank || r.bank_id === f.bank);
  const scoped = all.filter(inScope);
  const counts = d3.rollup(scoped, (v) => v.length, (r) => r.verdict);
  const notOk = scoped.length - (counts.get("ok") ?? 0) - (counts.get("truly_weak") ?? 0);

  return (
    <div>
      <AssertionTitle
        kicker="Floor map"
        sub="Each glyph is a machine at its last location in the period. Color and shape = verdict. Click a machine for its breakdown; click a bank to filter every screen to it."
      >
        {notOk} of {scoped.length} machines {f.bank ? `in ${f.bank}` : f.zone ? `in ${f.zone}` : "on the floor"} are explained by luck,
        location, downtime or hold variance
      </AssertionTitle>

      <div className="mb-3 flex flex-wrap items-center gap-3" aria-label="Legend">
        {verdictOrder.map((v) => (
          <span key={v} className="inline-flex items-center gap-1.5 text-xs text-muted">
            <svg width="14" height="14" aria-hidden>
              <Glyph v={v} x={7} y={7} r={5} />
            </svg>
            {verdictLabels[v]} <span className="tabular-nums text-ink">{counts.get(v) ?? 0}</span>
          </span>
        ))}
      </div>

      <section id="map" className="card relative overflow-hidden p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Casino floor with machines colored by verdict">
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
                stroke={w.closed_from_utc ? verdictColors.downtime : colors.rule}
                strokeWidth={w.closed_from_utc ? 3 : 6}
                strokeDasharray={w.closed_from_utc ? "6 5" : undefined}
                strokeLinecap="round"
                opacity={0.8}
              >
                <title>{`${w.walkway_id}${w.closed_from_utc ? " (closed for renovation Mar 3 – Apr 7)" : ""}`}</title>
              </line>
            );
          })}
          {geo.hulls.map((h) => (
            <g key={h.z} opacity={f.zone && f.zone !== h.z ? 0.35 : 1}>
              <polygon
                points={h.hull.map((p) => p.join(",")).join(" ")}
                fill={colors["surface-2"]}
                stroke={colors.rule}
                strokeWidth={28}
                strokeLinejoin="round"
              />
              <polygon points={h.hull.map((p) => p.join(",")).join(" ")} fill={colors["surface-2"]} />
              <text x={h.c[0]} y={h.c[1]} textAnchor="middle" fill={colors.muted} fontSize={13} opacity={0.5} className="font-display">
                {h.name}
              </text>
            </g>
          ))}
          {geo.banks.map((b) => (
            <rect
              key={b.b}
              x={b.x0}
              y={b.y0}
              width={b.x1 - b.x0}
              height={b.y1 - b.y0}
              rx={5}
              fill="transparent"
              stroke={f.bank === b.b ? colors.gold : colors.rule}
              strokeWidth={f.bank === b.b ? 2 : 1}
              className="cursor-pointer"
              data-bank={b.b}
              role="button"
              tabIndex={0}
              aria-label={`Filter to bank ${b.b}`}
              onClick={() => setF({ bank: f.bank === b.b ? null : b.b, zone: f.bank === b.b ? f.zone : b.zone })}
              onKeyDown={(e) => e.key === "Enter" && setF({ bank: f.bank === b.b ? null : b.b, zone: b.zone })}
            />
          ))}
          {all.map((r) => {
            const p = geo.pos.get(r.location_id);
            if (!p) return null;
            const dim = !inScope(r);
            return (
              <g
                key={r.machine_id}
                className="cursor-pointer"
                opacity={dim ? 0.18 : 1}
                data-machine={r.machine_id}
                role="button"
                tabIndex={dim ? -1 : 0}
                aria-label={`${r.machine_id}: ${verdictLabels[r.verdict]}`}
                onClick={(e) => {
                  e.stopPropagation();
                  open(r.machine_id);
                }}
                onKeyDown={(e) => e.key === "Enter" && open(r.machine_id)}
                onMouseEnter={() => setHover({ r, x: p[0], y: p[1] })}
                onMouseLeave={() => setHover(null)}
              >
                <Glyph v={r.verdict} x={p[0]} y={p[1]} r={selected?.machine_id === r.machine_id ? 7 : 5} ring={selected?.machine_id === r.machine_id} />
              </g>
            );
          })}
        </svg>
        {hover && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-rule bg-surface-2 px-3 py-2 text-xs shadow-xl"
            style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%`, transform: "translate(12px, -50%)" }}
          >
            <p className="font-medium text-ink">
              {hover.r.machine_id} · {verdictLabels[hover.r.verdict]}
            </p>
            <p className="text-muted">
              Win {fmt.usd(hover.r.house_win_usd)} · {fmt.usd(hover.r.coin_in_per_avail_hr)}/hr · effect {fmt.num(hover.r.machine_effect_shrunk)}
            </p>
          </div>
        )}
      </section>
      <MachineDrawer row={selected} onClose={close} />
    </div>
  );
}

/** Verdict glyph: color + shape (colorblind-safe pairing). */
function Glyph({ v, x, y, r, ring = false }: { v: Verdict; x: number; y: number; r: number; ring?: boolean }) {
  const c = verdictColors[v];
  const common = { fill: c, stroke: ring ? colors.gold : colors.bg, strokeWidth: ring ? 2 : 1 };
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

