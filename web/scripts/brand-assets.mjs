// Renders public/favicon-32.png and public/og.png from public/favicon.svg. Run: node scripts/brand-assets.mjs
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const svg = readFileSync(new URL("../public/favicon.svg", import.meta.url), "utf8");
const b = await chromium.launch();

const fav = await b.newPage({ viewport: { width: 32, height: 32 } });
await fav.setContent(`<style>html,body{margin:0;background:transparent}svg{width:32px;height:32px;display:block}</style>${svg}`);
await fav.screenshot({ path: "public/favicon-32.png", omitBackground: true });

const og = await b.newPage({ viewport: { width: 1200, height: 630 } });
await og.setContent(`<style>
  body{margin:0;width:1200px;height:630px;background:#0A0909;color:#EDE6DD;font-family:Inter,"Segoe UI",system-ui,sans-serif;position:relative;overflow:hidden}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:40px 40px;mask-image:radial-gradient(ellipse at 30% 40%,#000 20%,transparent 75%)}
  .glow{position:absolute;left:-200px;top:-260px;width:900px;height:700px;background:radial-gradient(closest-side,rgba(122,26,26,.55),transparent)}
  .wrap{position:absolute;inset:72px 80px;display:flex;flex-direction:column}
  .mark svg{width:64px;height:64px}
  .eyebrow{margin-top:56px;font-size:20px;letter-spacing:.14em;text-transform:uppercase;color:#E3B36A}
  h1{margin:16px 0 0;font-size:72px;line-height:1.05;letter-spacing:-.03em;font-weight:600;max-width:900px}
  p{margin:auto 0 0;font-size:22px;color:#9C9289}
</style><div class="grid"></div><div class="glow"></div>
<div class="wrap"><div class="mark">${svg}</div><div class="eyebrow">The Gilded Ace · Floor review</div><h1>Luck, location, or a leak?</h1><p>Which low-earning slot machines are truly weak. Synthetic data, TAMU Datathon.</p></div>`);
await og.screenshot({ path: "public/og.png" });
await b.close();
console.log("wrote public/favicon-32.png, public/og.png");
