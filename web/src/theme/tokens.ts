/**
 * Design tokens v2. CSS custom properties (index.css, OKLCH) are the source for DOM styling via Tailwind;
 * the hex mirrors below exist only for canvas renderers (ECharts) that cannot read CSS variables.
 */
export const colors = {
  bg: "#F5EFE4",
  "surface-1": "#FFFCF6",
  "surface-2": "#FAF5EC",
  "surface-3": "#FFFCF6",
  fg: "#1F1716",
  "fg-muted": "#5E534F",
  "fg-subtle": "#6F655F",
  maroon: "#500000",
  "maroon-bright": "#7A1A1A",
  gold: "#A86F1C",
  "gold-soft": "#8A5A1E",
  divider: "#E4DACB",
  ring: "rgba(31,23,22,0.10)",
  "ring-strong": "rgba(31,23,22,0.18)",
} as const;

/** Reason colors (always paired with an icon + label). `setting` is presentation-only: low payback design. */
export const verdictColors = {
  setting: "#7A5AA8",
  luck: "#2F6EA3",
  location: "#8A5A1E",
  downtime: "#A3434F",
  inspect_hold: "#5E534F",
  truly_weak: "#1F1716",
  ok: "#8C817B",
} as const;

export type Verdict = Exclude<keyof typeof verdictColors, "setting">;

export const verdictLabels: Record<Verdict, string> = {
  inspect_hold: "Check the payout",
  downtime: "Often down",
  location: "Quiet spot",
  luck: "Unlucky stretch",
  truly_weak: "Truly weak",
  ok: "No clear problem",
};

export const verdictOrder: Verdict[] = ["inspect_hold", "downtime", "location", "luck", "truly_weak", "ok"];

/** Sequential (surface-2 -> maroon -> gold) and diverging (luck <-> neutral <-> maroon-bright), OKLCH-interpolated. */
export const scales = {
  sequential: ["#FAF5EC", "#F1E2C8", "#E6C99C", "#D4A464", "#B97E3A", "#8F4A22", "#500000"],
  diverging: ["#2F6EA3", "#7FA3C4", "#C9D3DB", "#EFE8DC", "#D8A99E", "#A85A50", "#7A1A1A"],
} as const;

export const fonts = {
  sans: "'Manrope Variable', Manrope, system-ui, sans-serif",
  display: "'Fraunces Variable', Fraunces, Georgia, serif",
  mono: "'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, monospace",
};

export const motion = { ease: [0.16, 1, 0.3, 1] as const, hover: 0.15, menu: 0.18, route: 0.2 };
