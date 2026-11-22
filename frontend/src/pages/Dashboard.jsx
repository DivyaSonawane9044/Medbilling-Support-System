import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./Dashboard.css";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Banknote,
  Boxes,
  CalendarClock,
  CirclePlus,
  CreditCard,
  FileBarChart2,
  FileText,
  HandCoins,
  IndianRupee,
  PackageCheck,
  PackageSearch,
  Pill,
  Search,
  ShoppingCart,
  TriangleAlert,
  Truck,
  UserPlus,
  Users,
  Wallet,
  Receipt,
  ReceiptIndianRupee,
  Sparkles,
  Stethoscope,
  Trophy,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import {
  PageHeader,
  StatCard,
  inr,
  inr2,
  StatusBadge,
  EmptyState,
  LoadingSkeleton,
  ProgressBar,
  ChartCard,
  Timeline,
  DataTable,
  MedicalIllustration,
} from "../components/ui";
import {
  analyticsAPI,
  customersAPI,
  inventoryAPI,
  paymentsAPI,
  productsAPI,
  purchasesAPI,
  salesAPI,
  handleApiError,
} from "../services/api";
import { CHART_COLORS, axisProps, gridProps, tooltipProps, inrShort, inrFull, chartAnimation, chartSurface, chartGold } from "../utils/chartTheme";
import useSections, { isPending, asArray } from "./insights/useSections";
import SectionError from "./insights/SectionError";
import {
  num,
  money,
  units,
  parseDate,
  lastMonths,
  sumByMonth,
  daysUntil,
  formatDate,
  formatDateTime,
  prettyMethod,
  greeting,
  ymd,
  monthKey,
} from "./insights/insightsUtils";

const SECTION_LABELS = {
  dash: "Summary figures",
  invoices: "Invoices",
  products: "Medicines",
  stock: "Stock summary",
  customers: "Customers",
  purchases: "Purchases",
  payments: "Payments",
  expiry: "Near-expiry batches",
};

const inventoryColumns = [
  { key: "name", header: "Medicine" },
  { key: "company", header: "Company", cell: (value) => value || "Unknown" },
  { key: "genericName", header: "Generic Name", cell: (value) => value || "-" },
  { key: "dosageForm", header: "Dosage", cell: (value) => value || "-" },
  { key: "unitType", header: "Unit", cell: (value) => value || "-" },
  {
    key: "quantity",
    header: "Stock (units)",
    align: "right",
    cell: (value) => (value != null ? Number(value).toLocaleString("en-IN") : "0"),
  },
  {
    key: "price",
    header: "Price / pack",
    align: "right",
    cell: (value) => (value != null ? money(value) : "-"),
  },
];

function CardHead({ icon: Icon, tone, title, subtitle, action }) {
  return (
    <div className="ins-card__head">
      <div className="ins-card__title">
        {Icon ? (
          <span className={`ins-card__icon ${tone ? `ins-card__icon--${tone}` : ""}`} aria-hidden="true">
            <Icon size={18} />
          </span>
        ) : null}
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const firstName = user?.firstName || "there";
  const today = useMemo(() => new Date(), []);

  // Every list is fetched exactly once here and shared by all the sections that need it.
  const [sec, reload] = useSections({
    dash: () => analyticsAPI.getDashboard(),
    invoices: () => salesAPI.listInvoices(),
    products: () => productsAPI.getAll(),
    stock: () => inventoryAPI.getStockSummary(),
    customers: () => customersAPI.getAll(),
    purchases: () => purchasesAPI.getAll(),
    payments: () => paymentsAPI.getAll(),
    expiry: () => inventoryAPI.getNearExpiry(),
  });

  const dash = sec.dash.data;
  const invoices = useMemo(() => asArray(sec.invoices), [sec.invoices]);
  const products = useMemo(() => asArray(sec.products), [sec.products]);
  const stock = useMemo(() => asArray(sec.stock), [sec.stock]);
  const customers = useMemo(() => asArray(sec.customers), [sec.customers]);
  const purchases = useMemo(() => asArray(sec.purchases), [sec.purchases]);
  const payments = useMemo(() => asArray(sec.payments), [sec.payments]);
  const nearExpiry = useMemo(() => asArray(sec.expiry), [sec.expiry]);

  const failed = Object.entries(sec).filter(([, s]) => s.status === "error");

  // ---------- medicine search (the empty query reuses the products list loaded above) ----------
  const [searchQuery, setSearchQuery] = useState("");
  const [remote, setRemote] = useState({ query: "", rows: [], loading: false, error: null });
  const trimmed = searchQuery.trim();

  useEffect(() => {
    if (!trimmed) return undefined;
    let cancelled = false;
    setRemote((r) => ({ ...r, loading: true }));
    const id = setTimeout(async () => {
      try {
        const res = await productsAPI.getAll(trimmed);
        if (cancelled) return;
        const data = res.data?.content ?? res.data ?? [];
        setRemote({ query: trimmed, rows: Array.isArray(data) ? data : [], loading: false, error: null });
      } catch (err) {
        if (!cancelled) setRemote({ query: trimmed, rows: [], loading: false, error: handleApiError(err).message });
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [trimmed]);

  const search = trimmed
    ? { rows: remote.rows, loading: remote.loading || remote.query !== trimmed, error: remote.error }
    : { rows: products, loading: isPending(sec.products), error: sec.products.status === "error" ? sec.products.error : null };

  // ---------- KPIs ----------
  const totalSales = invoices.reduce((s, i) => s + num(i.grandTotal), 0);
  const withBalance = invoices.filter((i) => num(i.balanceDue) > 0.004);
  const pendingAmount = withBalance.reduce((s, i) => s + num(i.balanceDue), 0);
  const availableUnits = stock.reduce((s, r) => s + num(r.saleableUnits), 0);
  const outOfStock = stock.filter((r) => r.status === "out_of_stock").length;
  const productsInStock = stock.filter((r) => num(r.saleableUnits) > 0).length;
  const todayRev = num(dash?.todayRevenue);
  const yesterdayRev = num(dash?.yesterdayRevenue);
  const revTrend = dash && yesterdayRev > 0 ? { value: ((todayRev - yesterdayRev) / yesterdayRev) * 100, label: "vs yesterday" } : null;

  // Daily invoice totals (local dates) — the single source for sparklines and the revenue chart
  const dailyRev = useMemo(() => {
    const m = new Map();
    for (const i of invoices) {
      const d = parseDate(i.saleDateTime);
      if (!d) continue;
      const k = ymd(d);
      m.set(k, (m.get(k) || 0) + num(i.grandTotal));
    }
    return m;
  }, [invoices]);
  const lastDays = useCallback(
    (n) =>
      Array.from({ length: n }, (_, idx) => {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (n - 1 - idx));
        return { date: d, key: ymd(d), value: dailyRev.get(ymd(d)) || 0 };
      }),
    [dailyRev, today]
  );
  const months12 = useMemo(() => lastMonths(12, today), [today]);
  const monthlyRev12 = useMemo(() => {
    const totals = sumByMonth(invoices, months12, (i) => i.saleDateTime, (i) => i.grandTotal);
    return months12.map((m) => ({ ...m, value: totals[m.key] }));
  }, [invoices, months12]);

  // Month-to-date vs the same days of last month (a fair comparison mid-month)
  const mtd = useMemo(() => {
    const startThis = new Date(today.getFullYear(), today.getMonth(), 1);
    const startPrev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevDays = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    const endPrev = new Date(today.getFullYear(), today.getMonth() - 1, Math.min(today.getDate(), prevDays), 23, 59, 59, 999);
    let cur = 0;
    let prev = 0;
    for (const i of invoices) {
      const d = parseDate(i.saleDateTime);
      if (!d) continue;
      if (d >= startThis && d <= today.getTime() + 86400000) cur += num(i.grandTotal);
      else if (d >= startPrev && d <= endPrev) prev += num(i.grandTotal);
    }
    const series = lastDays(today.getDate()).map((p) => p.value);
    let run = 0;
    return { cur, prev, cumulative: series.map((v) => (run += v)) };
  }, [invoices, today, lastDays]);
  const mtdTrend = mtd.prev > 0 ? { value: ((mtd.cur - mtd.prev) / mtd.prev) * 100, label: "MTD vs last month" } : null;

  const todayKey = ymd(today);
  const todaysInvoices = invoices.filter((i) => {
    const d = parseDate(i.saleDateTime);
    return d && ymd(d) === todayKey;
  });
  const monthKeyNow = months12[months12.length - 1]?.key;
  const patientsThisMonth = new Set(
    invoices
      .filter((i) => i.customerId != null && parseDate(i.saleDateTime) && monthKey(parseDate(i.saleDateTime)) === monthKeyNow)
      .map((i) => i.customerId)
  ).size;
  const patientsOwing = customers.filter((c) => num(c.remainingBalance) > 0.004).length;
  const unpaidBills = withBalance.filter((i) => String(i.paymentStatus).toUpperCase() === "UNPAID").length;

  const kpis = [
    {
      label: "Total Revenue", icon: ShoppingCart, tone: "gold", sec: "invoices", value: totalSales, format: inr,
      spark: monthlyRev12.map((m) => m.value),
      hint: `${units(invoices.length)} invoices, all time · 12-month trend`, onClick: () => navigate("/reports"),
    },
    {
      label: "Today's Revenue", icon: IndianRupee, tone: "mint", sec: "dash", value: todayRev, format: inr2,
      trend: revTrend, spark: lastDays(7).map((p) => p.value),
      hint: dash ? `${units(todaysInvoices.length)} bill${todaysInvoices.length === 1 ? "" : "s"} today · yesterday ${money(yesterdayRev)}` : null,
      onClick: () => navigate("/analytics"),
    },
    {
      label: "Monthly Revenue", icon: Banknote, tone: "navy", sec: "invoices", value: mtd.cur, format: inr,
      trend: mtdTrend, spark: mtd.cumulative,
      hint: today.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) + ", GST included", onClick: () => navigate("/accounting"),
    },
    {
      label: "Total Patients", icon: Users, tone: "lavender", sec: "customers", value: customers.length,
      hint: `${units(patientsThisMonth)} billed this month · ${units(patientsOwing)} with dues`, onClick: () => navigate("/customers"),
    },
    {
      label: "Total Medicines", icon: Pill, tone: "ice", sec: "products", value: products.length,
      hint: sec.stock.status === "ok" ? `${units(productsInStock)} in stock · ${units(outOfStock)} out of stock` : "In the medicine master",
      onClick: () => navigate("/product-master"),
    },
    {
      label: "Low Stock Medicines", icon: TriangleAlert, tone: "danger", sec: "dash", value: num(dash?.lowStockCount),
      hint: "At or below reorder level", onClick: () => navigate("/stock-alerts"),
    },
    {
      label: "Pending Bills", icon: ReceiptIndianRupee, tone: "warning", sec: "invoices", value: withBalance.length,
      hint: `${units(withBalance.length - unpaidBills)} part-paid · ${units(unpaidBills)} unpaid`, onClick: () => navigate("/payments"),
    },
    {
      label: "Outstanding Payments", icon: Wallet, tone: "coral", sec: "invoices", value: pendingAmount, format: inr,
      hint: `Balance due across ${units(withBalance.length)} invoice${withBalance.length === 1 ? "" : "s"}`, onClick: () => navigate("/payments"),
    },
    {
      label: "Near Expiry", icon: CalendarClock, tone: "warning", sec: "dash", value: num(dash?.nearExpiryCount),
      hint: "Batches expiring within 3 months", onClick: () => navigate("/expiry-alerts"),
    },
    {
      label: "Available Stock", icon: Boxes, tone: "navy", sec: "stock", value: availableUnits,
      hint: `Saleable units · ${units(productsInStock)} medicines in stock`, onClick: () => navigate("/inventory"),
    },
  ];

  // ---------- charts ----------
  const anim = chartAnimation();
  const gold = chartGold();
  const [revRange, setRevRange] = useState("30D");
  const revSeries = useMemo(() => {
    if (revRange === "12M") return monthlyRev12.map((m) => ({ label: m.label, sales: m.value }));
    const n = revRange === "7D" ? 7 : 30;
    return lastDays(n).map((p) => ({
      label: p.date.toLocaleDateString("en-IN", n === 7 ? { weekday: "short", day: "2-digit" } : { day: "2-digit", month: "short" }),
      sales: p.value,
    }));
  }, [revRange, monthlyRev12, lastDays]);
  const hasRev = revSeries.some((p) => p.sales > 0);
  const revTotal = revSeries.reduce((s, p) => s + p.sales, 0);
  const revAvg = revSeries.length ? revTotal / revSeries.length : 0;
  const revPeak = revSeries.reduce((best, p) => (p.sales > (best?.sales ?? -1) ? p : best), null);

  // Payment status of every invoice (PAID / PARTIAL / UNPAID come from the server)
  const statusMix = useMemo(() => {
    const defs = [
      { key: "PAID", name: "Paid", color: "#34d399" },
      { key: "PARTIAL", name: "Part-paid", color: "#fbbf24" },
      { key: "UNPAID", name: "Unpaid", color: "#f87171" },
    ];
    return defs.map((d) => {
      const rows = invoices.filter((i) => String(i.paymentStatus).toUpperCase() === d.key);
      return {
        ...d,
        count: rows.length,
        billed: rows.reduce((s, i) => s + num(i.grandTotal), 0),
        due: rows.reduce((s, i) => s + num(i.balanceDue), 0),
      };
    });
  }, [invoices]);
  const statusTotal = statusMix.reduce((s, m) => s + m.count, 0);
  const collectedTotal = invoices.reduce((s, i) => s + num(i.amountPaid), 0);
  const collectionRate = totalSales > 0 ? (collectedTotal / totalSales) * 100 : 0;

  // Recent patient activity: latest bills and payments, newest first
  const activity = useMemo(() => {
    const billRows = invoices.map((i) => ({
      key: `inv-${i.invoiceId}`,
      at: parseDate(i.saleDateTime),
      kind: "bill",
      who: i.customerName || "Walk-in",
      title: `${i.customerName || "Walk-in"} billed ${money(i.grandTotal)}`,
      meta: `${i.invoiceNumber} · ${units(i.itemCount)} item${num(i.itemCount) === 1 ? "" : "s"}`,
      status: i.paymentStatus,
    }));
    const payRows = payments
      .filter((p) => String(p.paymentStatus).toUpperCase() === "SUCCESS")
      .map((p) => ({
        key: `pay-${p.paymentId}`,
        at: parseDate(p.paymentDate),
        kind: "pay",
        who: p.customerName || "Walk-in",
        title: `${p.customerName || "Walk-in"} paid ${money(p.amountPaid)}`,
        meta: `${prettyMethod(p.paymentMethod)}${p.invoiceNumber ? ` · ${p.invoiceNumber}` : ""}`,
        status: "SUCCESS",
      }));
    return [...billRows, ...payRows]
      .filter((r) => r.at)
      .sort((a, b) => b.at - a.at)
      .slice(0, 7);
  }, [invoices, payments]);

  const months = useMemo(() => lastMonths(6, today), [today]);
  const monthly = useMemo(() => {
    const sales = sumByMonth(invoices, months, (i) => i.saleDateTime, (i) => i.grandTotal);
    const received = purchases.filter((p) => String(p.status).toUpperCase() === "RECEIVED");
    const bought = sumByMonth(received, months, (p) => p.purchaseDate, (p) => p.totalAmount);
    return months.map((m) => ({ month: m.label, sales: sales[m.key], purchases: bought[m.key] }));
  }, [invoices, purchases, months]);
  const hasMonthlyPurch = monthly.some((m) => m.sales > 0 || m.purchases > 0);

  const methodMix = useMemo(() => {
    const by = new Map();
    for (const p of payments) {
      if (String(p.paymentStatus).toUpperCase() !== "SUCCESS") continue;
      const name = prettyMethod(p.paymentMethod);
      const cur = by.get(name) || { name, value: 0, count: 0 };
      cur.value += num(p.amountPaid);
      cur.count += 1;
      by.set(name, cur);
    }
    // colour follows the method name (alphabetical), not its rank
    const names = [...by.keys()].sort();
    return [...by.values()]
      .map((m) => ({ ...m, color: CHART_COLORS[names.indexOf(m.name) % CHART_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [payments]);
  const methodTotal = methodMix.reduce((s, m) => s + m.value, 0);

  const categories = useMemo(() => {
    const unitsById = new Map(stock.map((r) => [r.productId, num(r.saleableUnits)]));
    const by = new Map();
    for (const p of products) {
      const name = (p.dosageForm || "").trim() || "Unspecified";
      const cur = by.get(name) || { name, units: 0, products: 0 };
      cur.units += unitsById.get(p.productId) || 0;
      cur.products += 1;
      by.set(name, cur);
    }
    const rows = [...by.values()].sort((a, b) => b.units - a.units || b.products - a.products);
    if (rows.length <= 6) return rows;
    const other = rows.slice(5).reduce((o, r) => ({ name: "Other", units: o.units + r.units, products: o.products + r.products }), { name: "Other", units: 0, products: 0 });
    return [...rows.slice(0, 5), other];
  }, [products, stock]);

  // ---------- lists ----------
  const recentInvoices = invoices.slice(0, 6);

  const lowStock = useMemo(() => {
    const byId = new Map(products.map((p) => [p.productId, p]));
    return stock
      .filter((r) => r.status === "low_stock" || r.status === "out_of_stock")
      .map((r) => {
        const p = byId.get(r.productId) || {};
        const target = num(p.targetStockLevel) > 0 ? num(p.targetStockLevel) : Math.max(1, num(r.reorderLevel) * 2);
        return { ...r, target, ratio: num(r.saleableUnits) / target, targetFromProduct: num(p.targetStockLevel) > 0 };
      })
      .sort((a, b) => a.ratio - b.ratio)
      .slice(0, 6);
  }, [stock, products]);

  const expiring = useMemo(
    () =>
      [...nearExpiry]
        .map((b) => ({ ...b, days: daysUntil(b.expiryDate, today) }))
        .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999))
        .slice(0, 6),
    [nearExpiry, today]
  );

  const recentPurchases = useMemo(
    () =>
      [...purchases]
        .sort((a, b) => (parseDate(b.purchaseDate)?.getTime() || 0) - (parseDate(a.purchaseDate)?.getTime() || 0) || num(b.invoiceId) - num(a.invoiceId))
        .slice(0, 5),
    [purchases]
  );

  const bestSellers = useMemo(
    () =>
      (dash?.bestSellingMedicines || []).map((m, i) => ({
        key: `${m.name}-${i}`,
        name: m.name || "Medicine",
        sold: num(m.quantity),
        revenue: num(m.revenue),
      })),
    [dash]
  );
  const maxSold = Math.max(1, ...bestSellers.map((b) => b.sold));

  const stockMrp = num(dash?.totalStockValueMrp);
  const stockCost = num(dash?.totalStockValueCost);

  return (
    <div className="mb-page dash">
      <PageHeader
        variant="hero"
        icon={Stethoscope}
        eyebrow={today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        title={`${greeting(today)}, ${firstName}`}
        subtitle="Your pharmacy at a glance: sales, stock, expiry and payments."
        actions={
          <div className="dash-header-actions" role="group" aria-label="Dashboard actions">
            <button className="btn btn-primary" onClick={() => navigate("/sales")}>
              <FileText size={16} /> New Bill
            </button>
            <button className="btn" onClick={() => navigate("/add-medicine")}>
              <CirclePlus size={16} /> Add Medicine
            </button>
            <button className="btn" onClick={() => navigate("/purchases")}>
              <PackageCheck size={16} /> Receive Stock
            </button>
            <button className="btn" onClick={() => navigate("/reports")}>
              <FileBarChart2 size={16} /> Reports
            </button>
            <button className="btn" onClick={() => navigate("/expiry-alerts")}>
              <TriangleAlert size={16} /> Alerts
            </button>
          </div>
        }
      >
        {/* Live pulse of today, from the same invoice / dashboard data as the cards below */}
        <dl className="dash-pulse" aria-label="Today at a glance">
          <div>
            <dt>Sales today</dt>
            <dd>{isPending(sec.dash) ? "…" : inr(todayRev)}</dd>
          </div>
          <div>
            <dt>Bills today</dt>
            <dd>{isPending(sec.invoices) ? "…" : units(todaysInvoices.length)}</dd>
          </div>
          <div>
            <dt>Collection rate</dt>
            <dd>{isPending(sec.invoices) ? "…" : `${collectionRate.toFixed(1)}%`}</dd>
          </div>
          <div>
            <dt>Stock alerts</dt>
            <dd>{isPending(sec.dash) ? "…" : units(num(dash?.lowStockCount) + num(dash?.nearExpiryCount))}</dd>
          </div>
        </dl>
        <MedicalIllustration className="dash-hero-art" />
      </PageHeader>

      {failed.length > 0 && (
        <SectionError
          title="Some dashboard data could not be loaded. Showing the sections that loaded."
          message={failed.map(([k, s]) => `${SECTION_LABELS[k]}: ${s.error}`).join(" · ")}
          onRetry={() => reload(failed.map(([k]) => k))}
        />
      )}

      <section className="mb-grid-stats mb-stagger dash-stats" aria-label="Key figures">
        {kpis.map((k) => (
          <StatCard
            key={k.label}
            testId="kpi-card"
            icon={k.icon}
            label={k.label}
            tone={k.tone}
            value={sec[k.sec].status === "error" && sec[k.sec].data == null ? null : k.value}
            format={k.format}
            trend={k.trend}
            spark={k.spark}
            hint={sec[k.sec].status === "error" && sec[k.sec].data == null ? "Could not load" : k.hint}
            loading={isPending(sec[k.sec])}
            onClick={k.onClick}
          />
        ))}
      </section>

      <section className="card dash-snapshot" aria-label="This month and stock value">
        {isPending(sec.dash) ? (
          <LoadingSkeleton variant="lines" rows={3} label="Loading summary figures" />
        ) : !dash ? (
          <EmptyState compact icon={Receipt} title="Summary unavailable" message="The monthly figures could not be loaded." />
        ) : (
          <>
            <div className="dash-snap" data-testid="dash-monthly-revenue">
              <span className="dash-snap__label">Monthly Revenue</span>
              <span className="dash-snap__value kpi-value">{money(dash.monthlyRevenue)}</span>
              <span className="dash-snap__hint">This month, GST included</span>
            </div>
            <div className="dash-snap" data-testid="dash-monthly-profit">
              <span className="dash-snap__label">Monthly Profit</span>
              <span className="dash-snap__value kpi-value">{money(dash.monthlyProfit)}</span>
              <span className="dash-snap__hint">This month • Revenue {money(dash.monthlyRevenue)}</span>
            </div>
            <div className="dash-snap" data-testid="dash-today-profit">
              <span className="dash-snap__label">Today's Profit</span>
              <span className="dash-snap__value kpi-value">{money(dash.profit)}</span>
              <span className="dash-snap__hint">Cost of goods sold today {money(dash.totalCost)}</span>
            </div>
            <div className="dash-snap dash-snap--wide" data-testid="dash-stock-value">
              <span className="dash-snap__label">Stock Value (MRP)</span>
              <span className="dash-snap__value kpi-value">{money(stockMrp)}</span>
              <ProgressBar value={stockCost} max={stockMrp} tone="info" label="Stock value at cost as a share of MRP value" size="sm" />
              <span className="dash-snap__hint">
                At cost: {money(stockCost)}
                {stockMrp > 0 ? ` (${((stockCost / stockMrp) * 100).toFixed(1)}% of MRP)` : ""}
              </span>
            </div>
          </>
        )}
      </section>

      <div className="dash-row dash-row--2-1">
        <ChartCard
          className="dash-revenue"
          title="Revenue Analytics"
          subtitle={revRange === "12M" ? "Invoice totals per month, last 12 months" : `Invoice totals per day, last ${revRange === "7D" ? 7 : 30} days`}
          loading={isPending(sec.invoices)}
          empty={!hasRev}
          emptyText={sec.invoices.status === "error" ? "Invoices could not be loaded." : "No sales recorded in this period."}
          height={300}
          actions={
            <div className="ins-seg" role="group" aria-label="Revenue period">
              {[
                ["7D", "Weekly"],
                ["30D", "30 days"],
                ["12M", "Monthly"],
              ].map(([key, text]) => (
                <button key={key} type="button" aria-pressed={revRange === key} onClick={() => setRevRange(key)}>
                  {text}
                </button>
              ))}
            </div>
          }
        >
          <div className="dash-rev-stats">
            <div>
              <span>Total</span>
              <strong className="mb-gold-text">{inr(revTotal)}</strong>
            </div>
            <div>
              <span>Average / {revRange === "12M" ? "month" : "day"}</span>
              <strong>{inr(revAvg)}</strong>
            </div>
            <div>
              <span>Best {revRange === "12M" ? "month" : "day"}</span>
              <strong>{revPeak && revPeak.sales > 0 ? `${revPeak.label} · ${inrShort(revPeak.sales)}` : "-"}</strong>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart key={revRange} data={revSeries} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="dashRevFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor={gold.fill} stopOpacity={0.42} />
                  <stop offset="0.6" stopColor={gold.fill} stopOpacity={0.08} />
                  <stop offset="1" stopColor={gold.fill} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="dashRevStroke" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0" stopColor={gold.line[0]} />
                  <stop offset="0.5" stopColor={gold.line[1]} />
                  <stop offset="1" stopColor={gold.line[2]} />
                </linearGradient>
                <filter id="dashRevGlow" x="-10%" y="-30%" width="120%" height="160%">
                  <feGaussianBlur stdDeviation="4" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={18} />
              <YAxis {...axisProps} axisLine={false} width={60} tickFormatter={inrShort} />
              <Tooltip {...tooltipProps} cursor={{ stroke: gold.dot, strokeDasharray: "4 4" }} formatter={(v) => [inrFull(v), "Sales"]} />
              <Area
                type="monotone"
                dataKey="sales"
                name="Sales"
                stroke="url(#dashRevStroke)"
                strokeWidth={2.5}
                fill="url(#dashRevFill)"
                filter="url(#dashRevGlow)"
                activeDot={{ r: 5, fill: gold.dot, stroke: gold.dotStroke, strokeWidth: 2 }}
                {...anim}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <section className="card ins-card dash-paystatus" aria-label="Payment status overview">
          <CardHead icon={Activity} title="Payment Status" subtitle="All invoices by settlement status" />
          {isPending(sec.invoices) ? (
            <LoadingSkeleton variant="lines" rows={4} label="Loading payment status" />
          ) : statusTotal === 0 ? (
            <EmptyState compact icon={Receipt} title="No invoices yet" message="Create a bill to see payment status here." />
          ) : (
            <>
              <div className="dash-gauge">
                <div className="dash-gauge__ring" style={{ "--pct": Math.min(100, collectionRate) }} aria-hidden="true" />
                <div className="dash-gauge__text">
                  <strong>{collectionRate.toFixed(1)}%</strong>
                  <span>collected</span>
                </div>
                <div className="dash-gauge__meta">
                  <span>Collected</span>
                  <b>{inr(collectedTotal)}</b>
                  <span>Billed</span>
                  <b>{inr(totalSales)}</b>
                </div>
              </div>
              <div className="dash-stackbar" role="img" aria-label={statusMix.map((m) => `${m.name}: ${m.count}`).join(", ")}>
                {statusMix.map((m) =>
                  m.count ? <span key={m.key} style={{ flexGrow: m.count, background: m.color }} title={`${m.name}: ${m.count}`} /> : null
                )}
              </div>
              <ul className="dash-status-list">
                {statusMix.map((m) => (
                  <li key={m.key}>
                    <span className="ins-legend__dot" style={{ background: m.color }} />
                    <span className="dash-status-list__name">{m.name}</span>
                    <span className="dash-status-list__count">{units(m.count)} bills</span>
                    <span className="dash-status-list__amt">{m.key === "PAID" ? inr(m.billed) : `${inr(m.due)} due`}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <div className="dash-row dash-row--2">
        <ChartCard
          title="Payment Methods"
          subtitle="Successful payments by method, all time"
          loading={isPending(sec.payments)}
          empty={methodMix.length === 0}
          emptyText={sec.payments.status === "error" ? "Payments could not be loaded." : "No successful payments recorded yet."}
          height={260}
        >
          <div className="dash-donut">
            <div className="dash-donut__chart">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Tooltip {...tooltipProps} formatter={(v, n) => [inrFull(v), n]} />
                  <Pie data={methodMix} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={2} stroke={chartSurface()} strokeWidth={2} {...anim}>
                    {methodMix.map((m) => (
                      <Cell key={m.name} fill={m.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="dash-donut__center" aria-hidden="true">
                <strong>{inrShort(methodTotal)}</strong>
                <span>collected</span>
              </div>
            </div>
            <ul className="ins-legend" aria-label="Payment method totals">
              {methodMix.map((m) => (
                <li key={m.name}>
                  <span className="ins-legend__dot" style={{ background: m.color }} />
                  <span className="ins-legend__name">{m.name}</span>
                  <span className="ins-legend__val">
                    {inr(m.value)}
                    <small>{methodTotal > 0 ? `${((m.value / methodTotal) * 100).toFixed(0)}%` : ""}</small>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </ChartCard>

        <ChartCard
          title="Purchases vs Sales"
          subtitle="Received purchase invoices vs sales invoices, per month"
          loading={isPending(sec.invoices) || isPending(sec.purchases)}
          empty={!hasMonthlyPurch}
          emptyText={sec.purchases.status === "error" ? "Purchases could not be loaded." : "No purchases or sales in the last 6 months."}
          height={250}
        >
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthly} margin={{ top: 10, right: 12, bottom: 0, left: 0 }} barGap={2}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} axisLine={false} width={60} tickFormatter={inrShort} />
              <Tooltip {...tooltipProps} formatter={(v, n) => [inrFull(v), n]} />
              <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="sales" name="Sales" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={26} {...anim} />
              <Bar dataKey="purchases" name="Purchases" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} maxBarSize={26} {...anim} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="dash-row dash-row--2">
        <ChartCard
          title="Inventory by Category"
          subtitle="Saleable units per dosage form"
          loading={isPending(sec.products) || isPending(sec.stock)}
          empty={categories.length === 0}
          emptyText={sec.stock.status === "error" || sec.products.status === "error" ? "Stock could not be loaded." : "No medicines in the catalogue yet."}
          height={250}
        >
          <ResponsiveContainer width="100%" height={Math.max(160, categories.length * 40 + 20)}>
            <BarChart data={categories} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} vertical horizontal={false} />
              <XAxis type="number" {...axisProps} allowDecimals={false} tickFormatter={(v) => num(v).toLocaleString("en-IN")} />
              <YAxis type="category" dataKey="name" {...axisProps} width={92} />
              <Tooltip
                {...tooltipProps}
                formatter={(v, n, item) => [`${units(v)} units · ${item?.payload?.products ?? 0} medicines`, "Saleable stock"]}
              />
              <Bar dataKey="units" name="Saleable units" fill={CHART_COLORS[2]} radius={[0, 4, 4, 0]} maxBarSize={22} {...anim} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <section className="card ins-card table-card dash-best">
          <CardHead
            icon={Trophy}
            tone="purple"
            title="Best Selling Medicines"
            subtitle="Top medicines by units sold this month"
            action={
              <button className="btn btn-sm" onClick={() => navigate("/reports")}>
                <FileText size={16} /> View Reports
              </button>
            }
          />
          {isPending(sec.dash) ? (
            <LoadingSkeleton variant="lines" rows={4} label="Loading best sellers" />
          ) : bestSellers.length === 0 ? (
            <EmptyState compact icon={Trophy} title="No sales this month yet" message="Best sellers appear after the first bill of the month." />
          ) : (
            <ol className="dash-rank">
              {bestSellers.map((m, i) => (
                <li key={m.key}>
                  <span className="dash-rank__n">{i + 1}</span>
                  <div className="dash-rank__main">
                    <div className="dash-rank__row">
                      <span className="dash-rank__name">{m.name}</span>
                      <span className="dash-rank__val">{money(m.revenue)}</span>
                    </div>
                    <ProgressBar value={m.sold} max={maxSold} tone="purple" size="sm" label={`${m.name}: ${m.sold} units sold`} />
                    <span className="dash-rank__meta">{units(m.sold)} units sold</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="dash-row dash-row--2-1 dash-row--recent">
        <section className="card ins-card table-card dash-recent">
          <CardHead
            icon={Receipt}
            title="Recent Transactions"
            subtitle="Latest invoices and payment status"
            action={
              <button className="btn btn-primary btn-sm" onClick={() => navigate("/sales")}>
                <CreditCard size={16} /> Open Billing
              </button>
            }
          />
          <div className="table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th className="num">Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {isPending(sec.invoices) ? (
                  <tr>
                    <td colSpan={5}>
                      <LoadingSkeleton variant="table" rows={4} label="Loading recent transactions" />
                    </td>
                  </tr>
                ) : recentInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState
                        compact
                        icon={Receipt}
                        title={sec.invoices.status === "error" ? "Recent sales could not be loaded" : "No invoices yet"}
                        message={sec.invoices.status === "error" ? sec.invoices.error : "Create a bill to see it here."}
                      />
                    </td>
                  </tr>
                ) : (
                  recentInvoices.map((i) => (
                    <tr key={i.invoiceId}>
                      <td className="mono">{i.invoiceNumber}</td>
                      <td className="strong">{i.customerName || "Walk-in"}</td>
                      <td className="num">{money(i.grandTotal)}</td>
                      <td>{formatDateTime(i.saleDateTime)}</td>
                      <td>
                        <StatusBadge status={i.paymentStatus} size="sm" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card ins-card dash-activity" aria-label="Recent patient activity">
          <CardHead
            icon={Sparkles}
            title="Recent Patient Activity"
            subtitle="Latest bills and payments"
            action={
              <button className="btn btn-ghost btn-sm" onClick={() => navigate("/customers")}>
                Patients
              </button>
            }
          />
          {isPending(sec.invoices) || isPending(sec.payments) ? (
            <LoadingSkeleton variant="lines" rows={5} label="Loading patient activity" />
          ) : activity.length === 0 ? (
            <EmptyState compact icon={Users} title="No activity yet" message="Bills and payments appear here as they happen." />
          ) : (
            <ul className="dash-feed">
              {activity.map((a) => (
                <li key={a.key} className={`dash-feed__item dash-feed__item--${a.kind}`}>
                  <span className="dash-feed__avatar" aria-hidden="true">
                    {a.who
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((s) => s[0].toUpperCase())
                      .join("")}
                  </span>
                  <div className="dash-feed__body">
                    <span className="dash-feed__title">{a.title}</span>
                    <span className="dash-feed__meta">
                      {a.meta} · {formatDateTime(a.at)}
                    </span>
                  </div>
                  {a.kind === "bill" ? <StatusBadge status={a.status} size="sm" /> : <span className="dash-feed__tag">Payment</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="dash-row dash-row--3">
        <section className="card ins-card dash-lowstock">
          <CardHead
            icon={TriangleAlert}
            tone="danger"
            title="Low Stock Medicines"
            subtitle="Saleable units vs target stock level"
            action={
              <button className="btn btn-ghost btn-sm" onClick={() => navigate("/stock-alerts")}>
                View all
              </button>
            }
          />
          {isPending(sec.stock) ? (
            <LoadingSkeleton variant="lines" rows={4} label="Loading low stock" />
          ) : sec.stock.status === "error" && !stock.length ? (
            <SectionError title="Stock could not be loaded" message={sec.stock.error} onRetry={() => reload(["stock"])} />
          ) : lowStock.length === 0 ? (
            <EmptyState compact icon={PackageSearch} title="Stock levels look healthy" message="No medicine is at or below its reorder level." />
          ) : (
            <ul className="dash-list">
              {lowStock.map((r) => (
                <li key={r.productId} className="dash-stockrow">
                  <div className="dash-stockrow__top">
                    <span className="dash-stockrow__name">{r.name}</span>
                    <StatusBadge status={r.status === "out_of_stock" ? "OUT_OF_STOCK" : "LOW_STOCK"} size="sm" />
                  </div>
                  <ProgressBar
                    value={num(r.saleableUnits)}
                    max={r.target}
                    tone={r.status === "out_of_stock" || r.ratio <= 0.25 ? "danger" : "warning"}
                    size="sm"
                    label={`${r.name}: ${num(r.saleableUnits)} of ${r.target} units`}
                  />
                  <span className="dash-stockrow__meta">
                    {units(r.saleableUnits)} / {units(r.target)} units {r.targetFromProduct ? "(target)" : "(2 × reorder level)"} · reorder at {units(r.reorderLevel)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card ins-card dash-expiry">
          <CardHead
            icon={CalendarClock}
            tone="warning"
            title="Expiry Alerts"
            subtitle="Batches expiring within 3 months"
            action={
              <button className="btn btn-ghost btn-sm" onClick={() => navigate("/expiry-alerts")}>
                View all
              </button>
            }
          />
          {isPending(sec.expiry) ? (
            <LoadingSkeleton variant="lines" rows={4} label="Loading expiry alerts" />
          ) : sec.expiry.status === "error" && !nearExpiry.length ? (
            <SectionError title="Expiry alerts could not be loaded" message={sec.expiry.error} onRetry={() => reload(["expiry"])} />
          ) : expiring.length === 0 ? (
            <EmptyState compact icon={CalendarClock} title="Nothing expiring soon" message="No batch expires within the next 3 months." />
          ) : (
            <ul className="dash-list">
              {expiring.map((b) => (
                <li key={b.batchId} className="dash-exprow">
                  <div className="dash-exprow__main">
                    <span className="dash-exprow__name">{b.product?.name || "Medicine"}</span>
                    <span className="dash-exprow__meta">
                      Batch {b.batchNumber} · {units(b.totalUnits)} units · {formatDate(b.expiryDate)}
                    </span>
                  </div>
                  <span className={`dash-days ${b.days != null && b.days <= 30 ? "is-critical" : ""}`}>
                    {b.days == null ? "-" : b.days <= 0 ? "Expires today" : `${b.days} day${b.days === 1 ? "" : "s"} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card ins-card dash-purchases">
          <CardHead
            icon={Truck}
            tone="navy"
            title="Recent Purchases"
            subtitle="Latest supplier invoices and orders"
            action={
              <button className="btn btn-ghost btn-sm" onClick={() => navigate("/purchases")}>
                View all
              </button>
            }
          />
          {isPending(sec.purchases) ? (
            <LoadingSkeleton variant="lines" rows={4} label="Loading purchases" />
          ) : sec.purchases.status === "error" && !purchases.length ? (
            <SectionError title="Purchases could not be loaded" message={sec.purchases.error} onRetry={() => reload(["purchases"])} />
          ) : recentPurchases.length === 0 ? (
            <EmptyState compact icon={Truck} title="No purchases yet" message="Receive supplier stock to see it here." />
          ) : (
            <Timeline
              items={recentPurchases.map((p) => {
                const received = String(p.status).toUpperCase() === "RECEIVED";
                return {
                  key: p.invoiceId,
                  tone: received ? "success" : "warning",
                  icon: received ? PackageCheck : CalendarClock,
                  title: `${p.invoiceNumber} · ${p.supplierName || "Supplier"}`,
                  meta: `${formatDate(p.purchaseDate)}${received ? ` · ${units(p.batchCount)} batch${num(p.batchCount) === 1 ? "" : "es"}` : ""}`,
                  right: (
                    <div className="dash-tl-right">
                      <span>{p.totalAmount != null ? inr2(p.totalAmount) : "-"}</span>
                      <StatusBadge status={received ? "RECEIVED" : "PENDING"} size="sm" />
                    </div>
                  ),
                };
              })}
            />
          )}
        </section>
      </div>

      <section className="card ins-card quick-card">
        <CardHead icon={HandCoins} title="Quick Actions" subtitle="Fast shortcuts for daily work" />
        <div className="quick-grid mb-stagger">
          <button className="quick-action mb-lift" onClick={() => navigate("/sales")}>
            <span className="quick-icon" aria-hidden="true"><FileText size={18} /></span>
            <span>
              <span className="quick-title">Create New Bill</span>
              <span className="quick-sub">Fast POS billing</span>
            </span>
          </button>
          <button className="quick-action mb-lift" onClick={() => navigate("/add-medicine")}>
            <span className="quick-icon" aria-hidden="true"><CirclePlus size={18} /></span>
            <span>
              <span className="quick-title">Add Medicine</span>
              <span className="quick-sub">Update stock master</span>
            </span>
          </button>
          <button className="quick-action mb-lift" onClick={() => navigate("/purchases")}>
            <span className="quick-icon" aria-hidden="true"><PackageCheck size={18} /></span>
            <span>
              <span className="quick-title">Receive Stock</span>
              <span className="quick-sub">Supplier invoices into batches</span>
            </span>
          </button>
          <button className="quick-action mb-lift" onClick={() => navigate("/suppliers")}>
            <span className="quick-icon" aria-hidden="true"><UserPlus size={18} /></span>
            <span>
              <span className="quick-title">Add Supplier</span>
              <span className="quick-sub">Supplier management</span>
            </span>
          </button>
          <button className="quick-action mb-lift" onClick={() => navigate("/reports")}>
            <span className="quick-icon" aria-hidden="true"><FileBarChart2 size={18} /></span>
            <span>
              <span className="quick-title">View Reports</span>
              <span className="quick-sub">Sales & GST insights</span>
            </span>
          </button>
        </div>
      </section>

      <section className="card ins-card dash-search-card">
        <div className="ins-card__head">
          <div className="ins-card__title">
            <span className="ins-card__icon ins-card__icon--info" aria-hidden="true">
              <Search size={18} />
            </span>
            <div>
              <h3>Search Medicines</h3>
              <p>Type a medicine name, company, or generic name to see matching stock.</p>
            </div>
          </div>
          <button className="btn btn-sm" onClick={() => setSearchQuery("")}>
            Clear
          </button>
        </div>
        <div className="search-row">
          <div className="search-field">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search medicines on dashboard"
              placeholder="Search medicines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={() => setSearchQuery(searchQuery.trim())}>
            Search
          </button>
        </div>
        <div className="search-results-card">
          {search.loading && <LoadingSkeleton variant="table" rows={3} label="Searching medicines" />}
          {!search.loading && search.error && <SectionError title="Search failed" message={search.error} />}
          {!search.loading && !search.error && search.rows.length === 0 && (
            <div className="search-hint">
              {trimmed
                ? "No medicines match that keyword. Try a different name, company, or generic name."
                : "No medicines in the catalogue yet. Add medicines to display them here."}
            </div>
          )}
          {!search.loading && !search.error && search.rows.length > 0 && (
            <div className="dash-scroll-x">
              <div className="search-summary">
                {trimmed ? `Found ${search.rows.length} medicines for "${trimmed}"` : `Showing all ${search.rows.length} medicines`}
              </div>
              <DataTable
                title="Inventory Search Results"
                subtitle="Stock is the real number of units on hand across all batches."
                columns={inventoryColumns}
                rows={search.rows}
                rowKey={(row) => row.productId}
                searchable={false}
                initialPageSize={10}
                pageSizeOptions={[5, 10, 20, 50]}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
