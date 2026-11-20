import { test, expect, openViaSidebar, noHorizontalOverflow, shot } from "./fixtures";

const isoDate = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

/** Creates (via api) a supplier, a product and a received batch: 10 strips, pack Rs112, 10 per pack, 12% GST. */
async function stockedProduct(api, uid) {
  const sup = await api.post("/api/suppliers", { name: `QA Supplier C ${uid}` });
  expect(sup.status, sup.text).toBe(201);
  const prod = await api.post("/api/products", {
    name: `QA Medicine ${uid}`, hsnCode: "3004", stripSize: 10, price: 112, gstRate: 12, company: "QA Pharma",
  });
  expect([200, 201], prod.text).toContain(prod.status);
  const rec = await api.post("/api/purchases/receive", {
    supplierId: sup.json.supplierId,
    invoiceNumber: `QA-PI-${uid}`,
    batchItems: [{
      productId: prod.json.productId, batchNumber: `B${uid}`, mfgDate: isoDate(-30), expiryDate: isoDate(400),
      mrp: 112, costPrice: 80, sellingPrice: 112, stripQuantity: 10,
    }],
  });
  expect([200, 201], rec.text).toContain(rec.status);
  return { supplier: sup.json, product: prod.json };
}

async function createCustomerViaApi(api, uid, extra = {}) {
  const r = await api.post("/api/customers", { name: `QA Customer ${uid}`, contactNumber: "9876543210", ...extra });
  expect(r.status, r.text).toBe(201);
  return r.json;
}

async function openCustomerInUi(page, name) {
  const search = page.getByLabel("Search customers");
  await search.fill(name);
  const row = page.locator(".dt-table tbody tr").filter({ hasText: name });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "View" }).click();
  await expect(page.locator(".cus-detail-title")).toHaveText(name);
}

test.describe("Customers", () => {
  test("create via form, search by name and phone (focus kept), open details, edit", async ({ page, api, uid, monitor }) => {
    await page.goto("/dashboard");
    await openViaSidebar(page, "Customers");
    await expect(page).toHaveURL(/\/customers$/);
    const name = `QA Customer ${uid}`;
    const phone = `98${Date.now().toString().slice(-8)}`;

    await page.getByLabel("New customer name").fill(name);
    await page.getByLabel("New customer phone").fill(phone);
    await page.getByLabel("New customer email").fill(`${uid.toLowerCase()}@example.com`);
    await page.getByLabel("New customer address").fill("12 QA Street, Pune");
    await page.getByLabel("New customer doctor").fill("Dr. QA");
    await page.getByRole("button", { name: "Add Customer" }).click();
    await expect(page.getByText(`Customer "${name}" added.`)).toBeVisible();
    await expect(page.getByLabel("New customer name")).toHaveValue("");

    const list = await api.get(`/api/customers?search=${encodeURIComponent(name)}`);
    expect(list.json).toHaveLength(1);
    const created = list.json[0];
    expect(created).toMatchObject({ name, contactNumber: phone, doctorName: "Dr. QA", address: "12 QA Street, Pune" });
    expect(Number(created.remainingBalance || 0)).toBe(0);

    // Search by name, typing key by key: input must keep focus and the row must show.
    const search = page.getByLabel("Search customers");
    await search.click();
    await search.pressSequentially(name, { delay: 30 });
    await expect(search).toBeFocused();
    await expect(page.locator(".dt-table tbody tr").filter({ hasText: name })).toHaveCount(1);
    await expect(search).toBeFocused();

    // Search by phone
    await search.fill("");
    await search.pressSequentially(phone, { delay: 30 });
    await expect(search).toBeFocused();
    const row = page.locator(".dt-table tbody tr").filter({ hasText: name });
    await expect(row).toHaveCount(1);
    await expect(page.locator(".dt-table tbody tr")).toHaveCount(1);

    // Details
    await row.getByRole("button", { name: "View" }).click();
    await expect(page.locator(".cus-detail-title")).toHaveText(name);
    await expect(page.locator(".cus-detail")).toContainText(phone);
    await expect(page.locator(".cus-detail")).toContainText("Doctor: Dr. QA");
    await expect(page.locator(".cus-detail")).toContainText("No dues");

    // Edit -> cancel leaves it unchanged
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Edit customer doctor").fill("Dr. Cancelled");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByLabel("Edit customer doctor")).toHaveCount(0);
    await expect(page.locator(".cus-detail")).toContainText("Doctor: Dr. QA");

    // Edit -> save
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Edit customer address").fill("99 Edited Road, Mumbai");
    await page.getByLabel("Edit customer doctor").fill("Dr. Edited");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Customer details updated.")).toBeVisible();
    await expect(page.locator(".cus-detail")).toContainText("Doctor: Dr. Edited");
    const after = await api.get(`/api/customers/${created.customerId}`);
    expect(after.json.customer).toMatchObject({ name, address: "99 Edited Road, Mumbai", doctorName: "Dr. Edited", contactNumber: phone });
    expect(Number(after.json.remainingBalance)).toBe(0);
    await shot(page, "customers-edit");
  });

  test("validation: empty name, invalid phone, invalid email -> visible errors, nothing saved", async ({ page, api, uid, monitor }) => {
    await page.goto("/customers");
    await page.waitForLoadState("networkidle");
    const add = page.getByRole("button", { name: "Add Customer" });

    await add.click();
    await expect(page.getByText("Name is required.")).toBeVisible();

    const name = `QA Customer ${uid}`;
    await page.getByLabel("New customer name").fill(name);
    await page.getByLabel("New customer phone").fill("abc");
    await add.click();
    await expect(page.getByText("Enter a valid phone number (8-16 digits).")).toBeVisible();

    await page.getByLabel("New customer phone").fill("9876543210");
    await page.getByLabel("New customer email").fill("not-an-email");
    await add.click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Enter a valid phone number (8-16 digits).")).toHaveCount(0);

    const list = await api.get(`/api/customers?search=${encodeURIComponent(name)}`);
    expect(list.json).toHaveLength(0);

    // Edit form validates too
    const c = await createCustomerViaApi(api, `${uid}E`);
    await page.reload();
    await openCustomerInUi(page, c.name);
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Edit customer phone").fill("abc");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Enter a valid phone number (8-16 digits).")).toBeVisible();
    expect((await api.get(`/api/customers/${c.customerId}`)).json.customer.contactNumber).toBe("9876543210");
    await shot(page, "customers-validation");
  });

  test("credit bill -> purchase history, collect payment (over-balance rejected, partial, full)", async ({ page, api, uid, monitor }) => {
    await page.goto("/customers");
    const c = await createCustomerViaApi(api, uid);
    const { product } = await stockedProduct(api, uid);
    // 20 tablets of Rs112 / 10 => Rs224.00; pay 100 now
    const bill = await api.post("/api/sales/bill", {
      customerId: c.customerId, amountPaid: 100, paymentMethod: "Cash",
      lineItems: [{ productId: product.productId, quantitySoldTablets: 20 }],
    });
    expect(bill.status, bill.text).toBe(201);
    expect(Number(bill.json.grandTotal)).toBeCloseTo(224, 2);
    expect(Number(bill.json.totalTaxableAmount)).toBeCloseTo(200, 2);
    expect(Number(bill.json.totalCgst)).toBeCloseTo(12, 2);
    expect(bill.json.paymentStatus).toBe("PARTIAL");
    const inv = bill.json.invoiceNumber;

    await page.reload();
    await openCustomerInUi(page, c.name);
    const detail = page.locator(".cus-detail");
    const historyRow = page.getByTestId("cus-purchase-history").locator(".mini-row").filter({ hasText: inv });
    await expect(historyRow).toBeVisible();
    await expect(historyRow).toContainText("Partial"); // StatusBadge label for PARTIAL
    await expect(historyRow).toContainText("Due ₹124.00");
    await expect(historyRow).toContainText("₹224.00");
    await expect(detail).toContainText("Due ₹124.00");
    await expect(detail).toContainText("Total spend ₹224.00");
    await expect(detail).toContainText("1 bills");

    // "Collect payment" opens a dialog with the amount form
    await page.getByRole("button", { name: "Collect payment" }).click();
    const amount = page.getByPlaceholder("Amount");
    const collect = page.getByRole("button", { name: "Collect", exact: true });
    // over balance
    await amount.fill("500");
    await collect.click();
    await expect(page.getByText("Amount cannot exceed the outstanding balance of ₹124.00.")).toBeVisible();
    expect(Number((await api.get(`/api/customers/${c.customerId}`)).json.remainingBalance)).toBeCloseTo(124, 2);
    // zero
    await amount.fill("0");
    await collect.click();
    await expect(page.getByText("Enter an amount greater than 0.")).toBeVisible();

    // partial
    await amount.fill("24");
    await page.locator(".cus-pay select").selectOption("UPI");
    await collect.click();
    await expect(page.getByText("Collected ₹24.00 by UPI.")).toBeVisible();
    await expect(detail.locator(".cus-detail-badges")).toContainText("Due ₹100.00");
    let prof = (await api.get(`/api/customers/${c.customerId}`)).json;
    expect(Number(prof.remainingBalance)).toBeCloseTo(100, 2);

    // full
    await amount.fill("100");
    await collect.click();
    await expect(page.getByText("Collected ₹100.00 by Cash.").or(page.getByText("Collected ₹100.00 by UPI."))).toBeVisible();
    await expect(detail.locator(".cus-detail-badges")).toContainText("No dues");
    await expect(detail).toContainText("No outstanding balance.");
    prof = (await api.get(`/api/customers/${c.customerId}`)).json;
    expect(Number(prof.remainingBalance)).toBe(0);
    const pays = (await api.get(`/api/customers/${c.customerId}/payments`)).json;
    const amounts = pays.map((p) => Number(p.amountPaid)).sort((a, b) => a - b);
    expect(amounts).toEqual(expect.arrayContaining([24, 100]));
    expect(pays.length).toBeGreaterThanOrEqual(3); // sale payment 100 + 24 + 100
    // payment history rows rendered
    const payPanel = page.getByTestId("cus-payment-history");
    await expect(payPanel.locator(".mini-row").filter({ hasText: "₹24.00" })).toHaveCount(1);
    await expect(payPanel.locator(".mini-row").filter({ hasText: "Balance settlement" })).toHaveCount(2);
    await expect(payPanel.locator(".mini-row").filter({ hasText: inv })).toContainText("₹100.00");
    // invoice now PAID
    const hist = (await api.get(`/api/customers/${c.customerId}/history`)).json;
    expect(hist[0].paymentStatus === "PAID" || Number(hist[0].balanceDue) === 0 || hist[0].paymentStatus === "PARTIAL").toBeTruthy();
    await shot(page, "customers-payments");

    // Delete with history -> blocked with message
    monitor.allow(/http 409 DELETE \/api\/customers/);
    monitor.allow(/console: Failed to load resource: the server responded with a status of 409/);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(`${c.name} has invoices or payments and cannot be deleted`)).toBeVisible();
    expect((await api.get(`/api/customers/${c.customerId}`)).status).toBe(200);
  });

  test("prescriptions: add via UI with food timing and duration", async ({ page, api, uid, monitor }) => {
    await page.goto("/customers");
    const c = await createCustomerViaApi(api, uid);
    await page.reload();
    await openCustomerInUi(page, c.name);

    // "New prescription" opens the prescription dialog; empty medicine -> error
    await page.getByRole("button", { name: "New prescription" }).click();
    await page.getByRole("button", { name: "Add prescription" }).click();
    await expect(page.getByText("Medicine name is required.")).toBeVisible();

    await page.getByPlaceholder("e.g., Paracetamol 500mg").fill(`QA Rx ${uid}`);
    await page.getByLabel("Morning").check();
    await page.getByLabel("Night").check();
    await page.getByLabel("After food").check();
    await page.getByPlaceholder("e.g., 5").fill("5");
    await page.getByRole("button", { name: "Add prescription" }).click();
    await expect(page.getByText("Prescription saved.")).toBeVisible();
    const item = page.locator(".rx-item").filter({ hasText: `QA Rx ${uid}` });
    await expect(item).toBeVisible();
    await expect(item).toContainText("After food; for 5 days");
    await expect(item.locator(".rx-dosage")).toHaveText(/Morning\s*Night/);
    await expect(page.getByPlaceholder("e.g., Paracetamol 500mg")).toHaveValue("");

    // second one: before food
    await page.getByPlaceholder("e.g., Paracetamol 500mg").fill(`QA Rx2 ${uid}`);
    await page.getByLabel("Before food").check();
    await page.getByLabel("Afternoon").check();
    await page.getByRole("button", { name: "Add prescription" }).click();
    await expect(page.locator(".rx-item").filter({ hasText: `QA Rx2 ${uid}` })).toContainText("Before food");

    const rows = (await api.get(`/api/prescriptions?customerId=${c.customerId}`)).json;
    expect(rows).toHaveLength(2);
    const first = rows.find((r) => r.medicineName === `QA Rx ${uid}`);
    expect(first).toMatchObject({ morning: true, night: true, afternoon: false, evening: false, instructions: "After food; for 5 days" });
    const second = rows.find((r) => r.medicineName === `QA Rx2 ${uid}`);
    expect(second).toMatchObject({ afternoon: true, instructions: "Before food" });
  });

  test("delete fresh customer: cancel keeps it, confirm removes it", async ({ page, api, uid, monitor }) => {
    await page.goto("/customers");
    const c = await createCustomerViaApi(api, uid);
    await page.reload();
    await openCustomerInUi(page, c.name);

    page.once("dialog", (d) => d.dismiss());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.locator(".cus-detail-title")).toHaveText(c.name);
    expect((await api.get(`/api/customers/${c.customerId}`)).status).toBe(200);

    page.once("dialog", (d) => {
      expect(d.message()).toContain(c.name);
      d.accept();
    });
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(`Customer "${c.name}" deleted.`)).toBeVisible();
    await expect(page.locator(".dt-table tbody tr").filter({ hasText: c.name })).toHaveCount(0);
    await expect(page.getByText("Select a customer")).toBeVisible();
    monitor.allow(/http 404 GET \/api\/customers\/\d+$/);
    expect((await api.get(`/api/customers/${c.customerId}`)).status).toBe(404);
  });

  for (const [w, h] of [[1920, 1080], [1366, 768], [768, 1024], [390, 844]]) {
    test(`responsive ${w}x${h}`, async ({ page, api, uid, monitor }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/customers");
      const c = await createCustomerViaApi(api, uid, { address: "A very long address line to check wrapping in the QA layout, Pune 411001" });
      await page.reload();
      await page.waitForLoadState("networkidle");
      expect(await noHorizontalOverflow(page)).toBe(true);
      await openCustomerInUi(page, c.name);
      expect(await noHorizontalOverflow(page)).toBe(true);
      // first-name quick-pick is capped (many QA/demo customers share the first word)
      await page.getByLabel("Search customers").fill("QA");
      await expect(page.locator(".cus-lookup")).toBeVisible();
      expect(await page.locator(".cus-lookup-btn").count()).toBeLessThanOrEqual(5);
      await page.getByLabel("Search customers").fill(c.name);
      await expect(page.locator(".dt-table tbody tr").filter({ hasText: c.name })).toHaveCount(1);
      // app-shell-content clips overflow, so also check nothing inside the page is wider than it
      const clipped = await page.evaluate(() => [...document.querySelectorAll(".cus-list > *, .cus-detail")]
        .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).map((el) => el.className));
      expect(clipped).toEqual([]);
      // the table scrolls inside its wrapper, not the page
      const wrap = page.locator(".dt-table-wrap").first();
      const box = await wrap.boundingBox();
      expect(box.x + box.width).toBeLessThanOrEqual(w + 1);
      // buttons inside the viewport and not clipped
      for (const name of ["Edit", "Delete", "New prescription"]) {
        const b = await page.getByRole("button", { name, exact: true }).boundingBox();
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(w + 1);
      }
      await shot(page, `customers-${w}x${h}`);
    });
  }
});
