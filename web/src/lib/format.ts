const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const fmt = {
  usd: (v: number | null | undefined) => (v == null ? "–" : usd0.format(v)),
  usdK: (v: number | null | undefined) => {
    if (v == null) return "–";
    const a = Math.abs(v);
    if (a >= 1e6) return `${v < 0 ? "−" : ""}$${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
    if (a >= 1e3) return `${v < 0 ? "−" : ""}$${(a / 1e3).toFixed(a >= 1e5 ? 0 : 1)}k`;
    return usd0.format(v);
  },
  pct: (v: number | null | undefined, d = 1) => (v == null ? "–" : `${(v * 100).toFixed(d)}%`),
  num: (v: number | null | undefined, d = 2) => (v == null ? "–" : v.toFixed(d)),
  int: (v: number | null | undefined) => (v == null ? "–" : Math.round(v).toLocaleString("en-US")),
};
