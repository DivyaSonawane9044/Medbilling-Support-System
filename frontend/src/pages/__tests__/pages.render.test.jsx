// @vitest-environment jsdom
import React, { Suspense } from "react";
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// --- Clerk: a signed-in user, no network ---
vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({ isLoaded: true, isSignedIn: true, user: { firstName: "Asha", fullName: "Asha Rao", primaryEmailAddress: { emailAddress: "asha@example.com" } } }),
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
  useClerk: () => ({ signOut: vi.fn() }),
  UserButton: () => <div data-testid="user-button" />,
  SignIn: () => <div>clerk sign-in</div>,
  SignUp: () => <div>clerk sign-up</div>,
  SignedIn: ({ children }) => children,
  SignedOut: () => null,
}));

// --- API: responses shaped exactly like the backend contract ---
const product = { productId: 1, name: "Paracip 500", genericName: "Paracetamol", company: "Cipla", hsnCode: "3004", stripSize: 10,
  dosageForm: "Tablet", unitType: "Strip", reorderLevel: 20, targetStockLevel: 200, price: 112, profitMargin: 0.2, gstRate: 12,
  barcode: "B1", quantity: 70, scheduleDrugType: "OTC" };
const batch = { batchId: 5, batchNumber: "B-1", mfgDate: "2026-01-01", expiryDate: "2026-12-01", mrp: 120, costPrice: 80, sellingPrice: 112,
  supplierId: 3, supplierName: "Acme", stripStock: 7, tabletStock: 0, totalUnits: 70, isNearExpiry: true,
  product: { productId: 1, name: "Paracip 500", company: "Cipla", stripSize: 10, reorderLevel: 20 } };
// Dated today (local time) so period filters such as "today" always include it
const pad = (n) => String(n).padStart(2, "0");
const now = new Date();
const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const invoice = { invoiceId: 9, invoiceNumber: "INV-20261031-101010-001", saleDateTime: `${TODAY}T10:10:10`, grandTotal: 280,
  totalTaxableAmount: 250, totalCgst: 15, totalSgst: 15, discountPercent: 0, totalDiscount: 0, customerId: 2, customerName: "Ravi",
  itemCount: 1, amountPaid: 200, balanceDue: 80, paymentStatus: "PARTIAL" };
const customer = { customerId: 2, name: "Ravi", contactNumber: "9876500001", email: null, address: "Pune", doctorName: null,
  prescriptionImageUrl: null, remainingBalance: 80 };
const supplier = { supplierId: 3, name: "Acme", contactNumber: "99", company: "Acme Ltd", gstIn: "27ABCDE1234F1Z5", ledgerBalance: 560 };
const payment = { paymentId: 1, amountPaid: 200, paymentDate: "2026-10-31T10:10:10", paymentMethod: "Cash", paymentStatus: "SUCCESS",
  transactionReference: "SALE-1", razorpayOrderId: null, invoiceId: 9, invoiceNumber: invoice.invoiceNumber, customerName: "Ravi" };
const purchase = { invoiceId: 4, invoiceNumber: "PO-1", purchaseDate: "2026-10-30", totalAmount: 560, status: "PENDING", supplierId: 3,
  supplierName: "Acme", batchCount: 0 };
const dashboard = { todayRevenue: 280, yesterdayRevenue: 200, monthlyRevenue: 5000, monthlyProfit: 900, profit: 50, totalCost: 200,
  totalStockValueMrp: 840, totalStockValueCost: 560, nearExpiryCount: 1, lowStockCount: 0,
  bestSellingMedicines: [{ name: "Paracip 500", quantity: 25, revenue: 280 }], topCustomers: [{ name: "Ravi", totalSpend: 280 }],
  topSuppliers: [{ name: "Acme", totalPurchase: 560 }], profitLossPie: [{ name: "Cost", value: 200 }, { name: "Profit", value: 50 }],
  salesTrend: [{ date: "2026-10-30", revenue: 200 }, { date: "2026-10-31", revenue: 280 }] };
const prescription = { prescriptionId: 1, customerId: 2, customerName: "Ravi", medicineName: "Paracip 500", morning: true, afternoon: false,
  evening: false, night: true, instructions: "After food, 5 days", createdAt: "2026-10-31T10:00:00" };

const ok = (data) => vi.fn(() => Promise.resolve({ data, headers: {} }));
vi.mock("../../services/api", () => ({
  default: {},
  downloadBlob: vi.fn(),
  handleApiError: (e) => new Error(e?.message || "error"),
  analyticsAPI: { getDashboard: ok(dashboard), getStockAlerts: ok([product]), exportGstReport: ok(""), exportExpiryReport: ok("") },
  accountingAPI: { getSummary: ok({ period: "today", invoiceCount: 1, totalTaxable: 250, totalCgst: 15, totalSgst: 15, totalGst: 30, grandTotal: 280, totalCost: 200, profit: 50 }) },
  customersAPI: { getAll: ok([customer]), getById: ok({ customer, purchaseHistory: [invoice], totalSpend: 280, paymentHistory: [payment], remainingBalance: 80, prescriptions: [prescription] }),
    lookupByFirstName: ok([]), getHistory: ok([invoice]), getPayments: ok([payment]), processPayment: ok({}), create: ok(customer), update: ok(customer), delete: ok(null), savePrescriptionImage: ok(customer) },
  suppliersAPI: { getAll: ok([supplier]), getById: ok(supplier), getHistory: ok([]), create: ok(supplier), update: ok(supplier), processPayment: ok({}) },
  productsAPI: { getAll: ok([product]), search: ok([product]), getById: ok(product), create: ok(product), update: ok(product), delete: ok(null), getAlternatives: ok([]) },
  medicinesAPI: { getAll: ok([product]) },
  salesAPI: { quote: ok({ grandTotal: 112, items: [] }), createBill: ok(invoice), listInvoices: ok([invoice]), getInvoice: ok(invoice), notify: ok({}),
    quickProductSearch: ok([product]), searchByCompany: ok([product]), findByBarcode: ok(product) },
  purchasesAPI: { getAll: ok([purchase]), getPending: ok([purchase]), createOrder: ok(purchase), receiveStock: ok(purchase) },
  paymentsAPI: { getAll: ok([payment]), getConfig: ok({ configured: false, keyId: "" }), getReceipt: ok(payment), createOrder: ok({}), verifyPayment: ok(payment), reportFailure: ok({}), recordPayment: ok(payment) },
  reportsAPI: new Proxy({}, { get: () => ok(new Blob()) }),
  notificationsAPI: { getAlerts: ok({ lowStock: [product], nearExpiry: [batch], expired: [], pendingPurchases: [purchase] }) },
  prescriptionAPI: { getAll: ok([prescription]), save: ok(prescription) },
  inventoryAPI: { getAllStock: ok([batch]), getStockSummary: ok([{ productId: 1, name: "Paracip 500", company: "Cipla", unitsPerPack: 10, totalTablets: 70, saleableUnits: 70, reorderLevel: 20, status: "in_stock" }]),
    getNearExpiry: ok([batch]), getExpired: ok([]), getAgingReport: ok([batch]), processReturn: ok({}), writeOff: ok({}) },
}));

beforeAll(() => {
  // jsdom lacks these browser APIs used by Recharts / layout code
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  window.scrollTo = () => {};
});
afterEach(cleanup);

// Text from the mocked API that must appear once the page has loaded its data
const expectText = {
  Dashboard: "INV-20261031-101010-001", Billing: "Paracip 500", ProductMaster: "Paracip 500", Inventory: "B-1",
  ExpiryTracking: "B-1", MedicineSchedule: "Paracip 500", Customers: "Ravi", Suppliers: "Acme", Purchases: "PO-1",
  Reports: TODAY, Payments: "INV-20261031-101010-001", Accounting: "INV-20261031-101010-001",
  Analytics: "Ravi", Settings: "Saved in this browser", MainLayout: "Billing",
};

const pages = {
  Dashboard: () => import("../Dashboard"),
  Billing: () => import("../Billing"),
  ProductMaster: () => import("../ProductMaster"),
  Inventory: () => import("../Inventory"),
  ExpiryTracking: () => import("../ExpiryTracking"),
  MedicineSchedule: () => import("../MedicineSchedule"),
  Customers: () => import("../Customers"),
  Suppliers: () => import("../Suppliers"),
  Purchases: () => import("../Purchases"),
  Reports: () => import("../Reports"),
  Payments: () => import("../Payments"),
  Accounting: () => import("../Accounting"),
  Analytics: () => import("../Analytics"),
  Settings: () => import("../Settings"),
  MainLayout: () => import("../../layout/MainLayout"),
};

describe("every page renders with backend-shaped data", () => {
  for (const [name, load] of Object.entries(pages)) {
    it(`${name} renders without crashing or React errors`, async () => {
      const errors = [];
      const spy = vi.spyOn(console, "error").mockImplementation((...args) => errors.push(args.map(String).join(" ")));
      const { default: Page } = await load();
      render(
        <MemoryRouter>
          <Suspense fallback={null}>
            <Page />
          </Suspense>
        </MemoryRouter>
      );
      // Let the mocked requests resolve and the loading state clear
      await waitFor(() => expect(document.body.textContent).toContain(expectText[name]), { timeout: 4000 });
      await new Promise((r) => setTimeout(r, 400));
      spy.mockRestore();
      expect(screen.queryByText(/something went wrong/i)).toBeNull();
      const real = errors.filter((e) => !/width\(0\) and height\(0\)|not wrapped in act/i.test(e));
      expect(real, real.join("\n")).toEqual([]);
    });
  }
});
