// Lists elements wider than the viewport. Usage: node scripts/find-overflow.mjs <url> [width] [role]
import { chromium } from "playwright-core";
const [url, width = "390", role = "pastor"] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: Number(width), height: 844 } });
await ctx.addInitScript((r) => localStorage.setItem("shepherdos-demo", JSON.stringify({ state: { epoch: Date.now(), role: r, online: true, deltas: {}, guide: {} }, version: 1 })), role);
const p = await ctx.newPage();
await p.goto(url, { waitUntil: "networkidle" });
console.log("scrollWidth", await p.evaluate(() => document.documentElement.scrollWidth), "viewport", width);
console.log(await p.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map((e) => `${e.tagName}.${(e.className?.toString?.() ?? "").slice(0, 100)} r=${Math.round(e.getBoundingClientRect().right)}`)));
await b.close();
