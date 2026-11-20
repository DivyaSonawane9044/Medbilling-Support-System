import { test, expect } from "@playwright/test";
import fs from "node:fs";

/**
 * Full-stack E2E: React (5173) -> Spring Boot (8081, real Clerk JWT verification) -> H2 e2e database.
 * Uses Clerk's development-only test identities (+clerk_test emails, OTP 424242), so no real inbox is needed.
 */
const API = process.env.E2E_API_URL || "http://localhost:8081";
const RUN = Date.now().toString().slice(-6);
const EMAIL = `medbilling.e2e+clerk_test@example.com`;
const PASSWORD = `E2e-Medbill-${RUN}-pass!`;
const ART = "e2e-artifacts";
fs.mkdirSync(ART, { recursive: true });

let token = null;
const ctx = { medicine: `E2E Paracip ${RUN}` };

async function signIn(page) {
  await page.goto("/sign-up");
  const email = page.locator('input[name="emailAddress"]');
  await email.waitFor({ timeout: 30_000 });
  await email.fill(EMAIL);
  const pw = page.locator('input[name="password"]');
  if (await pw.count()) await pw.fill(PASSWORD);
  for (const n of ["firstName", "lastName", "username"]) {
    const f = page.locator(`input[name="${n}"]`);
    if (await f.count()) await f.fill(n === "username" ? `e2e${RUN}` : "E2E");
  }
  await page.getByRole("button", { name: /^continue$/i }).click();

  // Either a verification code is requested (new user) or the email already exists -> sign in instead
  const otp = page.locator('input[autocomplete="one-time-code"], input[name="code"]').first();
  const exists = page.getByText(/already (taken|exists)|is taken/i);
  await Promise.race([otp.waitFor({ timeout: 30_000 }), exists.waitFor({ timeout: 30_000 })]).catch(() => {});
  if (await exists.isVisible().catch(() => false)) {
    await page.goto("/sign-in");
    await page.locator('input[name="identifier"]').fill(EMAIL);
    await page.getByRole("button", { name: /^continue$/i }).click();
    const pwIn = page.locator('input[name="password"]');
    await pwIn.waitFor({ timeout: 20_000 }).catch(() => {});
    if (await pwIn.isVisible().catch(() => false)) {
      await pwIn.fill(PASSWORD);
      await page.getByRole("button", { name: /^continue$/i }).click();
    }
    const code = page.locator('input[autocomplete="one-time-code"], input[name="code"]').first();
    if (await code.isVisible({ timeout: 10_000 }).catch(() => false)) await page.keyboard.type("424242");
  } else {
    await otp.click();
    await page.keyboard.type("424242");
  }
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
}

async function freshToken(page) {
  return page.evaluate(() => window.Clerk.session.getToken());
}

async function api(page, method, path, body) {
  token = await freshToken(page);
  const res = await page.request.fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* binary or empty */ }
  return { status: res.status(), json, headers: res.headers(), text };
}

// Needs a Clerk instance without bot protection, or Clerk Testing Tokens (requires CLERK_SECRET_KEY).
// Opt in with E2E_CLERK_UI=1; skipped otherwise because the dev instance shows a Turnstile CAPTCHA.
test.describe.serial("MedBilling browser end-to-end (Clerk)", () => {
  test.skip(!process.env.E2E_CLERK_UI, "Set E2E_CLERK_UI=1 when Clerk testing access is configured");
  let page;
  const consoleErrors = [];

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    page.on("console", (m) => {
      if (m.type() === "error" && !/clerk|favicon|Download the React DevTools/i.test(m.text())) {
        consoleErrors.push(`${page.url()} :: ${m.text()}`);
      }
    });
    page.on("pageerror", (e) => consoleErrors.push(`${page.url()} :: PAGEERROR ${e.message}`));
  });


  test("02 sign up / sign in with Clerk and open dashboard", async () => {
    await signIn(page);
    await expect(page.getByText(/dashboard|welcome/i).first()).toBeVisible();
    await page.screenshot({ path: `${ART}/02-dashboard.png`, fullPage: true });
    token = await freshToken(page);
    expect(token.split(".")).toHaveLength(3);
  });

  test("03 backend accepts the real Clerk token", async () => {
    const r = await api(page, "GET", "/api/products");
    expect(r.status).toBe(200);
    expect(r.json.length).toBeGreaterThan(0);
  });

  test("04 add, edit and search a medicine", async () => {
    let r = await api(page, "POST", "/api/products", {
      name: ctx.medicine, genericName: "Paracetamol", company: "E2E Labs", hsnCode: "30049099",
      stripSize: 10, dosageForm: "Tablet", unitType: "Strip", reorderLevel: 20, price: 112, gstRate: 12,
    });
    expect(r.status).toBe(201);
    ctx.productId = r.json.productId;
    expect(r.json.quantity).toBe(0);
    r = await api(page, "PUT", `/api/products/${ctx.productId}`, { ...r.json, company: "E2E Laboratories" });
    expect(r.status).toBe(200);
    expect(r.json.company).toBe("E2E Laboratories");
    r = await api(page, "GET", `/api/products?search=${encodeURIComponent(ctx.medicine)}`);
    expect(r.json.map((p) => p.productId)).toContain(ctx.productId);
  });

  test("05 add a customer and a supplier", async () => {
    let r = await api(page, "POST", "/api/customers", { name: `E2E Customer ${RUN}`, contactNumber: "9876543210" });
    expect(r.status).toBe(201);
    ctx.customerId = r.json.customerId;
    r = await api(page, "POST", "/api/suppliers", { name: `E2E Supplier ${RUN}`, gstIn: "27ABCDE1234F1Z5" });
    expect(r.status).toBe(201);
    ctx.supplierId = r.json.supplierId;
  });

  test("06 create purchase order, receive stock, inventory increases", async () => {
    let r = await api(page, "POST", "/api/purchases/order", { supplierId: ctx.supplierId, invoiceNumber: `PO-${RUN}` });
    expect(r.status).toBe(201);
    expect(r.json.status).toBe("PENDING");
    const today = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    r = await api(page, "POST", "/api/purchases/receive", {
      supplierId: ctx.supplierId, purchaseInvoiceId: r.json.invoiceId,
      batchItems: [{ productId: ctx.productId, batchNumber: `B${RUN}`, mfgDate: iso(new Date(today - 864e5 * 30)),
        expiryDate: iso(new Date(+today + 864e5 * 400)), mrp: 120, costPrice: 80, sellingPrice: 112, stripQuantity: 10 }],
    });
    expect(r.status).toBe(201);
    expect(r.json.status).toBe("RECEIVED");
    r = await api(page, "GET", `/api/products/${ctx.productId}`);
    expect(r.json.quantity).toBe(100);
  });

  test("07 bill through the UI: GST shown from server, stock decreases, invoice printable", async () => {
    await page.goto("/billing");
    await page.getByPlaceholder("Patient / customer").fill(`E2E Customer ${RUN}`);
    await page.getByPlaceholder("Phone number").fill("9876543210");
    await page.getByPlaceholder("Type medicine, generic or company...").fill(ctx.medicine);
    const select = page.locator(".search-stack select");
    await expect(select.locator("option", { hasText: ctx.medicine })).toHaveCount(1);
    await select.selectOption(String(ctx.productId));
    await page.locator(".qty-row input").fill("2"); // 2 strips = 20 tablets
    await expect(page.locator(".price-value")).toContainText("224");
    await page.getByRole("button", { name: "Add Item" }).click();
    await expect(page.locator(".sum-grand")).toContainText("224.00");
    // Inclusive 12% GST: taxable 200.00, CGST 12.00, SGST 12.00
    await expect(page.locator(".summary")).toContainText("200.00");
    await expect(page.locator(".summary")).toContainText("12.00");
    await page.screenshot({ path: `${ART}/07-billing-cart.png`, fullPage: true });
    await page.getByRole("button", { name: "Save Bill" }).click();
    await expect(page.locator(".bill-notice-green")).toContainText("saved");
    await expect(page.locator("#bill-container")).toContainText("Tax Invoice INV-");
    await page.screenshot({ path: `${ART}/07-invoice.png`, fullPage: true });

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PDF" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^INV-.*\.pdf$/);

    const r = await api(page, "GET", `/api/products/${ctx.productId}`);
    expect(r.json.quantity).toBe(80);
    const inv = await api(page, "GET", "/api/sales/invoices");
    ctx.invoice = inv.json.find((i) => i.customerName === `E2E Customer ${RUN}`);
    expect(Number(ctx.invoice.grandTotal)).toBe(224);
    expect(Number(ctx.invoice.totalCgst)).toBe(12);
    expect(ctx.invoice.paymentStatus).toBe("PAID");
  });

  test("08 credit sale, record payment, payment history", async () => {
    let r = await api(page, "POST", "/api/sales/bill", {
      customerId: ctx.customerId, amountPaid: 50, paymentMethod: "Cash",
      lineItems: [{ productId: ctx.productId, quantitySoldTablets: 10 }],
    });
    expect(r.status).toBe(201);
    expect(Number(r.json.balanceDue)).toBe(62);
    r = await api(page, "POST", "/api/payments/record", { invoiceId: r.json.invoiceId, paymentMethod: "UPI" });
    expect(r.status).toBe(200);
    expect(Number(r.json.amountPaid)).toBe(62);
    r = await api(page, "GET", `/api/customers/${ctx.customerId}/payments`);
    expect(r.json.length).toBeGreaterThanOrEqual(2);
    await page.goto("/payments");
    await expect(page.getByText("Payment Records")).toBeVisible();
  });

  test("09 negative quantity is rejected end to end", async () => {
    const r = await api(page, "POST", "/api/sales/bill", { lineItems: [{ productId: ctx.productId, quantitySoldTablets: -500 }] });
    expect(r.status).toBe(400);
    const p = await api(page, "GET", `/api/products/${ctx.productId}`);
    expect(p.json.quantity).toBe(70);
  });

  test("10 expiry alerts and reports", async () => {
    let r = await api(page, "GET", "/api/notifications/alerts");
    expect(r.status).toBe(200);
    expect(Array.isArray(r.json.nearExpiry)).toBe(true);
    for (const path of ["daily", "monthly", "stock", "expiry", "profit-loss", "purchases", "medicines"]) {
      r = await api(page, "GET", `/api/reports/${path}`);
      expect(r.status, path).toBe(200);
      expect(r.headers["content-type"]).toContain("application/pdf");
    }
    r = await api(page, "GET", "/api/reports/gst/monthly");
    expect(r.text).toContain("Invoice");
  });

  const routes = ["/dashboard", "/billing", "/product-master", "/inventory", "/expiry-tracking", "/medicine-schedule",
    "/customers", "/suppliers", "/purchases", "/reports", "/payments", "/accounting", "/analytics", "/settings"];

  test("11 every page loads on desktop and phone without errors or horizontal scroll", async () => {
    for (const vp of [{ name: "desktop", width: 1366, height: 900 }, { name: "mobile", width: 375, height: 812 }]) {
      await page.setViewportSize(vp);
      for (const route of routes) {
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        await expect(page.locator(".app-shell")).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${vp.name} ${route} horizontal overflow`).toBeLessThanOrEqual(1);
        await page.screenshot({ path: `${ART}/11-${vp.name}${route.replace("/", "-")}.png`, fullPage: false });
      }
    }
    await page.setViewportSize({ width: 1366, height: 900 });
  });

  test("12 data persists after a browser refresh", async () => {
    await page.goto("/reports");
    await page.reload();
    const r = await api(page, "GET", "/api/sales/invoices");
    expect(r.json.some((i) => i.invoiceId === ctx.invoice.invoiceId)).toBe(true);
  });

  test("13 sign out protects routes again", async () => {
    await page.evaluate(() => window.Clerk.signOut());
    await page.goto("/customers");
    await page.waitForURL(/\/sign-in/);
  });

  test("14 no browser console errors were logged", async () => {
    fs.writeFileSync(`${ART}/console-errors.txt`, consoleErrors.join("\n"));
    expect(consoleErrors).toEqual([]);
  });
});
