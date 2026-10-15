// Phase 4 flows: departments, soul-winning, messaging. Usage: node scripts/smoke-phase4.mjs [shotDir]
import { chromium } from "playwright-core";

const base = process.env.BASE_URL ?? "http://localhost:4173";
const shots = process.argv[2];
const width = Number(process.env.WIDTH ?? 1440);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
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
    if (shots) await page.screenshot({ path: `${shots}/FAIL-${name.slice(0, 30).replace(/\W+/g, "_")}_${width}.png` });
  }
};
const setRole = (role) =>
  page.evaluate((r) => {
    const raw = localStorage.getItem("shepherdos-demo");
    const s = raw ? JSON.parse(raw) : { state: { epoch: Date.now(), online: true, deltas: {}, guide: {} }, version: 1 };
    s.state.role = r;
    localStorage.setItem("shepherdos-demo", JSON.stringify(s));
  }, role);
const visible = (loc) => loc.filter({ visible: true }).first();
const G = `${base}/c/grace-fellowship`;
await page.goto(base + "/");
await setRole("pastor");

await step("departments grid shows 9 departments", async () => {
  await page.goto(`${G}/departments/`);
  await page.getByRole("heading", { name: "Departments", exact: true }).waitFor();
  const n = await page.locator("main li a h2").count();
  if (n !== 9) throw new Error(`cards: ${n}`);
  if (shots) await page.screenshot({ path: `${shots}/departments_${width}.png`, fullPage: true });
});
await step("assign two members to Media, remove one with undo", async () => {
  await page.locator("main li a", { hasText: "Media" }).click();
  await page.getByRole("heading", { name: "Media", exact: true }).waitFor();
  const before = Number(await page.getByText("Members", { exact: true }).locator("xpath=following-sibling::p[1]").first().textContent());
  await page.getByRole("button", { name: "Assign members" }).click();
  const d = page.getByRole("dialog");
  const boxes = d.getByRole("checkbox");
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await d.getByRole("button", { name: "Add 2 members" }).click();
  await page.getByText("2 members added").waitFor();
  const after = Number(await page.getByText("Members", { exact: true }).locator("xpath=following-sibling::p[1]").first().textContent());
  if (after !== before + 2) throw new Error(`${before} -> ${after}`);
  await visible(page.getByRole("button", { name: /^Remove .* from Media$/ })).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await page.waitForTimeout(300);
  const back = Number(await page.getByText("Members", { exact: true }).locator("xpath=following-sibling::p[1]").first().textContent());
  if (back !== after) throw new Error(`undo: ${after} -> ${back}`);
});
await step("youth head lands on Youth, cannot assign", async () => {
  await setRole("dept_head");
  await page.goto(`${G}/departments/`);
  await page.getByRole("heading", { name: "Youth", exact: true }).waitFor();
  if (await page.getByRole("button", { name: "Assign members" }).count()) throw new Error("assign visible");
});
await step("secretary: add prospect with phone normalised", async () => {
  await setRole("secretary");
  await page.goto(`${G}/soul-winning/`);
  await page.getByRole("button", { name: "Add prospect" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("First name").fill("Blessing");
  await d.getByLabel("Last name").fill("Kromah");
  await d.getByLabel("Phone (optional)").fill("0776 555 123");
  await d.getByText("Saved as +231 77 655 5123").waitFor();
  await d.getByRole("button", { name: "Add prospect" }).click();
  await page.getByText("Prospect added").waitFor();
  await page.getByRole("dialog").getByRole("heading", { name: "Blessing Kromah" }).waitFor();
  await page.waitForTimeout(500);
  if (shots) await page.screenshot({ path: `${shots}/prospect-sheet_${width}.png` });
});
await step("note with next follow-up, move stage", async () => {
  const d = page.getByRole("dialog");
  await d.getByLabel("New note").fill("Called her; she will visit on Sunday.");
  const next = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  await d.getByLabel("Next follow-up (optional)").fill(next);
  await d.getByRole("button", { name: "Save note" }).click();
  await d.getByText("Called her; she will visit on Sunday.").waitFor();
  await d.getByRole("button", { name: "Move to Contacted" }).click();
  await d.getByText("Moved from New contact to Contacted.").waitFor();
});
await step("convert to member: member exists with history", async () => {
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Convert to member" }).click();
  await page.getByRole("dialog", { name: "Welcome Blessing as a member?" }).getByRole("button", { name: "Convert to member" }).click();
  await page.getByText("Blessing Kromah is now a member").waitFor();
  await page.goto(`${G}/members/?q=Blessing%20Kromah`);
  await visible(page.getByRole("button", { name: /Blessing Kromah/ })).click();
  await page.getByRole("dialog").getByText("Soul-winning history").waitFor();
  await page.getByRole("dialog").getByText("Called her; she will visit on Sunday.").waitFor();
});
await step("messaging: Unicode warning and fix", async () => {
  await page.goto(`${G}/messaging/`);
  await page.getByRole("button", { name: "A department" }).click();
  await page.getByLabel("Department").selectOption({ label: "Youth" });
  await page.getByLabel("Message").fill("Youth: don’t miss Friday’s revival at 6PM!");
  await page.getByText("Unicode (70 per SMS)").waitFor();
  await page.getByRole("button", { name: "Replace quotes and dashes" }).click();
  await page.getByText("Standard (160 per SMS)").waitFor();
  if (shots) await page.screenshot({ path: `${shots}/composer_${width}.png`, fullPage: true });
});
await step("send: queued -> delivered, wallet decreases", async () => {
  const balBefore = Number((await page.getByText("Wallet balance").locator("xpath=following-sibling::dd[1]").textContent()).replace(/,/g, ""));
  await page.getByRole("button", { name: /^Send to \d+ members?$/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Send now" }).click();
  await page.getByText("Message queued").waitFor();
  await page.getByText(/delivered/).first().waitFor({ timeout: 8000 });
  await page.getByRole("tab", { name: /Credits/ }).click();
  const after = Number((await page.getByText("Wallet balance").locator("xpath=following-sibling::p[1]").textContent()).replace(/,/g, ""));
  if (!(after < balBefore)) throw new Error(`${balBefore} -> ${after}`);
});
await step("not enough credits blocks sending", async () => {
  await page.getByRole("tab", { name: "New message" }).click();
  await page.getByRole("button", { name: "Everyone" }).click();
  await page.getByLabel("Message").fill("x".repeat(153 * 6));
  await page.getByText(/Not enough credits/).first().waitFor();
  if (!(await page.getByRole("button", { name: /^Send to / }).isDisabled())) throw new Error("send enabled");
});
await step("offline blocks sending", async () => {
  await page.getByLabel("Message").fill("Short note");
  await page.getByRole("switch", { name: /Network connection/ }).click();
  await page.getByText("You're offline. Messages need a connection to send.").waitFor();
  await page.getByRole("switch", { name: /Network connection/ }).click();
});
await step("history shows seeded messages and retry", async () => {
  await page.getByRole("tab", { name: /Sent/ }).click();
  const retry = page.getByRole("button", { name: /^Retry \d+ failed$/ }).first();
  if (await retry.count()) {
    await retry.click();
    await page.getByText(/Retry sent|Couldn't retry/).waitFor();
  }
});
await step("treasurer blocked from messaging and soul-winning", async () => {
  await setRole("treasurer");
  await page.goto(`${G}/messaging/`);
  await page.getByRole("heading", { name: "Your role doesn't have access to this" }).waitFor();
  await page.goto(`${G}/soul-winning/`);
  await page.getByRole("heading", { name: "Your role doesn't have access to this" }).waitFor();
});
await browser.close();
console.log(errors.length ? `\n${errors.length} problem(s):\n` + errors.join("\n") : "\nAll Phase 4 steps passed, no console errors.");
process.exit(errors.length ? 1 : 0);
