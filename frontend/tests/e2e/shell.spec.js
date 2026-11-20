import { test, expect, noHorizontalOverflow, shot } from "./fixtures";

const PAGES = ["/dashboard", "/reports", "/accounting", "/analytics", "/settings"];
const VIEWPORTS = [
  [1920, 1080],
  [1366, 768],
  [768, 1024],
  [390, 844],
];

/** Layout problems in the visible app: elements cut off by a non-scrolling container, overlapping buttons, clipped text. */
async function layoutProblems(page) {
  return page.evaluate(() => {
    const out = [];
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
    };
    const clipBox = (el) => {
      for (let a = el.parentElement; a; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (/(auto|scroll)/.test(cs.overflowX)) return null; // inside a scroll container: fine
        if (/(hidden|clip)/.test(cs.overflowX)) return a.getBoundingClientRect();
      }
      return { left: 0, right: window.innerWidth };
    };
    const sel = ".app-shell-content button, .app-shell-content a, .app-shell-content h1, .app-shell-content h2, .app-shell-content h3, .app-shell-content label, .app-shell-content input, .app-shell-content select, .top-nav button, .top-nav input";
    const els = [...document.querySelectorAll(sel)].filter(visible);
    for (const el of els) {
      const box = clipBox(el);
      if (!box) continue;
      const r = el.getBoundingClientRect();
      if (r.right > box.right + 1 || r.left < box.left - 1) {
        out.push(`cut off: <${el.tagName.toLowerCase()}> "${(el.textContent || el.placeholder || "").trim().slice(0, 40)}" (${Math.round(r.left)}..${Math.round(r.right)} vs ${Math.round(box.left)}..${Math.round(box.right)})`);
      }
      const cs = getComputedStyle(el);
      if (/^(BUTTON|A|H1|H2|H3|LABEL)$/.test(el.tagName) && cs.textOverflow !== "ellipsis" && /(hidden|clip)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) {
        out.push(`clipped text: <${el.tagName.toLowerCase()}> "${el.textContent.trim().slice(0, 40)}"`);
      }
    }
    // overlapping buttons (outside tables)
    const btns = els.filter((e) => e.tagName === "BUTTON" && !e.closest("table"));
    for (let i = 0; i < btns.length; i++) {
      for (let j = i + 1; j < btns.length; j++) {
        if (btns[i].contains(btns[j]) || btns[j].contains(btns[i])) continue;
        const a = btns[i].getBoundingClientRect();
        const b = btns[j].getBoundingClientRect();
        const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ix > 2 && iy > 2) out.push(`overlap: "${btns[i].textContent.trim().slice(0, 25)}" x "${btns[j].textContent.trim().slice(0, 25)}"`);
      }
    }
    return out;
  });
}

test.describe("App shell", () => {
  test("sidebar highlights the active link on every page", async ({ page, monitor }) => {
    const labels = { "/dashboard": "Dashboard", "/reports": "Reports", "/accounting": "Accounting", "/analytics": "Analytics", "/settings": "Settings" };
    await page.goto("/dashboard");
    for (const [route, label] of Object.entries(labels)) {
      await page.locator("aside").getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${route}$`));
      const active = page.locator("aside a.active");
      await expect(active).toHaveCount(1);
      await expect(active).toHaveText(label);
      await expect(page.locator("aside").getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
    }
  });

  test("sidebar background runs the full page height and the menu stays in view while scrolling", async ({ page, monitor }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const m = await page.evaluate(async () => {
      const aside = document.querySelector(".sidebar");
      const docH = document.documentElement.scrollHeight;
      window.scrollTo(0, docH);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const inner = document.querySelector(".sidebar-inner").getBoundingClientRect();
      const a = aside.getBoundingClientRect();
      return { docH, asideH: a.height, asideBottom: a.bottom, innerTop: inner.top, vh: innerHeight, bg: getComputedStyle(aside).backgroundColor };
    });
    expect(m.docH).toBeGreaterThan(m.vh); // long page
    expect(m.asideH).toBeGreaterThanOrEqual(m.docH - 1);
    expect(Math.abs(m.asideBottom - m.vh)).toBeLessThanOrEqual(1); // background reaches the bottom
    expect(Math.abs(m.innerTop)).toBeLessThanOrEqual(1); // menu pinned at the top
    expect(m.bg).toBe("rgb(255, 255, 255)"); // white sidebar (White Medical theme)
    await expect(page.locator("aside").getByRole("link", { name: "Settings", exact: true })).toBeInViewport();
  });

  test("mobile menu: open via button, close via overlay, Esc, close button and link click", async ({ page, monitor }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    const open = page.getByRole("button", { name: "Open menu", exact: true });
    const aside = page.locator("#app-sidebar");
    await expect(open).toBeVisible();
    await expect(open).toHaveAttribute("aria-expanded", "false");
    await expect(aside).toBeHidden();

    await open.click();
    await expect(aside).toBeInViewport();
    await expect(open).toHaveAttribute("aria-expanded", "true");
    await shot(page, "shell-mobile-menu");
    await page.mouse.click(370, 500); // overlay, outside the drawer
    await expect(aside).toBeHidden();

    await open.click();
    await expect(aside).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(aside).toBeHidden();

    await open.click();
    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(aside).toBeHidden();

    await open.click();
    await aside.getByRole("link", { name: "Reports", exact: true }).click();
    await expect(page).toHaveURL(/\/reports$/);
    await expect(aside).toBeHidden();
    expect(await noHorizontalOverflow(page)).toBe(true);
  });

  test("navbar search goes to the medicine catalog with the query", async ({ page, monitor }) => {
    await page.goto("/dashboard");
    const box = page.getByRole("searchbox", { name: "Search medicines", exact: true });
    await box.fill("Amlodipine 5mg");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/product-master\?search=Amlodipine%205mg$/);
    await page.waitForLoadState("networkidle");

    await page.goto("/dashboard");
    await page.getByRole("searchbox", { name: "Search medicines", exact: true }).press("Enter");
    await expect(page).toHaveURL(/\/product-master$/);
  });

  test("keyboard focus is visible on buttons and links", async ({ page, monitor }) => {
    await page.goto("/dashboard");
    await page.keyboard.press("Tab");
    const targets = [
      page.locator("aside").getByRole("link", { name: "Reports", exact: true }),
      page.locator(".dash-header-actions").getByRole("button", { name: "New Bill" }),
      page.getByRole("button", { name: /stock and expiry alerts/i }),
      page.getByRole("button", { name: "Clear", exact: true }),
    ];
    for (const t of targets) {
      await t.focus();
      const style = await t.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { outline: cs.outlineStyle, width: cs.outlineWidth, shadow: cs.boxShadow, fv: el.matches(":focus-visible") };
      });
      expect(style.fv).toBe(true);
      expect(style.outline !== "none" && style.width !== "0px", JSON.stringify(style)).toBe(true);
    }
  });

  for (const [w, h] of VIEWPORTS) {
    test(`${w}x${h}: no overflow, clipping or overlap on dashboard/reports/accounting/analytics/settings`, async ({ page, monitor }) => {
      await page.setViewportSize({ width: w, height: h });
      const all = [];
      for (const route of PAGES) {
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        await expect(page.locator(".app-shell-content")).not.toBeEmpty();
        if (!(await noHorizontalOverflow(page))) all.push(`${route}: horizontal page overflow`);
        for (const p of await layoutProblems(page)) all.push(`${route}: ${p}`);
        await shot(page, `shell-${w}${route.replace("/", "-")}`);
      }
      expect(all).toEqual([]);
    });
  }
});
