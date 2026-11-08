// Count consistency, every period: reasons.ts masks reproduce the pipeline verdicts; the manager's 10 get exactly one
// primary reason each (chips sum to 10); headline = 10 - truly weak; "no clear problem" counts toward the headline.
// With --dom, also checks the rendered Ch 1 headline/chips and Ch 2 hand counts against the same numbers.
// Usage: node scripts/consistency.mjs [--dom] [--url http://localhost:4173]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { flagsFor, pipelineVerdict, primary, REASON_ORDER, tally } from "../src/lib/reasons.ts";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "data");
const read = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));
const rows = (c) => {
  const n = c.data[c.columns[0]].length;
  return Array.from({ length: n }, (_, i) =>
    Object.fromEntries(c.columns.map((k) => [k, c.dicts?.[k] ? c.dicts[k][c.data[k][i]] : c.data[k][i]])),
  );
};

const meta = read("meta.json");
const fails = [];
const expected = {};
for (const period of Object.keys(meta.periods)) {
  const all = rows(read(`scorecard_${period}.json`));
  const flags = flagsFor(all, meta.verdict_rules, meta.rules);
  const bad = all.filter((r) => pipelineVerdict(flags.get(r.machine_id)) !== r.verdict);
  if (bad.length) fails.push(`${period}: ${bad.length} machines' masks disagree with the pipeline verdict (e.g. ${bad[0].machine_id})`);
  const mgr = [...all].sort((a, b) => a.house_win_usd - b.house_win_usd).slice(0, 10).map((r) => r.machine_id);
  const t = tally(mgr, flags);
  const sum = REASON_ORDER.reduce((s, k) => s + t.counts[k], 0);
  if (sum !== 10) fails.push(`${period}: chip counts sum to ${sum}, not 10`);
  if (t.notProblem !== 10 - t.weak) fails.push(`${period}: headline ${t.notProblem} != 10 - ${t.weak}`);
  const perCard = mgr.map((id) => primary(flags.get(id)));
  if (perCard.filter((p) => p === "none").length !== t.counts.none) fails.push(`${period}: "no clear problem" miscounted`);
  expected[period] = { headline: t.notProblem, counts: t.counts, setting: t.setting };
  const chips = REASON_ORDER.filter((k) => t.counts[k]).map((k) => `${k} ${t.counts[k]}`).join(", ");
  console.log(`${period.padEnd(8)} ${t.notProblem} of 10 aren't the problem · ${chips} · set-to-pay-back flag ${t.setting}`);
}

if (process.argv.includes("--dom")) {
  const url = process.argv[process.argv.indexOf("--url") + 1] ?? "http://localhost:4173";
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  for (const [period, e] of Object.entries(expected)) {
    await page.goto(`${url}/?period=${period}`);
    await page.waitForSelector("[data-testid=headline-count]");
    const head = Number(await page.getAttribute("[data-testid=headline-count]", "data-value"));
    if (head !== e.headline) fails.push(`${period} DOM: Ch 1 headline ${head} != ${e.headline}`);
    const chips = await page.$$eval("[data-reason-chip]", (els) => els.map((el) => [el.dataset.reasonChip, Number(el.dataset.count)]));
    const chipSum = chips.reduce((s, [, n]) => s + n, 0);
    if (chipSum !== 10) fails.push(`${period} DOM: Ch 1 chips sum to ${chipSum}`);
    for (const [k, n] of chips) if (e.counts[k] !== n) fails.push(`${period} DOM: chip ${k} ${n} != ${e.counts[k]}`);
    await page.goto(`${url}/why?period=${period}`);
    await page.waitForSelector("[data-hand]");
    const hands = await page.$$eval("[data-hand]", (els) => els.map((el) => [el.dataset.hand, Number(el.dataset.count)]));
    for (const [k, n] of hands) {
      const want = k === "setting" ? e.setting : e.counts[k];
      if (want !== n) fails.push(`${period} DOM: Ch 2 hand ${k} ${n} != ${want}`);
    }
  }
  await browser.close();
}

if (fails.length) {
  console.error(`\nFAIL (${fails.length})\n  ` + fails.join("\n  "));
  process.exit(1);
}
console.log(`\ncounts consistent for ${Object.keys(expected).length} periods${process.argv.includes("--dom") ? " (data + DOM)" : ""}`);
