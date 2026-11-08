import type { Config } from "tailwindcss";

/** Every color resolves to an OKLCH custom property in index.css, so opacity modifiers (bg-gold/10) work. */
const v = (name: string) => `oklch(var(--${name}) / <alpha-value>)`;
const names = ["bg", "surface-1", "surface-2", "surface-3", "fg", "fg-muted", "fg-subtle", "maroon", "maroon-bright", "gold", "gold-soft", "ivory", "ink", "lacquer", "suit-red", "paper", "card", "card-2", "rule", "ink-2", "ink-3"];
const verdicts = ["setting", "luck", "location", "downtime", "inspect_hold", "truly_weak", "ok"];

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    fontSize: {
      // 13px floor everywhere (2xs/xs kept as aliases so older markup cannot go below it)
      "2xs": ["13px", { lineHeight: "18px" }],
      xs: ["13px", { lineHeight: "20px" }],
      sm: ["15px", { lineHeight: "24px" }],
      base: ["17px", { lineHeight: "1.6" }],
      lg: ["18px", { lineHeight: "28px" }],
      xl: ["22px", { lineHeight: "30px" }],
      "2xl": ["26px", { lineHeight: "34px" }],
      "3xl": ["32px", { lineHeight: "1.15" }],
      "4xl": ["44px", { lineHeight: "1.1" }],
      "5xl": ["52px", { lineHeight: "1.05" }],
    },
    borderRadius: { none: "0", sm: "6px", DEFAULT: "6px", md: "8px", lg: "12px", xl: "16px", full: "9999px" },
    extend: {
      colors: {
        ...Object.fromEntries(names.map((n) => [n, v(n)])),
        verdict: Object.fromEntries(verdicts.map((n) => [n, v(n)])),
        ring: "rgb(31 23 22 / 0.1)",
        "ring-strong": "rgb(31 23 22 / 0.18)",
        divider: "#E4DACB",
      },
      fontFamily: {
        sans: ["'Source Serif 4 Variable'", "'Source Serif 4'", "Georgia", "serif"],
        display: ["'Source Serif 4 Variable'", "'Source Serif 4'", "Georgia", "serif"],
        serif: ["'Source Serif 4 Variable'", "'Source Serif 4'", "Georgia", "serif"],
        mono: ["'JetBrains Mono Variable'", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      letterSpacing: { tightest: "-0.025em", eyebrow: "0.06em" },
      maxWidth: { content: "1120px", prose: "56ch" },
      spacing: { sidebar: "232px", rail: "56px", topbar: "48px", row: "36px", "row-compact": "32px" },
      boxShadow: {
        card: "0 1px 2px rgb(31 23 22 / 0.06), 0 8px 24px -12px rgb(31 23 22 / 0.18)",
        float: "0 2px 4px rgb(31 23 22 / 0.08), 0 18px 40px -16px rgb(31 23 22 / 0.32)",
        highlight: "none",
        "highlight-strong": "none",
      },
      transitionTimingFunction: { out: "cubic-bezier(0.16, 1, 0.3, 1)" },
      transitionDuration: { hover: "150ms", menu: "180ms", route: "200ms" },
      keyframes: {
        shimmer: { "0%": { backgroundPosition: "-400px 0" }, "100%": { backgroundPosition: "400px 0" } },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 oklch(var(--maroon) / 0.5)" },
          "70%": { boxShadow: "0 0 0 6px oklch(var(--maroon) / 0)" },
          "100%": { boxShadow: "0 0 0 0 oklch(var(--maroon) / 0)" },
        },
        "fade-up": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        shimmer: "shimmer 1.5s linear infinite",
        "pulse-ring": "pulse-ring 0.6s cubic-bezier(0.16, 1, 0.3, 1) 2",
        "fade-up": "fade-up 240ms cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
} satisfies Config;
