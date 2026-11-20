import { test, expect, openViaSidebar, noHorizontalOverflow, shot } from "./fixtures";

// Route -> sidebar link label (null = route reached only by URL / other links)
const ROUTES = [
  ["/dashboard", "Dashboard"],
  ["/billing", "Billing"],
  ["/sales", null],
  ["/inventory", "Inventory"],
  ["/purchases", "Purchases"],
  ["/expiry-tracking", "Expiry & Batch Tracking"],
  ["/expiry-alerts", null],
  ["/stock-alerts", null],
  ["/product-master", "Medicine Catalog & Pricing"],
  ["/medicines", null],
  ["/add-medicine", null],
  ["/medicine-schedule", "Medicine Schedule"],
  ["/customers", "Customers"],
  ["/suppliers", "Suppliers"],
  ["/payments", "Payments"],
  ["/accounting", "Accounting"],
  ["/reports", "Reports"],
  ["/analytics", "Analytics"],
  ["/settings", "Settings"],
];

test.describe("every route: direct URL, refresh, no errors", () => {
  for (const [route] of ROUTES) {
    test(`${route} loads, survives refresh, shows content`, async ({ page, monitor }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(new RegExp(`${route}$`));
      await expect(page.locator(".app-shell")).toBeVisible();
      await expect(page.locator(".app-shell-content")).not.toBeEmpty();
      await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(new RegExp(`${route}$`));
      await expect(page.locator(".app-shell-content")).not.toBeEmpty();
      await shot(page, `nav${route.replace(/\//g, "-")}`);
    });
  }
});

test("sidebar links navigate to every page and back", async ({ page, monitor }) => {
  await page.goto("/dashboard");
  for (const [route, label] of ROUTES.filter(([, l]) => l)) {
    await openViaSidebar(page, label);
    await expect(page, `sidebar "${label}"`).toHaveURL(new RegExp(`${route}$`));
    await expect(page.locator(".app-shell-content")).not.toBeEmpty();
  }
  await page.goBack();
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".app-shell-content")).not.toBeEmpty();
});

const VIEWPORTS = [
  { name: "desktop-1920", width: 1920, height: 1080 },
  { name: "laptop-1366", width: 1366, height: 768 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 },
];

for (const vp of VIEWPORTS) {
  test(`responsive ${vp.name}: no horizontal overflow on any page, navigation reachable`, async ({ page, monitor }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const overflowing = [];
    for (const [route] of ROUTES.filter(([, l]) => l)) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      if (!(await noHorizontalOverflow(page))) {
        const w = await page.evaluate(() => document.documentElement.scrollWidth);
        overflowing.push(`${route} (${w}px > ${vp.width}px)`);
        await shot(page, `overflow-${vp.name}${route.replace(/\//g, "-")}`);
      }
    }
    await page.goto("/dashboard");
    await shot(page, `responsive-${vp.name}-dashboard`);
    // Navigation must be reachable: either visible links or a menu toggle
    if (vp.width < 900) {
      const toggle = page.getByRole("button", { name: "Open menu", exact: true });
      await expect(toggle).toBeVisible();
      await toggle.click();
      await expect(page.locator("aside").getByRole("link", { name: "Billing", exact: true })).toBeVisible();
      await shot(page, `responsive-${vp.name}-menu-open`);
      await page.locator("aside").getByRole("link", { name: "Billing", exact: true }).click();
      await expect(page).toHaveURL(/\/billing$/);
    } else {
      await expect(page.locator("aside").getByRole("link", { name: "Billing", exact: true })).toBeVisible();
    }
    expect(overflowing, `pages with horizontal overflow at ${vp.name}`).toEqual([]);
  });
}
