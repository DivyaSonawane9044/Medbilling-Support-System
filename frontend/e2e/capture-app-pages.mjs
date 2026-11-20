// Screenshots every signed-in page at desktop and phone width (real Clerk session).
// Usage: node e2e/capture-app-pages.mjs <label> [widths=1366,390]
import { chromium } from "@playwright/test";
const label = process.argv[2] || "shot";
const widths = (process.argv[3] || "1366,390").split(",").map(Number);
const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const ROUTES = ["/dashboard", "/billing", "/product-master", "/inventory", "/expiry-tracking", "/purchases", "/customers",
  "/suppliers", "/payments", "/accounting", "/reports", "/analytics", "/medicine-schedule", "/settings"];
const browser = await chromium.launch();
for (const w of widths) {
  const ctx = await browser.newContext({ storageState: "e2e-artifacts/auth/user.json", viewport: { width: w, height: w > 800 ? 768 : 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`${page.url()} ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()} ${m.text()}`));
  for (const r of ROUTES) {
    await page.goto(BASE + r);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800); // let entrance animations finish before capturing
    await page.screenshot({ path: `e2e-artifacts/redesign/${label}-${w}${r.replace("/", "-")}.png`, fullPage: true });
  }
  console.log(`${label} @${w}: ${ROUTES.length} pages, console/page errors: ${errors.length}`, errors.slice(0, 5));
  await ctx.close();
}
await browser.close();
