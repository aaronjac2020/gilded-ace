/** Design tokens: the single source for Tailwind and the ECharts theme. */
export const colors = {
  bg: "#0F0B0B",
  surface: "#1A1414",
  "surface-2": "#221A1A",
  rule: "#2E2626",
  maroon: "#500000",
  "maroon-hover": "#6B0F0F",
  gold: "#C9822E",
  "gold-soft": "#E3B36A",
  ink: "#F3EEEC",
  muted: "#9A8F8C",
} as const;

export const verdictColors = {
  luck: "#6FA8DC",
  location: "#C9822E",
  downtime: "#B4656F",
  inspect_hold: "#9B7FD1",
  truly_weak: "#E0DCDC",
  ok: "#4A4040",
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

export const fonts = { sans: "Inter, system-ui, sans-serif", display: "'Playfair Display', Georgia, serif" };
