import { test, expect, noHorizontalOverflow, shot, openViaSidebar } from "./fixtures";

const iso = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

async function createProduct(api, body) {
  const r = await api.post("/api/products", { hsnCode: "30049099", stripSize: 10, price: 50, company: "QA Inv Co", ...body });
  expect(r.status, r.text).toBe(201);
  return r.json;
}

const tabBtn = (page, re) => page.locator(".inv-tabs button").filter({ hasText: re });

async function openInventory(page) {
  await page.goto("/inventory");
  await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
  await expect(page.locator(".dt")).toBeVisible();
}

test.describe("Inventory", () => {
  test("tabs show own products correctly and counts match stock-summary", async ({ page, monitor, api, uid }) => {
    await page.goto("/dashboard");
    const okP = await createProduct(api, {
      name: `QA Inv OK ${uid}`, reorderLevel: 10, openingQuantity: 200, batchNumber: `OK${uid}`,
      mfgDate: daysFromNow(-30), expiryDate: daysFromNow(500), mrp: 60, costPrice: 30,
    });
    const lowP = await createProduct(api, {
      name: `QA Inv Low ${uid}`, reorderLevel: 50, openingQuantity: 20, batchNumber: `LOW${uid}`,
      mfgDate: daysFromNow(-400), expiryDate: daysFromNow(30), mrp: 60, costPrice: 30,
    });
    const outP = await createProduct(api, { name: `QA Inv Out ${uid}`, reorderLevel: 10 });

    await openViaSidebar(page, "Inventory");
    await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
    const summary = (await api.get("/api/inventory/stock-summary")).json;
    const st = (id) => summary.find((s) => s.productId === id);
    expect(st(okP.productId)).toMatchObject({ status: "in_stock", saleableUnits: 200 });
    expect(st(lowP.productId)).toMatchObject({ status: "low_stock", saleableUnits: 20 });
    expect(st(outP.productId)).toMatchObject({ status: "out_of_stock", saleableUnits: 0 });
    // Other QA agents write concurrently: refresh and re-read the API until both agree.
    const refresh = async () => {
      await page.locator(".inv-tabs").getByRole("button", { name: "Refresh" }).click();
      await expect(page.locator(".inv-tabs").getByRole("button", { name: "Refresh" })).toBeEnabled();
    };
    await expect(async () => {
      await refresh();
      const sum = (await api.get("/api/inventory/stock-summary")).json;
      const all = (await api.get("/api/inventory/stock-list")).json;
      await expect(tabBtn(page, /^Low Stock/)).toHaveText(`Low Stock (${sum.filter((s) => s.status === "low_stock").length})`, { timeout: 1000 });
      await expect(tabBtn(page, /^Out of Stock/)).toHaveText(`Out of Stock (${sum.filter((s) => s.status === "out_of_stock").length})`, { timeout: 1000 });
      await expect(page.locator(".dt-subtitle")).toHaveText(`${all.length} batch record(s)`, { timeout: 1000 });
    }).toPass({ timeout: 60_000 });

    const search = page.getByPlaceholder("Search...");
    const rows = page.locator("tbody tr");

    // All batches
    await search.fill(uid);
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: `OK${uid}` })).toContainText("200");
    await expect(rows.filter({ hasText: `OK${uid}` })).toContainText("20 packs + 0 loose");
    await expect(rows.filter({ hasText: `OK${uid}` })).toContainText("Opening stock");
    await expect(rows.filter({ hasText: `LOW${uid}` }).getByText("Near Expiry")).toBeVisible();

    // Low stock tab
    await tabBtn(page, /^Low Stock/).click();
    await expect(page.locator(".dt-title")).toHaveText("Low Stock Medicines");
    await page.getByPlaceholder("Search...").fill(uid);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(`QA Inv Low ${uid}`);
    await expect(rows.first()).toContainText("Low Stock");
    await expect(rows.first()).toContainText("50");

    // Out of stock tab
    await tabBtn(page, /^Out of Stock/).click();
    await page.getByPlaceholder("Search...").fill(uid);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(`QA Inv Out ${uid}`);

    // Near expiry tab
    await tabBtn(page, /^Near Expiry/).click();
    await expect(async () => {
      await refresh();
      const near = (await api.get("/api/inventory/near-expiry")).json;
      await expect(page.locator(".dt-subtitle")).toHaveText(near.length ? `${near.length} batch record(s)` : "No batches to show.", { timeout: 1000 });
    }).toPass({ timeout: 60_000 });
    await page.getByPlaceholder("Search...").fill(uid);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(`LOW${uid}`);

    // Expired tab: count matches api; our products are not there
    await tabBtn(page, /^Expired/).click();
    let expired = [];
    await expect(async () => {
      await refresh();
      expired = (await api.get("/api/inventory/expired")).json;
      await expect(page.locator(".dt-subtitle")).toHaveText(expired.length ? `${expired.length} batch record(s)` : "No batches to show.", { timeout: 1000 });
    }).toPass({ timeout: 60_000 });
    if (expired.length) await expect(rows.first().getByText("Expired", { exact: true })).toBeVisible();
    await page.getByPlaceholder("Search...").fill(uid);
    await expect(page.locator("td.dt-empty")).toBeVisible();

    // Aging: oldest mfg first
    await tabBtn(page, /^Stock Aging/).click();
    await expect(page.locator(".dt-title")).toHaveText("Stock Aging (oldest first)");
    await page.getByPlaceholder("Search...").fill(uid);
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText(`LOW${uid}`);
    await expect(rows.nth(1)).toContainText(`OK${uid}`);
    await shot(page, "inventory-aging");
  });

  test("Refresh button reloads new stock", async ({ page, monitor, api, uid }) => {
    await openInventory(page);
    await page.getByPlaceholder("Search...").fill(uid);
    await expect(page.locator("td.dt-empty")).toBeVisible();
    await createProduct(api, {
      name: `QA Inv Fresh ${uid}`, openingQuantity: 30, batchNumber: `FR${uid}`,
      mfgDate: daysFromNow(-10), expiryDate: daysFromNow(700), mrp: 60, costPrice: 30,
    });
    await page.locator(".inv-tabs").getByRole("button", { name: "Refresh" }).click();
    await expect(page.locator(".inv-tabs").getByRole("button", { name: "Refresh" })).toBeEnabled();
    await page.getByPlaceholder("Search...").fill(uid);
    await expect(page.locator("tbody tr").filter({ hasText: `FR${uid}` })).toHaveCount(1);
  });

  for (const [w, h] of [[1920, 1080], [1366, 768], [768, 1024], [390, 844]]) {
    test(`responsive ${w}x${h}`, async ({ page, monitor }) => {
      await page.setViewportSize({ width: w, height: h });
      await openInventory(page);
      expect(await noHorizontalOverflow(page)).toBe(true);
      for (const re of [/^Low Stock/, /^Stock Aging/]) {
        await tabBtn(page, re).click();
        expect(await noHorizontalOverflow(page)).toBe(true);
      }
      await shot(page, `inventory-${w}x${h}`);
    });
  }
});
