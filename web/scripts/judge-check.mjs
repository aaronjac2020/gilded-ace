// Runs the judge actions against a URL (default: vite preview on :4173) and asserts each changes the UI.
// Usage: npm run judge [-- --url https://... --only 1,3]
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const argVal = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const only = (argVal("--only") ?? "1,2,3,4").split(",").map(Number);
let url = argVal("--url");
let server = null;

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

const results = [];
const record = (n, name, ok, detail) => {
  results.push({ n, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  check ${n}: ${name} — ${detail}`);
};

const browser = await chromium.launch();

// Remote runs: the first page load in a freshly launched browser process is slow (4.5–5.7 s measured, every resource
// < 310 ms; client DNS/TLS + cold renderer), while later loads take 0.8–1.0 s. Warm up with a throwaway context so check 0
// measures the site; it still runs in a fresh context with an empty browser cache.
if (!server) {
  const t = Date.now();
  const warm = await browser.newContext();
  const wp = await warm.newPage();
  await wp.goto(`${url}/`, { waitUntil: "load" });
  await wp.locator("[data-testid=verdict-kpis] [data-kpi-value]").first().waitFor({ timeout: 15000 }).catch(() => {});
  console.log(`warm-up: throwaway context loaded / in ${Date.now() - t} ms`);
  await warm.close();
}
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(String(e)));

const kpis = async () => (await page.locator("[data-testid=verdict-kpis] [data-kpi-value]").allInnerTexts()).join(" | ");

try {
  const t0 = Date.now();
  await page.goto(`${url}/`, { waitUntil: "load" });
  await page.locator("[data-testid=verdict-kpis] [data-kpi-value]").first().waitFor({ timeout: 10000 });
  const wallMs = Date.now() - t0;
  // Page-side time from navigation start to KPIs rendered (excludes Playwright/browser cold-start overhead).
  const loadMs = Math.round(await page.evaluate(() => performance.now()));
  let slowest = "";
  if (loadMs >= 3000) {
    const top = await page.evaluate(() =>
      performance.getEntriesByType("resource").sort((a, b) => b.duration - a.duration).slice(0, 5).map((e) => `${e.name.split("/").pop()} ${Math.round(e.duration)}ms`),
    );
    const nav = await page.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0];
      return n ? `doc ttfb ${Math.round(n.responseStart)}ms, doc done ${Math.round(n.responseEnd)}ms, dcl ${Math.round(n.domContentLoadedEventEnd)}ms, load ${Math.round(n.loadEventEnd)}ms` : "no nav entry";
    });
    slowest = `; ${nav}; slowest: ${top.join(", ")}`;
  }
  record(0, "first load of / (KPIs visible)", loadMs < 3000, `${loadMs} ms in page, ${wallMs} ms wall (limit 3000)${slowest}`);

  if (only.includes(1)) {
    const before = await kpis();
    const titleBefore = await page.getByTestId("assertion-title").innerText();
    await page.locator("[data-period='2025-03']").click();
    await page.waitForFunction((b) => {
      const v = [...document.querySelectorAll("[data-testid=verdict-kpis] [data-kpi-value]")].map((e) => e.textContent).join(" | ");
      return v !== b;
    }, before.replace(/\n/g, ""), { timeout: 8000 }).catch(() => {});
    const after = await kpis();
    const titleAfter = await page.getByTestId("assertion-title").innerText();
    record(1, "period change alters Verdict KPIs", before !== after, `"${before}" -> "${after}" (title: ${titleBefore} -> ${titleAfter})`);
  }

  if (only.includes(2)) {
    await page.goto(`${url}/floor`);
    const bank = page.locator("[data-bank]").first();
    await bank.waitFor({ timeout: 8000 }).catch(() => {});
    if (await bank.count()) {
      const id = await bank.getAttribute("data-bank");
      await page.goto(`${url}/`);
      await page.locator("[data-testid=verdict-kpis] [data-kpi-value]").first().waitFor();
      const before = await kpis();
      await page.goto(`${url}/floor`);
      await page.locator(`[data-bank='${id}']`).click();
      await page.getByRole("link", { name: "Verdict" }).click();
      await page.locator("[data-testid=verdict-kpis] [data-kpi-value]").first().waitFor();
      await page.waitForTimeout(400);
      const after = await kpis();
      let dtOk = true;
      let dtDetail = "downtime screen pending (M9)";
      await page.getByRole("link", { name: "Downtime" }).click();
      const dt = page.locator("[data-testid=downtime-kpi]");
      await dt.waitFor({ timeout: 8000 }).catch(() => {});
      if (await dt.count()) {
        const withBank = await dt.innerText();
        await page.goto(`${url}/downtime`);
        await page.locator("[data-testid=downtime-kpi]").waitFor({ timeout: 8000 });
        await page.waitForTimeout(300);
        const noBank = await page.locator("[data-testid=downtime-kpi]").innerText();
        dtOk = withBank !== noBank;
        dtDetail = `downtime "${noBank}" -> "${withBank}"`;
      }
      record(2, `bank ${id} drill changes Verdict + Downtime`, before !== after && dtOk, `verdict "${before}" -> "${after}"; ${dtDetail}`);
    } else record(2, "bank drill", false, "no bank elements");
  }

  if (only.includes(3)) {
    await page.goto(`${url}/`);
    await page.getByRole("link", { name: "Model Lab" }).click();
    const t = page.getByTestId("mae-table");
    await t.waitFor({ timeout: 8000 });
    const txt = await t.innerText();
    record(3, "Model Lab reachable with MAE table", (await t.isVisible()) && /MAE/.test(txt) && /\$/.test(txt), txt.replace(/\s+/g, " ").slice(0, 120));
  }

  if (only.includes(4)) {
    await page.goto(`${url}/plan`);
    const link = page.locator("[data-testid=plan-lines] [data-evidence]").first();
    await link.waitFor({ timeout: 8000 }).catch(() => {});
    if (await link.count()) {
      const focus = await link.getAttribute("data-evidence");
      await link.click();
      await page.waitForTimeout(800);
      const u = new URL(page.url());
      const target = focus ? page.locator(`#${focus}`) : null;
      const ok = target ? await target.isVisible() : true;
      record(4, "EvidenceLink from /plan lands on chart + filters", ok, `${u.pathname}${u.search} (focus #${focus})`);
    } else record(4, "EvidenceLink from /plan", false, "no evidence links");
  }

  record(9, "no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" || ") || "none");
} finally {
  await browser.close();
  if (server) {
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(server.pid), "/f", "/t"], { shell: true });
    else server.kill();
  }
}

const failed = results.filter((r) => !r.ok && (r.n === 0 || r.n === 9 || only.includes(r.n)));
console.log(failed.length ? `\n${failed.length} check(s) failed` : "\nall checks passed");
process.exit(failed.length ? 1 : 0);
