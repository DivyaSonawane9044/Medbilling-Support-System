import { test, expect } from "@playwright/test";

// RUN LAST, ON ITS OWN: signing out revokes the Clerk session that every other test reuses.
//   npx playwright test --project=browser tests/e2e/zz-signout.spec.js
test.skip(!process.env.E2E_RUN_SIGNOUT, "Set E2E_RUN_SIGNOUT=1 (ends the saved session)");

test("sign out through the Clerk user menu ends the session and protects routes", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.locator(".cl-userButtonTrigger").first().click();
  await page.getByRole("menuitem", { name: /sign out/i }).click();
  await page.waitForURL(/\/sign-in/);
  await page.goto("/billing");
  await page.waitForURL(/\/sign-in/);
  const hasSession = await page.evaluate(() => !!window.Clerk?.session);
  expect(hasSession).toBe(false);
});
