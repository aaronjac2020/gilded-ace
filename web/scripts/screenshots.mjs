// Screenshots every route. Usage: npm run shots [-- --out ../outputs/figures/ui_v2/after --sizes 1440x900,1280x800 --url http://...]
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const argVal = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const out = argVal("--out") ?? "../outputs/figures";
const sizes = (argVal("--sizes") ?? "1600x1000").split(",").map((s) => s.split("x").map(Number));
const full = args.includes("--full");
let url = argVal("--url");
let server = null;

const ROUTES = [
  ["verdict", "/"],
  ["floor", "/floor"],
  ["demand", "/demand"],
  ["downtime", "/downtime"],
  ["players", "/players"],
  ["comps", "/comps"],
  ["model", "/model"],
  ["plan", "/plan"],
  ["method", "/method"],
];

async function waitFor(u, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      if ((await fetch(u)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`server not up: ${u}`);
}

if (!url) {
  url = "http://localhost:4173";
  server = spawn("npx", ["vite", "preview", "--port", "4173", "--strictPort"], { shell: true, stdio: "ignore" });
  await waitFor(url);
}
url = url.replace(/\/$/, "");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
try {
  for (const [w, h] of sizes) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    for (const [name, path] of ROUTES) {
      await page.goto(`${url}${path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(700);
      const file = `${out}/${name}_${w}x${h}.png`;
      await page.screenshot({ path: file, fullPage: full });
      console.log(file);
    }
    await page.close();
  }
} finally {
  await browser.close();
  if (server) {
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(server.pid), "/f", "/t"], { shell: true });
    else server.kill();
  }
}
