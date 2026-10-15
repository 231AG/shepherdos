// Screenshot routes at 390 / 768 / 1440 px for visual review.
// Usage: node scripts/screenshot.mjs <baseUrl> <outDir> <role|-> <path> [path...]
//   role "-" leaves the demo signed out.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const [base, outDir, role, ...paths] = process.argv.slice(2);
const widths = (process.env.WIDTHS ?? "390,768,1440").split(",").map(Number);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const errors = [];
for (const width of widths) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : width < 1000 ? 1024 : 900 }, deviceScaleFactor: 1 });
  if (role !== "-") {
    await ctx.addInitScript(([r, extra]) => {
      if (!localStorage.getItem("shepherdos-demo")) {
        localStorage.setItem("shepherdos-demo", JSON.stringify({ state: { epoch: Date.now(), role: r, online: true, deltas: {}, guide: {}, ...extra }, version: 1 }));
      }
    }, [role, JSON.parse(process.env.EXTRA_STATE ?? "{}")]);
  }
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`[${width}] ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`[${width}] ${e.message}`));
  for (const p of paths) {
    await page.goto(base + p, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const name = `${(role === "-" ? "anon" : role)}${p.replace(/[/?=&]+/g, "_")}_${width}.png`.replace(/_+/g, "_");
    await page.screenshot({ path: `${outDir}/${name}`, fullPage: true });
    // Horizontal overflow check
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) errors.push(`[${width}] ${p}: horizontal overflow ${overflow}px`);
  }
  await ctx.close();
}
await browser.close();
console.log(errors.length ? "ISSUES:\n" + errors.join("\n") : "No console errors or overflow.");
