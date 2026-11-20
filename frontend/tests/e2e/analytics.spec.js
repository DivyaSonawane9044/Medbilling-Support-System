import { test, expect, noHorizontalOverflow, shot } from "./fixtures";

const money = (v) =>
  `₹${(Number(v) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Own product + supplier + received batch + a 20-tablet bill so this month has a best seller. */
async function createSale(api, uid) {
  const prod = await api.post("/api/products", {
    name: `QA Medicine ${uid}`, genericName: `QA Generic ${uid}`, company: `QA Co ${uid}`,
    hsnCode: "3004", stripSize: 10, price: 112, gstRate: 12, reorderLevel: 1, targetStockLevel: 10,
  });
  expect(prod.status, prod.text).toBeLessThan(300);
  const sup = await api.post("/api/suppliers", { name: `QA Supplier ${uid}`, contactNumber: "9876543210", company: `QA Co ${uid}` });
  const rec = await api.post("/api/purchases/receive", {
    supplierId: sup.json.supplierId, invoiceNumber: `QA-PI-${uid}`,
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
  return bill.json;
}

async function openAnalytics(page) {
  const w = page.waitForResponse((r) => r.url().includes("/api/analytics/dashboard") && r.status() === 200);
  await page.goto("/analytics");
  const data = await (await w).json();
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
  return data;
}

const kpiValue = (page, label) => page.locator(".an-kpi").filter({ hasText: label }).locator(".an-kpi-value");

test.describe("Analytics", () => {
  test("KPIs, charts and tables match /api/analytics/dashboard", async ({ page, monitor, api, uid }) => {
    await createSale(api, uid);
    const d = await openAnalytics(page);

    await expect(kpiValue(page, "Today vs Yesterday")).toHaveText(money(d.todayRevenue));
    await expect(page.locator(".an-kpi").filter({ hasText: "Today vs Yesterday" })).toContainText(`Yesterday: ${money(d.yesterdayRevenue)}`);
    await expect(kpiValue(page, "This Month Revenue")).toHaveText(money(d.monthlyRevenue));
    await expect(kpiValue(page, "This Month Profit")).toHaveText(money(d.monthlyProfit));
    await expect(kpiValue(page, "Stock Value (MRP)")).toHaveText(money(d.totalStockValueMrp));
    await expect(kpiValue(page, "Stock Value (Cost)")).toHaveText(money(d.totalStockValueCost));

    // our sale today => today's revenue, today's profit/cost pie and this month's best sellers all have data
    expect(Number(d.todayRevenue)).toBeGreaterThanOrEqual(224 - 0.01);
    expect(d.bestSellingMedicines.length).toBeGreaterThan(0);
    const charts = page.locator(".an-chart");
    await expect(charts).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(charts.nth(i).locator("svg.recharts-surface").first(), `chart ${i}`).toBeVisible();
    }
    // line chart has one point per day of salesTrend
    await expect(charts.nth(0).locator(".recharts-xAxis .recharts-cartesian-axis-tick")).toHaveCount(d.salesTrend.length);
    // bar chart: one bar per best seller
    await expect(charts.nth(2).locator(".recharts-bar-rectangle")).toHaveCount(d.bestSellingMedicines.length);

    // Best sellers table
    const best = page.locator(".an-table").filter({ hasText: "Best Sellers Revenue" });
    await expect(best.locator(".dt-count")).toContainText(`of ${d.bestSellingMedicines.length}`);
    const first = d.bestSellingMedicines[0];
    await expect(best.locator("tbody tr").first()).toContainText(first.name);
    await expect(best.locator("tbody tr").first()).toContainText(money(first.revenue));

    // Top customers table
    const top = page.locator(".an-table").filter({ hasText: "Top Customers" });
    await expect(top.locator(".dt-count")).toContainText(`of ${d.topCustomers.length}`);
    if (d.topCustomers.length) {
      await expect(top.locator("tbody tr").first()).toContainText(d.topCustomers[0].name);
      await expect(top.locator("tbody tr").first()).toContainText(money(d.topCustomers[0].totalSpend));
    }

    // Y-axis ticks must be distinct (was "2k, 2k" from rounding)
    const ticks = await charts.nth(0).locator(".recharts-yAxis .recharts-cartesian-axis-tick-value").allTextContents();
    expect(new Set(ticks).size).toBe(ticks.length);
    await shot(page, "analytics");
  });

  test("Refresh reloads data", async ({ page, monitor }) => {
    await openAnalytics(page);
    const w = page.waitForResponse((r) => r.url().includes("/api/analytics/dashboard") && r.status() === 200);
    await page.getByRole("button", { name: "Refresh" }).click();
    await w;
    await expect(page.getByRole("button", { name: "Refresh" })).toBeEnabled();
    await expect(page.locator(".an-kpi")).toHaveCount(5);
  });

  test("load failure shows an error with Retry that recovers", async ({ page, monitor }) => {
    monitor.allow(/http 500 GET \/api\/analytics\/dashboard/);
    monitor.allow(/console: Failed to load resource/);
    let fail = true;
    await page.route("**/api/analytics/dashboard", (r) =>
      fail ? r.fulfill({ status: 500, contentType: "application/json", body: '{"status":500,"message":"QA forced failure"}' }) : r.fallback()
    );
    await page.goto("/analytics");
    const alert = page.getByRole("alert").filter({ hasText: "Could not load analytics" });
    await expect(alert).toBeVisible();
    fail = false;
    await alert.getByRole("button", { name: "Retry" }).click();
    await expect(page.locator(".an-kpi")).toHaveCount(5);
    await expect(alert).toHaveCount(0);

    // a failed refresh keeps the last data and says so
    fail = true;
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Could not refresh analytics" })).toBeVisible();
    await expect(page.locator(".an-kpi")).toHaveCount(5);
  });

  test("no overflow at 390px", async ({ page, monitor }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAnalytics(page);
    await page.waitForLoadState("networkidle");
    expect(await noHorizontalOverflow(page)).toBe(true);
    await shot(page, "analytics-390");
  });
});
