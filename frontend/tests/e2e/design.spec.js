import { test, expect } from "./fixtures";
import { test as plain } from "@playwright/test";

// Design-system and motion behaviour, measured in the real browser (signed-in session, real data).

test("design tokens, fonts and theme are applied globally", async ({ page, monitor }) => {
  await page.goto("/dashboard");
  await expect(page.locator("#app-sidebar")).toBeVisible();
  const t = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      gold: cs.getPropertyValue("--mb-gold").trim(),
      gold2: cs.getPropertyValue("--mb-gold-2").trim(),
      bg: getComputedStyle(document.body).backgroundColor,
      font: getComputedStyle(document.body).fontFamily,
      sidebar: getComputedStyle(document.querySelector("#app-sidebar")).backgroundColor,
    };
  });
  // White Medical theme is the default (Black + Gold is the optional dark theme)
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
  expect(t.gold).toBe("#b08a22");
  expect(t.gold2).toBe("#8f6f17");
  expect(t.bg).toBe("rgb(245, 247, 250)");
  expect(t.font).toMatch(/^Inter/);
  expect(t.sidebar).toBe("rgb(255, 255, 255)"); // white sidebar
});

test("route change plays the page transition and settles fully visible", async ({ page, monitor }) => {
  await page.goto("/dashboard");
  await page.locator("aside").getByRole("link", { name: "Customers", exact: true }).click();
  await expect(page).toHaveURL(/\/customers$/);
  const page1 = page.locator(".app-page");
  // Framer Motion animates opacity/transform inline; it must end at opacity 1 with no offset
  await expect.poll(async () => page1.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await expect.poll(async () => page1.evaluate((el) => getComputedStyle(el).transform)).toMatch(/none|matrix\(1, 0, 0, 1, 0, 0\)/);
});

test("dashboard stat cards stagger in and count up to the real value", async ({ page, monitor }) => {
  await page.goto("/dashboard");
  const grid = page.locator(".mb-stagger").first();
  await expect(grid).toBeVisible();
  const names = await grid.locator(":scope > *").evaluateAll((els) => els.slice(0, 3).map((e) => ({
    name: getComputedStyle(e).animationName,
    delay: getComputedStyle(e).animationDelay,
  })));
  expect(names[0].name).toBe("mb-fade-up");
  expect(names[1].delay).not.toBe(names[0].delay); // staggered
  // Count-up: the visible number ends equal to the screen-reader (final) value
  const stat = page.locator(".mb-stat").filter({ has: page.locator(".mb-sr-only") }).first();
  await expect(stat).toBeVisible();
  await expect.poll(async () => stat.evaluate((el) => {
    const shown = el.querySelector('.mb-stat__value [aria-hidden="true"]')?.textContent;
    const final = el.querySelector(".mb-stat__value .mb-sr-only")?.textContent;
    return shown === final && !!final;
  }), { timeout: 5000 }).toBe(true);
});

test("cards lift on hover and primary buttons give hover/press feedback", async ({ page, monitor }) => {
  await page.goto("/dashboard");
  const card = page.locator(".mb-stat").first();
  await expect(card).toBeVisible();
  await page.waitForTimeout(800); // let the entrance animation finish before measuring hover
  await card.hover();
  await expect.poll(async () => card.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42)).toBeLessThan(0);
  const btn = page.locator(".btn-primary:not(:disabled)").first();
  await btn.hover();
  await expect.poll(async () => btn.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42)).toBeLessThan(0);
  const transition = await btn.evaluate((el) => getComputedStyle(el).transitionProperty);
  expect(transition).toMatch(/transform/);
});

test("sidebar collapses, persists across reload, and the active indicator follows navigation", async ({ page, monitor }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/dashboard");
  const aside = page.locator("#app-sidebar");
  const width = () => aside.evaluate((el) => Math.round(el.getBoundingClientRect().width));
  await expect.poll(width).toBe(248);
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect.poll(width).toBe(76);
  // Labels stay accessible while collapsed
  await expect(aside.getByRole("link", { name: "Billing", exact: true })).toBeAttached();
  await page.reload();
  await expect.poll(width).toBe(76);
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect.poll(width).toBe(248);

  await aside.getByRole("link", { name: "Billing", exact: true }).click();
  await expect(aside.getByRole("link", { name: "Billing", exact: true }).locator(".sidebar-active-bg")).toHaveCount(1);
  await expect(aside.getByRole("link", { name: "Billing", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(aside.locator(".sidebar-active-bg")).toHaveCount(1);
});

test("modal opens with a fade/scale animation and closes on Escape", async ({ page, monitor }) => {
  await page.goto("/add-medicine");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect.poll(async () => dialog.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("keyboard focus is always visible", async ({ page, monitor }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
  const ring = await page.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    return { tag: el.tagName, outline: cs.outlineStyle, shadow: cs.boxShadow };
  });
  expect(ring.outline !== "none" || ring.shadow !== "none", JSON.stringify(ring)).toBe(true);
});

test("no endless animations once each page has loaded", async ({ page, monitor }) => {
  for (const route of ["/dashboard", "/billing", "/inventory", "/expiry-tracking", "/customers", "/analytics"]) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    const infinite = await page.evaluate(() =>
      document.getAnimations()
        .filter((a) => a.effect?.getTiming().iterations === Infinity && a.playState === "running")
        .map((a) => `${a.animationName || a.constructor.name} on ${a.effect.target?.className || a.effect.target?.tagName}`)
    );
    expect(infinite, `${route}: ${infinite.join(", ")}`).toEqual([]);
  }
});

plain.describe("reduced motion", () => {
  plain.use({ storageState: "e2e-artifacts/auth/user.json", reducedMotion: "reduce" });
  plain("users who prefer reduced motion get no entrance or hover motion", async ({ page }) => {
    await page.goto("/dashboard");
    const card = page.locator(".mb-stat").first();
    await expect(card).toBeVisible();
    const t = await card.evaluate((el) => ({
      anim: parseFloat(getComputedStyle(el).animationDuration),
      trans: parseFloat(getComputedStyle(el).transitionDuration),
    }));
    expect(t.anim).toBeLessThan(0.01);
    expect(t.trans).toBeLessThan(0.01);
    // Count-up shows the final value immediately
    const same = await card.evaluate((el) => {
      const shown = el.querySelector('.mb-stat__value [aria-hidden="true"]')?.textContent;
      const final = el.querySelector(".mb-stat__value .mb-sr-only")?.textContent;
      return !final || shown === final;
    });
    expect(same).toBe(true);
  });
});
