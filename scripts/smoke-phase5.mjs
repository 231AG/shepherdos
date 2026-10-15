// Phase 5 flows: reports, events, Bible, settings. Usage: node scripts/smoke-phase5.mjs [shotDir]
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

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
const kpi = (label) => page.locator("main p", { hasText: new RegExp(`^${label}$`) }).first().locator("xpath=following-sibling::p[1]");
const G = `${base}/c/grace-fellowship`;
await page.goto(base + "/");
await setRole("pastor");

/* Reports */
await step("pastor reports: three tabs, membership CSV downloads", async () => {
  await page.goto(`${G}/reports/`);
  await page.getByRole("heading", { name: "Reports", exact: true }).waitFor();
  for (const t of ["Membership", "Attendance", "Giving"]) await page.getByRole("tab", { name: t }).waitFor();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
  const csv = readFileSync(await dl.path(), "utf8");
  const rows = csv.trim().split("\r\n");
  if (rows.length !== 487) throw new Error(`rows ${rows.length}`);
  if (!rows[0].includes("Phone")) throw new Error("pastor CSV should include phone");
});
await step("giving report keeps LRD and USD apart; totals-only CSV for pastor", async () => {
  await page.getByRole("tab", { name: "Giving" }).click();
  await page.getByText("Liberian dollars · net").waitFor();
  await page.getByText("US dollars · net").waitFor();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
  if (!dl.suggestedFilename().startsWith("giving_totals_")) throw new Error(dl.suggestedFilename());
  const csv = readFileSync(await dl.path(), "utf8");
  if (!csv.includes("Type,LRD,USD")) throw new Error("header");
});
await step("custom range validates and print opens", async () => {
  await page.getByRole("button", { name: "Custom" }).click();
  await page.getByLabel("From", { exact: true }).fill("2026-10-10");
  await page.getByLabel("To", { exact: true }).fill("2026-10-01");
  await page.getByText("The start date is after the end date.").waitFor();
  await page.getByRole("button", { name: "Last 6 months" }).click();
  await page.evaluate(() => {
    window.__printed = 0;
    window.print = () => (window.__printed += 1);
  });
  await page.getByRole("button", { name: "Print or save PDF" }).click();
  await page.waitForTimeout(200);
  if ((await page.evaluate(() => window.__printed)) !== 1) throw new Error("print not called");
  await page.emulateMedia({ media: "print" });
  if (await page.locator("aside").first().isVisible()) throw new Error("sidebar visible in print");
  await page.getByRole("heading", { name: "Giving report" }).waitFor();
  if (shots) await page.screenshot({ path: `${shots}/report_print_${width}.png`, fullPage: true });
  await page.emulateMedia({ media: "screen" });
});
await step("secretary: no giving tab; treasurer: giving first, ledger CSV, no phones", async () => {
  await setRole("secretary");
  await page.goto(`${G}/reports/`);
  await page.getByRole("tab", { name: "Attendance" }).waitFor();
  if (await page.getByRole("tab", { name: "Giving" }).count()) throw new Error("secretary sees giving");
  await page.getByText("Financial reports are for the pastor and treasurer.").waitFor();
  await setRole("treasurer");
  await page.goto(`${G}/reports/`);
  await page.getByText("Liberian dollars · net").waitFor();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
  const csv = readFileSync(await dl.path(), "utf8");
  if (!csv.startsWith("﻿Ref,Date")) throw new Error("ledger header");
  if (!csv.includes("Reversal")) throw new Error("no reversal rows");
  await page.getByRole("tab", { name: "Membership" }).click();
  const [dl2] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
  if (readFileSync(await dl2.path(), "utf8").split("\r\n")[0].includes("Phone")) throw new Error("treasurer CSV has phones");
});

/* Events */
await setRole("pastor");
await step("events calendar, create event with a new service, link visible", async () => {
  await page.goto(`${G}/events/`);
  await page.getByRole("heading", { name: "Events", exact: true }).waitFor();
  await page.getByRole("button", { name: "New event" }).click();
  const d = page.getByRole("dialog", { name: "New event" });
  await d.getByRole("button", { name: "Create event" }).click();
  await d.getByText("Give the event a name.").waitFor();
  await d.getByLabel("Event name").fill("Deacons' prayer vigil");
  const day = await page.evaluate(() => {
    const t = new Date(Date.now() + 9 * 86400000);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  });
  await d.getByLabel("Date").fill(day);
  await d.getByLabel("Starts").fill("19:00");
  await d.getByLabel("Who it's for").selectOption({ label: "Deacons" });
  await d.getByLabel("Service for check-in").selectOption("new");
  await d.getByRole("button", { name: "Create event" }).click();
  const sheet = page.getByRole("dialog", { name: "Deacons' prayer vigil" });
  await sheet.getByText("Open for check-in").waitFor();
  await sheet.getByRole("link", { name: "Open check-in" }).waitFor();
  if (shots) await page.screenshot({ path: `${shots}/event_sheet_${width}.png` });
});
await step("send reminder hands off to Messaging, pre-filled with the department", async () => {
  const sheet = page.getByRole("dialog", { name: "Deacons' prayer vigil" });
  await sheet.getByRole("button", { name: "Send reminder" }).click();
  await page.getByRole("heading", { name: "Messaging", exact: true }).waitFor();
  await page.getByText("Reminder for").waitFor();
  const body = await page.locator("main textarea").inputValue();
  if (!body.includes("Deacons' prayer vigil")) throw new Error(body);
  const dept = await page.getByLabel("Department").evaluate((el) => el.options[el.selectedIndex].text);
  if (dept !== "Deacons") throw new Error(dept);
});
await step("list view shows the new event with badges", async () => {
  await page.goto(`${G}/events/?view=list`);
  const row = page.locator("main button", { hasText: "Deacons' prayer vigil" });
  await row.getByText("Linked to a service").waitFor();
  await row.getByText("Reminder SMS").waitFor();
});
await step("treasurer views events read-only", async () => {
  await setRole("treasurer");
  await page.goto(`${G}/events/`);
  await page.getByText("View only for the treasurer.").waitFor();
  if (await page.getByRole("button", { name: "New event" }).count()) throw new Error("treasurer can create");
  await setRole("pastor");
});

/* Bible */
await step("bible opens John 3, lazy-loads Psalms, searches all books", async () => {
  await page.goto(`${G}/bible/`);
  await page.getByText("Demo includes selected books", { exact: false }).first().waitFor();
  await page.getByText("For God so loved the world").waitFor();
  const before = await page.evaluate(() => performance.getEntriesByType("resource").filter((r) => /\/bible\/\w+\.json$/.test(r.name)).map((r) => r.name));
  if (before.length !== 1) throw new Error(`loaded ${before.join(",")}`);
  await page.getByLabel("Book", { exact: true }).selectOption("psalms");
  await page.getByLabel("Chapter", { exact: true }).selectOption("23");
  await page.getByText("The LORD is my shepherd; I shall not want.").waitFor();
  await page.getByLabel("Search the Bible").fill("living water");
  await page.locator("main").getByRole("button", { name: "Search", exact: true }).click();
  await page.getByText("No verses found").waitFor();
  await page.getByRole("button", { name: "All demo books" }).click();
  await page.getByRole("button", { name: /John 4:10/ }).click();
  await page.locator("li.bg-gold-soft", { hasText: "living water" }).waitFor();
  if (!page.url().includes("verse=10")) throw new Error(page.url());
});

/* Settings */
await step("thresholds preview and recalculate statuses live", async () => {
  await page.goto(`${G}/settings/?tab=status`);
  await page.getByRole("heading", { name: "Members today" }).waitFor();
  await page.getByLabel("Inactive after").fill("3");
  await page.getByRole("heading", { name: "Preview" }).waitFor();
  await page.getByRole("button", { name: "Save and recalculate" }).click();
  await page.getByText("Statuses recalculated").waitFor();
  await page.goto(`${G}/`);
  const inactive = await page.locator("main").getByText(/inactive/i).count();
  if (!inactive) throw new Error("dashboard");
  await page.goto(`${G}/members/?status=inactive`);
  await page.waitForTimeout(300);
  await page.goto(`${G}/reports/`);
  const v = Number((await kpi("Inactive today").textContent()).replace(/,/g, ""));
  if (v <= 58) throw new Error(`inactive ${v}`);
  await page.goto(`${G}/settings/?tab=status`);
  await page.getByRole("button", { name: /Use defaults/ }).click();
  await page.getByRole("button", { name: "Save and recalculate" }).click();
  await page.goto(`${G}/reports/`);
  const back = Number((await kpi("Inactive today").textContent()).replace(/,/g, ""));
  if (back !== 58) throw new Error(`reset inactive ${back}`);
});
await step("giving visibility: none hides Giving for the pastor; ledger shows it", async () => {
  await page.goto(`${G}/settings/?tab=giving`);
  await page.getByLabel(/No giving/).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Giving visibility saved").waitFor();
  if (await visible(page.getByRole("link", { name: "Giving" })).count()) throw new Error("giving still in nav");
  await page.goto(`${G}/giving/`);
  await page.getByText("This church has turned off giving for pastors.", { exact: false }).waitFor();
  await page.goto(`${G}/settings/?tab=giving`);
  await page.getByLabel(/Totals only/).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
});
await step("invite a staff user and cancel the invitation", async () => {
  await page.goto(`${G}/settings/?tab=staff`);
  await page.getByRole("button", { name: "Invite user" }).click();
  const d = page.getByRole("dialog", { name: "Invite a staff user" });
  await d.getByLabel("Full name").fill("Comfort Gbessay");
  await d.getByLabel("Phone number").fill("0886 555 123");
  await d.getByLabel("Role").selectOption("dept_head");
  await d.getByLabel("Department").selectOption({ label: "Choir" });
  await d.getByRole("button", { name: "Send invitation" }).click();
  await page.getByText("Invitation sent").waitFor();
  const row = page.locator("tr", { hasText: "Comfort Gbessay" });
  await row.getByText("Choir").waitFor();
  await row.getByRole("button", { name: "Cancel invite" }).click();
  await page.getByText("Invitation cancelled").waitFor();
  if (await page.locator("tr", { hasText: "Comfort Gbessay" }).count()) throw new Error("still listed");
});
await step("support request approved from Settings with a chosen duration", async () => {
  await setRole("operator");
  await page.goto(`${base}/platform/`);
  await page.getByLabel("Request access to").selectOption({ label: "Living Waters Assembly" });
  await page.getByRole("button", { name: "Request", exact: true }).click();
  await page.getByText("Access requested").waitFor();
  await setRole("pastor");
  await page.goto(`${base}/c/living-waters/settings/?tab=support`);
  await page.getByText("from ComNet asked for access").first().waitFor();
  await page.getByLabel("Access lasts").selectOption("1");
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByText("Support access approved").waitFor();
  await page.getByText(/ends in/).first().waitFor();
});

await browser.close();
console.log(errors.length ? `\n${errors.length} problem(s):\n${errors.join("\n")}` : "\nAll phase 5 flows pass.");
process.exit(errors.length ? 1 : 0);
