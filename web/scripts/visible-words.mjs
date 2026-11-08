// Visible words per chapter: rendered text of <main> (closed <details> and hidden tabs excluded).
// Usage: node scripts/visible-words.mjs [--url http://localhost:4173]
import { chromium } from "playwright";

const url = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:4173";
const ROUTES = [["Ch1", "/"], ["Ch2", "/why"], ["Ch3", "/floor"], ["Ch4", "/guests"], ["Ch5", "/plan"], ["Evidence", "/evidence"]];
const words = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const out = [];
for (const [k, r] of ROUTES) {
  await page.goto(url + r);
  await page.waitForSelector("[data-copy=headline], main h1");
  await page.waitForLoadState("networkidle");
  const text = await page.$eval("main", (el) => {
    const c = el.cloneNode(true);
    c.querySelectorAll("svg, canvas, [aria-hidden=true]").forEach((n) => n.remove());
    return el.innerText;
  });
  out.push(`${k} ${words(text)}`);
}
await browser.close();
console.log(out.join(" · "));
