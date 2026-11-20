import { test, expect, request } from "@playwright/test";
import fs from "node:fs";
import { createSign } from "node:crypto";

/**
 * Live API end-to-end against the running backend jar (HTTP -> Spring Security JWT verification -> services -> H2).
 * Tokens are RS256 JWTs signed by e2e/test-issuer.mjs; the backend must be started with
 *   CLERK_JWKS_URI=http://localhost:9999/.well-known/jwks.json CLERK_ISSUER=http://localhost:9999
 */
const API = process.env.E2E_API_URL || "http://localhost:8081";
const KEY_FILE = "e2e-artifacts/test-issuer-key.pem";
const RUN = Date.now().toString().slice(-6);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

function jwt(claims = {}) {
  const now = Math.floor(Date.now() / 1000);
  const body = { iss: "http://localhost:9999", sub: "user_e2e", azp: "http://localhost:5173", iat: now, nbf: now - 5, exp: now + 600, ...claims };
  const input = `${b64({ alg: "RS256", typ: "JWT", kid: "e2e-key" })}.${b64(body)}`;
  const sig = createSign("RSA-SHA256").update(input).sign(fs.readFileSync(KEY_FILE)).toString("base64url");
  return `${input}.${sig}`;
}

const iso = (d) => d.toISOString().slice(0, 10);
const days = (n) => new Date(Date.now() + n * 864e5);

test.describe.serial("API end-to-end (real server, real JWT verification)", () => {
  test.skip(!fs.existsSync(KEY_FILE), "Start e2e/test-issuer.mjs first");
  let api;
  const ctx = {};

  test.beforeAll(async () => {
    api = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${jwt()}` } });
  });

  const json = async (r) => (r.status() === 204 ? null : r.json());

  test("security: missing, forged, expired, wrong-issuer and wrong-origin tokens are rejected", async () => {
    const anon = await request.newContext({ baseURL: API });
    expect((await anon.get("/api/health")).status()).toBe(200);
    expect((await anon.get("/api/products")).status()).toBe(401);
    const bad = async (token) => (await anon.get("/api/products", { headers: { Authorization: `Bearer ${token}` } })).status();
    const good = jwt();
    expect(await bad(good.slice(0, -4) + "AAAA")).toBe(401); // tampered signature
    expect(await bad(jwt({ exp: Math.floor(Date.now() / 1000) - 120 }))).toBe(401);
    expect(await bad(jwt({ iss: "https://attacker.example" }))).toBe(401);
    expect(await bad(jwt({ azp: "https://evil.example" }))).toBe(401);
    expect(await bad(good)).toBe(200);
  });

  test("medicine: add, edit, search", async () => {
    let r = await api.post("/api/products", { data: {
      name: `E2E Paracip ${RUN}`, genericName: "Paracetamol", company: "E2E Labs", hsnCode: "30049099",
      stripSize: 10, dosageForm: "Tablet", unitType: "Strip", reorderLevel: 20, price: 112, gstRate: 12 } });
    expect(r.status()).toBe(201);
    const p = await json(r);
    ctx.productId = p.productId;
    r = await api.put(`/api/products/${p.productId}`, { data: { ...p, company: "E2E Laboratories" } });
    expect((await json(r)).company).toBe("E2E Laboratories");
    r = await api.get("/api/products", { params: { search: `Paracip ${RUN}` } });
    expect((await json(r)).map((x) => x.productId)).toEqual([p.productId]);
  });

  test("customer and supplier", async () => {
    let r = await api.post("/api/customers", { data: { name: `E2E Customer ${RUN}`, contactNumber: "9876543210" } });
    expect(r.status()).toBe(201);
    ctx.customerId = (await json(r)).customerId;
    r = await api.post("/api/suppliers", { data: { name: `E2E Supplier ${RUN}`, gstIn: "27ABCDE1234F1Z5" } });
    expect(r.status()).toBe(201);
    ctx.supplierId = (await json(r)).supplierId;
  });

  test("purchase order -> receive stock -> inventory and ledger increase", async () => {
    let r = await api.post("/api/purchases/order", { data: { supplierId: ctx.supplierId, invoiceNumber: `PO-${RUN}` } });
    const po = await json(r);
    expect(po.status).toBe("PENDING");
    r = await api.post("/api/purchases/receive", { data: { supplierId: ctx.supplierId, purchaseInvoiceId: po.invoiceId,
      batchItems: [
        { productId: ctx.productId, batchNumber: `LATE${RUN}`, mfgDate: iso(days(-30)), expiryDate: iso(days(500)), mrp: 120, costPrice: 80, sellingPrice: 112, stripQuantity: 8 },
        { productId: ctx.productId, batchNumber: `SOON${RUN}`, mfgDate: iso(days(-30)), expiryDate: iso(days(45)), mrp: 120, costPrice: 80, sellingPrice: 112, stripQuantity: 2 },
      ] } });
    expect(r.status()).toBe(201);
    expect((await json(r)).totalAmount).toBe(800);
    expect((await api.post("/api/purchases/receive", { data: { supplierId: ctx.supplierId, purchaseInvoiceId: po.invoiceId,
      batchItems: [{ productId: ctx.productId, batchNumber: "X", mfgDate: iso(days(-1)), expiryDate: iso(days(90)), mrp: 1, costPrice: 1, sellingPrice: 1, stripQuantity: 1 }] } })).status()).toBe(409);
    expect((await json(await api.get(`/api/products/${ctx.productId}`))).quantity).toBe(100);
    expect((await json(await api.get(`/api/suppliers/${ctx.supplierId}`))).ledgerBalance).toBe(800);
  });

  test("bill: quote equals saved bill, FEFO, inclusive GST, stock decreases, invoice detail", async () => {
    const cart = { customerName: `E2E Customer ${RUN}`, contactNumber: "9876543210", paymentMethod: "UPI",
      lineItems: [{ productId: ctx.productId, quantitySoldTablets: 25, morning: true, afterFood: true, durationDays: 5 }] };
    const quote = await json(await api.post("/api/sales/quote", { data: cart }));
    const r = await api.post("/api/sales/bill", { data: cart });
    expect(r.status()).toBe(201);
    const inv = await json(r);
    expect(inv.grandTotal).toBe(quote.grandTotal);
    expect(inv.grandTotal).toBe(280);
    expect(inv.totalTaxableAmount).toBe(250);
    expect(inv.totalCgst).toBe(15);
    expect(inv.totalSgst).toBe(15);
    expect(inv.items.map((i) => [i.batchNumber, i.quantityTablets])).toEqual([[`SOON${RUN}`, 20], [`LATE${RUN}`, 5]]);
    expect(inv.customerId).toBe(ctx.customerId); // matched existing customer by name + phone
    expect(inv.paymentStatus).toBe("PAID");
    ctx.invoiceId = inv.invoiceId;
    expect((await json(await api.get(`/api/products/${ctx.productId}`))).quantity).toBe(75);
    const detail = await json(await api.get(`/api/sales/invoices/${inv.invoiceId}`));
    expect(detail.items[0].morning).toBe(true);
  });

  test("bad bills are rejected and change nothing", async () => {
    const before = (await json(await api.get(`/api/products/${ctx.productId}`))).quantity;
    expect((await api.post("/api/sales/bill", { data: { lineItems: [{ productId: ctx.productId, quantitySoldTablets: -500 }] } })).status()).toBe(400);
    expect((await api.post("/api/sales/bill", { data: { lineItems: [] } })).status()).toBe(400);
    const r = await api.post("/api/sales/bill", { data: { lineItems: [{ productId: ctx.productId, quantitySoldTablets: 9999 }] } });
    expect(r.status()).toBe(409);
    expect((await json(r)).message).toContain("Insufficient stock");
    expect((await json(await api.get(`/api/products/${ctx.productId}`))).quantity).toBe(before);
  });

  test("credit sale -> record payment -> no overpayment -> history", async () => {
    let inv = await json(await api.post("/api/sales/bill", { data: { customerId: ctx.customerId, amountPaid: 50,
      lineItems: [{ productId: ctx.productId, quantitySoldTablets: 10 }] } }));
    expect(inv.balanceDue).toBe(62);
    expect((await api.post("/api/payments/record", { data: { invoiceId: inv.invoiceId, amount: 100 } })).status()).toBe(400);
    expect((await json(await api.post("/api/payments/record", { data: { invoiceId: inv.invoiceId, paymentMethod: "Cash" } }))).amountPaid).toBe(62);
    expect((await api.post("/api/payments/record", { data: { invoiceId: inv.invoiceId } })).status()).toBe(409);
    const pays = await json(await api.get(`/api/customers/${ctx.customerId}/payments`));
    expect(pays.length).toBe(3);
    const cust = await json(await api.get(`/api/customers/${ctx.customerId}`));
    expect(cust.remainingBalance).toBe(0);
    expect(cust.totalSpend).toBe(392);
  });

  test("razorpay: disabled without keys, mock signature rejected", async () => {
    expect((await json(await api.get("/api/payments/config"))).configured).toBe(false);
    expect((await api.post("/api/payments/create-order", { data: { invoiceId: ctx.invoiceId } })).status()).toBe(503);
    expect((await api.post("/api/payments/verify-payment", { data: { razorpay_order_id: "order_mock_1",
      razorpay_payment_id: "pay_x", razorpay_signature: "mock_signature_dev" } })).status()).toBe(404);
  });

  test("expiry alerts, supplier return and write-off", async () => {
    const near = await json(await api.get("/api/inventory/near-expiry"));
    const soon = near.find((b) => b.batchNumber === `SOON${RUN}`);
    // SOON batch was fully sold by FEFO, so it is no longer in the near-expiry stock list
    expect(soon).toBeUndefined();
    const stock = await json(await api.get("/api/inventory/stock-list"));
    const late = stock.find((b) => b.batchNumber === `LATE${RUN}`);
    expect(late.supplierName).toBe(`E2E Supplier ${RUN}`);
    let r = await api.post("/api/inventory/returns", { data: { batchId: late.batchId, strips: 1 } });
    expect((await json(r)).creditValue).toBe(80);
    r = await api.post(`/api/inventory/batches/${late.batchId}/write-off`, { data: { units: 5, reason: "damaged" } });
    expect((await json(r)).unitsWrittenOff).toBe(5);
    expect((await json(await api.get(`/api/products/${ctx.productId}`))).quantity).toBe(50);
    const alerts = await json(await api.get("/api/notifications/alerts"));
    expect(Array.isArray(alerts.expired)).toBe(true);
  });

  test("reports and analytics use real data", async () => {
    for (const path of ["daily", "monthly", "yearly", "stock", "expiry", "profit-loss", "purchases", "medicines", `customer/${ctx.customerId}`]) {
      const r = await api.get(`/api/reports/${path}`);
      expect(r.status(), path).toBe(200);
      expect(r.headers()["content-type"]).toContain("application/pdf");
      expect((await r.body()).subarray(0, 4).toString()).toBe("%PDF");
    }
    const gst = await (await api.get("/api/reports/gst/monthly")).text();
    expect(gst).toContain("Invoice");
    const dash = await json(await api.get("/api/analytics/dashboard"));
    expect(dash.todayRevenue).toBeGreaterThanOrEqual(392);
    const acc = await json(await api.get("/api/accounting/summary", { params: { period: "today" } }));
    expect(acc.totalGst).toBeCloseTo(acc.totalCgst + acc.totalSgst, 2);
    expect(acc.profit).toBeCloseTo(acc.totalTaxable - acc.totalCost, 2);
  });

  test("delete rules protect history", async () => {
    expect((await api.delete(`/api/products/${ctx.productId}`)).status()).toBe(409);
    expect((await api.delete(`/api/customers/${ctx.customerId}`)).status()).toBe(409);
    const tmp = await json(await api.post("/api/customers", { data: { name: `E2E Temp ${RUN}` } }));
    expect((await api.delete(`/api/customers/${tmp.customerId}`)).status()).toBe(204);
  });
});
