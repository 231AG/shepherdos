// Generates favicon + PWA icons from src/components/brand/Logo.tsx.
// The /brand-preview page renders the logo mark; this script screenshots it.
// Usage: npm run build && npm run serve (in another terminal) && npm run icons
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:4173";
mkdirSync("public/icons", { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

async function render(selector, size, file) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 700 }, deviceScaleFactor: size / 512 });
  const page = await ctx.newPage();
  await page.goto(`${base}/brand-preview/`, { waitUntil: "networkidle" });
  await page.locator(selector).screenshot({ path: file, omitBackground: true });
  await ctx.close();
}

await render("#icon-square", 512, "public/icons/icon-512.png");
await render("#icon-square", 192, "public/icons/icon-192.png");
await render("#icon-square", 180, "public/icons/apple-touch-icon.png");
await render("#icon-square", 32, "public/icons/favicon-32.png");
await render("#icon-maskable", 512, "public/icons/icon-maskable-512.png");

// favicon.ico containing the 32px PNG (ICO allows embedded PNG data).
const png = readFileSync("public/icons/favicon-32.png");
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // count
header.writeUInt8(32, 6); // width
header.writeUInt8(32, 7); // height
header.writeUInt8(0, 8); // palette
header.writeUInt8(0, 9); // reserved
header.writeUInt16LE(1, 10); // colour planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(png.length, 14); // size
header.writeUInt32LE(22, 18); // offset
writeFileSync("public/favicon.ico", Buffer.concat([header, png]));

await browser.close();
console.log("Icons written to public/icons and public/favicon.ico");
