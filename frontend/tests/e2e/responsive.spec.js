import { test, expect } from "./fixtures";

// Every page at five viewport sizes: no page-level horizontal scroll and no element sticking out of the
// viewport (the content area clips overflow, so element boxes are checked, not just scrollWidth).
// Elements inside a horizontal scroll container (wide tables) are fine as long as the container fits.
const ROUTES = ["/dashboard", "/billing", "/product-master", "/inventory", "/expiry-tracking", "/purchases", "/customers",
  "/suppliers", "/payments", "/accounting", "/reports", "/analytics", "/medicine-schedule", "/settings"];
const VIEWPORTS = [[1920, 1080], [1366, 768], [768, 1024], [390, 844], [360, 740]];

for (const [w, h] of VIEWPORTS) {
  test(`all pages fit at ${w}x${h}`, async ({ page, monitor }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: w, height: h });
    const problems = [];
    for (const route of ROUTES) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(600);
      const bad = await page.evaluate(() => {
        const vw = window.innerWidth;
        const out = [];
        if (document.documentElement.scrollWidth > vw + 1) out.push(`page scrollWidth ${document.documentElement.scrollWidth}`);
        const inScroller = (el) => {
          for (let p = el.parentElement; p; p = p.parentElement) {
            const cs = getComputedStyle(p);
            if (/(auto|scroll)/.test(cs.overflowX)) return p.getBoundingClientRect().right <= vw + 1;
          }
          return false;
        };
        for (const el of document.querySelectorAll(".app-shell-main *")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const cs = getComputedStyle(el);
          if (cs.position === "fixed" || cs.visibility === "hidden") continue;
          if (el.closest(".mb-sr-only, .recharts-wrapper, svg, [aria-hidden='true']")) continue;
          if ((r.right > vw + 1 || r.left < -1) && !inScroller(el)) {
            const label = (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40);
            out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} "${label}" [${Math.round(r.left)}-${Math.round(r.right)}]`);
          }
        }
        return [...new Set(out)].slice(0, 5);
      });
      if (bad.length) {
        problems.push(`${route}: ${bad.join(" | ")}`);
        await page.screenshot({ path: `e2e-artifacts/redesign/overflow-${w}${route.replace("/", "-")}.png`, fullPage: true });
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
}
