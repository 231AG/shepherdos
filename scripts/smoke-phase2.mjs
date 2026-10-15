// Phase 2 flows: members, import, check-in. Usage: node scripts/smoke-phase2.mjs [shotDir]
import { chromium } from "playwright-core";

const base = process.env.BASE_URL ?? "http://localhost:4173";
const shots = process.argv[2];
const width = Number(process.env.WIDTH ?? 1280);
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
const setRole = (role) =>
  page.evaluate((r) => {
    const raw = localStorage.getItem("shepherdos-demo");
    const s = raw ? JSON.parse(raw) : { state: { epoch: Date.now(), online: true, deltas: {}, guide: {} }, version: 1 };
    s.state.role = r;
    localStorage.setItem("shepherdos-demo", JSON.stringify(s));
  }, role);
const guide = () => page.evaluate(() => JSON.parse(localStorage.getItem("shepherdos-demo")).state.guide);
const G = `${base}/c/grace-fellowship`;

await page.goto(base + "/");
await setRole("secretary");

await step("search by last 4 digits finds Abraham Sumo", async () => {
  await page.goto(`${G}/members/`);
  await page.getByLabel(/Search by name or phone/).fill("4521");
  await page.getByRole("button", { name: "Abraham Sumo" }).first().waitFor();
});
await step("open member profile sheet", async () => {
  await page.getByRole("button", { name: "Abraham Sumo" }).first().click();
  await page.getByRole("dialog").getByText(/Attended \d+ of the last/).waitFor();
  await page.waitForTimeout(400);
  if (shots) await page.screenshot({ path: `${shots}/member-sheet_${width}.png` });
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await page.waitForURL((u) => !u.searchParams.has("id"));
  await page.locator("dialog[open]").waitFor({ state: "detached" });
});
await step("status filter Inactive shows 58", async () => {
  await page.getByLabel(/Search by name or phone/).fill("");
  await page.getByRole("button", { name: /^Inactive 58/ }).click();
  await page.getByText("Showing 30 of 58").waitFor();
});
await step("add member normalises phone", async () => {
  await page.getByRole("button", { name: "Add member" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("First name").fill("Comfort");
  await d.getByLabel("Last name").fill("Wesseh");
  await d.getByLabel("Phone").fill("0886-123-457");
  await d.getByText("Saved as +231 88 612 3457").waitFor();
  await d.getByLabel("Youth").check();
  await d.getByRole("button", { name: "Add member" }).click();
  await page.getByText("Member added").waitFor();
  await page.getByRole("dialog").getByText("Comfort Wesseh").first().waitFor();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
});
await step("duplicate phone is refused", async () => {
  await page.getByRole("button", { name: "Add member" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Phone").fill("077 452 4521");
  await d.getByText(/Abraham Sumo already uses this number/).first().waitFor();
  await d.getByRole("button", { name: "Cancel" }).click();
});
await step("import sample: counts, duplicates block, error report, confirm", async () => {
  await page.goto(`${G}/members/import/`);
  await page.getByRole("button", { name: "Use sample notebook file" }).click();
  await page.getByText("We read").waitFor();
  await page.getByRole("button", { name: "Review rows" }).click();
  await page.getByText("Ready to import").waitFor();
  for (const [v, l] of [["198", "Ready to import"], ["11", "Rows need fixing"], ["187", "Phones normalised to +231"]]) {
    const tile = page.locator("div", { has: page.getByText(l, { exact: true }) }).filter({ hasText: v }).first();
    await tile.waitFor();
  }
  const cont = page.getByRole("button", { name: "Resolve 3 duplicates to continue" });
  if (!(await cont.isDisabled())) throw new Error("continue not blocked");
  if (shots) await page.screenshot({ path: `${shots}/import-review_${width}.png` });
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download error report/ }).click();
  const file = await dl;
  if (!file.suggestedFilename().endsWith("_error_report.csv")) throw new Error("bad filename " + file.suggestedFilename());
  await page.getByRole("group", { name: /notebook row 47/ }).getByRole("button", { name: "Merge" }).click();
  await page.getByRole("group", { name: /notebook row 88/ }).getByRole("button", { name: "Keep both" }).click();
  await page.getByRole("group", { name: /notebook row 156/ }).getByRole("button", { name: "Skip row" }).click();
  await page.getByRole("button", { name: "Continue to confirm" }).click();
  await page.getByRole("button", { name: "Import 199 members" }).click();
  await page.getByRole("heading", { name: "199 members added" }).waitFor();
  if (!(await guide())["secretary:import_sample"]) throw new Error("guide not ticked");
});
await step("imported members show as New, not Inactive", async () => {
  await page.getByRole("link", { name: "View new members" }).click();
  await page.getByRole("button", { name: /^New 21[0-9]/ }).waitFor();
  await page.getByRole("button", { name: /^Inactive 58/ }).waitFor();
});
await step("check-in offline -> pending -> sync -> synced", async () => {
  await page.goto(`${G}/attendance/check-in/`);
  await page.getByRole("switch", { name: /Network connection/ }).click();
  await page.getByLabel("Search name or last 4 digits").fill("Daniel Toe");
  await page.getByRole("button", { name: /Daniel Toe.*Tap to check in/ }).click();
  await page.getByRole("button", { name: /Daniel Toe.*waiting to sync/ }).waitFor();
  await page.getByRole("switch", { name: /Network connection/ }).click();
  await page.getByRole("button", { name: /Daniel Toe.*Checked in · synced/ }).waitFor({ timeout: 5000 });
  if (!(await guide())["secretary:checkin_offline"]) throw new Error("guide not ticked");
});
await step("failed row retries to synced", async () => {
  await page.getByLabel("Search name or last 4 digits").fill("Felix Massaquoi");
  await page.getByRole("button", { name: /Felix Massaquoi.*Sync failed/ }).click();
  await page.getByRole("button", { name: /Felix Massaquoi.*Checked in · synced/ }).waitFor({ timeout: 5000 });
});
await step("duplicate check-in prevented", async () => {
  await page.getByLabel("Search name or last 4 digits").fill("Abraham Sumo");
  await page.getByRole("button", { name: /Abraham Sumo.*synced/ }).first().click();
  await page.getByText("Abraham is already checked in").waitFor();
});
await step("guest counter", async () => {
  const before = Number(await page.getByLabel("Guests").first().textContent().catch(() => "0"));
  await page.getByRole("button", { name: "Add a guest" }).click();
  await page.getByRole("button", { name: "Add a guest" }).click();
  const after = await page.locator('[aria-labelledby="guests-label"]').textContent();
  if (Number(after) < 2) throw new Error(`guests ${before} -> ${after}`);
});
await step("treasurer: phones hidden, no phone search", async () => {
  await setRole("treasurer");
  await page.goto(`${G}/members/`);
  await page.getByText("Contact details hidden for your role.").waitFor();
  if (await page.getByText(/\+231 \d\d \d{3} \d{4}/).count()) throw new Error("phone visible");
  await page.getByLabel("Search by name").fill("4521");
  await page.getByText("No members match").waitFor();
});
await step("treasurer blocked from attendance", async () => {
  await page.goto(`${G}/attendance/check-in/`);
  await page.getByRole("heading", { name: "Your role doesn't have access to this" }).waitFor();
});
await step("youth head sees Youth only and can check in", async () => {
  await setRole("dept_head");
  await page.goto(`${G}/members/`);
  await page.getByText(/in Youth/).first().waitFor();
  await page.goto(`${G}/attendance/check-in/`);
  await page.getByText("Showing Youth members only.").waitFor();
  await page.getByRole("button", { name: /Tap to check in/ }).first().click();
  if (!(await guide())["dept_head:checkin_youth"]) throw new Error("guide not ticked");
});
await browser.close();
console.log(errors.length ? `\n${errors.length} problem(s):\n` + errors.join("\n") : "\nAll Phase 2 steps passed, no console errors.");
process.exit(errors.length ? 1 : 0);
