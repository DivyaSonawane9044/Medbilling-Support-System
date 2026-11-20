import { defineConfig, devices } from "@playwright/test";

// Projects:
//  - "api-public": API E2E (local test issuer) + signed-out browser checks          -> ./e2e
//  - "browser":    signed-in browser tests with a REAL Clerk session                 -> ./tests/e2e
//                  Create the session once with: node e2e/save-auth-session.mjs (a person signs in)
// Both need the dev servers running (frontend :5173, backend :8081).
export default defineConfig({
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "api-public", testDir: "./e2e", use: { ...devices["Desktop Chrome"] } },
    {
      name: "browser",
      testDir: "./tests/e2e",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 }, storageState: "e2e-artifacts/auth/user.json" },
    },
  ],
});
