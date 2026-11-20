import { test, expect, API, clerkReady } from "./fixtures";
import { test as plain } from "@playwright/test";

// Real Clerk session (saved by a person signing in), verified by the real backend.
test("signed-in session is active and carries a verified Clerk token", async ({ page, api, monitor }) => {
  await page.goto("/dashboard");
  await clerkReady(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  const claims = await page.evaluate(async () => {
    const t = await window.Clerk.session.getToken();
    return JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  });
  expect(claims.iss).toMatch(/clerk\.accounts\.dev$/);
  expect(claims.azp).toBe("http://localhost:5173");
  expect((await api.get("/api/products?search=zzzz")).status).toBe(200);
});

test("signed-in user visiting /sign-in or / is redirected to the dashboard", async ({ page, monitor }) => {
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("session persists across reload and a new tab", async ({ page, context, monitor }) => {
  await page.goto("/customers");
  await page.reload();
  await expect(page).toHaveURL(/\/customers$/);
  const tab = await context.newPage();
  await tab.goto("/payments");
  await expect(tab).toHaveURL(/\/payments$/);
  await tab.close();
});

test("navbar shows the signed-in user and Clerk user menu", async ({ page, monitor }) => {
  await page.goto("/dashboard");
  await clerkReady(page);
  const email = await page.evaluate(() => window.Clerk.user.primaryEmailAddress.emailAddress);
  await expect(page.getByText(email).first()).toBeVisible();
  await expect(page.locator(".cl-userButtonTrigger, .cl-userButton-root, [class*='userButton']").first()).toBeVisible();
});

test("every API call made by the UI carries a Bearer token", async ({ page, monitor }) => {
  const missing = [];
  page.on("request", (r) => {
    if (r.url().startsWith(API) && !/\/api\/health/.test(r.url()) && !r.headers()["authorization"]?.startsWith("Bearer ey")) {
      missing.push(`${r.method()} ${r.url()}`);
    }
  });
  for (const route of ["/dashboard", "/billing", "/customers", "/payments", "/reports", "/analytics"]) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
  }
  expect(missing).toEqual([]);
});

test("expired or forged tokens are rejected by the backend", async ({ page, request }) => {
  await page.goto("/dashboard");
  await clerkReady(page);
  const real = await page.evaluate(() => window.Clerk.session.getToken());
  const [h, p] = real.split(".");
  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  const forged = `${h}.${Buffer.from(JSON.stringify({ ...payload, sub: "user_attacker" })).toString("base64url")}.${real.split(".")[2]}`;
  for (const t of [forged, real.slice(0, -6) + "AAAAAA", "garbage"]) {
    const r = await request.get(`${API}/api/customers`, { headers: { Authorization: `Bearer ${t}` } });
    expect(r.status()).toBe(401);
  }
  expect((await request.get(`${API}/api/customers`)).status()).toBe(401);
  expect((await request.delete(`${API}/api/products/1`)).status()).toBe(401);
});

// Signed-out context: no saved session
plain.describe("signed out", () => {
  plain.use({ storageState: { cookies: [], origins: [] } });
  for (const route of ["/dashboard", "/billing", "/customers", "/settings", "/sales"]) {
    plain(`direct URL ${route} redirects to sign-in`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(/\/sign-in/);
    });
  }
});

