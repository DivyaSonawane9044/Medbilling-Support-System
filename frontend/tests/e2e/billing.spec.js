import fs from "node:fs";
import { test, expect, openViaSidebar, noHorizontalOverflow, shot } from "./fixtures";

// ---------- helpers ----------
const iso = (d) => d.toISOString().slice(0, 10);
const inDays = (n) => iso(new Date(Date.now() + n * 86400000));
const inr = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

/**
 * Creates an isolated supplier + product (12% GST, 10 per pack, Rs112) and receives two batches:
 * NEAR (expires in ~45 days, `nearStrips` packs) and FAR (expires in ~2 years, `farStrips` packs).
 */
async function seedProduct(api, uid, tag = "A", { nearStrips = 3, farStrips = 5, withStock = true } = {}) {
  const sup = await api.post("/api/suppliers", { name: `QA Supplier ${uid}${tag}`, contactNumber: "9876500000", company: `QACo ${uid}` });
  expect(sup.status, sup.text).toBeLessThan(300);
  const prod = await api.post("/api/products", {
    name: `QA Med ${uid}${tag}`,
    genericName: `QA Generic ${uid}`,
    company: `QACo ${uid}${tag}`,
    hsnCode: "30049099",
    stripSize: 10,
    dosageForm: "Tablet",
    unitType: "Strip",
    price: 112,
    gstRate: 12,
    reorderLevel: 1,
    targetStockLevel: 100,
    barcode: `BC${uid}${tag}`,
  });
  expect(prod.status, prod.text).toBeLessThan(300);
  const p = prod.json;
  const batches = { near: `N${uid}${tag}`, far: `F${uid}${tag}` };
  if (withStock) {
    const rec = await api.post("/api/purchases/receive", {
      supplierId: sup.json.supplierId,
      invoiceNumber: `PI-${uid}${tag}`,
      batchItems: [
        { productId: p.productId, batchNumber: batches.near, mfgDate: inDays(-300), expiryDate: inDays(45), mrp: 120, costPrice: 80, sellingPrice: 112, stripQuantity: nearStrips },
        { productId: p.productId, batchNumber: batches.far, mfgDate: inDays(-30), expiryDate: inDays(730), mrp: 120, costPrice: 80, sellingPrice: 112, stripQuantity: farStrips },
      ].filter((b) => b.stripQuantity > 0),
    });
    expect(rec.status, rec.text).toBeLessThan(300);
  }
  return { ...p, supplierId: sup.json.supplierId, batches };
}

async function openBilling(page) {
  await page.goto("/dashboard");
  await openViaSidebar(page, "Billing");
  await expect(page).toHaveURL(/\/billing$/);
  await expect(page.getByRole("heading", { name: "Sales & Billing" })).toBeVisible();
}

const medOption = (page, product) => page.getByRole("listbox", { name: "Select medicine" }).getByTestId(`med-option-${product.productId}`);
const cartLines = (page) => page.locator(".cart-line");
const cartEmpty = (page) => page.getByTestId("cart-empty");

/** Types the medicine name in the search box and picks it from the result list. */
async function pickMedicine(page, product) {
  await page.getByLabel("Medicine search").fill(product.name);
  // Results are a listbox of selectable rows (redesign); click the product's row
  const opt = medOption(page, product);
  await expect(opt).toBeVisible();
  await opt.click();
  await expect(opt).toHaveAttribute("aria-selected", "true");
}

async function addMedicine(page, product, qty, mode = "strip") {
  await pickMedicine(page, product);
  await page.getByRole("button", { name: mode === "strip" ? "Strip / Pack" : "Loose units" }).click();
  await page.getByLabel("Quantity").fill(String(qty));
  await expect(page.getByTestId("price-preview")).toContainText("₹");
  await page.getByRole("button", { name: "Add Item" }).click();
}

const itemRow = (page, product) => page.locator(".cart-line", { hasText: product.name });

// ---------- tests ----------
test.describe("Billing", () => {
  test("cart: search, strip vs loose, preview, merge, FEFO batch, second item, remove, totals, discount, change", async ({ page, api, uid, monitor }) => {
    const a = await seedProduct(api, uid, "A");
    const b = await seedProduct(api, uid, "B");
    await openBilling(page);

    // Strip mode: 2 packs = 20 tablets = Rs224.00
    await pickMedicine(page, a);
    await expect(page.getByText("10 per pack")).toBeVisible();
    await expect(page.getByText("GST 12%").first()).toBeVisible();
    await page.getByLabel("Quantity").fill("2");
    await expect(page.getByTestId("price-preview")).toHaveText(inr(224));
    // Loose units: 5 tablets = Rs56.00
    await page.getByRole("button", { name: "Loose units" }).click();
    await expect(page.getByText("Units", { exact: true })).toBeVisible();
    await page.getByLabel("Quantity").fill("5");
    await expect(page.getByTestId("price-preview")).toHaveText(inr(56));
    // Back to packs and add 2 packs
    await page.getByRole("button", { name: "Strip / Pack" }).click();
    await page.getByLabel("Quantity").fill("2");
    await expect(page.getByTestId("price-preview")).toHaveText(inr(224));
    await page.getByRole("button", { name: "Add Item" }).click();

    const rowA = itemRow(page, a);
    await expect(rowA).toHaveCount(1);
    await expect(rowA).toContainText("20 units");
    // FEFO: the near-expiry batch is used first
    await expect(rowA).toContainText(`Batch ${a.batches.near}`);
    await expect(rowA).not.toContainText(a.batches.far);
    await expect(page.getByTestId("sum-taxable")).toHaveText(inr(200));
    await expect(page.getByTestId("sum-cgst")).toHaveText(inr(12));
    await expect(page.getByTestId("sum-sgst")).toHaveText(inr(12));
    await expect(page.getByTestId("sum-grand")).toHaveText(inr(224));

    // Same medicine again (5 loose) merges into the same line: 25 units = Rs280
    await addMedicine(page, a, 5, "tablet");
    await expect(itemRow(page, a)).toHaveCount(1);
    await expect(itemRow(page, a)).toContainText("25 units");
    await expect(itemRow(page, a)).toContainText("2 pack(s) + 5");
    await expect(page.getByTestId("sum-grand")).toHaveText(inr(280));
    await expect(page.getByTestId("sum-taxable")).toHaveText(inr(250));
    await expect(page.getByTestId("sum-cgst")).toHaveText(inr(15));

    // Taking more than the near batch (30 units) spills into the far batch (FEFO across batches)
    await addMedicine(page, a, 1, "strip"); // 35 units
    await expect(itemRow(page, a)).toContainText("35 units");
    await expect(itemRow(page, a)).toContainText(a.batches.near);
    await expect(itemRow(page, a)).toContainText(a.batches.far);
    await expect(page.getByTestId("sum-grand")).toHaveText(inr(392));

    // Second medicine
    await addMedicine(page, b, 1, "strip");
    await expect(cartLines(page)).toHaveCount(2);
    await expect(page.getByTestId("sum-grand")).toHaveText(inr(504));
    await expect(page.getByTestId("sum-taxable")).toHaveText(inr(450));
    await expect(page.getByTestId("sum-cgst")).toHaveText(inr(27));
    await expect(page.getByTestId("sum-sgst")).toHaveText(inr(27));

    // Remove the second medicine
    await page.getByRole("button", { name: `Remove ${b.name}` }).click();
    await expect(cartLines(page)).toHaveCount(1);
    await expect(page.getByTestId("sum-grand")).toHaveText(inr(392));

    // Cart +/- steps one pack for a line added as packs; totals re-quoted by the server
    await page.getByRole("button", { name: `Increase ${a.name}` }).click();
    await expect(itemRow(page, a)).toContainText("45 units");
    await expect(page.getByTestId("sum-grand")).toHaveText(inr(504));
    await page.getByRole("button", { name: `Decrease ${a.name}` }).click();
    await expect(itemRow(page, a)).toContainText("35 units");
    await expect(page.getByTestId("sum-grand")).toHaveText(inr(392));

    // Change to return when more cash is received
    await page.getByLabel("Amount received").fill("400");
    await expect(page.getByTestId("sum-change")).toHaveText(inr(8));
    await expect(page.getByTestId("sum-due")).toHaveCount(0);

    // Discount 10% - UI must show exactly what the server quotes
    await page.getByLabel("Discount %").fill("10");
    const q = await api.post("/api/sales/quote", { discountPercent: 10, lineItems: [{ productId: a.productId, quantitySoldTablets: 35 }] });
    expect(q.status).toBe(200);
    await expect(page.getByTestId("sum-grand")).toHaveText(inr(q.json.grandTotal));
    await expect(page.getByTestId("sum-taxable")).toHaveText(inr(q.json.totalTaxableAmount));
    await expect(page.getByTestId("sum-cgst")).toHaveText(inr(q.json.totalCgst));
    await expect(page.getByText(`Discount (10%)`)).toBeVisible();
    expect(Number(q.json.grandTotal)).toBeLessThan(392);
    await shot(page, "billing-cart");
    expect(monitor.unexpected()).toEqual([]);
  });

  test("credit bill with customer: balance due, save, invoice panel, stock, history, print, PDF, SMS", async ({ page, api, uid }) => {
    const a = await seedProduct(api, uid, "A");
    await openBilling(page);
    const customer = `QA Cust ${uid}`;
    await page.getByLabel("Customer name").fill(customer);
    await page.getByLabel("Contact number").fill("9876543210");
    await page.getByLabel("Doctor name").fill(`Dr QA ${uid}`);
    await page.getByRole("radiogroup", { name: "Payment method" }).getByRole("radio", { name: "UPI" }).click();
    await expect(page.getByRole("radio", { name: "UPI" })).toHaveAttribute("aria-checked", "true");
    await page.getByLabel("Morning").check();
    await page.getByLabel("Night").check();
    await page.getByLabel("Before / After food").selectOption("before");
    await page.getByLabel("Duration (days)").fill("5");
    await addMedicine(page, a, 2, "strip");
    await expect(page.getByTestId("sum-grand")).toHaveText(inr(224));
    await expect(itemRow(page, a)).toContainText("Dose: Morning / Night • Before food • 5 days");

    await page.getByLabel("Amount received").fill("100");
    await expect(page.getByTestId("sum-due")).toHaveText(inr(124));

    await page.getByRole("button", { name: "Save Bill" }).click();
    const notice = page.getByRole("status");
    await expect(notice).toContainText(/Bill INV-.* saved/);
    const invNo = (await notice.textContent()).match(/INV-[\w-]+/)[0];

    const panel = page.getByRole("region", { name: "Saved invoice" });
    await expect(panel).toContainText(`Saved invoice ${invNo}`);
    await expect(panel).toContainText(a.batches.near);
    await expect(panel).toContainText(inDays(45));
    await expect(panel).toContainText("HSN 30049099");
    await expect(panel).toContainText(customer);
    await expect(panel).toContainText(inr(200));
    await expect(panel).toContainText(inr(12));
    await expect(panel).toContainText(inr(224));
    await expect(panel).toContainText("Balance due:");
    await expect(panel).toContainText(inr(124));
    await expect(panel).toContainText("Morning / Night • Before food • 5 days");
    // Form reset after save
    await expect(cartEmpty(page)).toContainText("Add medicines to start billing.");
    await expect(page.getByLabel("Customer name")).toHaveValue("");

    // DB: stock decreased by 20 units (80 -> 60)
    const prod = await api.get(`/api/products/${a.productId}`);
    expect(prod.json.quantity).toBe(60);
    // DB: invoice saved with balance due, linked to the customer
    const list = await api.get("/api/sales/invoices");
    const row = list.json.find((r) => r.invoiceNumber === invNo);
    expect(row).toBeTruthy();
    expect(Number(row.grandTotal)).toBe(224);
    expect(Number(row.amountPaid)).toBe(100);
    expect(Number(row.balanceDue)).toBe(124);
    expect(row.paymentStatus).toBe("PARTIAL");
    expect(row.customerName).toBe(customer);
    const hist = await api.get(`/api/customers/${row.customerId}/history`);
    expect(hist.json.map((h) => h.invoiceNumber)).toContain(invNo);
    const detail = await api.get(`/api/sales/invoices/${row.invoiceId}`);
    expect(detail.json.items[0].batchNumber).toBe(a.batches.near);
    expect(detail.json.items[0].morning).toBe(true);
    expect(detail.json.items[0].beforeFood).toBe(true);

    // Print calls window.print
    await page.evaluate(() => {
      window.__printCalls = 0;
      window.print = () => { window.__printCalls += 1; };
    });
    await panel.getByRole("button", { name: "Print" }).click();
    expect(await page.evaluate(() => window.__printCalls)).toBe(1);

    // Download PDF
    const [download] = await Promise.all([page.waitForEvent("download"), panel.getByRole("button", { name: "Download PDF" }).click()]);
    expect(download.suggestedFilename()).toBe(`${invNo}.pdf`);
    const bytes = fs.readFileSync(await download.path());
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
    expect(bytes.length).toBeGreaterThan(5000);

    // SMS (invoice has a phone)
    await panel.getByRole("button", { name: "SMS" }).click();
    await expect(page.getByRole("status")).toContainText(/SMS|log/i);
    await shot(page, "billing-saved-invoice");

    // Close panel
    await panel.getByRole("button", { name: "Close" }).click();
    await expect(panel).toHaveCount(0);
  });

  test("paid walk-in bill: full payment, SMS disabled without phone, stock via api", async ({ page, api, uid }) => {
    const a = await seedProduct(api, uid, "A");
    await page.goto("/sales"); // the /sales route renders the same billing screen
    await expect(page.getByRole("heading", { name: "Sales & Billing" })).toBeVisible();
    await addMedicine(page, a, 7, "tablet");
    await expect(page.getByTestId("sum-grand")).toHaveText(inr(78.4));
    await page.getByRole("button", { name: "Save Bill" }).dblclick(); // a double click must save one bill only
    await expect(page.getByRole("status")).toContainText(/saved/);
    const panel = page.getByRole("region", { name: "Saved invoice" });
    await expect(panel).toContainText("Walk-in");
    await expect(panel.getByRole("button", { name: "SMS" })).toBeDisabled();
    await expect(panel).not.toContainText("Balance due:");
    const prod = await api.get(`/api/products/${a.productId}`);
    expect(prod.json.quantity).toBe(73);
  });

  test("validation: credit needs customer, bad quantities, out of stock disabled, nothing to save", async ({ page, api, uid }) => {
    const a = await seedProduct(api, uid, "A");
    const empty = await seedProduct(api, uid, "Z", { withStock: false });
    await openBilling(page);

    await expect(page.getByRole("button", { name: "Save Bill" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Add Item" })).toBeDisabled();

    // Out-of-stock product is listed but cannot be chosen
    await page.getByLabel("Medicine search").fill(empty.name);
    const opt = medOption(page, empty);
    await expect(opt).toBeVisible();
    await expect(opt).toBeDisabled();
    await expect(opt).toContainText("out of stock", { ignoreCase: true });

    await pickMedicine(page, a);
    for (const bad of ["0", "-2", "", "1.5"]) {
      await page.getByLabel("Quantity").fill(bad);
      await expect(page.getByTestId("price-preview")).toHaveText("…");
      await page.getByRole("button", { name: "Add Item" }).click();
      await expect(page.getByRole("status")).toHaveText("Enter a whole quantity greater than zero.");
      await expect(cartEmpty(page)).toContainText("Add medicines to start billing.");
    }

    await page.getByLabel("Quantity").fill("1");
    await page.getByRole("button", { name: "Add Item" }).click();
    await expect(itemRow(page, a)).toContainText("10 units");
    await expect(page.getByRole("status")).toHaveCount(0);

    // Part payment without a customer is blocked with a clear message
    await page.getByLabel("Amount received").fill("50");
    await expect(page.getByTestId("sum-due")).toHaveText(inr(62));
    await page.getByRole("button", { name: "Save Bill" }).click();
    await expect(page.getByRole("status")).toHaveText("Enter the customer's name to record a part-paid (credit) bill.");
    const prod = await api.get(`/api/products/${a.productId}`);
    expect(prod.json.quantity).toBe(80); // nothing sold
    await shot(page, "billing-validation");
  });

  test("barcode Find + Enter, company filter, F1 / Ctrl+K focus, Clear resets", async ({ page, api, uid }) => {
    const a = await seedProduct(api, uid, "A");
    const b = await seedProduct(api, uid, "B");
    await openBilling(page);

    // Barcode via Find button
    await page.getByLabel("Barcode").fill(a.barcode);
    await page.getByRole("button", { name: "Find", exact: true }).click();
    await expect(medOption(page, a)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Barcode")).toHaveValue("");
    // Barcode via Enter key
    await page.getByLabel("Barcode").fill(b.barcode);
    await page.getByLabel("Barcode").press("Enter");
    await expect(medOption(page, b)).toHaveAttribute("aria-selected", "true");
    await expect(medOption(page, a)).toHaveAttribute("aria-selected", "false");

    // Company filter (no name typed) lists only that company's medicines
    await page.getByLabel("Company filter").fill(a.company);
    const options = page.getByRole("listbox", { name: "Select medicine" }).getByRole("option");
    await expect(options).toHaveCount(1);
    await expect(options.first()).toContainText(a.name);
    // Company filter + name search combine
    await page.getByLabel("Medicine search").fill(`QA Med ${uid}`);
    await expect(options).toHaveCount(1);
    await page.getByLabel("Company filter").fill("");
    await expect(options).toHaveCount(2);

    // Keyboard shortcuts focus the medicine search
    await page.getByLabel("Customer name").click();
    await page.keyboard.press("F1");
    await expect(page.getByLabel("Medicine search")).toBeFocused();
    await page.getByLabel("Customer name").click();
    await page.keyboard.press("Control+k");
    await expect(page.getByLabel("Medicine search")).toBeFocused();

    // Clear resets the whole bill
    await page.getByLabel("Customer name").fill(`QA Clear ${uid}`);
    await addMedicine(page, a, 1, "strip");
    await page.getByLabel("Discount %").fill("5");
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(cartEmpty(page)).toContainText("Add medicines to start billing.");
    await expect(page.getByLabel("Customer name")).toHaveValue("");
    await expect(page.getByLabel("Discount %")).toHaveValue("");
    await expect(page.getByLabel("Medicine search")).toHaveValue("");
    await expect(page.getByTestId("sum-grand")).toHaveText("—");
  });

  test("unknown barcode shows a visible message", async ({ page, monitor, uid }) => {
    monitor.allow(/http 404 GET \/api\/sales\/barcode/);
    monitor.allow(/status of 404/);
    await openBilling(page);
    await page.getByLabel("Barcode").fill(`NOPE${uid}`);
    await page.getByLabel("Barcode").press("Enter");
    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByRole("status")).not.toBeEmpty();
  });

  for (const vp of [
    { w: 1920, h: 1080 },
    { w: 1366, h: 768 },
    { w: 768, h: 1024 },
    { w: 390, h: 844 },
  ]) {
    test(`responsive ${vp.w}x${vp.h}: no overflow, readable left column, dosage controls not clipped`, async ({ page, api, uid }) => {
      const a = await seedProduct(api, uid, "A");
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto("/billing");
      await expect(page.getByRole("heading", { name: "Sales & Billing" })).toBeVisible();
      await addMedicine(page, a, 2, "strip");
      await expect(page.getByTestId("sum-grand")).toHaveText(inr(224));
      expect(await noHorizontalOverflow(page)).toBe(true);

      // Customer & payment column (Bill summary) is never squeezed
      const left = await page.locator(".bill-summary").boundingBox();
      expect(left.width).toBeGreaterThanOrEqual(Math.min(340, vp.w - 40));

      // Medicine search is styled like the other inputs
      const searchStyle = await page.getByLabel("Medicine search").evaluate((el) => {
        const cs = getComputedStyle(el);
        return { radius: cs.borderRadius, pad: cs.paddingLeft, w: el.getBoundingClientRect().width, parent: el.parentElement.getBoundingClientRect().width };
      });
      expect(searchStyle.radius).toBe("12px");
      expect(searchStyle.pad).toBe("14px");
      expect(searchStyle.w).toBeGreaterThan(searchStyle.parent - 2);

      // Checkbox boxes do not overlap the next label
      const boxes = await page.locator(".dose-grid .chk").evaluateAll((labels) =>
        labels.map((l) => {
          const cb = l.querySelector("input").getBoundingClientRect();
          const lb = l.getBoundingClientRect();
          return { cbRight: cb.right, lbRight: lb.right, overflow: l.scrollWidth > l.clientWidth + 1 };
        })
      );
      for (const b of boxes) {
        expect(b.overflow).toBe(false);
        expect(b.cbRight).toBeLessThanOrEqual(b.lbRight);
      }
      // Before/After food select shows its full text
      const food = await page.getByLabel("Before / After food").boundingBox();
      expect(food.width).toBeGreaterThanOrEqual(130);
      // Hints don't wrap word by word: hint has at least 120px
      const hint = await page.getByText("Leave blank for a walk-in sale").boundingBox();
      expect(hint.height).toBeLessThan(40);

      // The items table scrolls inside its wrapper, not the page
      const wrap = await page.locator(".items-wrap").evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, ov: getComputedStyle(el).overflowX }));
      expect(["auto", "scroll"]).toContain(wrap.ov);
      for (const name of ["Save Bill", "Clear", "Add Item"]) {
        await expect(page.getByRole("button", { name })).toBeVisible();
      }
      await shot(page, `billing-${vp.w}x${vp.h}`);

      // Saved invoice panel fits too
      await page.getByRole("button", { name: "Save Bill" }).click();
      await expect(page.getByRole("region", { name: "Saved invoice" })).toBeVisible();
      expect(await noHorizontalOverflow(page)).toBe(true);
      await shot(page, `billing-invoice-${vp.w}x${vp.h}`);
    });
  }
});
