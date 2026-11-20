import fs from "node:fs";
import { test, expect, noHorizontalOverflow, shot } from "./fixtures";

const iso = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

async function seed(api, uid) {
  const sup = await api.post("/api/suppliers", { name: `QA Sup ${uid}`, company: "QA Exp Supply" });
  expect(sup.status, sup.text).toBe(201);
  const prod = await api.post("/api/products", {
    name: `QA Exp Med ${uid}`, company: "QA Exp Co", hsnCode: "30049099", stripSize: 10, price: 55, reorderLevel: 10, targetStockLevel: 100,
  });
  expect(prod.status, prod.text).toBe(201);
  const rcv = await api.post("/api/purchases/receive", {
    supplierId: sup.json.supplierId, invoiceNumber: `QAINV-${uid}`,
    batchItems: [{
      productId: prod.json.productId, batchNumber: `NE${uid}`, mfgDate: daysFromNow(-300), expiryDate: daysFromNow(30),
      mrp: 60, costPrice: 50, sellingPrice: 55, stripQuantity: 5,
    }],
  });
  expect(rcv.status, rcv.text).toBe(201);
  return { supplier: sup.json, product: prod.json };
}

async function batchOf(api, productId) {
  return (await api.get("/api/inventory/stock-list")).json.filter((b) => b.product?.productId === productId);
}

async function openExpiry(page, path = "/expiry-tracking") {
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "Expiry & Batch Tracking" })).toBeVisible();
  await expect(page.locator(".dt")).toBeVisible();
}

const tab = (page, re) => page.locator(".expiry-tabs button").filter({ hasText: re });
const rows = (page) => page.locator("tbody tr");

test.describe("Expiry tracking / alerts", () => {
  test("near-expiry batch is listed; supplier return credits the ledger", async ({ page, monitor, api, uid }) => {
    await page.goto("/dashboard");
    const { supplier, product } = await seed(api, uid);
    const ledgerBefore = Number((await api.get(`/api/suppliers/${supplier.supplierId}`)).json.ledgerBalance);
    expect(ledgerBefore).toBe(250); // 5 strips x Rs50

    await openExpiry(page, "/expiry-alerts");
    await expect(tab(page, /^Near Expiry/)).toHaveClass(/active/);
    await page.getByPlaceholder("Search...").fill(uid);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText(`NE${uid}`);
    await expect(rows(page).first()).toContainText("30 days");
    await expect(rows(page).first()).toContainText("5 packs + 0 loose (50 units)");
    await expect(rows(page).first()).toContainText(`QA Sup ${uid}`);

    // batch-wise stock flags it as near expiry too
    await tab(page, /^Batch-wise Stock/).click();
    await page.getByPlaceholder("Search...").fill(uid);
    await expect(rows(page).first().getByText("Near Expiry")).toBeVisible();
    await expect(rows(page).first()).toContainText("₹250.00");

    // Return via Returns & Write-offs tab
    await tab(page, /^Returns & Write-offs/).click();
    await page.getByPlaceholder("Search...").fill(uid);
    await rows(page).first().getByRole("button", { name: `Return QA Exp Med ${uid} batch NE${uid}` }).click();
    const dlg = page.getByRole("dialog", { name: "Return to supplier" });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole("button", { name: "Process Return" })).toBeDisabled();
    // Cancel closes without change
    await dlg.getByRole("button", { name: "Cancel" }).click();
    await expect(dlg).toBeHidden();
    expect((await batchOf(api, product.productId))[0].totalUnits).toBe(50);

    await rows(page).first().getByRole("button", { name: `Return QA Exp Med ${uid} batch NE${uid}` }).click();
    await dlg.getByLabel("Packs to Return").fill("9");
    await expect(dlg.getByLabel("Packs to Return")).toHaveValue("5"); // clamped to available
    await dlg.getByLabel("Packs to Return").fill("2");
    await dlg.getByRole("button", { name: "Process Return" }).click();
    await expect(page.getByRole("status")).toContainText(`Returned 20 units of QA Exp Med ${uid}`);
    await expect(page.getByRole("status")).toContainText("credit ₹100.00");
    await expect(dlg).toBeHidden();

    const b = (await batchOf(api, product.productId))[0];
    expect(b.totalUnits).toBe(30);
    const ledgerAfter = Number((await api.get(`/api/suppliers/${supplier.supplierId}`)).json.ledgerBalance);
    expect(ledgerAfter).toBe(150);
    await page.getByPlaceholder("Search...").fill(uid);
    await expect(rows(page).first()).toContainText("3 packs + 0 loose (30 units)");
    await shot(page, "expiry-return");
  });

  test("write-off of own near-expiry opening stock (cancel and confirm)", async ({ page, monitor, api, uid }) => {
    await page.goto("/dashboard");
    const prod = await api.post("/api/products", {
      name: `QA Exp WO ${uid}`, hsnCode: "30049099", stripSize: 10, price: 20, openingQuantity: 25, batchNumber: `WO${uid}`,
      mfgDate: daysFromNow(-200), expiryDate: daysFromNow(20), mrp: 25, costPrice: 12,
    });
    expect(prod.status, prod.text).toBe(201);
    await openExpiry(page);
    await tab(page, /^Returns & Write-offs/).click();
    await page.getByPlaceholder("Search...").fill(uid);
    const r = rows(page).first();
    await expect(r).toContainText(`WO${uid}`);
    await expect(r.getByRole("button", { name: /^Return / })).toBeDisabled(); // opening stock has no supplier

    let msg = "";
    page.once("dialog", (d) => { msg = d.message(); d.dismiss(); });
    await r.getByRole("button", { name: `Write off QA Exp WO ${uid} batch WO${uid}` }).click();
    expect(msg).toContain("Write off all 25 units");
    expect(msg).toContain("near expiry");
    expect((await batchOf(api, prod.json.productId))[0].totalUnits).toBe(25);

    page.once("dialog", (d) => d.accept());
    await r.getByRole("button", { name: `Write off QA Exp WO ${uid} batch WO${uid}` }).click();
    await expect(page.getByRole("status")).toContainText(`Wrote off 25 units of QA Exp WO ${uid}`);
    const after = await batchOf(api, prod.json.productId);
    expect(after.reduce((s, x) => s + x.totalUnits, 0)).toBe(0);
    expect((await api.get(`/api/products/${prod.json.productId}`)).json.quantity).toBe(0);
    await page.getByPlaceholder("Search...").fill(uid);
    await expect(page.locator("td.dt-empty")).toBeVisible();
  });

  test("expired tab lists seeded expired batches; write-off confirm can be cancelled (demo data untouched)", async ({ page, monitor, api }) => {
    await openExpiry(page);
    await tab(page, /^Expired Stock/).click();
    let expired = [];
    await expect(async () => {
      await page.getByRole("button", { name: "Refresh" }).click();
      await expect(page.getByRole("button", { name: "Refresh" })).toBeEnabled();
      expired = (await api.get("/api/inventory/expired")).json;
      await expect(tab(page, /^Expired Stock/)).toHaveText(`Expired Stock (${expired.length})`, { timeout: 1000 });
    }).toPass({ timeout: 60_000 });
    await tab(page, /^Expired Stock/).click();
    test.skip(expired.length === 0, "no expired demo batches");
    const withStock = expired.find((b) => b.totalUnits > 0);
    const first = rows(page).first();
    await expect(first.getByText("Expired", { exact: true })).toBeVisible();
    await expect(first).toContainText(/Expired \(\d+d ago\)/);
    if (withStock) {
      await page.getByPlaceholder("Search...").fill(withStock.batchNumber);
      const r = rows(page).filter({ hasText: withStock.batchNumber }).first();
      const btn = r.getByRole("button", { name: /^Write off / });
      await expect(btn).toBeEnabled();
      let msg = "";
      page.once("dialog", (d) => { msg = d.message(); d.dismiss(); });
      await btn.click();
      expect(msg).toContain("as expired");
      const again = (await api.get("/api/inventory/expired")).json.find((b) => b.batchId === withStock.batchId);
      expect(again.totalUnits).toBe(withStock.totalUnits);
    }
    await shot(page, "expiry-expired");
  });

  test("/stock-alerts opens low-stock tab with threshold text and own low product", async ({ page, monitor, api, uid }) => {
    await page.goto("/dashboard");
    const prod = await api.post("/api/products", {
      name: `QA Exp Low ${uid}`, hsnCode: "30049099", stripSize: 10, price: 20, targetStockLevel: 100, reorderLevel: 5,
      openingQuantity: 20, mfgDate: daysFromNow(-20), expiryDate: daysFromNow(600), mrp: 25, costPrice: 12,
    });
    expect(prod.status).toBe(201);
    await openExpiry(page, "/stock-alerts");
    await expect(tab(page, /^Low Stock Alerts/)).toHaveClass(/active/);
    await expect(page.getByText("at or below 30% of their target stock level")).toBeVisible();
    await expect(async () => {
      await page.getByRole("button", { name: "Refresh" }).click();
      await expect(page.getByRole("button", { name: "Refresh" })).toBeEnabled();
      const alerts = (await api.get("/api/analytics/stock-alerts?threshold=30")).json;
      await expect(tab(page, /^Low Stock Alerts/)).toHaveText(`Low Stock Alerts (${alerts.length})`, { timeout: 1000 });
    }).toPass({ timeout: 60_000 });
    await page.getByPlaceholder("Search...").fill(uid);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("20 units");
    await expect(rows(page).first()).toContainText("Low Stock");
    await expect(rows(page).first()).toContainText("100");
  });

  test("pending purchases tab and PDF export", async ({ page, monitor, api, uid }) => {
    await page.goto("/dashboard");
    const sup = await api.post("/api/suppliers", { name: `QA Sup PO ${uid}` });
    const po = await api.post("/api/purchases/order", { supplierId: sup.json.supplierId, invoiceNumber: `QAPO-${uid}`, totalAmount: 999 });
    expect(po.status, po.text).toBe(201);
    await openExpiry(page);
    await tab(page, /^Pending Purchases/).click();
    await page.getByPlaceholder("Search...").fill(uid);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText(`QAPO-${uid}`);
    await expect(rows(page).first()).toContainText("Pending");
    await expect(rows(page).first()).toContainText("₹999.00");

    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export Expiry Report (PDF)" }).click(),
    ]);
    const path = await dl.path();
    const head = fs.readFileSync(path).subarray(0, 4).toString();
    expect(head).toBe("%PDF");
    expect(dl.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  for (const [w, h] of [[1920, 1080], [1366, 768], [768, 1024], [390, 844]]) {
    test(`responsive ${w}x${h}`, async ({ page, monitor }) => {
      await page.setViewportSize({ width: w, height: h });
      await openExpiry(page);
      expect(await noHorizontalOverflow(page)).toBe(true);
      await tab(page, /^Returns & Write-offs/).click();
      expect(await noHorizontalOverflow(page)).toBe(true);
      await shot(page, `expiry-${w}x${h}`);
    });
  }
});
