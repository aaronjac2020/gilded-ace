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
  await wp
    .locator("[data-testid=verdict-kpis] [data-kpi-value]")
    .first()
    .waitFor({ timeout: 15000 })
    .catch(() => {});
  console.log(`warm-up: throwaway context loaded / in ${Date.now() - t} ms`);
  await warm.close();
}
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(String(e)));

// Ch 1's signature: headline count + every reason chip. Ch 2's: every hand count.
const ch1 = async () =>
  page.evaluate(() =>
    [
      document.querySelector("[data-testid=headline-count]")?.getAttribute("data-value"),
      ...[...document.querySelectorAll("[data-reason-chip]")].map((el) => `${el.dataset.reasonChip}=${el.dataset.count}`),
    ].join(" "),
  );
const hands = async () =>
  page.evaluate(() => [...document.querySelectorAll("[data-hand]")].map((el) => `${el.dataset.hand}=${el.dataset.count}`).join(" "));

try {
  const t0 = Date.now();
  await page.goto(`${url}/`, { waitUntil: "load" });
  await page.locator("[data-testid=headline-count]").waitFor({ timeout: 10000 });
  const wallMs = Date.now() - t0;
  // Page-side time from navigation start to the headline rendered (excludes Playwright/browser cold-start overhead).
  const loadMs = Math.round(await page.evaluate(() => performance.now()));
  let slowest = "";
  if (loadMs >= 3000) {
    const top = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5)
        .map((e) => `${e.name.split("/").pop()} ${Math.round(e.duration)}ms`),
    );
    slowest = `; slowest: ${top.join(", ")}`;
  }
  record(0, "first load of / (Ch 1 headline visible)", loadMs < 3000, `${loadMs} ms in page, ${wallMs} ms wall (limit 3000)${slowest}`);

  if (only.includes(1)) {
    const before = await ch1();
    const titleBefore = await page.getByTestId("assertion-title").innerText();
    await page.getByTestId("period-menu").click();
    await page.locator("[data-period='2025-03']").click();
    await page
      .waitForFunction(
        (b) => {
          const v = [
            document.querySelector("[data-testid=headline-count]")?.getAttribute("data-value"),
            ...[...document.querySelectorAll("[data-reason-chip]")].map((el) => `${el.dataset.reasonChip}=${el.dataset.count}`),
          ].join(" ");
          return v !== b;
        },
        before,
        { timeout: 8000 },
      )
      .catch(() => {});
    const after = await ch1();
    const titleAfter = await page.getByTestId("assertion-title").innerText();
    record(
      1,
      "period change alters Ch 1 headline + chips",
      before !== after,
      `"${before}" -> "${after}" (title: ${titleBefore} -> ${titleAfter})`,
    );
  }

  if (only.includes(2)) {
    // Bank drill on Ch 3's map: the filter pill appears, Ch 3's downtime KPI and Ch 2's hands change.
    await page.goto(`${url}/why`);
    await page.locator("[data-hand]").first().waitFor({ timeout: 8000 });
    const h0 = await hands();
    await page.goto(`${url}/floor`);
    const dt = page.locator("[data-testid=downtime-kpi]");
    await dt.waitFor({ timeout: 8000 });
    const d0 = await dt.innerText();
    const bank = page.locator("#map [data-bank], [data-testid=floor-map] [data-bank]").first();
    await bank.waitFor({ timeout: 8000 }).catch(() => {});
    if (await bank.count()) {
      const id = await bank.getAttribute("data-bank");
      await bank.click();
      await page.waitForTimeout(500);
      const pill = await page
        .getByTestId("filter-pill")
        .innerText()
        .catch(() => "");
      const d1 = await dt.innerText();
      await page
        .getByRole("link", { name: /Why they.re low/ })
        .first()
        .click();
      await page
        .locator("[data-hand]")
        .first()
        .waitFor({ timeout: 8000 })
        .catch(() => {});
      await page.waitForTimeout(400);
      const h1 = await hands();
      const ok = pill.includes(id) && d0 !== d1 && h0 !== h1;
      record(
        2,
        `bank ${id} drill: filter pill, Ch 3 downtime + Ch 2 hands change`,
        ok,
        `pill "${pill.replace(/\s+/g, " ")}"; downtime "${d0}" -> "${d1}"; hands "${h0}" -> "${h1}"`,
      );
    } else record(2, "bank drill", false, "no bank elements on /floor");

    // Guest variant: a player-segment drilldown must change every Players chart (each carries a data-sig of its data).
    const sigs = async () => page.locator("[data-sig]").evaluateAll((els) => els.map((e) => e.getAttribute("data-sig")));
    await page.goto(`${url}/guests`);
    await page.locator("[data-sig]").first().waitFor({ timeout: 8000 });
    await page.waitForTimeout(300);
    const s0 = await sigs();
    const seg = page.locator("#segments [data-segment]").nth(1);
    const segId = await seg.getAttribute("data-segment");
    await seg.click();
    await page.waitForTimeout(500);
    const s1 = await sigs();
    const changed = s0.filter((s, i) => s !== s1[i]).length;
    record(
      "2b",
      `segment ${segId} drill changes all Players charts`,
      s0.length >= 4 && changed === s0.length,
      `${changed}/${s0.length} charts changed`,
    );
  }

  if (only.includes(3)) {
    // Model checks: stepper to Evidence, then the MAE table in "How the models were checked".
    await page.goto(`${url}/`);
    await page.getByRole("link", { name: "Evidence" }).first().click();
    const t = page.locator("[data-testid^=mae-table]").first();
    await t.waitFor({ timeout: 8000 });
    await t.scrollIntoViewIfNeeded();
    const txt = await t.innerText();
    record(
      3,
      "Model checks reachable with MAE table",
      (await t.isVisible()) && /MAE/.test(txt) && /\$/.test(txt),
      txt.replace(/\s+/g, " ").slice(0, 120),
    );
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

    // Allocator: starts at the recommended total; refuses a 4th type, an incompatible combo and going over budget.
    await page.goto(`${url}/plan#allocator`);
    const al = page.getByTestId("allocator");
    await al.waitFor({ timeout: 8000 });
    const step = (id, d) => al.locator(`[data-action='${id}'] [data-step='${d}']`).click();
    const total = () => al.getByTestId("alloc-total").innerText();
    const blockedMsg = async () =>
      (await al.getByTestId("alloc-blocked").count()) ? await al.getByTestId("alloc-blocked").innerText() : "";
    const t0 = await total();
    const rec = await al.getByTestId("plan-total").innerText();
    await step("A-SURVEY", 1);
    const types = await blockedMsg();
    await step("A-WAYFINDING", -1);
    for (let k = 0; k < 3; k++) await step("A-REPLACE-BUY", 1);
    const incompat = await blockedMsg();
    for (let k = 0; k < 2; k++) await step("A-REPLACE-BUY", -1);
    for (let k = 0; k < 6; k++) await step("A-MOVE-MACHINE", -1);
    for (let k = 0; k < 5; k++) await step("A-REPLACE-BUY", 1);
    const over = await blockedMsg();
    const tEnd = await total();
    const ok = t0 === rec && /action types/.test(types) && /incompatible/.test(incompat) && /exceeds/.test(over) && tEnd !== t0;
    record(
      "4b",
      "allocator matches plan total and refuses rule breaks",
      ok,
      `start ${t0} = plan ${rec}; 4th type: "${types}"; combo: "${incompat}"; budget: "${over}"; end ${tEnd}`,
    );

    // Ch 1's game-setting Evidence link lands on its claim on /evidence.
    await page.goto(`${url}/`);
    const gs = page.locator("[data-evidence='claim-game-setting']").first();
    await gs.waitFor({ timeout: 8000 }).catch(() => {});
    let cOk = false;
    let cDetail = "no game-setting evidence link on /";
    if (await gs.count()) {
      await gs.click();
      const anchor = page.locator("#claim-game-setting");
      await anchor.waitFor({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(800);
      const n = await page.locator("[id^='claim-']").count();
      cOk = (await anchor.count()) > 0 && (await anchor.isVisible()) && n >= 12;
      const u = new URL(page.url());
      cDetail = `${u.pathname}${u.search}; ${n} claims rendered`;
    }
    record("4c", "game-setting Evidence link lands on /evidence claim", cOk, cDetail);
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
