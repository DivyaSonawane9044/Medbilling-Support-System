import { test as base, expect } from "@playwright/test";
import fs from "node:fs";

/**
 * Shared fixtures for signed-in browser tests.
 * - Every page is monitored for console errors, uncaught page errors and failed API calls (>= 400)
 *   and the test FAILS if any occur, unless the test expects them via `monitor.allow(...)`.
 * - `api` calls the backend with the browser's real Clerk session token, to verify database state.
 * - `uid` gives a deterministic-but-unique suffix so test data never collides with real data.
 */
export const API = process.env.E2E_API_URL || "http://localhost:8081";
export const SHOTS = "e2e-artifacts/browser";
fs.mkdirSync(SHOTS, { recursive: true });

// Noise that is not an app defect (Clerk dev-instance banner, React dev hints)
const IGNORE = [/clerk.*development/i, /Download the React DevTools/i, /favicon/i, /\[vite\]/i];

export const test = base.extend({
  monitor: async ({ page }, use, testInfo) => {
    const problems = [];
    const allowed = [];
    page.on("console", (m) => {
      if (m.type() === "error" && !IGNORE.some((r) => r.test(m.text()))) problems.push(`console: ${m.text()}`);
    });
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    page.on("response", (r) => {
      if (r.url().startsWith(API) && r.status() >= 400) {
        problems.push(`http ${r.status()} ${r.request().method()} ${r.url().replace(API, "")}`);
      }
    });
    const monitor = {
      problems,
      // e.g. monitor.allow(/http 409 DELETE \/api\/products/) when a test provokes an expected error
      allow: (re) => allowed.push(re),
      unexpected: () => problems.filter((p) => !allowed.some((re) => re.test(p))),
    };
    await use(monitor);
    const bad = monitor.unexpected();
    if (bad.length) {
      await testInfo.attach("problems", { body: bad.join("\n"), contentType: "text/plain" });
    }
    expect(bad, `Unexpected browser/API problems:\n${bad.join("\n")}`).toEqual([]);
  },

  api: async ({ page }, use) => {
    const call = async (method, path, body) => {
      if (!page.url().startsWith("http")) await page.goto("/dashboard");
      await page.waitForFunction(() => !!window.Clerk?.session, null, { timeout: 30_000 });
      const token = await page.evaluate(() => window.Clerk?.session?.getToken());
      if (!token) throw new Error("No Clerk session in the browser - re-run e2e/save-auth-session.mjs");
      const res = await page.request.fetch(`${API}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        data: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { /* not JSON */ }
      return { status: res.status(), json, text, headers: res.headers() };
    };
    await use({
      get: (p) => call("GET", p),
      post: (p, b) => call("POST", p, b ?? {}),
      put: (p, b) => call("PUT", p, b ?? {}),
      del: (p) => call("DELETE", p),
    });
  },

  uid: async ({}, use) => {
    await use(`QA${Date.now().toString(36).toUpperCase().slice(-6)}`);
  },
});

/** Opens a route through the sidebar link (not by URL) and waits for the network to settle. */
export async function openViaSidebar(page, linkName) {
  const toggle = page.getByRole("button", { name: "Open menu", exact: true });
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
  await page.locator("aside, nav").getByRole("link", { name: linkName, exact: true }).first().click();
  await page.waitForLoadState("networkidle");
}

export async function noHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth <= 1);
}

export async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

export { expect };

/** Waits until Clerk has restored the signed-in session in this page. */
export async function clerkReady(page) {
  await page.waitForFunction(() => !!window.Clerk?.session, null, { timeout: 30_000 });
}
