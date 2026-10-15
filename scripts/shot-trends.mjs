// Screenshot the Attendance > Trends tab. Usage: node scripts/shot-trends.mjs <outDir> [width] [role]
import { chromium } from "playwright-core";
const [out, width = "1440", role = "pastor"] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: Number(width), height: 900 } });
await ctx.addInitScript((r) => localStorage.setItem("shepherdos-demo", JSON.stringify({ state: { epoch: Date.now(), role: r, online: true, deltas: {}, guide: {} }, version: 1 })), role);
const p = await ctx.newPage();
await p.goto("http://localhost:4173/c/grace-fellowship/attendance/", { waitUntil: "networkidle" });
await p.getByRole("tab", { name: "Trends" }).click();
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/trends_${role}_${width}.png`, fullPage: true });
await b.close();
