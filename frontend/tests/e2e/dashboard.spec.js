import { test, expect, noHorizontalOverflow, shot } from "./fixtures";

// Same formatting the pages use
const money = (v) =>
  `₹${(Number(v) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Own product + supplier + received batch + a 20-tablet bill (pack ₹112, 10/pack, 12% GST => ₹224.00). */
async function createSale(api, uid) {
  const prod = await api.post("/api/products", {
    name: `QA Medicine ${uid}`,
    genericName: `QA Generic ${uid}`,
    company: `QA Co ${uid}`,
    hsnCode: "3004",
    stripSize: 10,
    price: 112,
    gstRate: 12,
    reorderLevel: 1,
    targetStockLevel: 10,
  });
  expect(prod.status, prod.text).toBeLessThan(300);
  const sup = await api.post("/api/suppliers", { name: `QA Supplier ${uid}`, contactNumber: "9876543210", company: `QA Co ${uid}` });
  expect(sup.status, sup.text).toBeLessThan(300);
  const yesterday = new Date(Date.now() - 86400000);
  const nextYear = new Date(Date.now() + 400 * 86400000);
  const rec = await api.post("/api/purchases/receive", {
    supplierId: sup.json.supplierId,
    invoiceNumber: `QA-PI-${uid}`,
    batchItems: [
      {
        productId: prod.json.productId,
        batchNumber: `B${uid}`,
        mfgDate: ymd(yesterday),
        expiryDate: ymd(nextYear),
        mrp: 112,
        costPrice: 80,
        sellingPrice: 112,
        stripQuantity: 5,
      },
    ],
  });
  expect(rec.status, rec.text).toBeLessThan(300);
  const bill = await api.post("/api/sales/bill", {
    customerName: `QA Cust ${uid}`,
    paymentMethod: "CASH",
    lineItems: [{ productId: prod.json.productId, quantitySoldTablets: 20 }],
  });
  expect(bill.status, bill.text).toBeLessThan(300);
  expect(Number(bill.json.grandTotal)).toBeCloseTo(224, 2);
  expect(Number(bill.json.totalTaxableAmount)).toBeCloseTo(200, 2);
  return { product: prod.json, supplier: sup.json, invoice: bill.json };
}

/** Loads /dashboard and returns the exact analytics + invoices payloads the page rendered. */
async function openDashboard(page) {
  const dashP = page.waitForResponse((r) => r.url().includes("/api/analytics/dashboard") && r.status() === 200);
  const invP = page.waitForResponse((r) => r.url().includes("/api/sales/invoices") && r.status() === 200);
  await page.goto("/dashboard");
  const dash = await (await dashP).json();
  const invoices = await (await invP).json();
  await expect(page.locator('[data-testid="kpi-card"]').first()).toBeVisible();
  return { dash, invoices };
}

function kpi(page, title) {
  return page.locator('[data-testid="kpi-card"]').filter({ hasText: title });
}

// StatCards count up; the final value is in the screen-reader text (.mb-sr-only) of .mb-stat__value
const kpiValue = (page, title) => kpi(page, title).locator(".mb-stat__value .mb-sr-only");
const snap = (page, id) => page.getByTestId(id);

async function expectKpis(page, dash) {
  await expect(kpiValue(page, "Today's Revenue")).toHaveText(money(dash.todayRevenue));
  await expect(kpiValue(page, "Low Stock")).toHaveText(String(dash.lowStockCount));
  await expect(kpiValue(page, "Near Expiry")).toHaveText(String(dash.nearExpiryCount));
  await expect(snap(page, "dash-monthly-profit").locator(".kpi-value")).toHaveText(money(dash.monthlyProfit));
  await expect(snap(page, "dash-monthly-profit")).toContainText(`Revenue ${money(dash.monthlyRevenue)}`);
  await expect(snap(page, "dash-stock-value").locator(".kpi-value")).toHaveText(money(dash.totalStockValueMrp));
  await expect(snap(page, "dash-stock-value")).toContainText(`At cost: ${money(dash.totalStockValueCost)}`);
}

function recentSalesRows(page) {
  return page.locator(".table-card").filter({ hasText: "Recent Transactions" }).locator("tbody tr");
}

test.describe("Dashboard", () => {
  test("KPI cards and recent sales equal the backend", async ({ page, monitor, api }) => {
    const { dash, invoices } = await openDashboard(page);
    await expectKpis(page, dash);

    // the page payload is the real backend answer
    const fresh = await api.get("/api/analytics/dashboard");
    expect(fresh.status).toBe(200);
    for (const k of ["lowStockCount", "nearExpiryCount", "totalStockValueMrp", "totalStockValueCost"]) {
      expect(typeof fresh.json[k], k).not.toBe("undefined");
    }

    const rows = recentSalesRows(page);
    const expected = invoices.slice(0, 6);
    await expect(rows).toHaveCount(Math.max(1, expected.length));
    for (let i = 0; i < expected.length; i++) {
      await expect(rows.nth(i).locator("td").nth(0)).toHaveText(expected[i].invoiceNumber);
      await expect(rows.nth(i).locator("td").nth(1)).toHaveText(expected[i].customerName || "Walk-in");
      await expect(rows.nth(i).locator("td").nth(2)).toHaveText(money(expected[i].grandTotal));
      await expect(rows.nth(i).locator("td").nth(4)).toHaveText(new RegExp("^" + expected[i].paymentStatus + "$", "i"));
    }
    await shot(page, "dashboard-kpis");
  });

  test("a new bill raises today's revenue and appears in Recent Sales after reload", async ({ page, monitor, api, uid }) => {
    const before = await openDashboard(page);
    const { invoice } = await createSale(api, uid);

    const after = await openDashboard(page);
    expect(Number(after.dash.todayRevenue)).toBeGreaterThanOrEqual(Number(before.dash.todayRevenue) + 224 - 0.01);
    await expectKpis(page, after.dash);
    // newest first: our invoice is in the list the page received and shown in the table
    const idx = after.invoices.slice(0, 6).findIndex((i) => i.invoiceId === invoice.invoiceId);
    expect(idx, "new invoice among the 6 newest").toBeGreaterThanOrEqual(0);
    const row = recentSalesRows(page).nth(idx);
    await expect(row).toContainText(invoice.invoiceNumber);
    await expect(row).toContainText(`QA Cust ${uid}`);
    await expect(row).toContainText("₹224.00");
    await expect(row.locator("td").nth(4)).toHaveText(/^paid$/i);
  });

  test("medicine search filters, Clear resets", async ({ page, monitor, api, uid }) => {
    await createSale(api, uid);
    await page.goto("/dashboard");
    const search = page.getByLabel("Search medicines on dashboard");
    await expect(page.getByText(/Showing all \d+ medicines/)).toBeVisible();
    const all = Number((await page.getByText(/Showing all \d+ medicines/).textContent()).match(/\d+/)[0]);

    await search.fill(`QA Medicine ${uid}`);
    await expect(page.getByText(`Found 1 medicines for "QA Medicine ${uid}"`)).toBeVisible();
    const table = page.locator(".dash-search-card .dt-table tbody");
    await expect(table.locator("tr")).toHaveCount(1);
    await expect(table.locator("tr").first()).toContainText(`QA Medicine ${uid}`);
    // 50 received - 20 sold = 30 units on hand, ₹112 per pack
    await expect(table.locator("tr").first()).toContainText("30");
    await expect(table.locator("tr").first()).toContainText("₹112.00");

    await search.fill(`zz-no-such-medicine-${uid}`);
    await expect(page.getByText(/No medicines match that keyword/)).toBeVisible();

    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(search).toHaveValue("");
    await expect(page.getByText(new RegExp(`Showing all \\d+ medicines`))).toBeVisible();
    const allAgain = Number((await page.getByText(/Showing all \d+ medicines/).textContent()).match(/\d+/)[0]);
    expect(allAgain).toBeGreaterThanOrEqual(all);
  });

  test("header and quick action buttons navigate", async ({ page, monitor }) => {
    const cases = [
      [page.locator(".dash-header-actions").getByRole("button", { name: "Add Medicine" }), /\/add-medicine$/],
      [page.locator(".dash-header-actions").getByRole("button", { name: "New Bill" }), /\/sales$/],
      [page.locator(".dash-header-actions").getByRole("button", { name: "Alerts" }), /\/expiry-alerts$/],
      [page.getByRole("button", { name: /Create New Bill/ }), /\/sales$/],
      [page.locator(".quick-grid").getByRole("button", { name: /Add Medicine/ }), /\/add-medicine$/],
      [page.getByRole("button", { name: /Add Supplier/ }), /\/suppliers$/],
      [page.locator(".quick-grid").getByRole("button", { name: /View Reports/ }), /\/reports$/],
      [page.getByRole("button", { name: "View Reports" }).first(), /\/reports$/],
      [page.getByRole("button", { name: "Open Billing" }), /\/sales$/],
    ];
    for (const [btn, url] of cases) {
      await page.goto("/dashboard");
      await btn.click();
      await expect(page).toHaveURL(url);
      await expect(page.locator(".app-shell-content")).not.toBeEmpty();
    }
  });

  test("only one alerts bell (navbar) and it lists the backend alert counts", async ({ page, monitor, api }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: /stock and expiry alerts/i })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Dashboard notifications" })).toHaveCount(0);

    const alerts = (await api.get("/api/notifications/alerts?stockThreshold=30")).json;
    const total = alerts.lowStock.length + alerts.nearExpiry.length + alerts.expired.length;
    const bell = page.getByRole("button", { name: /stock and expiry alerts/i });
    if (total > 0) {
      await expect(bell).toHaveAccessibleName(new RegExp(`^\\d+ stock and expiry alerts$`));
      await expect(bell.locator(".notification-badge")).toHaveText(total > 99 ? "99+" : String(total));
    }
    await bell.click();
    const panel = page.getByRole("region", { name: "Alerts" });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("button", { name: /Low stock medicines/ })).toBeVisible();
    await expect(panel.getByRole("button", { name: /Batches expiring within 3 months/ })).toBeVisible();
    await expect(panel.getByRole("button", { name: /Expired batches/ })).toBeVisible();
    await shot(page, "shell-alerts-panel");
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();

    await bell.click();
    await panel.getByRole("button", { name: /Low stock medicines/ }).click();
    await expect(page).toHaveURL(/\/stock-alerts$/);
    await expect(panel).toBeHidden();

    await bell.click();
    await page.getByRole("region", { name: "Alerts" }).getByRole("button", { name: /Batches expiring/ }).click();
    await expect(page).toHaveURL(/\/expiry-alerts$/);
  });

  test("390px phone: header buttons and tables are not clipped", async ({ page, monitor }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await expect(page.locator('[data-testid="kpi-card"]').first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(await noHorizontalOverflow(page)).toBe(true);
    const bad = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll(".dash button, .dash h3, .dash .card")) {
        const r = el.getBoundingClientRect();
        if (r.width && r.right > window.innerWidth + 1) out.push(`${el.tagName} "${el.textContent.trim().slice(0, 30)}" right=${r.right}`);
      }
      // wide tables must scroll inside their own wrapper
      for (const w of document.querySelectorAll(".dash .table-wrap, .dash .dt-table-wrap")) {
        const cs = getComputedStyle(w);
        if (!/(auto|scroll)/.test(cs.overflowX)) out.push(`wrapper not scrollable: ${w.className}`);
        if (w.getBoundingClientRect().right > window.innerWidth + 1) out.push(`wrapper clipped: ${w.className}`);
      }
      return out;
    });
    expect(bad).toEqual([]);
    for (const name of ["View Reports", "Open Billing"]) {
      await expect(page.getByRole("button", { name, exact: true })).toBeInViewport({ ratio: 1 }).catch(async () => {
        await page.getByRole("button", { name, exact: true }).scrollIntoViewIfNeeded();
        await expect(page.getByRole("button", { name, exact: true })).toBeInViewport({ ratio: 1 });
      });
    }
    await shot(page, "dashboard-390");
  });
});
