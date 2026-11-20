import { test, expect } from "@playwright/test";

// Signed-out checks of the redesigned sign-in / sign-up pages against the REAL Clerk instance.
// E2E_ACCOUNT_EMAIL: an existing password account, used only to reach the "Forgot password?" step
// (the test stops before "Reset password", so no email is sent).
const ACCOUNT = process.env.E2E_ACCOUNT_EMAIL;

test.describe("auth pages (signed out, real Clerk)", () => {
  let errors;
  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && !/clerk|turnstile|cloudflare|challenge|status of 422|Content Security Policy|^%c%[do] font-size:0/i.test(m.text()) && errors.push(m.text()));
  });
  test.afterEach(() => expect(errors, errors.join("\n")).toEqual([]));

  test("sign-in shows branding, Welcome back card and sign-up link; navigation both ways", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "Manage Your Pharmacy Smarter" })).toBeVisible();
    for (const f of ["Smart Inventory Management", "Fast & Accurate Billing", "Real-Time Business Analytics"]) {
      await expect(page.getByText(f)).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByText("Sign in to your MedBilling account.")).toBeVisible();
    await page.locator(".cl-footerActionLink", { hasText: "Sign up" }).click();
    await expect(page).toHaveURL(/\/sign-up/);
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await page.locator(".cl-footerActionLink", { hasText: "Sign in" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("unknown account shows a clear Clerk error message", async ({ page }) => {
    await page.goto("/sign-in");
    await page.locator('input[name="identifier"]').fill(`nobody.${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.locator(".cl-formFieldErrorText, [id$='-error-feedback']").first()).toBeVisible();
    await expect(page.getByText(/couldn.t find your account|not found|invalid/i).first()).toBeVisible();
    await page.screenshot({ path: "e2e-artifacts/login-redesign/test-error-message.png" });
  });

  test("forgot password flow is reachable (stops before sending a reset email)", async ({ page }) => {
    test.skip(!ACCOUNT, "Set E2E_ACCOUNT_EMAIL to an existing password account");
    await page.goto("/sign-in");
    await page.locator('input[name="identifier"]').fill(ACCOUNT);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    const pw = page.locator('input[name="password"]');
    await expect(pw).toBeVisible();
    // Password visibility control provided by Clerk
    await page.getByRole("button", { name: /show password/i }).click();
    await expect(pw).toHaveAttribute("type", "text");
    await page.screenshot({ path: "e2e-artifacts/login-redesign/test-password-step.png" });
    await page.getByRole("link", { name: /forgot password/i }).or(page.getByRole("button", { name: /forgot password/i })).first().click();
    await expect(page.getByText(/forgot password|reset your password/i).first()).toBeVisible();
    await page.screenshot({ path: "e2e-artifacts/login-redesign/test-forgot-password.png" });
  });

  test("sign-up is protected by Clerk bot protection (CAPTCHA appears)", async ({ page }) => {
    await page.goto("/sign-up");
    await page.locator('input[name="emailAddress"]').fill(`qa.captcha.check.${Date.now()}@example.com`);
    await page.locator('input[name="password"]').fill(`Qa-Captcha-${Date.now()}!x`);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    // Turnstile renders inside a closed shadow root; Clerk's container gains the widget's size
    const captcha = page.locator("#clerk-captcha, .cl-captcha").first();
    await expect(captcha).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => (await captcha.boundingBox())?.height ?? 0, { timeout: 30_000 }).toBeGreaterThan(40);
    await page.screenshot({ path: "e2e-artifacts/login-redesign/test-captcha.png" });
  });

  for (const [w, h] of [[1920, 1080], [1366, 768], [768, 1024], [390, 844], [360, 740]]) {
    test(`whole card visible, nothing clipped, no horizontal scroll at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      for (const path of ["/sign-in", "/sign-up"]) {
        await page.goto(path);
        const card = page.locator(".cl-cardBox");
        await expect(card).toBeVisible();
        const box = await card.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(w);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
        // Page can scroll to the card's bottom (no fixed-height clipping)
        await page.locator(".cl-footer").last().scrollIntoViewIfNeeded();
        await expect(page.locator(".cl-footer").last()).toBeInViewport();
        await expect(page.locator(".auth-secure")).toBeAttached();
      }
    });
  }
});
