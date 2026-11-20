import fs from "node:fs";
import { test, expect, noHorizontalOverflow, shot } from "./fixtures";

const money = (v) =>
  `₹${(Number(v) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Own product + supplier + received batch + a 20-tablet bill (₹224.00 incl. 12% GST, cost ₹160). */
async function createSale(api, uid) {
  const prod = await api.post("/api/products", {
    name: `QA Medicine ${uid}`, genericName: `QA Generic ${uid}`, company: `QA Co ${uid}`,
    hsnCode: "3004", stripSize: 10, price: 112, gstRate: 12, reorderLevel: 1, targetStockLevel: 10,
  });
  expect(prod.status, prod.text).toBeLessThan(300);
  const sup = await api.post("/api/suppliers", { name: `QA Supplier ${uid}`, contactNumber: "9876543210", company: `QA Co ${uid}` });
  expect(sup.status, sup.text).toBeLessThan(300);
  const rec = await api.post("/api/purchases/receive", {
    supplierId: sup.json.supplierId,
    invoiceNumber: `QA-PI-${uid}`,
    batchItems: [{
      productId: prod.json.productId, batchNumber: `B${uid}`,
      mfgDate: ymd(new Date(Date.now() - 86400000)), expiryDate: ymd(new Date(Date.now() + 400 * 86400000)),
      mrp: 112, costPrice: 80, sellingPrice: 112, stripQuantity: 5,
    }],
  });
  expect(rec.status, rec.text).toBeLessThan(300);
  const bill = await api.post("/api/sales/bill", {
    customerName: `QA Cust ${uid}`, paymentMethod: "CASH",
    lineItems: [{ productId: prod.json.productId, quantitySoldTablets: 20 }],
  });
  expect(bill.status, bill.text).toBeLessThan(300);
  return { product: prod.json, invoice: bill.json };
}

/** Loads /reports and returns the payloads the page rendered. */
async function openReports(page) {
  const want = {
    dash: "/api/analytics/dashboard",
    stock: "/api/inventory/stock-list",
    invoices: "/api/sales/invoices",
    customers: "/api/customers",
  };
  const waits = Object.fromEntries(
    Object.entries(want).map(([k, path]) => [
      k,
      page.waitForResponse((r) => new URL(r.url()).pathname === path && r.request().method() === "GET" && r.status() === 200),
    ])
  );
  const prodWait = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/products" && r.status() === 200);
  await page.goto("/reports");
  const out = {};
  for (const [k, p] of Object.entries(waits)) out[k] = await (await p).json();
  out.products = await (await prodWait).json();
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  return out;
}

function tab(page, name) {
  return page.locator(".rep-tabs").getByRole("button", { name, exact: true });
}

const footCount = (page) => page.locator(".rep-table .dt-count");

async function download(page, button) {
  const [dl] = await Promise.all([page.waitForEvent("download"), button.click()]);
  const path = await dl.path();
  const buf = fs.readFileSync(path);
  return { name: dl.suggestedFilename(), buf };
}

test.describe("Reports", () => {
  test("every tab shows data consistent with the backend", async ({ page, monitor, api, uid }) => {
    const { invoice } = await createSale(api, uid);
    const d = await openReports(page);
    const inv = d.invoices;
    expect(inv.some((i) => i.invoiceId === invoice.invoiceId)).toBe(true);

    // Today summary card
    const now = new Date();
    const todays = inv.filter((i) => new Date(i.saleDateTime).toDateString() === now.toDateString());
    const todayTotal = todays.reduce((s, i) => s + Number(i.grandTotal), 0);
    const todayGst = todays.reduce((s, i) => s + Number(i.totalCgst) + Number(i.totalSgst), 0);
    await expect(page.locator(".rep-summary .sum-value")).toHaveText(money(todayTotal));
    await expect(page.locator(".rep-summary")).toContainText(`${todays.length} invoices`);
    await expect(page.locator(".rep-summary")).toContainText(`GST ${money(todayGst)}`);

    // Daily tab (default): newest day first, equals the invoices grouped by local day
    const dayKeys = [...new Set(inv.map((i) => ymd(new Date(i.saleDateTime))))].sort().reverse();
    await expect(footCount(page)).toContainText(`of ${dayKeys.length}`);
    const firstRow = page.locator(".rep-table tbody tr").first();
    const day0 = inv.filter((i) => ymd(new Date(i.saleDateTime)) === dayKeys[0]);
    await expect(firstRow.locator("td").nth(0)).toHaveText(dayKeys[0]);
    await expect(firstRow.locator("td").nth(1)).toHaveText(String(day0.length));
    await expect(firstRow.locator("td").nth(5)).toHaveText(money(day0.reduce((s, i) => s + Number(i.grandTotal), 0)));

    // Recent invoices: search finds our invoice with correct amount
    await tab(page, "Recent Invoices").click();
    await expect(footCount(page)).toContainText(`of ${inv.length}`);
    await page.getByLabel("Search Recent Invoices").fill(invoice.invoiceNumber);
    const row = page.locator(".rep-table tbody tr");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(`QA Cust ${uid}`);
    await expect(row).toContainText("₹224.00");
    await expect(row).toContainText("PAID");

    // Stock report: one row per batch
    await tab(page, "Stock Report").click();
    await expect(footCount(page)).toContainText(`of ${d.stock.length}`);
    await page.getByLabel("Search Stock Report").fill(`B${uid}`);
    await expect(page.locator(".rep-table tbody tr")).toHaveCount(1);
    await expect(page.locator(".rep-table tbody tr")).toContainText("30"); // 50 - 20 units
    await expect(page.locator(".rep-table tbody tr")).toContainText("₹112.00");

    // Profit & Loss: values from /api/analytics/dashboard
    await tab(page, "Profit & Loss").click();
    const pl = [
      ["Today Revenue", d.dash.todayRevenue], ["Yesterday Revenue", d.dash.yesterdayRevenue],
      ["Today Profit", d.dash.profit], ["Monthly Revenue", d.dash.monthlyRevenue],
      ["Monthly Profit", d.dash.monthlyProfit], ["Stock Value (MRP)", d.dash.totalStockValueMrp],
      ["Stock Value (Cost)", d.dash.totalStockValueCost],
    ];
    for (const [metric, value] of pl) {
      await expect(page.locator(".rep-table tbody tr").filter({ hasText: metric }).first().locator("td").nth(1)).toHaveText(money(value));
    }

    // Medicines A-Z: all products, sorted
    await tab(page, "Medicines A-Z").click();
    await expect(footCount(page)).toContainText(`of ${d.products.length}`);
    const names = await page.locator(".rep-table tbody tr td:first-child").allTextContents();
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    await shot(page, "reports-tabs");
  });

  test("date range filter narrows the on-screen views and Clear dates resets them", async ({ page, monitor, api, uid }) => {
    const { invoice } = await createSale(api, uid);
    const d = await openReports(page);
    const todayKey = ymd(new Date());
    const todays = d.invoices.filter((i) => ymd(new Date(i.saleDateTime)) === todayKey);
    const allDays = new Set(d.invoices.map((i) => ymd(new Date(i.saleDateTime)))).size;

    await page.getByLabel("From date").fill(todayKey);
    await page.getByLabel("To date").fill(todayKey);
    await expect(page.locator(".rep-filter__note")).toContainText(`Showing ${todayKey} to ${todayKey}`);
    // Daily tab: exactly today's row with today's totals
    await expect(footCount(page)).toContainText("of 1");
    const first = page.locator(".rep-table tbody tr").first();
    await expect(first.locator("td").nth(0)).toHaveText(todayKey);
    await expect(first.locator("td").nth(1)).toHaveText(String(todays.length));
    await expect(first.locator("td").nth(5)).toHaveText(money(todays.reduce((s, i) => s + Number(i.grandTotal), 0)));
    // GST totals card follows the range
    const gst = todays.reduce((s, i) => s + Number(i.totalCgst) + Number(i.totalSgst), 0);
    await expect(page.locator(".rep-gst-totals")).toContainText(`${todays.length} invoices`);
    await expect(page.locator(".rep-gst-totals .rep-gst-list > div").filter({ hasText: "Total GST" }).locator("dd")).toHaveText(money(gst));
    // Invoices tab: only today's invoices, ours included
    await tab(page, "Recent Invoices").click();
    await expect(footCount(page)).toContainText(`of ${todays.length}`);
    await page.getByLabel("Search Recent Invoices").fill(invoice.invoiceNumber);
    await expect(page.locator(".rep-table tbody tr")).toHaveCount(1);

    // a range in the future shows nothing; Clear dates restores everything
    await page.getByLabel("To date").fill("2999-12-31");
    await page.getByLabel("From date").fill("2999-12-31");
    await page.getByLabel("Search Recent Invoices").fill("");
    await expect(footCount(page)).toContainText("of 0");
    await expect(page.locator(".rep-table tbody")).toContainText("No results found.");
    await page.getByRole("button", { name: "Clear dates" }).click();
    await tab(page, "Daily Sales (GST)").click();
    await expect(footCount(page)).toContainText(`of ${allDays}`);
  });

  test("every download button produces a real file", async ({ page, monitor }) => {
    await openReports(page);
    const buttons = [
      ["Daily Sales PDF", "pdf"], ["Monthly Sales PDF", "pdf"], ["Yearly Sales PDF", "pdf"],
      ["GST Monthly CSV", "csv"], ["GST Yearly CSV", "csv"], ["P&L PDF", "pdf"],
      ["Stock PDF", "pdf"], ["Expiry PDF", "pdf"], ["Purchase PDF", "pdf"], ["Medicines A-Z", "pdf"],
    ];
    for (const [label, kind] of buttons) {
      const btn = page.locator(".rep-actions, .rep-btn-row").getByRole("button", { name: label });
      const { name, buf } = await download(page, btn);
      expect(buf.length, label).toBeGreaterThan(50);
      if (kind === "pdf") {
        expect(buf.subarray(0, 4).toString(), `${label} -> ${name}`).toBe("%PDF");
        expect(name.toLowerCase()).toMatch(/\.pdf$/);
      } else {
        const text = buf.toString("utf8").replace(/^﻿/, "");
        const header = text.split(/\r?\n/)[0];
        expect(name.toLowerCase(), label).toMatch(/\.csv$/);
        expect(header.split(",").length, `${label} header: ${header}`).toBeGreaterThan(2);
        expect(header, label).toMatch(/[A-Za-z]/);
      }
      await expect(btn).toBeEnabled();
    }
    await expect(page.locator(".rep-error")).toHaveCount(0);
  });

  test("customer report picker downloads that customer's PDF", async ({ page, monitor, api, uid }) => {
    const c = await api.post("/api/customers", { name: `QA Report Cust ${uid}`, contactNumber: "9000000001" });
    expect(c.status, c.text).toBeLessThan(300);
    await openReports(page);
    const btn = page.getByRole("button", { name: "Customer PDF" });
    await expect(btn).toBeDisabled();
    const picker = page.getByLabel("Customer for report");
    await picker.selectOption(String(c.json.customerId));
    await expect(btn).toBeEnabled();
    const { buf } = await download(page, btn);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  test("a failing download shows an error and can be dismissed", async ({ page, monitor }) => {
    monitor.allow(/http 500 GET \/api\/reports\/daily/);
    monitor.allow(/console: Failed to load resource/);
    await openReports(page);
    await page.route("**/api/reports/daily", (r) =>
      r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ status: 500, error: "Internal Server Error", message: "QA forced failure" }) })
    );
    await page.getByRole("button", { name: "Daily Sales PDF" }).click();
    const err = page.getByRole("alert").filter({ hasText: "Download failed" });
    await expect(err).toBeVisible();
    await expect(page.getByRole("button", { name: "Daily Sales PDF" })).toBeEnabled();
    await err.getByRole("button", { name: "Dismiss" }).click();
    await expect(err).toHaveCount(0);
  });
});

test.describe("Accounting", () => {
  test("period switch: cards equal /api/accounting/summary, list filtered, totals reconcile", async ({ page, monitor, api, uid }) => {
    await createSale(api, uid);
    const invWait = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/sales/invoices" && r.status() === 200);
    const sumWait = page.waitForResponse((r) => r.url().includes("/api/accounting/summary?period=today") && r.status() === 200);
    await page.goto("/accounting");
    await invWait;
    let summary = await (await sumWait).json();

    for (const [period, label] of [["today", "Today"], ["month", "This Month"], ["year", "This Year"]]) {
      if (period !== "today") {
        const w = page.waitForResponse((r) => r.url().includes(`/api/accounting/summary?period=${period}`) && r.status() === 200);
        const iw = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/sales/invoices" && r.status() === 200);
        await page.getByRole("group", { name: "Period" }).getByRole("button", { name: label, exact: true }).click();
        await expect(page.getByRole("group", { name: "Period" }).getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
        summary = await (await w).json();
        await iw;
      }
      const invoices = (await api.get("/api/sales/invoices")).json;
      const card = (l) => page.getByTestId(`acc-card-${l}`).locator(".summary-value");
      await expect(card("Invoices")).toHaveText(Number(summary.invoiceCount).toLocaleString("en-IN"));
      await expect(card("Total Sales")).toHaveText(money(summary.grandTotal));
      await expect(card("Total Taxable")).toHaveText(money(summary.totalTaxable));
      await expect(card("Total CGST")).toHaveText(money(summary.totalCgst));
      await expect(card("Total SGST")).toHaveText(money(summary.totalSgst));
      await expect(card("Total GST")).toHaveText(money(summary.totalGst));
      await expect(card("Total Cost")).toHaveText(money(summary.totalCost));
      await expect(card("Profit")).toHaveText(money(summary.profit));

      // server totals reconcile
      const t = Number(summary.totalTaxable), cg = Number(summary.totalCgst), sg = Number(summary.totalSgst);
      expect(Math.abs(t + cg + sg - Number(summary.grandTotal)), `${period} taxable+GST vs grand`).toBeLessThan(0.05 * Math.max(1, summary.invoiceCount));
      expect(Math.abs(cg + sg - Number(summary.totalGst))).toBeLessThan(0.02);
      expect(Math.abs(t - Number(summary.totalCost) - Number(summary.profit)), `${period} profit`).toBeLessThan(0.02);

      // invoice list filtered by period (our sale today is always inside)
      const now = new Date();
      const inPeriod = invoices.filter((i) => {
        const d = new Date(i.saleDateTime);
        if (period === "today") return d.toDateString() === now.toDateString();
        if (period === "month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        return d.getFullYear() === now.getFullYear();
      });
      expect(inPeriod.length).toBeGreaterThan(0);
      await expect(page.locator(".accounting-table .dt-count")).toContainText(`of ${inPeriod.length}`);
      expect(Number(summary.invoiceCount), `${period} count`).toBe(inPeriod.length);
      await page.getByLabel("Search Sales Report with GST Breakup").fill(`QA Cust ${uid}`);
      const row = page.locator(".accounting-table tbody tr");
      await expect(row).toHaveCount(1);
      await expect(row).toContainText("₹200.00");
      await expect(row).toContainText("₹12.00");
      await expect(row).toContainText("₹224.00");
      await page.getByLabel("Search Sales Report with GST Breakup").fill("");
      await expect(page.locator(".accounting-table h3")).toBeVisible();
      await expect(page.locator(".accounting-table")).toContainText(`Invoices for ${label}`);
    }
    await shot(page, "accounting-year");
  });

  test("summary failure shows an error with a working Retry", async ({ page, monitor }) => {
    monitor.allow(/http 500 GET \/api\/accounting\/summary/);
    monitor.allow(/console: Failed to load resource/);
    let fail = true;
    await page.route("**/api/accounting/summary**", (r) =>
      fail ? r.fulfill({ status: 500, contentType: "application/json", body: '{"status":500,"message":"QA forced failure"}' }) : r.fallback()
    );
    await page.goto("/accounting");
    const alert = page.getByRole("alert").filter({ hasText: "Could not load the today summary" });
    await expect(alert).toBeVisible();
    fail = false;
    await alert.getByRole("button", { name: "Retry" }).click();
    await expect(alert).toHaveCount(0);
    await expect(page.getByTestId("acc-card-Total Sales")).toBeVisible();
  });
});

test("reports and accounting have no overflow at 390px", async ({ page, monitor }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/reports", "/accounting"]) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    expect(await noHorizontalOverflow(page), route).toBe(true);
    await shot(page, `${route.slice(1)}-390`);
  }
});
