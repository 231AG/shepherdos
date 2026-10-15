// End-to-end smoke test of the demo flows against a served build.
// Usage: npm run build && npm run serve (in another terminal) && node scripts/smoke.mjs
import { chromium } from "playwright-core";

const base = process.env.BASE_URL ?? "http://localhost:4173";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await browser.newContext({ viewport: { width: Number(process.env.WIDTH ?? 1280), height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const step = async (name, fn) => {
  try {
    await fn();
    console.log("ok  ", name);
  } catch (e) {
    console.log("FAIL", name, "-", e.message.split("\n")[0]);
    errors.push(name);
  }
};
const guide = () => page.evaluate(() => JSON.parse(localStorage.getItem("shepherdos-demo")).state.guide);

await step("landing -> demo sign-in", async () => {
  await page.goto(base + "/");
  await page.getByRole("link", { name: "Start the demo" }).first().click();
  await page.waitForURL("**/demo/");
});
await step("pick Pastor lands on dashboard", async () => {
  await page.getByRole("button", { name: /Pastor/ }).first().click();
  await page.waitForURL("**/c/grace-fellowship/");
  await page.getByRole("heading", { name: /Good (morning|afternoon|evening), Rev\. Kollie/ }).waitFor();
});
await step("switch church to Living Waters", async () => {
  await page.getByRole("button", { name: /Switch church/ }).click();
  await page.getByRole("button", { name: /Living Waters Assembly/ }).click();
  await page.waitForURL("**/c/living-waters/");
  await page.getByRole("heading", { name: /Rev\. Barclay/ }).waitFor();
});
await step("go offline shows banner, back online", async () => {
  await page.getByRole("switch", { name: /Network connection/ }).click();
  await page.getByText("You're offline.").waitFor();
  await page.getByRole("switch", { name: /Network connection/ }).click();
  await page.getByText("You're offline.").waitFor({ state: "detached" });
});
await step("log a follow-up note", async () => {
  const before = await page.getByRole("button", { name: /^Log note for/ }).count();
  await page.getByRole("button", { name: /^Log note for/ }).first().click();
  await page.getByRole("button", { name: "Save note" }).click();
  await page.getByText("Write a short note").waitFor();
  await page.getByLabel("What happened?").fill("Called him; he will come on Sunday.");
  await page.getByRole("button", { name: "Save note" }).click();
  await page.getByText("Follow-up logged").waitFor();
  const after = await page.getByRole("button", { name: /^Log note for/ }).count();
  if (after > before) throw new Error(`task count ${before} -> ${after}`);
});
await step("guide ticked items", async () => {
  const g = await guide();
  for (const k of ["pastor:view_dashboard", "pastor:switch_church", "pastor:toggle_offline", "pastor:log_note"]) if (!g[k]) throw new Error("missing " + k);
});
await step("switch role to Treasurer via demo bar", async () => {
  await page.getByRole("button", { name: /Viewing as|Role:/ }).click();
  await page.getByRole("button", { name: /^Treasurer/ }).click();
  await page.getByText("Offline drafts").first().waitFor({ timeout: 5000 }).catch(() => {});
  await page.getByRole("heading", { name: /Moses|Martha/ }).waitFor();
  if (!(await guide())["pastor:switch_role"]) throw new Error("switch_role not ticked");
});
await step("secretary blocked from giving URL", async () => {
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("shepherdos-demo"));
    s.state.role = "secretary";
    localStorage.setItem("shepherdos-demo", JSON.stringify(s));
  });
  await page.goto(base + "/c/grace-fellowship/giving/");
  await page.getByRole("heading", { name: "Your role doesn't have access to this" }).waitFor();
});
await step("reset demo data restores tasks", async () => {
  await page.goto(base + "/c/grace-fellowship/");
  await page.getByRole("button", { name: /Reset demo data/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Reset demo data" }).click();
  await page.getByText("Demo data reset").waitFor();
  const deltas = await page.evaluate(() => JSON.parse(localStorage.getItem("shepherdos-demo")).state.deltas);
  if (Object.keys(deltas).length) throw new Error("deltas not cleared");
});
await step("operator sees platform, provisions a church", async () => {
  await page.getByRole("button", { name: /Viewing as|Role:/ }).click();
  await page.getByRole("button", { name: /^Platform operator/ }).click();
  await page.waitForURL("**/platform/");
  await page.getByRole("button", { name: "Provision church" }).click();
  await page.getByLabel("Church name").fill("Calvary Baptist Church");
  await page.getByLabel("City or town").fill("Kakata");
  await page.getByLabel("Church admin").fill("Joseph Dolo");
  await page.getByLabel("Admin phone").fill("0886 123 456");
  await page.getByRole("dialog").getByRole("button", { name: "Provision church" }).click();
  await page.getByText("Calvary Baptist Church").first().waitFor();
});
await browser.close();
console.log(errors.length ? `\n${errors.length} problem(s):\n` + errors.join("\n") : "\nAll smoke steps passed, no console errors.");
process.exit(errors.length ? 1 : 0);
