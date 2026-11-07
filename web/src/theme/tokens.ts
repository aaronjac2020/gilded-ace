/**
 * Design tokens v2. CSS custom properties (index.css, OKLCH) are the source for DOM styling via Tailwind;
 * the hex mirrors below exist only for canvas renderers (ECharts) that cannot read CSS variables.
 */
export const colors = {
  bg: "#0A0909",
  "surface-1": "#111010",
  "surface-2": "#171515",
  "surface-3": "#1E1B1B",
  fg: "#EDEAE9",
  "fg-muted": "#8F8786",
  "fg-subtle": "#5E5756",
  maroon: "#500000",
  "maroon-bright": "#7A1A1A",
  gold: "#C9822E",
  "gold-soft": "#E3B36A",
  /** white at 6% / 8% / 14% over bg, flattened for canvas. */
  divider: "rgba(255,255,255,0.06)",
  ring: "rgba(255,255,255,0.08)",
  "ring-strong": "rgba(255,255,255,0.14)",
} as const;

export const verdictColors = {
  luck: "#6FA8DC",
  location: "#C9822E",
  downtime: "#B4656F",
  inspect_hold: "#9B7FD1",
  truly_weak: "#D9D4D3",
  ok: "#3A3434",
} as const;

export type Verdict = keyof typeof verdictColors;

export const verdictLabels: Record<Verdict, string> = {
  inspect_hold: "Inspect hold",
  downtime: "Downtime",
  location: "Location",
  luck: "Luck",
  truly_weak: "Truly weak",
  ok: "OK",
};

export const verdictOrder: Verdict[] = ["inspect_hold", "downtime", "location", "luck", "truly_weak", "ok"];

/** Sequential (surface-2 -> maroon -> gold) and diverging (luck <-> neutral <-> maroon-bright), OKLCH-interpolated. */
export const scales = {
  sequential: ["#171515", "#2A1312", "#41100D", "#5E1B10", "#86391A", "#AA5E25", "#C9822E"],
  diverging: ["#6FA8DC", "#5B7FA0", "#4A5560", "#3A3434", "#5A2A28", "#6E2220", "#7A1A1A"],
} as const;

export const fonts = {
  sans: "'Inter Variable', Inter, system-ui, sans-serif",
  mono: "'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, monospace",
};

export const motion = { ease: [0.16, 1, 0.3, 1] as const, hover: 0.12, menu: 0.18, route: 0.24 };
