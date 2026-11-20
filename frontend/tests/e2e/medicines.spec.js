import { test, expect, noHorizontalOverflow, shot } from "./fixtures";

const iso = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

async function openCatalog(page) {
  await page.goto("/product-master");
  await expect(page.getByRole("heading", { name: "Medicine Catalog & Pricing" })).toBeVisible();
  await expect(page.getByText(/Medicine Catalog \(\d+ records\)/)).toBeVisible();
}

async function openAddForm(page) {
  await page.getByRole("button", { name: "Add Medicine" }).first().click();
  const dlg = page.getByRole("dialog", { name: "Add New Medicine" });
  await expect(dlg).toBeVisible();
  return dlg;
}

async function fillBasics(dlg, { name, company = "QA Pharma", generic = "Paracetamol", hsn = "30049099", strip = "10", gst = "12", price = "112" }) {
  await dlg.getByLabel("Medicine Name").fill(name);
  await dlg.getByLabel("Company / Manufacturer").fill(company);
  await dlg.getByLabel("Generic Name").fill(generic);
  await dlg.getByLabel("HSN Code").fill(hsn);
  await dlg.getByLabel("Units per Pack").fill(strip);
  await dlg.getByLabel("GST Rate").selectOption(gst);
  await dlg.getByLabel("Selling Price per Pack").fill(price);
}

async function fillOpening(dlg, { qty = "50", batch, mfg = daysFromNow(-60), exp = daysFromNow(600), mrp = "120", cost = "80" }) {
  await dlg.getByLabel("Opening Quantity (units)").fill(qty);
  if (batch) await dlg.getByLabel("Batch Number").fill(batch);
  await dlg.getByLabel("Mfg Date").fill(mfg);
  await dlg.getByLabel("Expiry Date").fill(exp);
  await dlg.getByLabel("MRP per Pack").fill(mrp);
  if (cost !== null) await dlg.getByLabel("Cost Price per Pack").fill(cost);
}

async function findProduct(api, name) {
  const r = await api.get(`/api/products?search=${encodeURIComponent(name)}`);
  expect(r.status).toBe(200);
  return (r.json || []).find((p) => p.name === name) || null;
}

async function searchCatalog(page, q) {
  await page.getByLabel("Search medicines catalog").fill(q);
}

const row = (page, name) => page.locator("tbody tr").filter({ hasText: name });

test.describe("Medicines / Product Master", () => {
  test("add medicine with opening stock, persists, search, edit keeps stock & unitType", async ({ page, monitor, api, uid }) => {
    const name = `QA Med ${uid}`;
    await openCatalog(page);
    const dlg = await openAddForm(page);
    await fillBasics(dlg, { name });
    await fillOpening(dlg, { batch: `B${uid}` });
    await expect(dlg.getByText(/Estimated margin/)).toBeVisible();
    await dlg.getByRole("button", { name: "Add Medicine" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Medicine added with opening stock." })).toBeVisible();
    await expect(dlg).toBeHidden();

    await searchCatalog(page, name);
    await expect(row(page, name)).toHaveCount(1);
    await expect(row(page, name).locator(".pm-stock-qty")).toHaveText("50");
    await expect(row(page, name)).toContainText("QA Pharma");

    // DB
    const p = await findProduct(api, name);
    expect(p).toBeTruthy();
    expect(p.quantity).toBe(50);
    expect(Number(p.price)).toBe(112);
    expect(Number(p.gstRate)).toBe(12);
    expect(p.unitType).toBe("Strip");
    const summary = (await api.get("/api/inventory/stock-summary")).json.find((s) => s.productId === p.productId);
    expect(summary.saleableUnits).toBe(50);
    const batches = (await api.get("/api/inventory/stock-list")).json.filter((b) => b.product?.productId === p.productId);
    expect(batches).toHaveLength(1);
    expect(batches[0].batchNumber).toBe(`B${uid}`);
    expect(Number(batches[0].mrp)).toBe(120);
    expect(Number(batches[0].costPrice)).toBe(80);

    // refresh persists
    await page.reload();
    await expect(page.getByText(/Medicine Catalog \(\d+ records\)/)).toBeVisible();
    await searchCatalog(page, uid);
    await expect(row(page, name)).toHaveCount(1);
    await shot(page, "medicines-added");

    // edit: company + GST 5
    await row(page, name).getByRole("button", { name: `Edit ${name}` }).click();
    const edit = page.getByRole("dialog", { name: "Edit Medicine" });
    await expect(edit).toBeVisible();
    await expect(edit.getByLabel("Medicine Name")).toHaveValue(name);
    await expect(edit.getByLabel("Pack Type")).toHaveValue("Strip");
    await expect(edit.getByText("50 saleable units")).toBeVisible();
    await edit.getByLabel("Company / Manufacturer").fill("QA Pharma Edited");
    await edit.getByLabel("GST Rate").selectOption("5");
    await edit.getByRole("button", { name: "Update Medicine" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Medicine updated successfully." })).toBeVisible();
    await expect(row(page, name)).toContainText("QA Pharma Edited");
    await expect(row(page, name)).toContainText("5%");
    await expect(row(page, name).locator(".pm-stock-qty")).toHaveText("50");

    // Detail view lists the product's batches from the stock list
    await row(page, name).getByRole("button", { name: `View ${name}` }).click();
    const det = page.getByRole("dialog", { name });
    await expect(det).toBeVisible();
    await expect(det.locator(".pm-batch-table tbody tr")).toHaveCount(1);
    await expect(det.locator(".pm-batch-table tbody tr")).toContainText(`B${uid}`);
    await expect(det.locator(".pm-batch-table tbody tr")).toContainText("50");
    await expect(det.locator(".pm-batch-table tbody tr")).toContainText("₹120.00");
    await expect(det.locator(".pm-batch-table tbody tr")).toContainText("₹80.00");
    await det.getByRole("button", { name: "Close", exact: true }).click();
    await expect(det).toBeHidden();

    const p2 = (await api.get(`/api/products/${p.productId}`)).json;
    expect(p2.company).toBe("QA Pharma Edited");
    expect(Number(p2.gstRate)).toBe(5);
    expect(p2.quantity).toBe(50);
    expect(p2.unitType).toBe("Strip");
    expect(p2.genericName).toBe("Paracetamol");
    expect(p2.hsnCode).toBe("30049099");
  });

  test("validation errors are shown and nothing is saved; Cancel closes without saving", async ({ page, monitor, api, uid }) => {
    const name = `QA Med Invalid ${uid}`;
    const existing = (await api.get("/api/products")).json[0];
    await openCatalog(page);
    const dlg = await openAddForm(page);
    const submit = dlg.getByRole("button", { name: "Add Medicine" });
    const err = dlg.getByRole("alert");

    // all empty
    await dlg.getByLabel("HSN Code").fill("");
    await submit.click();
    await expect(err).toHaveText(/Medicine name is required/);
    await dlg.getByLabel("Medicine Name").fill(name);
    await submit.click();
    await expect(err).toHaveText(/HSN code is required/);
    await dlg.getByLabel("HSN Code").fill("30049099");
    await submit.click();
    await expect(err).toHaveText(/Selling price must be greater than 0/);
    await dlg.getByLabel("Selling Price per Pack").fill("0");
    await submit.click();
    await expect(err).toHaveText(/Selling price must be greater than 0/);
    await dlg.getByLabel("Selling Price per Pack").fill("-5");
    await submit.click();
    await expect(err).toHaveText(/Selling price must be greater than 0/);
    await dlg.getByLabel("Units per Pack").fill("0");
    await dlg.getByLabel("Selling Price per Pack").fill("50");
    await submit.click();
    await expect(err).toHaveText(/Units per pack must be greater than 0/);
    await dlg.getByLabel("Units per Pack").fill("10");

    // opening stock rules
    await fillOpening(dlg, { qty: "20", mrp: "40", cost: "30" });
    await submit.click();
    await expect(err).toHaveText(/Selling price cannot be more than MRP/);
    await dlg.getByLabel("MRP per Pack").fill("60");
    await dlg.getByLabel("Expiry Date").fill(daysFromNow(-5));
    await submit.click();
    await expect(err).toHaveText(/Expiry date must be in the future/);
    await dlg.getByLabel("Expiry Date").fill(daysFromNow(400));
    await dlg.getByLabel("Cost Price per Pack").fill("");
    await submit.click();
    await expect(err).toHaveText(/Cost price per pack is required/);
    await dlg.getByLabel("Cost Price per Pack").fill("30");

    // duplicate of an existing medicine name (case-insensitive)
    await dlg.getByLabel("Medicine Name").fill(existing.name.toUpperCase());
    await submit.click();
    await expect(err).toHaveText(/already exists/);
    await shot(page, "medicines-validation");

    // Cancel closes without saving
    await dlg.getByLabel("Medicine Name").fill(name);
    await dlg.getByRole("button", { name: "Cancel" }).click();
    await expect(dlg).toBeHidden();
    expect(await findProduct(api, name)).toBeNull();

    // X close as well
    const dlg2 = await openAddForm(page);
    await expect(dlg2.getByLabel("Medicine Name")).toHaveValue("");
    await dlg2.getByLabel("Medicine Name").fill(name);
    await dlg2.getByRole("button", { name: "Close" }).click();
    await expect(dlg2).toBeHidden();
    expect(await findProduct(api, name)).toBeNull();
  });

  test("server-side duplicate check also blocks (case/whitespace variant)", async ({ page, monitor, api, uid }) => {
    // Create via API, then try to add the same name in the UI before the list knows about it
    const name = `QA Med Dup ${uid}`;
    await openCatalog(page);
    const created = await api.post("/api/products", { name, hsnCode: "30049099", stripSize: 10, price: 10 });
    expect(created.status).toBe(201);
    monitor.allow(/http 409 POST \/api\/products/);
    monitor.allow(/status of 409/);
    const dlg = await openAddForm(page);
    await fillBasics(dlg, { name: `  ${name}  `, price: "10" });
    await dlg.getByRole("button", { name: "Add Medicine" }).click();
    await expect(dlg.getByRole("alert")).toContainText(/already exists/);
    const all = (await api.get(`/api/products?search=${encodeURIComponent(name)}`)).json.filter((p) => p.name === name);
    expect(all).toHaveLength(1);
    await dlg.getByRole("button", { name: "Cancel" }).click();
    await api.del(`/api/products/${created.json.productId}`);
  });

  test("delete medicine without stock; delete with stock is blocked with server message", async ({ page, monitor, api, uid }) => {
    const plain = `QA Med NoStock ${uid}`;
    const stocked = `QA Med Stocked ${uid}`;
    await openCatalog(page);
    // create both through the UI
    let dlg = await openAddForm(page);
    await fillBasics(dlg, { name: plain, price: "20" });
    await dlg.getByRole("button", { name: "Add Medicine" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Medicine added successfully." })).toBeVisible();
    dlg = await openAddForm(page);
    await fillBasics(dlg, { name: stocked, price: "20" });
    await fillOpening(dlg, { qty: "10", mrp: "25", cost: "15" });
    await dlg.getByRole("button", { name: "Add Medicine" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Medicine added with opening stock." })).toBeVisible();

    const pPlain = await findProduct(api, plain);
    const pStocked = await findProduct(api, stocked);
    expect(pPlain.quantity).toBe(0);
    expect(pStocked.quantity).toBe(10);

    await searchCatalog(page, uid);
    await expect(page.locator("tbody tr")).toHaveCount(2);

    // dismissing the confirm keeps it
    page.once("dialog", (d) => d.dismiss());
    await row(page, plain).getByRole("button", { name: `Delete ${plain}` }).click();
    await expect(row(page, plain)).toHaveCount(1);
    expect((await api.get(`/api/products/${pPlain.productId}`)).status).toBe(200);

    // accept -> gone
    page.once("dialog", (d) => d.accept());
    await row(page, plain).getByRole("button", { name: `Delete ${plain}` }).click();
    await expect(page.getByRole("status").filter({ hasText: `"${plain}" deleted.` })).toBeVisible();
    await expect(row(page, plain)).toHaveCount(0);
    monitor.allow(/http 404 GET \/api\/products\/\d+/);
    expect((await api.get(`/api/products/${pPlain.productId}`)).status).toBe(404);

    // with stock -> 409 message
    monitor.allow(/http 409 DELETE \/api\/products/);
    monitor.allow(/status of 409/);
    page.once("dialog", (d) => d.accept());
    await row(page, stocked).getByRole("button", { name: `Delete ${stocked}` }).click();
    await expect(page.getByRole("alert").filter({ hasText: /has inventory batches/ })).toBeVisible();
    await expect(row(page, stocked)).toHaveCount(1);
    expect((await api.get(`/api/products/${pStocked.productId}`)).status).toBe(200);
    await shot(page, "medicines-delete-blocked");
  });

  test("navbar search, ?search= param, /add-medicine and /medicines routes", async ({ page, monitor, api }) => {
    const any = (await api.get("/api/products")).json.find((p) => p.name && p.name.length > 4);
    await page.goto("/dashboard");
    await page.getByRole("searchbox", { name: "Search medicines", exact: true }).fill(any.name);
    await page.getByRole("searchbox", { name: "Search medicines", exact: true }).press("Enter");
    await expect(page).toHaveURL(/\/product-master\?search=/);
    await expect(page.getByLabel("Search medicines catalog")).toHaveValue(any.name);
    await expect(row(page, any.name).first()).toBeVisible();

    await page.goto(`/product-master?search=${encodeURIComponent("zzzz-no-such-medicine")}`);
    await expect(page.locator("td.dt-empty")).toHaveText("No results found.");

    await page.goto("/medicines");
    await expect(page.getByRole("heading", { name: "Medicine Catalog & Pricing" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.goto("/add-medicine");
    await expect(page.getByRole("dialog", { name: "Add New Medicine" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("filters, sorting and pagination", async ({ page, monitor, api }) => {
    await openCatalog(page);
    // Other QA agents create data concurrently: refresh until UI and API snapshots agree.
    const refresh = async () => {
      await page.getByRole("button", { name: "Refresh" }).click();
      await expect(page.getByText(/Medicine Catalog \(\d+ records\)/)).toBeVisible();
    };
    const counts = async () => {
      const summary = (await api.get("/api/inventory/stock-summary")).json;
      const total = (await api.get("/api/products")).json.length;
      const c = (st) => summary.filter((x) => x.status === st).length;
      return { total, in: c("in_stock"), low: c("low_stock"), out: c("out_of_stock") };
    };
    let total = 0;
    await expect(async () => {
      await refresh();
      const c = await counts();
      total = c.total;
      await expect(page.getByText(`Medicine Catalog (${c.total} records)`)).toBeVisible({ timeout: 1000 });
      await expect(page.locator(".pm-stat-blue .pm-stat-val")).toHaveText(String(c.total), { timeout: 1000 });
      await expect(page.locator(".pm-stat-green .pm-stat-val")).toHaveText(String(c.in), { timeout: 1000 });
      await expect(page.locator(".pm-stat-amber .pm-stat-val")).toHaveText(String(c.low), { timeout: 1000 });
      await expect(page.locator(".pm-stat-red .pm-stat-val")).toHaveText(String(c.out), { timeout: 1000 });
    }).toPass({ timeout: 60_000 });

    // pagination
    const pager = page.locator(".dt-page");
    await expect(pager).toContainText(/Page 1 \/ \d+/);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(pager).toContainText("Page 2 /");
    await page.getByRole("button", { name: "Last" }).click();
    await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
    await page.getByRole("button", { name: "First" }).click();
    await expect(pager).toContainText("Page 1 /");
    await page.locator(".dt-page-size select").selectOption("50");
    await expect(page.locator("tbody tr")).toHaveCount(Math.min(50, total));

    // sort by medicine name descending
    await page.locator("th", { hasText: "Medicine" }).click();
    await page.locator("th", { hasText: "Medicine" }).click();
    const names = await page.locator("tbody tr .pm-name").allInnerTexts();
    const sorted = [...names].sort((a, b) => b.localeCompare(a));
    expect(names).toEqual(sorted);

    // stock filters match stock-summary
    for (const [val, key] of [["out_of_stock", "out"], ["low_stock", "low"], ["in_stock", "in"]]) {
      await page.getByTestId(`stock-chip-${val}`).click(); // stock filter chips (redesign)
      await expect(page.getByTestId(`stock-chip-${val}`)).toHaveAttribute("aria-pressed", "true");
      await expect(async () => {
        await refresh();
        const c = await counts();
        await expect(page.getByText(`Medicine Catalog (${c[key]} records)`)).toBeVisible({ timeout: 1000 });
      }).toPass({ timeout: 60_000 });
    }
    await page.getByTestId("stock-chip-all").click();

    // company filter
    const company = (await api.get("/api/products")).json.find((p) => p.company)?.company;
    await page.getByLabel("Filter by company").selectOption(company);
    const companies = await page.locator("tbody tr .pm-company").allInnerTexts();
    expect(companies.length).toBeGreaterThan(0);
    for (const c of companies) expect(c).toBe(company);
  });

  for (const [w, h] of [[1920, 1080], [1366, 768], [768, 1024], [390, 844]]) {
    test(`responsive ${w}x${h}: catalog and add form`, async ({ page, monitor }) => {
      await page.setViewportSize({ width: w, height: h });
      await openCatalog(page);
      expect(await noHorizontalOverflow(page)).toBe(true);
      await shot(page, `medicines-${w}x${h}`);
      const dlg = await openAddForm(page);
      expect(await noHorizontalOverflow(page)).toBe(true);
      const box = await dlg.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(-1); // sub-pixel tolerance, same as noHorizontalOverflow
      expect(box.x + box.width).toBeLessThanOrEqual(w + 1);
      // submit button reachable
      await dlg.getByRole("button", { name: "Add Medicine" }).scrollIntoViewIfNeeded();
      await expect(dlg.getByRole("button", { name: "Add Medicine" })).toBeInViewport();
      await shot(page, `medicines-form-${w}x${h}`);
      await dlg.getByRole("button", { name: "Cancel" }).click();
    });
  }
});
