// Copy budget: every [data-copy] element on each chapter stays within its word limit, so the story reads in one pass.
// Section titles ≤6 words and section sentences ≤15 (as in Chapter.tsx); headline ≤14 and chapter sentence ≤25.
// Usage: node scripts/copy-budget.mjs [--url http://localhost:4173]
import { chromium } from "playwright";

const url = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:4173";
const LIMIT = { headline: 14, sentence: 25, "section-title": 6, "section-sentence": 15 };
const ROUTES = ["/", "/why", "/floor", "/guests", "/plan", "/evidence"];
const words = (s) => s.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const fails = [];
let n = 0;
for (const r of ROUTES) {
  await page.goto(url + r);
  await page.waitForSelector("[data-copy=headline]");
  await page.waitForLoadState("networkidle");
  const items = await page.$$eval("[data-copy]", (els) => els.map((el) => [el.dataset.copy, el.textContent ?? ""]));
  for (const [kind, text] of items) {
    n++;
    const w = words(text);
    if (LIMIT[kind] && w > LIMIT[kind]) fails.push(`${r} ${kind} ${w}>${LIMIT[kind]}: "${text.trim().slice(0, 90)}"`);
  }
}
await browser.close();

if (fails.length) {
  console.error(`FAIL (${fails.length})\n  ` + fails.join("\n  "));
  process.exit(1);
}
console.log(`copy within budget: ${n} elements on ${ROUTES.length} chapters`);
