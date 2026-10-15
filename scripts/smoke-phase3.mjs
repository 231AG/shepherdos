// Phase 3 flows: giving ledger rules and platform support sessions.
// Usage: node scripts/smoke-phase3.mjs [shotDir]
import { chromium } from "playwright-core";

const base = process.env.BASE_URL ?? "http://localhost:4173";
const shots = process.argv[2];
const width = Number(process.env.WIDTH ?? 1440);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const step = async (name, fn) => {
  try {
    await fn();
    console.log("ok  ", name);
  } catch (e) {
    console.log("FAIL", name, "-", e.message.split("\n")[0]);
    if (shots) await page.screenshot({ path: `${shots}/FAIL-${name.slice(0, 30).replace(/\W+/g, "_")}_${width}.png` });
    errors.push(name);
  }
};
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("shepherdos-demo")).state);
const setState = (patch) =>
  page.evaluate((p) => {
    const raw = localStorage.getItem("shepherdos-demo");
    const s = raw ? JSON.parse(raw) : { state: { epoch: Date.now(), online: true, deltas: {}, guide: {} }, version: 1 };
    Object.assign(s.state, p);
    localStorage.setItem("shepherdos-demo", JSON.stringify(s));
  }, patch);
const G = `${base}/c/grace-fellowship`;
const tile = (label) => page.getByText(label, { exact: true }).locator("xpath=following-sibling::p[1]");

await page.goto(base + "/");
await setState({ role: "treasurer" });

await step("post an entry: appears in ledger and LRD total rises", async () => {
  await page.goto(`${G}/giving/`);
  const before = await tile("Posted · LRD").first().textContent();
  await page.getByLabel("Giver").fill("Abraham Su");
  await page.getByRole("option").getByRole("button", { name: /Abraham Sumo/ }).click();
  await page.getByLabel("Amount").fill("5000");
  await page.getByRole("button", { name: "Post entry" }).click();
  await page.getByText(/GV-\d+ posted/).waitFor();
  const after = await tile("Posted · LRD").first().textContent();
  const n = (t) => Number(t.replace(/[^\d.]/g, ""));
  if (n(after) - n(before) !== 5000) throw new Error(`${before} -> ${after}`);
});
await step("amount and giver are validated", async () => {
  await page.getByRole("button", { name: "Post entry" }).click();
  await page.getByText(/Choose the giver/).waitFor();
});
await step("reversal needs a reason, posts linked row, can't repeat", async () => {
  await page.getByRole("button", { name: /^Reverse GV-/ }).first().click();
  const d = page.getByRole("dialog");
  const ref = (await d.getByRole("heading").textContent()).replace("Reverse ", "");
  await d.getByRole("button", { name: "Post reversal" }).click();
  await d.getByText(/Every reversal needs one/).waitFor();
  await d.getByLabel("Reason").selectOption("Wrong amount");
  await d.getByRole("button", { name: "Post reversal" }).click();
  await page.getByText(/REV-\d+ posted/).waitFor();
  await page.getByText(`Reverses ${ref}.`).filter({ visible: true }).first().waitFor();
  if (await page.getByRole("button", { name: `Reverse ${ref}` }).count()) throw new Error("can reverse twice");
});
await step("close day blocked while drafts wait", async () => {
  const btn = page.getByRole("button", { name: "Close day" });
  if (!(await btn.isDisabled())) throw new Error("close not blocked");
  await page.getByText("2 drafts must be reviewed before close").waitFor();
});
await step("review drafts: post one, discard one", async () => {
  if (shots) await page.screenshot({ path: `${shots}/giving-before-review_${width}.png` });
  await page.getByRole("button", { name: /^Review draft/ }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Post to ledger" }).click();
  await page.getByText(/Draft DR-\d+ is now in the ledger/).waitFor();
  await page.getByRole("button", { name: /^Review draft/ }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Discard draft" }).click();
  await page.getByText("Draft discarded").waitFor();
});
await step("export CSV downloads the ledger", async () => {
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const f = await dl;
  if (!/^giving_grace-fellowship_\d{4}-\d\d-\d\d\.csv$/.test(f.suggestedFilename())) throw new Error(f.suggestedFilename());
});
await step("close the day, then posting is locked", async () => {
  await page.getByRole("button", { name: "Close day" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Close day" }).click();
  await page.getByText("Day closed").first().waitFor();
  await page.getByText(/Closed by Martha Doe/).waitFor();
  await page.getByText("This day is closed. Choose an open service").waitFor();
  if (await page.getByRole("button", { name: /^Reverse GV-/ }).count()) throw new Error("reverse still offered on closed day");
});
await step("offline capture only saves drafts, sync marks them for review", async () => {
  await page.getByLabel("Service").selectOption({ label: /\(open\)/ }).catch(async () => {
    const opts = await page.getByLabel("Service").locator("option").allTextContents();
    await page.getByLabel("Service").selectOption({ label: opts.find((o) => o.includes("(open)")) });
  });
  await page.getByRole("switch", { name: /Network connection/ }).click();
  if (!(await page.getByRole("button", { name: "Post entry" }).isDisabled())) throw new Error("post enabled offline");
  await page.getByLabel("Anonymous / loose offering").check();
  await page.getByLabel("Amount").fill("750");
  await page.getByRole("button", { name: "Save as draft" }).click();
  await page.getByText("Draft saved on this device").waitFor();
  await page.getByText("Draft · on device").filter({ visible: true }).first().waitFor();
  await page.getByRole("switch", { name: /Network connection/ }).click();
  await page.getByText("Draft · offline").filter({ visible: true }).first().waitFor({ timeout: 5000 });
});
await step("treasurer guide items ticked", async () => {
  const g = (await state()).guide;
  for (const k of ["record_giving", "reverse_entry", "review_drafts", "close_day", "export_csv"]) if (!g[`treasurer:${k}`]) throw new Error("missing " + k);
});
await step("pastor sees totals only", async () => {
  await setState({ role: "pastor" });
  await page.goto(`${G}/giving/`);
  await page.getByText("Totals only.").waitFor();
  if (await page.getByText(/^GV-\d+$/).count()) throw new Error("ledger rows visible");
  if (shots) await page.screenshot({ path: `${shots}/pastor-giving_${width}.png`, fullPage: true });
});
await step("secretary blocked from giving", async () => {
  await setState({ role: "secretary" });
  await page.goto(`${G}/giving/`);
  await page.getByRole("heading", { name: "Your role doesn't have access to this" }).waitFor();
});
await step("operator opens Grace under grant: read-only, no giving, no phones", async () => {
  await setState({ role: "operator" });
  await page.goto(`${base}/platform/`);
  await page.getByRole("button", { name: "Open church" }).click();
  await page.waitForURL("**/c/grace-fellowship/");
  await page.getByText("Support session, read-only.").waitFor();
  if (shots) await page.screenshot({ path: `${shots}/support-session_${width}.png` });
  await page.goto(`${G}/members/`);
  await page.getByText("Contact details hidden for your role.").waitFor();
  await page.goto(`${G}/giving/`);
  await page.getByRole("heading", { name: "Your role doesn't have access to this" }).waitFor();
  await page.goto(`${G}/attendance/check-in/`);
  await page.getByText("Support sessions are read-only.").waitFor();
});
await step("support session ends itself when the grant expires", async () => {
  const s = await state();
  const id = s.supportSession.grantId;
  const deltas = s.deltas;
  deltas.support_grants = deltas.support_grants ?? { added: [], patched: {} };
  deltas.support_grants.patched[id] = { ...(deltas.support_grants.patched[id] ?? {}), expires_at: new Date(Date.now() + 2500).toISOString() };
  await setState({ deltas });
  await page.goto(`${G}/`);
  await page.waitForURL("**/platform/", { timeout: 8000 });
  await page.getByText("Support access expired").waitFor();
  if ((await state()).supportSession) throw new Error("session not cleared");
});
await step("operator requests Living Waters; pastor approves; operator can open", async () => {
  await page.getByLabel("Request access to").selectOption({ label: "Living Waters Assembly" });
  await page.getByRole("button", { name: "Request", exact: true }).click();
  await page.getByText(/waiting for the church admin/).waitFor();
  await setState({ role: "pastor" });
  await page.goto(`${base}/c/living-waters/`);
  await page.getByRole("heading", { name: "ComNet IT Solutions asked for support access" }).waitFor();
  await page.getByRole("button", { name: "Approve for 2 hours" }).click();
  await page.getByText("Support access approved").waitFor();
  await setState({ role: "operator" });
  await page.goto(`${base}/platform/`);
  await page.getByText("Living Waters Assembly").first().waitFor();
  await page.locator("div", { hasText: /^Living Waters AssemblyGranted by/ }).getByRole("button", { name: "Open church" }).click();
  await page.waitForURL("**/c/living-waters/");
  await page.getByText("Support session, read-only.").waitFor();
  await page.getByRole("button", { name: "Leave session" }).click();
  await page.waitForURL("**/platform/");
});
await browser.close();
console.log(errors.length ? `\n${errors.length} problem(s):\n` + errors.join("\n") : "\nAll Phase 3 steps passed, no console errors.");
process.exit(errors.length ? 1 : 0);
