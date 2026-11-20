import { test, expect, noHorizontalOverflow, shot, openViaSidebar } from "./fixtures";

const iso = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

async function seed(api, uid) {
  const sup = await api.post("/api/suppliers", { name: `QA Sup Pur ${uid}` });
  expect(sup.status, sup.text).toBe(201);
  const prod = await api.post("/api/products", { name: `QA Pur Med ${uid}`, company: "QA Pur Co", hsnCode: "30049099", stripSize: 10, price: 40 });
  expect(prod.status, prod.text).toBe(201);
  return { supplier: sup.json, product: prod.json };
}

async function openPurchases(page) {
  await page.goto("/purchases");
  await expect(page.getByRole("heading", { name: "Purchases" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Pending PO" })).toBeVisible();
}

async function fillLine(page, n, { productId, batch, mfg = daysFromNow(-30), exp = daysFromNow(500), strips = "3", cost = "30", mrp = "50", sell = "45" }) {
  const L = (f) => page.getByLabel(`Line ${n} ${f}`, { exact: true });
  if (productId != null) await L("product").selectOption(String(productId));
  if (batch != null) await L("batch no.").fill(batch);
  await L("strips").fill(strips);
  await L("mfg date").fill(mfg);
  await L("expiry date").fill(exp);
  await L("cost / pack").fill(cost);
  await L("mrp / pack").fill(mrp);
  await L("selling / pack").fill(sell);
}

const ledger = async (api, id) => Number((await api.get(`/api/suppliers/${id}`)).json.ledgerBalance);
const units = async (api, pid) => (await api.get(`/api/products/${pid}`)).json.quantity;

test.describe("Purchases", () => {
  test("create PO -> receive against it with 2 batch lines -> RECEIVED, stock & ledger up; cannot receive twice", async ({ page, monitor, api, uid }) => {
    await page.goto("/dashboard");
    const { supplier, product } = await seed(api, uid);
    await openViaSidebar(page, "Purchases");
    await expect(page.getByRole("button", { name: "Create Pending PO" })).toBeVisible();

    // Create PO
    await page.getByLabel("PO supplier").selectOption(String(supplier.supplierId));
    await page.getByLabel("PO reference").fill(`QAPO-${uid}`);
    await page.getByLabel("PO expected amount").fill("500");
    await page.getByRole("button", { name: "Create Pending PO" }).click();
    await expect(page.getByRole("status").filter({ hasText: `Purchase order QAPO-${uid} created (PENDING).` })).toBeVisible();
    await page.getByPlaceholder("Search...").fill(uid);
    const row = page.locator("tbody tr").filter({ hasText: `QAPO-${uid}` });
    await expect(row).toContainText("PENDING");
    await expect(row).toContainText("₹500.00");
    const pend = (await api.get("/api/purchases/pending")).json.find((p) => p.invoiceNumber === `QAPO-${uid}`);
    expect(pend).toMatchObject({ status: "PENDING", supplierId: supplier.supplierId });

    // Receive against PO
    const ledger0 = await ledger(api, supplier.supplierId);
    await page.getByLabel("Receive against pending order").selectOption(String(pend.invoiceId));
    await expect(page.getByLabel("Receipt supplier", { exact: true })).toHaveValue(String(supplier.supplierId));
    await expect(page.getByLabel("Receipt supplier", { exact: true })).toBeDisabled();
    await fillLine(page, 1, { productId: product.productId, batch: `PA${uid}`, strips: "3", cost: "30" });
    await page.getByRole("button", { name: "Add batch line" }).click();
    await fillLine(page, 2, { productId: product.productId, batch: `PB${uid}`, strips: "2", cost: "35", exp: daysFromNow(700) });
    await page.getByRole("button", { name: "Add batch line" }).click();
    await expect(page.getByLabel("Line 3 product", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Remove batch line 3" }).click();
    await expect(page.getByLabel("Line 3 product", { exact: true })).toHaveCount(0);
    await expect(page.locator(".pur-total strong")).toHaveText("₹160.00");
    await page.getByRole("button", { name: `Receive QAPO-${uid}` }).click();
    await expect(page.getByRole("status").filter({ hasText: `Stock received against QAPO-${uid}: 2 batches added to inventory.` })).toBeVisible();
    await page.getByPlaceholder("Search...").fill(uid);
    await expect(row).toContainText("RECEIVED");
    await expect(row).toContainText("2");

    const all = (await api.get("/api/purchases")).json.find((p) => p.invoiceId === pend.invoiceId);
    expect(all).toMatchObject({ status: "RECEIVED", batchCount: 2 });
    expect(await units(api, product.productId)).toBe(50);
    const total = Number(all.totalAmount);
    expect(await ledger(api, supplier.supplierId)).toBeCloseTo(ledger0 + total, 2);
    expect(total).toBeGreaterThan(0);
    const batches = (await api.get("/api/inventory/stock-list")).json.filter((b) => b.product?.productId === product.productId);
    expect(batches.map((b) => b.batchNumber).sort()).toEqual([`PA${uid}`, `PB${uid}`]);

    // PO no longer offered for receiving; server also rejects a second receive
    await expect(page.getByLabel("Receive against pending order").locator(`option[value="${pend.invoiceId}"]`)).toHaveCount(0);
    const again = await api.post("/api/purchases/receive", {
      supplierId: supplier.supplierId, purchaseInvoiceId: pend.invoiceId,
      batchItems: [{ productId: product.productId, batchNumber: `PC${uid}`, mfgDate: daysFromNow(-1), expiryDate: daysFromNow(300), mrp: 50, costPrice: 30, sellingPrice: 45, stripQuantity: 1 }],
    });
    expect(again.status).toBe(409);
    expect(await units(api, product.productId)).toBe(50);

    // refresh persists
    await page.reload();
    await expect(page.getByRole("button", { name: "Create Pending PO" })).toBeVisible();
    await page.getByPlaceholder("Search...").fill(uid);
    await expect(row).toContainText("RECEIVED");
    await shot(page, "purchases-received");
  });

  test("direct receipt without PO", async ({ page, monitor, api, uid }) => {
    await page.goto("/dashboard");
    const { supplier, product } = await seed(api, uid);
    await openPurchases(page);
    const ledger0 = await ledger(api, supplier.supplierId);
    await page.getByLabel("Receipt supplier", { exact: true }).selectOption(String(supplier.supplierId));
    await page.getByLabel("Receipt supplier invoice number").fill(`QADIR-${uid}`);
    await fillLine(page, 1, { productId: product.productId, batch: `D${uid}`, strips: "4", cost: "25" });
    await page.getByRole("button", { name: "Receive Stock" }).click();
    await expect(page.getByRole("status").filter({ hasText: `Stock received against QADIR-${uid}: 1 batch added to inventory.` })).toBeVisible();
    await page.getByPlaceholder("Search...").fill(uid);
    await expect(page.locator("tbody tr").filter({ hasText: `QADIR-${uid}` })).toContainText("RECEIVED");
    await expect(page.locator("tbody tr").filter({ hasText: `QADIR-${uid}` })).toContainText("₹100.00");
    expect(await units(api, product.productId)).toBe(40);
    expect(await ledger(api, supplier.supplierId)).toBeCloseTo(ledger0 + 100, 2);
    // form was reset
    await expect(page.getByLabel("Line 1 batch no.", { exact: true })).toHaveValue("");

    // same invoice number again for this supplier -> server conflict shown
    monitor.allow(/http 409 POST \/api\/purchases\/receive/);
    monitor.allow(/status of 409/);
    await page.getByLabel("Receipt supplier", { exact: true }).selectOption(String(supplier.supplierId));
    await page.getByLabel("Receipt supplier invoice number").fill(`QADIR-${uid}`);
    await fillLine(page, 1, { productId: product.productId, batch: `D2${uid}`, strips: "1" });
    await page.getByRole("button", { name: "Receive Stock" }).click();
    await expect(page.getByRole("alert")).toContainText("already recorded");
    expect(await units(api, product.productId)).toBe(40);
  });

  test("validation errors block receipt and PO creation", async ({ page, monitor, api, uid }) => {
    await page.goto("/dashboard");
    const { supplier, product } = await seed(api, uid);
    await openPurchases(page);
    const alert = page.getByRole("alert");

    // PO validation
    await page.getByRole("button", { name: "Create Pending PO" }).click();
    await expect(alert).toHaveText("Select a supplier.");
    await page.getByLabel("PO supplier").selectOption(String(supplier.supplierId));
    await page.getByRole("button", { name: "Create Pending PO" }).click();
    await expect(alert).toHaveText("PO / invoice reference is required.");
    await page.getByLabel("PO reference").fill(`QAPOV-${uid}`);
    await page.getByLabel("PO expected amount").fill("-5");
    await page.getByRole("button", { name: "Create Pending PO" }).click();
    await expect(alert).toHaveText("Expected amount cannot be negative.");

    const rcv = page.getByRole("button", { name: "Receive Stock" });
    const rcvAlert = page.locator("form").filter({ has: rcv }).getByRole("alert");
    await rcv.click();
    await expect(rcvAlert).toHaveText("Select a supplier.");
    await page.getByLabel("Receipt supplier", { exact: true }).selectOption(String(supplier.supplierId));
    await rcv.click();
    await expect(rcvAlert).toHaveText("Supplier invoice number is required.");
    await page.getByLabel("Receipt supplier invoice number").fill(`QAV-${uid}`);
    await rcv.click();
    await expect(rcvAlert).toHaveText("Line 1: select a product.");
    await page.getByLabel("Line 1 product", { exact: true }).selectOption(String(product.productId));
    await rcv.click();
    await expect(rcvAlert).toHaveText("Line 1: batch number is required.");
    await page.getByLabel("Line 1 batch no.", { exact: true }).fill(`V${uid}`);
    await rcv.click();
    await expect(rcvAlert).toHaveText("Line 1: manufacturing date is required.");

    // expiry before mfg
    await fillLine(page, 1, { mfg: daysFromNow(-10), exp: daysFromNow(-20) });
    await expect(page.getByText("Must be after mfg date")).toBeVisible();
    await rcv.click();
    await expect(rcvAlert).toHaveText("Line 1: expiry date must be after the manufacturing date.");
    // expiry in the past but after mfg
    await fillLine(page, 1, { mfg: daysFromNow(-100), exp: daysFromNow(-1) });
    await rcv.click();
    await expect(rcvAlert).toHaveText("Line 1: expiry date must be in the future.");
    // qty 0
    await fillLine(page, 1, { strips: "0" });
    await rcv.click();
    await expect(rcvAlert).toHaveText("Line 1: strip quantity must be a whole number greater than 0.");
    // selling > MRP
    await fillLine(page, 1, { sell: "60", mrp: "50" });
    await expect(page.getByText("Cannot exceed MRP")).toBeVisible();
    await rcv.click();
    await expect(rcvAlert).toHaveText("Line 1: selling price cannot exceed MRP.");
    // missing cost
    await fillLine(page, 1, { cost: "" });
    await rcv.click();
    await expect(rcvAlert).toHaveText("Line 1: cost price is required.");
    // second line missing dates
    await fillLine(page, 1, {});
    await page.getByRole("button", { name: "Add batch line" }).click();
    await page.getByLabel("Line 2 product", { exact: true }).selectOption(String(product.productId));
    await page.getByLabel("Line 2 batch no.", { exact: true }).fill(`V2${uid}`);
    await rcv.click();
    await expect(rcvAlert).toHaveText("Line 2: manufacturing date is required.");
    await shot(page, "purchases-validation");

    // nothing saved
    const purchases = (await api.get("/api/purchases")).json;
    expect(purchases.some((p) => p.invoiceNumber === `QAV-${uid}` || p.invoiceNumber === `QAPOV-${uid}`)).toBe(false);
    expect(await units(api, product.productId)).toBe(0);
  });

  for (const [w, h] of [[1920, 1080], [1366, 768], [768, 1024], [390, 844]]) {
    test(`responsive ${w}x${h}`, async ({ page, monitor }) => {
      await page.setViewportSize({ width: w, height: h });
      await openPurchases(page);
      await page.getByRole("button", { name: "Add batch line" }).click();
      expect(await noHorizontalOverflow(page)).toBe(true);
      await shot(page, `purchases-${w}x${h}`);
    });
  }
});
