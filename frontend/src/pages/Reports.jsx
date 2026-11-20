import React, { useMemo, useState } from "react";
import "../components/ui/Select.css";
import "./Reports.css";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Boxes,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Download,
  FileBarChart2,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  ListOrdered,
  ReceiptText,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import {
  PageHeader,
  StatusBadge,
  LoadingSkeleton,
  ChartCard,
  AnimatedButton,
  DataTable,
  GradientCard,
} from "../components/ui";
import {
  analyticsAPI,
  customersAPI,
  inventoryAPI,
  productsAPI,
  salesAPI,
  reportsAPI,
  downloadBlob,
  handleApiError,
} from "../services/api";
import { CHART_COLORS, axisProps, gridProps, tooltipProps, inrShort, inrFull, chartAnimation } from "../utils/chartTheme";
import useSections, { isPending, asArray } from "./insights/useSections";
import SectionError from "./insights/SectionError";
import { num, money, ymd, monthKey, parseDate } from "./insights/insightsUtils";

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function localDateKey(value) {
  const d = parseDate(value);
  return d ? ymd(d) : "unknown";
}

// Server-side exports. `period` says which data each file covers (fixed by the backend, not by the on-screen filter).
const CATALOGUE = [
  {
    group: "Sales",
    items: [
      { id: "daily", label: "Daily Sales PDF", fetcher: reportsAPI.daily, file: "daily_sales.pdf", icon: CalendarDays, desc: "Every invoice billed today with GST totals.", period: "Today" },
      { id: "monthly", label: "Monthly Sales PDF", fetcher: reportsAPI.monthly, file: "monthly_sales.pdf", icon: CalendarRange, desc: "All invoices of the current month.", period: "This month" },
      { id: "yearly", label: "Yearly Sales PDF", fetcher: reportsAPI.yearly, file: "yearly_sales.pdf", icon: FileBarChart2, desc: "All invoices of the current calendar year.", period: "This year" },
      { id: "profitLoss", label: "P&L PDF", fetcher: reportsAPI.profitLoss, file: "profit_loss.pdf", icon: IndianRupee, desc: "Revenue, cost and profit statement.", period: "This month", primary: true },
    ],
  },
  {
    group: "GST",
    items: [
      { id: "gstMonthly", label: "GST Monthly CSV", fetcher: reportsAPI.gstMonthly, file: "gst_monthly.csv", icon: FileSpreadsheet, desc: "Invoice-wise taxable value, CGST and SGST for filing.", period: "This month" },
      { id: "gstYearly", label: "GST Yearly CSV", fetcher: reportsAPI.gstYearly, file: "gst_yearly.csv", icon: FileSpreadsheet, desc: "The same GST breakup for the whole year.", period: "This year" },
    ],
  },
  {
    group: "Inventory",
    items: [
      { id: "stock", label: "Stock PDF", fetcher: reportsAPI.stock, file: "stock.pdf", icon: Boxes, desc: "Batch-wise stock on hand with MRP and expiry.", period: "Current stock" },
      { id: "expiry", label: "Expiry PDF", fetcher: reportsAPI.expiry, file: "expiry.pdf", icon: CalendarClock, desc: "Batches expiring within the next 3 months.", period: "Next 3 months" },
      { id: "medicines", label: "Medicines A-Z", fetcher: reportsAPI.medicines, file: "medicines.pdf", icon: ListOrdered, desc: "Alphabetical catalogue of all medicines.", period: "Current catalogue" },
    ],
  },
  {
    group: "Purchases",
    items: [
      { id: "purchases", label: "Purchase PDF", fetcher: reportsAPI.purchases, file: "purchases.pdf", icon: Truck, desc: "Supplier purchase invoices and their status.", period: "All time" },
    ],
  },
];

const TABS = [
  ["daily", "Daily Sales (GST)"],
  ["invoices", "Recent Invoices"],
  ["stock", "Stock Report"],
  ["profit", "Profit & Loss"],
  ["alphabetical", "Medicines A-Z"],
];
const DATED_TABS = new Set(["daily", "invoices"]);

function Reports() {
  const [tab, setTab] = useState("daily");
  const [customerId, setCustomerId] = useState("");
  const [downloading, setDownloading] = useState(null);
  const [downloadError, setDownloadError] = useState(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [sec, reload] = useSections({
    dash: () => analyticsAPI.getDashboard(),
    stock: () => inventoryAPI.getAllStock(),
    products: () => productsAPI.getAll(),
    invoices: () => salesAPI.listInvoices(),
    customers: () => customersAPI.getAll(),
  });
  const dashboardData = sec.dash.data;
  const stockData = useMemo(() => asArray(sec.stock), [sec.stock]);
  const products = useMemo(() => asArray(sec.products), [sec.products]);
  const invoices = useMemo(() => asArray(sec.invoices), [sec.invoices]);
  const customers = useMemo(() => asArray(sec.customers), [sec.customers]);
  const failed = Object.entries(sec).filter(([, s]) => s.status === "error");
  const LABELS = { dash: "Summary", stock: "Stock", products: "Products", invoices: "Invoices", customers: "Customers" };

  const today = useMemo(() => new Date(), []);
  const rangeActive = Boolean(from || to);
  const rangeInvalid = Boolean(from && to && from > to);

  // client-side date range for the on-screen invoice views (inclusive, local dates)
  const rangedInvoices = useMemo(() => {
    if (!rangeActive || rangeInvalid) return invoices;
    return invoices.filter((inv) => {
      const k = localDateKey(inv.saleDateTime);
      if (k === "unknown") return false;
      return (!from || k >= from) && (!to || k <= to);
    });
  }, [invoices, from, to, rangeActive, rangeInvalid]);

  const dailyRows = useMemo(() => {
    const byDate = new Map();
    for (const inv of rangedInvoices) {
      const key = inv.saleDateTime ? localDateKey(inv.saleDateTime) : "unknown";
      const curr = byDate.get(key) || { date: key, invoices: 0, taxable: 0, cgst: 0, sgst: 0, grand: 0 };
      curr.invoices += 1;
      curr.taxable += num(inv.totalTaxableAmount);
      curr.cgst += num(inv.totalCgst);
      curr.sgst += num(inv.totalSgst);
      curr.grand += num(inv.grandTotal);
      byDate.set(key, curr);
    }
    return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [rangedInvoices]);

  const todaySummary = useMemo(() => {
    const rows = invoices.filter((inv) => inv.saleDateTime && sameDay(new Date(inv.saleDateTime), today));
    return {
      invoices: rows.length,
      total: rows.reduce((s, inv) => s + num(inv.grandTotal), 0),
      gst: rows.reduce((s, inv) => s + num(inv.totalCgst) + num(inv.totalSgst), 0),
    };
  }, [invoices, today]);

  // GST summary for the selected range (or all time)
  const gst = useMemo(() => {
    const t = { taxable: 0, cgst: 0, sgst: 0, grand: 0, count: rangedInvoices.length };
    const byMonth = new Map();
    for (const inv of rangedInvoices) {
      t.taxable += num(inv.totalTaxableAmount);
      t.cgst += num(inv.totalCgst);
      t.sgst += num(inv.totalSgst);
      t.grand += num(inv.grandTotal);
      const d = parseDate(inv.saleDateTime);
      if (!d) continue;
      const k = monthKey(d);
      const m = byMonth.get(k) || { key: k, label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), taxable: 0, cgst: 0, sgst: 0 };
      m.taxable += num(inv.totalTaxableAmount);
      m.cgst += num(inv.totalCgst);
      m.sgst += num(inv.totalSgst);
      byMonth.set(k, m);
    }
    const months = [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-12);
    return { ...t, months };
  }, [rangedInvoices]);

  const stockReport = useMemo(
    () =>
      stockData.map((item) => {
        const product = item.product || {};
        return {
          batchId: item.batchId,
          name: product.name || "Unknown",
          company: product.company || "N/A",
          batch: item.batchNumber || "N/A",
          stock: num(item.totalUnits),
          mrp: num(item.mrp),
          expiry: item.expiryDate ? new Date(item.expiryDate).toLocaleDateString("en-IN") : "N/A",
        };
      }),
    [stockData]
  );

  const alphabeticalMedicines = useMemo(
    () =>
      products
        .map((p) => ({
          productId: p.productId,
          name: p.name || "-",
          company: p.company || "N/A",
          genericName: p.genericName || "N/A",
          stripSize: p.stripSize || 1,
          price: num(p.price),
          stock: num(p.quantity),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  );

  const profitLossReport = useMemo(() => {
    if (!dashboardData) return [];
    return [
      { metric: "Today Revenue", value: dashboardData.todayRevenue },
      { metric: "Yesterday Revenue", value: dashboardData.yesterdayRevenue },
      { metric: "Today Profit", value: dashboardData.profit },
      { metric: "Monthly Revenue", value: dashboardData.monthlyRevenue },
      { metric: "Monthly Profit", value: dashboardData.monthlyProfit },
      { metric: "Stock Value (MRP)", value: dashboardData.totalStockValueMrp },
      { metric: "Stock Value (Cost)", value: dashboardData.totalStockValueCost },
    ].map((r) => ({ ...r, value: num(r.value) }));
  }, [dashboardData]);

  const invoiceRows = useMemo(
    () =>
      rangedInvoices.map((inv) => ({
        invoiceId: inv.invoiceId,
        invoiceNumber: inv.invoiceNumber,
        date: inv.saleDateTime ? new Date(inv.saleDateTime).toLocaleString("en-IN") : "-",
        customer: inv.customerName || "Walk-in",
        amount: num(inv.grandTotal),
        amountPaid: num(inv.amountPaid),
        balanceDue: num(inv.balanceDue),
        paymentStatus: inv.paymentStatus || "-",
      })),
    [rangedInvoices]
  );

  const customerOptions = useMemo(
    () => [...customers].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [customers]
  );

  async function downloadReport(id, fetcher, filename) {
    setDownloading(id);
    setDownloadError(null);
    try {
      const res = await fetcher();
      downloadBlob(res, filename);
    } catch (err) {
      setDownloadError(handleApiError(err).message);
    } finally {
      setDownloading(null);
    }
  }

  const rangeText = rangeInvalid
    ? "The start date is after the end date, so the filter is ignored."
    : rangeActive
      ? `Showing ${from || "the first sale"} to ${to || "today"}`
      : "Showing all dates";
  const tablePending = { daily: sec.invoices, invoices: sec.invoices, stock: sec.stock, profit: sec.dash, alphabetical: sec.products }[tab];
  const anim = chartAnimation();

  return (
    <div className="mb-page rep">
      <PageHeader
        icon={FileBarChart2}
        eyebrow="Finance & insights"
        title="Reports"
        subtitle="Sales, GST, inventory and purchase reports. Downloads are generated by the server."
      />

      {failed.length > 0 && (
        <SectionError
          title="Some data could not be loaded"
          message={failed.map(([k, s]) => `${LABELS[k]}: ${s.error}`).join(" · ")}
          onRetry={() => reload(failed.map(([k]) => k))}
        />
      )}
      {downloadError && (
        <div className="ins-error rep-error" role="alert">
          <div className="ins-error__text">
            <strong>Download failed</strong>
            <span>{downloadError}</span>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => setDownloadError(null)}>
            <X size={14} aria-hidden="true" /> Dismiss
          </button>
        </div>
      )}

      <div className="rep-top">
        <GradientCard variant="brand" className="rep-summary">
          <div className="sum-box">
            <div className="sum-label">Today</div>
            {isPending(sec.invoices) ? (
              <span className="mb-skel mb-skel--value" />
            ) : (
              <div className="sum-value">{money(todaySummary.total)}</div>
            )}
            <div className="sum-sub">
              <span className="sum-chip">{todaySummary.invoices} invoices</span>
              <span className="sum-chip">GST {money(todaySummary.gst)}</span>
            </div>
          </div>
          <ReceiptText className="sum-art" size={84} aria-hidden="true" />
        </GradientCard>

        <section className="card ins-card rep-customer" aria-label="Customer report">
          <div className="ins-card__head">
            <div className="ins-card__title">
              <span className="ins-card__icon ins-card__icon--purple" aria-hidden="true">
                <UserRound size={18} />
              </span>
              <div>
                <h3>Customer Report</h3>
                <p>Every invoice of one customer (all time), as PDF</p>
              </div>
            </div>
          </div>
          <div className="rep-customer-row">
            <select
              className="sel rep-customer-select"
              aria-label="Customer for report"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              disabled={customerOptions.length === 0}
            >
              <option value="">{customerOptions.length === 0 ? (isPending(sec.customers) ? "Loading customers..." : "No customers available") : "Select a customer..."}</option>
              {customerOptions.map((c) => (
                <option key={c.customerId} value={c.customerId}>
                  {c.name}
                  {c.contactNumber ? ` (${c.contactNumber})` : ""}
                </option>
              ))}
            </select>
            <AnimatedButton
              icon={Download}
              loading={downloading === "customer"}
              disabled={!customerId || downloading !== null}
              onClick={() => downloadReport("customer", () => reportsAPI.customer(customerId), `customer_${customerId}.pdf`)}
            >
              Customer PDF
            </AnimatedButton>
          </div>
        </section>
      </div>

      <section className="rep-catalogue rep-actions" aria-label="Report downloads">
        {CATALOGUE.map((g) => (
          <div className="rep-group" key={g.group}>
            <h2 className="rep-group__title">{g.group}</h2>
            <div className="rep-group__grid mb-stagger">
              {g.items.map((r) => {
                const Icon = r.icon;
                return (
                  <article className={`card rep-report mb-lift rep-report--${g.group.toLowerCase()}`} key={r.id}>
                    <div className="rep-report__head">
                      <span className="rep-report__icon" aria-hidden="true">
                        <Icon size={20} />
                      </span>
                      <span className="rep-report__period">{r.period}</span>
                    </div>
                    <p className="rep-report__desc">{r.desc}</p>
                    <AnimatedButton
                      variant={r.primary ? "primary" : "default"}
                      size="sm"
                      icon={r.file.endsWith(".csv") ? FileSpreadsheet : FileText}
                      loading={downloading === r.id}
                      disabled={downloading !== null}
                      onClick={() => downloadReport(r.id, r.fetcher, r.file)}
                    >
                      {r.label}
                    </AnimatedButton>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
        <p className="ins-note">Downloads cover the period on each card (set by the server) and ignore the on-screen date filter below.</p>
      </section>

      <section className="card rep-filter" aria-label="On-screen date filter">
        <div className="rep-filter__fields">
          <label className="rep-filter__field">
            <span>From</span>
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
          </label>
          <label className="rep-filter__field">
            <span>To</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          </label>
          <button type="button" className="btn btn-sm" onClick={() => { setFrom(""); setTo(""); }} disabled={!rangeActive}>
            Clear dates
          </button>
        </div>
        <p className={`rep-filter__note ${rangeInvalid ? "is-bad" : ""}`} role="status">
          {rangeText}. Applies to the GST summary, Daily Sales and Recent Invoices views.
        </p>
      </section>

      <div className="rep-gst">
        <ChartCard
          title="GST Summary"
          subtitle={`Taxable value, CGST and SGST per month · ${rangeActive && !rangeInvalid ? "selected dates" : "all dates"}`}
          loading={isPending(sec.invoices)}
          empty={gst.months.length === 0}
          emptyText="No invoices in the selected dates."
          height={250}
        >
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={gst.months} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} axisLine={false} width={64} tickFormatter={inrShort} />
              <Tooltip {...tooltipProps} formatter={(v, n) => [inrFull(v), n]} />
              <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="taxable" name="Taxable" stackId="g" fill={CHART_COLORS[0]} maxBarSize={40} {...anim} />
              <Bar dataKey="cgst" name="CGST" stackId="g" fill={CHART_COLORS[2]} maxBarSize={40} {...anim} />
              <Bar dataKey="sgst" name="SGST" stackId="g" fill={CHART_COLORS[4]} radius={[4, 4, 0, 0]} maxBarSize={40} {...anim} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <section className="card ins-card rep-gst-totals" aria-label="GST totals">
          <div className="ins-card__head">
            <div>
              <h3>GST Totals</h3>
              <p>{gst.count} invoices · {rangeActive && !rangeInvalid ? "selected dates" : "all dates"}</p>
            </div>
          </div>
          {isPending(sec.invoices) ? (
            <LoadingSkeleton variant="lines" rows={4} />
          ) : (
            <dl className="rep-gst-list">
              <div><dt>Taxable value</dt><dd>{money(gst.taxable)}</dd></div>
              <div><dt>CGST</dt><dd>{money(gst.cgst)}</dd></div>
              <div><dt>SGST</dt><dd>{money(gst.sgst)}</dd></div>
              <div><dt>Total GST</dt><dd>{money(gst.cgst + gst.sgst)}</dd></div>
              <div className="is-total"><dt>Gross (incl. GST)</dt><dd>{money(gst.grand)}</dd></div>
            </dl>
          )}
        </section>
      </div>

      <div className="rep-tabs" role="group" aria-label="Report views">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={tab === id} className={`rep-tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
            {label}
            {DATED_TABS.has(id) && rangeActive && !rangeInvalid ? <span className="rep-tab__dot" aria-hidden="true" /> : null}
          </button>
        ))}
      </div>

      {/* key: each tab gets a fresh table (search text, sort and page must not leak between tabs) */}
      <div className="rep-table" key={tab}>
        {isPending(tablePending) ? (
          <div className="card rep-table-loading">
            <LoadingSkeleton variant="table" rows={6} label="Loading report" />
          </div>
        ) : tab === "daily" ? (
          <DataTable
            title="Daily Sales Report"
            subtitle={dailyRows.length ? `Taxable, CGST, SGST and gross totals per day · ${rangeText}` : "No invoices for these dates"}
            columns={[
              { key: "date", header: "Date" },
              { key: "invoices", header: "Invoices", align: "right" },
              { key: "taxable", header: "Taxable", align: "right", cell: (v) => money(v) },
              { key: "cgst", header: "CGST", align: "right", cell: (v) => money(v) },
              { key: "sgst", header: "SGST", align: "right", cell: (v) => money(v) },
              { key: "grand", header: "Gross", align: "right", cell: (v) => money(v) },
            ]}
            rows={dailyRows}
            rowKey={(r) => r.date}
            initialPageSize={10}
          />
        ) : tab === "invoices" ? (
          <DataTable
            title="Recent Invoices"
            subtitle={invoiceRows.length ? `Search by invoice number or customer · ${rangeText}` : "No invoices for these dates"}
            columns={[
              { key: "invoiceNumber", header: "Invoice" },
              { key: "date", header: "Date/Time", searchable: false },
              { key: "customer", header: "Customer" },
              { key: "amount", header: "Amount", align: "right", cell: (v) => money(v), searchable: false },
              { key: "amountPaid", header: "Paid", align: "right", cell: (v) => money(v), searchable: false },
              { key: "balanceDue", header: "Balance", align: "right", cell: (v) => money(v), searchable: false },
              { key: "paymentStatus", header: "Status", cell: (v) => <StatusBadge status={v} size="sm" label={v} /> },
            ]}
            rows={invoiceRows}
            rowKey={(r) => r.invoiceId}
            initialPageSize={10}
          />
        ) : tab === "stock" ? (
          <DataTable
            title="Stock Report"
            subtitle={stockReport.length ? "Batch-wise units on hand and expiry (current stock)" : "No stock batches"}
            columns={[
              { key: "name", header: "Medicine" },
              { key: "company", header: "Company" },
              { key: "batch", header: "Batch" },
              { key: "stock", header: "Units", align: "right", cell: (v) => v.toLocaleString("en-IN") },
              { key: "mrp", header: "MRP / pack", align: "right", cell: (v) => money(v) },
              { key: "expiry", header: "Expiry" },
            ]}
            rows={stockReport}
            rowKey={(r) => r.batchId}
            initialPageSize={15}
          />
        ) : tab === "profit" ? (
          <DataTable
            title="Profit & Loss Statement"
            subtitle={profitLossReport.length ? "Profit = taxable value minus cost (GST excluded)" : "Summary figures are unavailable"}
            columns={[
              { key: "metric", header: "Metric" },
              { key: "value", header: "Value", align: "right", cell: (v) => money(v) },
            ]}
            rows={profitLossReport}
            rowKey={(r) => r.metric}
            searchable={false}
            initialPageSize={10}
          />
        ) : tab === "alphabetical" ? (
          <DataTable
            title="Alphabetical List of Medicines"
            subtitle={alphabeticalMedicines.length ? "All medicines sorted alphabetically" : "No medicines yet"}
            columns={[
              { key: "name", header: "Medicine Name" },
              { key: "company", header: "Company" },
              { key: "genericName", header: "Generic Name" },
              { key: "stripSize", header: "Units / pack", align: "right" },
              { key: "price", header: "Price / pack", align: "right", cell: (v) => money(v) },
              { key: "stock", header: "Stock (units)", align: "right", cell: (v) => v.toLocaleString("en-IN") },
            ]}
            rows={alphabeticalMedicines}
            rowKey={(r) => r.productId}
            initialPageSize={20}
          />
        ) : null}
      </div>
    </div>
  );
}

export default Reports;
