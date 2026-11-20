// Captures the signed-out auth pages at standard viewports and reports layout health.
// Usage: node e2e/capture-auth-pages.mjs <label>   (e.g. before / after)
import { chromium } from "@playwright/test";
const label = process.argv[2] || "shot";
const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const VPS = [["desktop", 1920, 1080], ["laptop", 1366, 768], ["tablet", 768, 1024], ["mobile", 390, 844], ["small", 360, 740]];
const browser = await chromium.launch();
for (const path of ["/sign-in", "/sign-up"]) {
  for (const [name, width, height] of VPS) {
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(BASE + path);
    await page.locator(".cl-card, .cl-cardBox").first().waitFor({ timeout: 30000 });
    await page.waitForLoadState("networkidle");
    const m = await page.evaluate(() => {
      const card = document.querySelector(".cl-cardBox") || document.querySelector(".cl-card");
      const r = card.getBoundingClientRect();
      // Is any ancestor clipping the card?
      let clipped = false;
      for (let el = card.parentElement; el && el !== document.body; el = el.parentElement) {
        const s = getComputedStyle(el); const pr = el.getBoundingClientRect();
        if (/(hidden|clip)/.test(s.overflow + s.overflowY + s.overflowX) && (r.bottom > pr.bottom + 1 || r.right > pr.right + 1 || r.left < pr.left - 1)) clipped = true;
      }
      return {
        overflowX: document.documentElement.scrollWidth - innerWidth,
        cardTop: Math.round(r.top + scrollY), cardBottom: Math.round(r.bottom + scrollY), cardLeft: Math.round(r.left), cardRight: Math.round(r.right),
        docHeight: document.documentElement.scrollHeight, clipped,
        font: getComputedStyle(document.body).fontFamily.split(",")[0],
        themeLoaded: getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim() !== "",
      };
    });
    await page.screenshot({ path: `e2e-artifacts/login-redesign/${label}${path.replace("/", "-")}-${name}.png`, fullPage: true });
    console.log(`${label} ${path} ${name} ${width}x${height}`, JSON.stringify(m), errors.length ? "ERRORS: " + errors.join(" | ") : "no console errors");
    await ctx.close();
  }
}
await browser.close();
