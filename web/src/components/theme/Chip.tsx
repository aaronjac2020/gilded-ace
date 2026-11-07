import { cn } from "../../lib/cn";

export type ChipTone = "maroon" | "gold" | "ivory" | "lacquer";
const tones: Record<ChipTone, { face: string; edge: string; spot: string }> = {
  maroon: { face: "#6b1212", edge: "#3d0808", spot: "#efe5d2" },
  gold: { face: "#c9822e", edge: "#7a4c16", spot: "#fbf1dc" },
  ivory: { face: "#ece3d1", edge: "#a99c84", spot: "#6b1212" },
  lacquer: { face: "#2a2323", edge: "#0b0909", spot: "#c9822e" },
};

/** Top-down casino chip: edge spots, inlay ring. Original SVG. */
export function Chip({ size = 16, tone = "maroon", className }: { size?: number; tone?: ChipTone; className?: string }) {
  const t = tones[tone];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cn("shrink-0", className)} aria-hidden>
      <circle cx="16" cy="16" r="15" fill={t.face} stroke={t.edge} strokeWidth="1.5" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <rect key={a} x="14" y="1.5" width="4" height="5" rx="0.6" fill={t.spot} transform={`rotate(${a} 16 16)`} />
      ))}
      <circle cx="16" cy="16" r="9" fill="none" stroke={t.spot} strokeWidth="0.8" strokeDasharray="2 2" opacity="0.7" />
      <circle cx="16" cy="16" r="6.5" fill={t.edge} opacity="0.35" />
    </svg>
  );
}

/**
 * Side-on stack of `n` chips, 5px each, top face drawn as an ellipse. Height grows with n.
 * Pure SVG; the caller animates the wrapper (transform/opacity only).
 */
export function ChipStack({
  n,
  tone = "maroon",
  width = 44,
  className,
}: {
  n: number;
  tone?: ChipTone;
  width?: number;
  className?: string;
}) {
  const t = tones[tone];
  const h = 5;
  const rx = width / 2 - 1;
  const ry = width * 0.2;
  const H = n * h + ry * 2 + 2;
  const top = H - ry - 1 - n * h;
  return (
    <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} className={className} aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        const cy = H - ry - 1 - i * h;
        return (
          <g key={i}>
            <path
              d={`M1 ${cy - h} v${h} a${rx} ${ry} 0 0 0 ${2 * rx} 0 v${-h} z`}
              fill={t.edge}
              stroke="rgb(0 0 0 / 0.35)"
              strokeWidth="0.5"
            />
            {[0.22, 0.5, 0.78].map((x) => (
              <rect key={x} x={1 + x * 2 * rx - 2.5} y={cy - h + 1.2} width="5" height={h - 2.4} fill={t.spot} opacity="0.8" />
            ))}
          </g>
        );
      })}
      <ellipse cx={width / 2} cy={top} rx={rx} ry={ry} fill={t.face} stroke={t.edge} strokeWidth="1" />
      <ellipse
        cx={width / 2}
        cy={top}
        rx={rx * 0.62}
        ry={ry * 0.62}
        fill="none"
        stroke={t.spot}
        strokeWidth="0.8"
        strokeDasharray="2 2"
        opacity="0.7"
      />
    </svg>
  );
}
