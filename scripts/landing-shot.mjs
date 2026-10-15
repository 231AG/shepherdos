// Captures the real dashboard for the landing page hero image.
// Usage: npm run build && npm run serve (in another terminal) && npm run shots:landing
import { chromium } from "playwright-core";

const base = process.env.BASE_URL ?? "http://localhost:4173";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() =>
  localStorage.setItem("shepherdos-demo", JSON.stringify({ state: { epoch: Date.now(), role: "pastor", online: true, deltas: {}, guide: {} }, version: 1 })),
);
const page = await ctx.newPage();
await page.goto(`${base}/c/grace-fellowship/`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
// Hide the demo bar so the image shows the product itself.
await page.addStyleTag({ content: "body > div > div:first-child.sticky { display: none !important; } header.sticky { top: 0 !important; } aside.sticky { top: 0 !important; height: 100dvh !important; }" });
await page.screenshot({ path: "public/images/dashboard-preview.jpg", type: "jpeg", quality: 80, clip: { x: 0, y: 0, width: 1280, height: 800 } });
await browser.close();
console.log("Wrote public/images/dashboard-preview.jpg");
