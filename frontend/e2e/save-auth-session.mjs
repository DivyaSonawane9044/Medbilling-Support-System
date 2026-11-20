// Opens a visible browser so a person can sign in with Clerk (real auth, real CAPTCHA),
// then saves that session for the automated browser tests. Output is git-ignored.
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const OUT = process.env.E2E_SESSION_OUT || "e2e-artifacts/auth/user.json";
fs.mkdirSync("e2e-artifacts/auth", { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1366, height: 860 } });
const page = await context.newPage();
await page.goto(`${BASE}/sign-in`);
console.log("Waiting for you to sign in (up to 5 minutes)...");
await page.waitForURL(/\/dashboard/, { timeout: 300_000 });
// Make sure Clerk has an active session before saving
await page.waitForFunction(() => !!window.Clerk?.session, null, { timeout: 30_000 });
const who = await page.evaluate(() => window.Clerk.user?.primaryEmailAddress?.emailAddress || window.Clerk.user?.id);
await page.screenshot({ path: "e2e-artifacts/login-redesign/after-real-login-dashboard.png" });
console.log("Landed on:", new URL(page.url()).pathname);
await context.storageState({ path: OUT });
console.log(`Signed in as ${who}; session saved to ${OUT}`);
await browser.close();
