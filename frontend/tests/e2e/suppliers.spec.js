import { test, expect, openViaSidebar, noHorizontalOverflow, shot } from "./fixtures";

const isoDate = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const CONSOLE_409 = /console: Failed to load resource: the server responded with a status of 409/;

async function createSupplierViaApi(api, uid, extra = {}) {
  const r = await api.post("/api/suppliers", { name: `QA Supplier ${uid}`, company: "QA Distributors", ...extra });
  expect(r.status, r.text).toBe(201);
  return r.json;
}

/** Receives 10 strips at cost Rs80 (=> Rs800 owed) for the supplier, via api. */
async function receivePurchase(api, supplierId, uid) {
  const prod = await api.post("/api/products", { name: `QA Medicine ${uid}`, hsnCode: "3004", stripSize: 10, price: 112, gstRate: 12 });
  expect([200, 201], prod.text).toContain(prod.status);
  const rec = await api.post("/api/purchases/receive", {
    supplierId,
    invoiceNumber: `QA-PI-${uid}`,
    batchItems: [{
      productId: prod.json.productId, batchNumber: `B${uid}`, mfgDate: isoDate(-30), expiryDate: isoDate(400),
      mrp: 112, costPrice: 80, sellingPrice: 110, stripQuantity: 10,
    }],
  });
  expect([200, 201], rec.text).toContain(rec.status);
  return prod.json;
}

async function openSupplierInUi(page, name) {
  await page.getByLabel("Search suppliers").fill(name);
  const row = page.locator(".dt-table tbody tr").filter({ hasText: name });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "View" }).click();
  await expect(page.locator(".sup-detail-title")).toHaveText(name);
}

test.describe("Suppliers", () => {
  test("create with valid GSTIN, listed, search keeps focus, edit (cancel + save)", async ({ page, api, uid, monitor }) => {
    await page.goto("/dashboard");
    await openViaSidebar(page, "Suppliers");
    await expect(page).toHaveURL(/\/suppliers$/);
    const name = `QA Supplier ${uid}`;

    await page.getByLabel("New supplier name").fill(name);
    await page.getByLabel("New supplier contact").fill("9123456780");
    await page.getByLabel("New supplier company").fill("QA Distributors");
    await page.getByLabel("New supplier GSTIN").fill("27abcde1234f1z5");
    await page.getByRole("button", { name: "Add Supplier" }).click();
    await expect(page.getByText(`Supplier "${name}" added.`)).toBeVisible();
    await expect(page.getByLabel("New supplier name")).toHaveValue("");

    const found = (await api.get(`/api/suppliers?search=${encodeURIComponent(name)}`)).json;
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ name, contactNumber: "9123456780", company: "QA Distributors", gstIn: "27ABCDE1234F1Z5" });
    expect(Number(found[0].ledgerBalance || 0)).toBe(0);

    const search = page.getByLabel("Search suppliers");
    await search.click();
    await search.pressSequentially(name, { delay: 30 });
    await expect(search).toBeFocused();
    const row = page.locator(".dt-table tbody tr").filter({ hasText: name });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("GSTIN 27ABCDE1234F1Z5");
    await expect(row).toContainText("Settled");
    await expect(search).toBeFocused();

    await row.getByRole("button", { name: "View" }).click();
    await expect(page.locator(".sup-detail-title")).toHaveText(name);
    await expect(page.locator(".sup-detail")).toContainText("No purchase history found for this supplier.");

    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Edit supplier company").fill("Cancelled Co");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator(".sup-detail")).toContainText("QA Distributors");

    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Edit supplier company").fill("QA Edited Co");
    await page.getByLabel("Edit supplier contact").fill("9000000001");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Supplier details updated.")).toBeVisible();
    await expect(page.locator(".sup-detail")).toContainText("QA Edited Co");
    const after = (await api.get(`/api/suppliers/${found[0].supplierId}`)).json;
    expect(after).toMatchObject({ name, company: "QA Edited Co", contactNumber: "9000000001", gstIn: "27ABCDE1234F1Z5" });

    // edit with an invalid GSTIN is rejected client-side
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Edit supplier GSTIN").fill("27ABCDE1234F0Z5");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/GSTIN format looks wrong/)).toBeVisible();
    expect((await api.get(`/api/suppliers/${found[0].supplierId}`)).json.gstIn).toBe("27ABCDE1234F1Z5");
    await shot(page, "suppliers-edit");
  });

  test("validation: empty name, invalid GSTIN, duplicate name", async ({ page, api, uid, monitor }) => {
    await page.goto("/suppliers");
    await page.waitForLoadState("networkidle");
    const add = page.getByRole("button", { name: "Add Supplier" });

    await add.click();
    await expect(page.getByText("Supplier name is required.")).toBeVisible();

    const name = `QA Supplier ${uid}`;
    await page.getByLabel("New supplier name").fill(name);
    for (const bad of ["12345", "27ABCDE1234F1X5", "27ABCDE1234F0Z5"]) {
      await page.getByLabel("New supplier GSTIN").fill(bad);
      await add.click();
      await expect(page.getByText(/GSTIN format looks wrong/)).toBeVisible();
    }
    expect((await api.get(`/api/suppliers?search=${encodeURIComponent(name)}`)).json).toHaveLength(0);

    // duplicate (case-insensitive) name -> server conflict shown
    await createSupplierViaApi(api, uid);
    monitor.allow(/http 409 POST \/api\/suppliers/);
    monitor.allow(CONSOLE_409);
    await page.getByLabel("New supplier GSTIN").fill("");
    await page.getByLabel("New supplier name").fill(name.toLowerCase());
    await add.click();
    await expect(page.getByText(/already exists/)).toBeVisible();
    expect((await api.get(`/api/suppliers?search=${encodeURIComponent(name)}`)).json).toHaveLength(1);
    await shot(page, "suppliers-validation");
  });

  test("history after receiving a purchase, we-owe balance, payments", async ({ page, api, uid, monitor }) => {
    await page.goto("/suppliers");
    const s = await createSupplierViaApi(api, uid);
    const product = await receivePurchase(api, s.supplierId, uid);
    expect(Number((await api.get(`/api/suppliers/${s.supplierId}`)).json.ledgerBalance)).toBeCloseTo(800, 2);

    await page.reload();
    await openSupplierInUi(page, s.name);
    const detail = page.locator(".sup-detail");
    await expect(page.locator(".dt-table tbody tr").filter({ hasText: s.name })).toContainText("We owe ₹800.00");
    await expect(detail.locator(".sup-detail-head")).toContainText("We owe ₹800.00");

    const inv = detail.locator(".sup-ledger .sup-ledger-row").filter({ hasText: `QA-PI-${uid}` });
    await expect(inv).toContainText("Received"); // StatusBadge label for RECEIVED
    await expect(inv).toContainText("₹800.00");
    await expect(inv).toContainText("1 batch");
    const item = detail.locator(".sup-supplies .sup-ledger-row").filter({ hasText: product.name });
    await expect(item).toContainText(`Batch B${uid}`);
    await expect(item).toContainText("10 strips received");
    const exp = new Date(new Date().setDate(new Date().getDate() + 400)).toLocaleDateString("en-IN");
    await expect(item).toContainText(`Exp ${exp}`);
    await expect(item).toContainText("Cost ₹80.00");
    await expect(item).toContainText("MRP ₹112.00");

    const amount = page.getByLabel("Supplier payment amount");
    const pay = page.getByRole("button", { name: "Add Payment" });
    for (const bad of ["0", "-50", ""]) {
      await amount.fill(bad);
      await pay.click();
      await expect(page.getByText("Enter a payment amount greater than 0.")).toBeVisible();
    }
    expect(Number((await api.get(`/api/suppliers/${s.supplierId}`)).json.ledgerBalance)).toBeCloseTo(800, 2);

    await amount.fill("300");
    await pay.click();
    await expect(page.getByText("Payment of ₹300.00 recorded. Balance now: We owe ₹500.00.")).toBeVisible();
    await expect(detail.locator(".sup-detail-head")).toContainText("We owe ₹500.00");
    await expect(amount).toHaveValue("");
    expect(Number((await api.get(`/api/suppliers/${s.supplierId}`)).json.ledgerBalance)).toBeCloseTo(500, 2);

    await amount.fill("500");
    await pay.click();
    await expect(detail.locator(".sup-detail-head")).toContainText("Settled");
    expect(Number((await api.get(`/api/suppliers/${s.supplierId}`)).json.ledgerBalance)).toBe(0);

    // detail stays open when the search no longer lists it
    await page.getByLabel("Search suppliers").fill(`zz-no-such-${uid}`);
    await expect(page.getByText("No suppliers match your search.")).toBeVisible();
    await expect(page.locator(".sup-detail-title")).toHaveText(s.name);
    await shot(page, "suppliers-history");
  });

  for (const [w, h] of [[1920, 1080], [1366, 768], [768, 1024], [390, 844]]) {
    test(`responsive ${w}x${h}`, async ({ page, api, uid, monitor }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/suppliers");
      const s = await createSupplierViaApi(api, uid, { gstIn: "27ABCDE1234F1Z5", contactNumber: "9123456780" });
      await receivePurchase(api, s.supplierId, uid);
      await page.reload();
      await page.waitForLoadState("networkidle");
      expect(await noHorizontalOverflow(page)).toBe(true);
      await openSupplierInUi(page, s.name);
      expect(await noHorizontalOverflow(page)).toBe(true);
      const clipped = await page.evaluate(() => [...document.querySelectorAll(".sup-list > *, .sup-detail, .sup-ledger-row")]
        .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).map((el) => el.className));
      expect(clipped).toEqual([]);
      for (const name of ["Edit", "Add Payment", "Add Supplier"]) {
        const b = await page.getByRole("button", { name, exact: true }).boundingBox();
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(w + 1);
      }
      await shot(page, `suppliers-${w}x${h}`);
    });
  }
});
