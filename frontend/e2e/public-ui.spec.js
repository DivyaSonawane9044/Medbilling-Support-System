import { test, expect } from "@playwright/test";

// Signed-out browser checks; these need no Clerk credentials.
test.describe("public UI (signed out)", () => {
  for (const route of ["/dashboard", "/billing", "/payments", "/settings"]) {
    test(`${route} redirects to sign-in`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(/\/sign-in/);
    });
  }

  for (const vp of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1366, height: 900 }]) {
    test(`sign-in page renders without horizontal scroll at ${vp.width}px`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.setViewportSize(vp);
      await page.goto("/sign-in");
      await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `e2e-artifacts/sign-in-${vp.width}.png` });
      expect(errors).toEqual([]);
    });
  }

  test("sign-up sub-routes stay on the Clerk page instead of bouncing", async ({ page }) => {
    await page.goto("/sign-up/verify-email-address");
    await expect(page).toHaveURL(/\/sign-up/);
  });
});
