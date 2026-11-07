// Records the Verdict reveal (~10s webm): deal, flip, replay, open a case file. Usage: node scripts/reveal_video.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : "../outputs/figures";
const url = "http://localhost:4174";
const server = spawn("npx", ["vite", "preview", "--port", "4174", "--strictPort"], { shell: true, stdio: "ignore" });
for (let t = 0; t < 60; t++) {
  try {
    if ((await fetch(url)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 300));
}
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, recordVideo: { dir: out, size: { width: 1600, height: 1000 } } });
const page = await ctx.newPage();
await page.goto(url + "/");
await page.waitForTimeout(3800);
await page.getByRole("button", { name: /replay deal/i }).click();
await page.waitForTimeout(3200);
await page.locator("[data-testid=manager-list] [data-machine-row]").nth(1).click();
await page.waitForTimeout(2600);
await ctx.close();
await browser.close();
const vid = readdirSync(out).find((f) => f.endsWith(".webm") && f !== "reveal.webm");
if (vid) renameSync(join(out, vid), join(out, "reveal.webm"));
server.kill();
process.exit(0);
