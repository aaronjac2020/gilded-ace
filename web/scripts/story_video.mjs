// Records the story walk-through (~30s webm): each chapter, scroll, then "Next" to the next one. Usage: node scripts/story_video.mjs [--out dir] [--url http://localhost:4173]
import { readdirSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : "../outputs/figures";
const url = args.includes("--url") ? args[args.indexOf("--url") + 1] : "http://localhost:4173";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: out, size: { width: 1440, height: 900 } } });
const page = await ctx.newPage();
await page.goto(url + "/");
await page.waitForSelector("[data-copy=headline]");
for (let ch = 0; ch < 5; ch++) {
  await page.waitForTimeout(2200);
  for (let k = 0; k < 3; k++) {
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(700);
  }
  const next = page.getByRole("link", { name: /^Next:/ });
  await next.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await next.click();
  await page.waitForSelector("[data-copy=headline]");
}
await page.waitForTimeout(2500);
await ctx.close();
await browser.close();
rmSync(join(out, "story.webm"), { force: true });
const vid = readdirSync(out).find((f) => f.endsWith(".webm") && !["reveal.webm", "story.webm"].includes(f));
if (vid) renameSync(join(out, vid), join(out, "story.webm"));
console.log(vid ? `wrote ${join(out, "story.webm")}` : "no video");
