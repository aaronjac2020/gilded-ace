import type { Config } from "tailwindcss";

/** Every color resolves to an OKLCH custom property in index.css, so opacity modifiers (bg-gold/10) work. */
const v = (name: string) => `oklch(var(--${name}) / <alpha-value>)`;
const names = ["bg", "surface-1", "surface-2", "surface-3", "fg", "fg-muted", "fg-subtle", "maroon", "maroon-bright", "gold", "gold-soft", "ivory", "ink", "lacquer", "suit-red"];
const verdicts = ["luck", "location", "downtime", "inspect_hold", "truly_weak", "ok"];

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    fontSize: {
      "2xs": ["11px", { lineHeight: "16px" }],
      xs: ["12px", { lineHeight: "16px" }],
      sm: ["13px", { lineHeight: "20px" }],
      base: ["14px", { lineHeight: "22px" }],
      lg: ["16px", { lineHeight: "24px" }],
      xl: ["20px", { lineHeight: "28px" }],
      "2xl": ["24px", { lineHeight: "30px" }],
      "3xl": ["32px", { lineHeight: "1.1" }],
      "4xl": ["44px", { lineHeight: "1.1" }],
      "5xl": ["56px", { lineHeight: "1.05" }],
    },
    borderRadius: { none: "0", sm: "6px", DEFAULT: "6px", md: "8px", lg: "12px", xl: "16px", full: "9999px" },
    extend: {
      colors: {
        ...Object.fromEntries(names.map((n) => [n, v(n)])),
        verdict: Object.fromEntries(verdicts.map((n) => [n, v(n)])),
        ring: "rgb(255 255 255 / 0.08)",
        "ring-strong": "rgb(255 255 255 / 0.14)",
        divider: "rgb(255 255 255 / 0.06)",
      },
      fontFamily: {
        sans: ["'Inter Variable'", "Inter", "system-ui", "sans-serif"],
        serif: ["'Bodoni Moda Variable'", "'Bodoni Moda'", "Didot", "Georgia", "serif"],
        mono: ["'JetBrains Mono Variable'", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      letterSpacing: { tightest: "-0.025em", eyebrow: "0.06em" },
      maxWidth: { content: "1180px", prose: "56ch" },
      spacing: { sidebar: "232px", rail: "56px", topbar: "48px", row: "36px", "row-compact": "32px" },
      boxShadow: {
        float: "0 8px 24px -8px rgb(0 0 0 / 0.6), 0 0 0 1px rgb(255 255 255 / 0.08)",
        highlight: "inset 0 1px 0 rgb(255 255 255 / 0.05)",
        "highlight-strong": "inset 0 1px 0 rgb(255 255 255 / 0.15)",
      },
      transitionTimingFunction: { out: "cubic-bezier(0.16, 1, 0.3, 1)" },
      transitionDuration: { hover: "120ms", menu: "180ms", route: "240ms" },
      keyframes: {
        shimmer: { "0%": { backgroundPosition: "-400px 0" }, "100%": { backgroundPosition: "400px 0" } },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 oklch(var(--gold) / 0.7)" },
          "70%": { boxShadow: "0 0 0 6px oklch(var(--gold) / 0)" },
          "100%": { boxShadow: "0 0 0 0 oklch(var(--gold) / 0)" },
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
