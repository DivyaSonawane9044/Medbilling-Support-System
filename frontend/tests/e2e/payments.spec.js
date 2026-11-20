import { test, expect, openViaSidebar, noHorizontalOverflow, shot } from "./fixtures";

const iso = (d) => d.toISOString().slice(0, 10);
const inDays = (n) => iso(new Date(Date.now() + n * 86400000));
const inr = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

/** Product with stock (12% GST, 10/pack, Rs112) + a credit invoice for 2 packs (Rs224) with `paid` paid now. */
async function seedCreditInvoice(api, uid, paid = 24, method = "Cash") {
  const sup = await api.post("/api/suppliers", { name: `QA Supplier ${uid}P`, contactNumber: "9876500001" });
  expect(sup.status, sup.text).toBeLessThan(300);
  const prod = await api.post("/api/products", {
    name: `QA PayMed ${uid}`, company: `QACo ${uid}`, hsnCode: "30049099", stripSize: 10, price: 112, gstRate: 12, barcode: `PB${uid}`,
  });
  expect(prod.status, prod.text).toBeLessThan(300);
  const rec = await api.post("/api/purchases/receive", {
    supplierId: sup.json.supplierId,
    invoiceNumber: `PI-${uid}P`,
    batchItems: [{ productId: prod.json.productId, batchNumber: `B${uid}`, mfgDate: inDays(-30), expiryDate: inDays(730), mrp: 120, costPrice: 80, sellingPrice: 112, stripQuantity: 5 }],
  });
  expect(rec.status, rec.text).toBeLessThan(300);
  const bill = await api.post("/api/sales/bill", {
    customerName: `QA PayCust ${uid}`,
    contactNumber: "9876500002",
    paymentMethod: method,
    amountPaid: paid,
    lineItems: [{ productId: prod.json.productId, quantitySoldTablets: 20 }],
  });
  expect(bill.status, bill.text).toBe(201);
  expect(Number(bill.json.grandTotal)).toBe(224);
  return bill.json;
}

async function openPayments(page) {
  await page.goto("/dashboard");
  await openViaSidebar(page, "Payments");
  await expect(page).toHaveURL(/\/payments$/);
  await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();
}

const invoiceRow = async (api, invoiceNumber) => (await api.get("/api/sales/invoices")).json.find((r) => r.invoiceNumber === invoiceNumber);

test.describe("Payments", () => {
  test("list loads with statuses; filter by method and Show all", async ({ page, api, uid }) => {
    const inv = await seedCreditInvoice(api, uid, 24, "Wallet");
    await openPayments(page);
    // KPI cards come from real data: outstanding = sum of invoice balances, failed = FAILED payment rows
    const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
    await expect(async () => {
      await page.reload();
      const invs = (await api.get("/api/sales/invoices")).json;
      const pays = (await api.get("/api/payments")).json;
      const outstanding = invs.reduce((s, i) => s + (Number(i.balanceDue) > 0 ? Number(i.balanceDue) : 0), 0);
      await expect(page.getByTestId("kpi-outstanding").locator(".mb-sr-only")).toHaveText(rupees(outstanding), { timeout: 3000 });
      await expect(page.getByTestId("kpi-failed").locator(".mb-sr-only")).toHaveText(String(pays.filter((p) => p.paymentStatus === "FAILED").length), { timeout: 3000 });
    }).toPass({ timeout: 60_000 });
    await expect(page.getByRole("region", { name: "Razorpay online payment" })).toBeVisible();

    const table = page.locator(".dt-table");
    await expect(table.locator("tbody tr").first()).toBeVisible();
    await expect(table.locator("tbody tr", { hasText: "No results found." })).toHaveCount(0);
    // status badges render
    await expect(table.locator("tbody").getByText(/^(SUCCESS|CREATED|FAILED)$/).first()).toBeVisible();

    // Our counter payment (Wallet) is listed
    await page.getByPlaceholder("Search...").fill(inv.invoiceNumber);
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await expect(table.locator("tbody tr")).toContainText(inr(24));
    await expect(table.locator("tbody tr")).toContainText("Wallet");
    await expect(table.locator("tbody tr")).toContainText("SUCCESS");
    await expect(table.locator("tbody tr")).toContainText(`QA PayCust ${uid}`);
    await page.getByPlaceholder("Search...").fill("");

    // Filter by method: methods used at the counter (Wallet) are offered too
    const filter = page.getByLabel("Filter method");
    await filter.selectOption("Cash");
    await expect(table.locator("tbody tr").first()).toBeVisible();
    const methods = await table.locator("tbody tr td:nth-child(5)").allTextContents();
    expect(methods.filter((m) => m.toLowerCase() !== "cash" && m !== "No results found."), methods.join(",")).toEqual([]);
    await filter.selectOption("Wallet");
    await page.getByPlaceholder("Search...").fill(inv.invoiceNumber);
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await expect(table.locator("tbody tr")).toContainText("Wallet");
    await page.getByPlaceholder("Search...").fill("");
    const all = (await api.get("/api/payments")).json.length;
    await page.getByRole("button", { name: "Show all" }).click();
    await expect(page.getByRole("button", { name: "Show all" })).toHaveCount(0);
    await expect(page.locator(".dt-count")).toContainText(`of ${all}`);
  });

  test("Razorpay section says not configured and offers no pay button", async ({ page, api }) => {
    const cfg = await api.get("/api/payments/config");
    expect(cfg.json.configured).toBe(false);
    await openPayments(page);
    const rz = page.getByRole("region", { name: "Razorpay online payment" });
    await expect(rz).toContainText("Not configured");
    await expect(rz).toContainText("Online payments are off");
    await expect(page.getByRole("button", { name: /Pay with Razorpay/ })).toHaveCount(0);
    await expect(page.getByLabel("Invoice for online payment")).toHaveCount(0);
  });

  test("record partial then remaining payment; over-payment rejected; paid invoice leaves selector; no duplicates", async ({ page, api, uid, monitor }) => {
    const inv = await seedCreditInvoice(api, uid, 24); // due 200
    const before = await invoiceRow(api, inv.invoiceNumber);
    expect(Number(before.balanceDue)).toBe(200);
    expect(before.paymentStatus).toBe("PARTIAL");

    await openPayments(page);
    const picker = page.getByLabel("Invoice with balance due");
    const opt = picker.locator(`option[value="${inv.invoiceId}"]`);
    await expect(opt).toContainText(`${inv.invoiceNumber} — QA PayCust ${uid} — due ${inr(200)}`);
    await expect(page.getByRole("button", { name: "Record Payment" })).toBeDisabled();
    await picker.selectOption(String(inv.invoiceId));
    await expect(page.getByLabel("Amount")).toHaveAttribute("placeholder", "Full: 200.00");

    // Over-payment is rejected with a visible message, nothing recorded
    await page.getByLabel("Amount").fill("250");
    await page.getByRole("button", { name: "Record Payment" }).click();
    await expect(page.getByRole("status")).toHaveText(`Amount must be more than 0 and at most ${inr(200)}.`);
    await page.getByLabel("Amount").fill("0");
    await page.getByRole("button", { name: "Record Payment" }).click();
    await expect(page.getByRole("status")).toHaveText(`Amount must be more than 0 and at most ${inr(200)}.`);
    expect(Number((await invoiceRow(api, inv.invoiceNumber)).balanceDue)).toBe(200);

    // Partial payment 120 by UPI
    await page.getByLabel("Payment method").selectOption("UPI");
    await page.getByLabel("Amount").fill("120");
    await page.getByRole("button", { name: "Record Payment" }).dblclick(); // double click must not record twice
    await expect(page.getByRole("status")).toHaveText(`Recorded ${inr(120)} for ${inv.invoiceNumber}.`);
    await expect(opt).toContainText(`due ${inr(80)}`);
    await expect(picker).toHaveValue("");
    let row = await invoiceRow(api, inv.invoiceNumber);
    expect(Number(row.amountPaid)).toBe(144);
    expect(Number(row.balanceDue)).toBe(80);
    let pays = (await api.get("/api/payments")).json.filter((p) => p.invoiceNumber === inv.invoiceNumber);
    expect(pays.filter((p) => Number(p.amountPaid) === 120)).toHaveLength(1);
    expect(pays.find((p) => Number(p.amountPaid) === 120).paymentMethod).toBe("UPI");

    // Remaining 80 (blank amount = full outstanding)
    await picker.selectOption(String(inv.invoiceId));
    await expect(page.getByLabel("Amount")).toHaveAttribute("placeholder", "Full: 80.00");
    await page.getByRole("button", { name: "Record Payment" }).click();
    await expect(page.getByRole("status")).toHaveText(`Recorded ${inr(80)} for ${inv.invoiceNumber}.`);
    // Fully paid invoice disappears from the selector
    await expect(opt).toHaveCount(0);
    row = await invoiceRow(api, inv.invoiceNumber);
    expect(Number(row.balanceDue)).toBe(0);
    expect(row.paymentStatus).toBe("PAID");
    pays = (await api.get("/api/payments")).json.filter((p) => p.invoiceNumber === inv.invoiceNumber);
    expect(pays).toHaveLength(3); // 24 at counter + 120 + 80
    expect(pays.reduce((s, p) => s + Number(p.amountPaid), 0)).toBe(224);
    // Customer balance cleared
    const cust = await api.get(`/api/customers/${row.customerId}`);
    expect(Number(cust.json.remainingBalance)).toBe(0);

    // New payment rows show in the table
    await page.getByPlaceholder("Search...").fill(inv.invoiceNumber);
    await expect(page.locator(".dt-table tbody tr")).toHaveCount(3);

    // Server-side duplicate prevention: paying a fully paid invoice again is a 409
    monitor.allow(/http 409 POST \/api\/payments\/record/);
    const dup = await api.post("/api/payments/record", { invoiceId: inv.invoiceId, paymentMethod: "Cash", amount: 10 });
    expect(dup.status).toBe(409);
    expect(dup.json.message).toMatch(/already fully paid/);
    await shot(page, "payments-recorded");
  });

  for (const vp of [
    { w: 1920, h: 1080 },
    { w: 1366, h: 768 },
    { w: 768, h: 1024 },
    { w: 390, h: 844 },
  ]) {
    test(`responsive ${vp.w}x${vp.h}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto("/payments");
      await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();
      await expect(page.locator(".dt-table tbody tr").first()).toBeVisible();
      expect(await noHorizontalOverflow(page)).toBe(true);
      await expect(page.getByRole("button", { name: "Record Payment" })).toBeVisible();
      const btn = await page.getByRole("button", { name: "Record Payment" }).boundingBox();
      expect(btn.x + btn.width).toBeLessThanOrEqual(vp.w);
      // Amount input is styled like the selects next to it
      expect(await page.getByLabel("Amount").evaluate((el) => getComputedStyle(el).borderRadius)).toBe("12px");
      const wrap = await page.locator(".dt-table-wrap").evaluate((el) => getComputedStyle(el).overflowX);
      expect(["auto", "scroll"]).toContain(wrap);
      await shot(page, `payments-${vp.w}x${vp.h}`);
    });
  }
});
