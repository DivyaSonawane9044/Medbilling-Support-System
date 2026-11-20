import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  ClipboardList,
  PackageCheck,
  Plus,
  Trash2,
  Truck,
  IndianRupee,
  Clock,
  CalendarCheck,
  Users,
  Eye,
  Boxes,
  FileText,
} from "lucide-react";
import {
  PageHeader,
  StatCard,
  StatusBadge,
  ProgressCard,
  ChartCard,
  Timeline,
  Modal,
  DataTable,
  EmptyState,
  LoadingSkeleton,
  FormField,
  TextInput,
  Select,
  inr,
} from "../components/ui";
import { CHART_COLORS, axisProps, gridProps, tooltipProps, chartAnimation, inrShort, inrFull } from "../utils/chartTheme";
import "./Purchases.css";
import { suppliersAPI, purchasesAPI, productsAPI, handleApiError } from "../services/api";

const money = (v) =>
  `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (v) => {
  if (!v) return "—";
  const [y, m, d] = String(v).split("T")[0].split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d).toLocaleDateString("en-IN") : String(v);
};
const monthKey = (v) => String(v || "").slice(0, 7); // "YYYY-MM"

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

let lineSeq = 0;
const newLine = () => ({
  key: ++lineSeq,
  productId: "",
  batchNumber: "",
  mfgDate: "",
  expiryDate: "",
  mrp: "",
  costPrice: "",
  sellingPrice: "",
  stripQuantity: "",
});

const EMPTY_PO = { supplierId: "", invoiceNumber: "", purchaseDate: "", totalAmount: "" };
const EMPTY_RECEIPT = { pendingId: "", supplierId: "", invoiceNumber: "", purchaseDate: "" };

function Msg({ msg }) {
  if (!msg) return null;
  return (
    <div className={`pur-msg pur-msg-${msg.type} mb-animate-in`} role={msg.type === "error" ? "alert" : "status"}>
      {msg.text}
    </div>
  );
}

function SectionTitle({ n, title, hint }) {
  return (
    <div className="pur-section-title">
      <span className="pur-step" aria-hidden="true">{n}</span>
      <span className="pur-section-name">{title}</span>
      {hint ? <span className="pur-section-hint">{hint}</span> : null}
    </div>
  );
}

function validateLine(line, idx, today) {
  const n = `Line ${idx + 1}`;
  if (!line.productId) return `${n}: select a product.`;
  if (!line.batchNumber.trim()) return `${n}: batch number is required.`;
  if (!line.mfgDate) return `${n}: manufacturing date is required.`;
  if (!line.expiryDate) return `${n}: expiry date is required.`;
  if (line.mfgDate > today) return `${n}: manufacturing date cannot be in the future.`;
  if (line.expiryDate <= line.mfgDate) return `${n}: expiry date must be after the manufacturing date.`;
  if (line.expiryDate <= today) return `${n}: expiry date must be in the future.`;
  const qty = Number(line.stripQuantity);
  if (!Number.isInteger(qty) || qty <= 0) return `${n}: strip quantity must be a whole number greater than 0.`;
  const mrp = Number(line.mrp);
  const cost = Number(line.costPrice);
  const sell = Number(line.sellingPrice);
  if (line.mrp === "" || !(mrp > 0)) return `${n}: MRP is required.`;
  if (line.costPrice === "" || !(cost > 0)) return `${n}: cost price is required.`;
  if (line.sellingPrice === "" || !(sell > 0)) return `${n}: selling price is required.`;
  if (sell > mrp) return `${n}: selling price cannot exceed MRP.`;
  return null;
}

function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [pending, setPending] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pending purchase order form
  const [po, setPo] = useState(EMPTY_PO);
  const [poSaving, setPoSaving] = useState(false);
  const [poMsg, setPoMsg] = useState(null);

  // Receive stock form
  const [receipt, setReceipt] = useState(EMPTY_RECEIPT);
  const [lines, setLines] = useState(() => [newLine()]);
  const [rcvSaving, setRcvSaving] = useState(false);
  const [rcvMsg, setRcvMsg] = useState(null);

  const loadData = useCallback(async () => {
    const [suppliersRes, purchasesRes, pendingRes, productsRes] = await Promise.all([
      suppliersAPI.getAll(),
      purchasesAPI.getAll(),
      purchasesAPI.getPending(),
      productsAPI.getAll(),
    ]);
    const list = (res) => {
      const d = res.data?.content ?? res.data;
      return Array.isArray(d) ? d : [];
    };
    setSuppliers(list(suppliersRes));
    setPurchases(list(purchasesRes));
    setPending(list(pendingRes));
    setProducts(list(productsRes));
  }, []);

  const initialLoad = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await loadData();
    } catch (err) {
      setError(handleApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, [loadData]);

  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: String(s.supplierId), label: s.company ? `${s.name} (${s.company})` : s.name })),
    [suppliers]
  );

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: String(p.productId),
        label: `${p.name}${p.company ? ` (${p.company})` : ""}${p.stripSize ? ` • ${p.stripSize}/pack` : ""}`,
      })),
    [products]
  );

  const pendingOptions = useMemo(
    () => [
      { value: "none", label: "No — new supplier invoice" },
      ...pending.map((p) => ({
        value: String(p.invoiceId),
        label: `${p.invoiceNumber} — ${p.supplierName || "Unknown supplier"}${Number(p.totalAmount) > 0 ? ` (${money(p.totalAmount)})` : ""}`,
      })),
    ],
    [pending]
  );

  const selectedPending = useMemo(
    () => pending.find((p) => String(p.invoiceId) === receipt.pendingId) || null,
    [pending, receipt.pendingId]
  );

  const rows = useMemo(
    () =>
      purchases.map((p) => ({
        id: p.invoiceId,
        supplier: p.supplierName || "—",
        invoiceNo: p.invoiceNumber,
        date: p.purchaseDate,
        amount: Number(p.totalAmount) || 0,
        status: p.status || "—",
        batchCount: p.batchCount ?? 0,
        supplierId: p.supplierId ?? null,
      })),
    [purchases]
  );

  const previewTotal = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.costPrice) || 0) * (Number(l.stripQuantity) || 0), 0),
    [lines]
  );

  async function createPurchaseOrder(e) {
    e.preventDefault();
    if (!po.supplierId) {
      setPoMsg({ type: "error", text: "Select a supplier." });
      return;
    }
    if (!po.invoiceNumber.trim()) {
      setPoMsg({ type: "error", text: "PO / invoice reference is required." });
      return;
    }
    if (po.totalAmount !== "" && !(Number(po.totalAmount) >= 0)) {
      setPoMsg({ type: "error", text: "Expected amount cannot be negative." });
      return;
    }
    const body = { supplierId: Number(po.supplierId), invoiceNumber: po.invoiceNumber.trim() };
    if (po.purchaseDate) body.purchaseDate = po.purchaseDate;
    if (po.totalAmount !== "") body.totalAmount = Number(po.totalAmount);
    try {
      setPoSaving(true);
      setPoMsg(null);
      const res = await purchasesAPI.createOrder(body);
      setPo(EMPTY_PO);
      setPoMsg({ type: "success", text: `Purchase order ${res.data?.invoiceNumber || body.invoiceNumber} created (PENDING).` });
      await loadData();
    } catch (err) {
      setPoMsg({ type: "error", text: handleApiError(err).message });
    } finally {
      setPoSaving(false);
    }
  }

  function choosePending(value) {
    if (value === "none") {
      setReceipt({ ...receipt, pendingId: "", supplierId: "" });
      return;
    }
    const order = pending.find((p) => String(p.invoiceId) === value);
    setReceipt({
      ...receipt,
      pendingId: value,
      supplierId: order?.supplierId != null ? String(order.supplierId) : "",
      invoiceNumber: "",
    });
  }

  function updateLine(key, field, value) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  }

  function removeLine(key) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  async function receiveStock(e) {
    e.preventDefault();
    const today = todayISO();
    if (!receipt.supplierId) {
      setRcvMsg({ type: "error", text: "Select a supplier." });
      return;
    }
    if (!selectedPending && !receipt.invoiceNumber.trim()) {
      setRcvMsg({ type: "error", text: "Supplier invoice number is required." });
      return;
    }
    for (let i = 0; i < lines.length; i += 1) {
      const problem = validateLine(lines[i], i, today);
      if (problem) {
        setRcvMsg({ type: "error", text: problem });
        return;
      }
    }

    const payload = {
      supplierId: Number(receipt.supplierId),
      batchItems: lines.map((l) => ({
        productId: Number(l.productId),
        batchNumber: l.batchNumber.trim(),
        mfgDate: l.mfgDate,
        expiryDate: l.expiryDate,
        mrp: Number(l.mrp),
        costPrice: Number(l.costPrice),
        sellingPrice: Number(l.sellingPrice),
        stripQuantity: Number(l.stripQuantity),
      })),
    };
    if (selectedPending) payload.purchaseInvoiceId = selectedPending.invoiceId;
    if (receipt.invoiceNumber.trim()) payload.invoiceNumber = receipt.invoiceNumber.trim();
    if (receipt.purchaseDate) payload.purchaseDate = receipt.purchaseDate;

    try {
      setRcvSaving(true);
      setRcvMsg(null);
      const res = await purchasesAPI.receiveStock(payload);
      const ref = res.data?.invoiceNumber || selectedPending?.invoiceNumber || payload.invoiceNumber;
      setReceipt(EMPTY_RECEIPT);
      setLines([newLine()]);
      setRcvMsg({
        type: "success",
        text: `Stock received against ${ref}: ${payload.batchItems.length} batch${payload.batchItems.length === 1 ? "" : "es"} added to inventory.`,
      });
      await loadData();
    } catch (err) {
      setRcvMsg({ type: "error", text: handleApiError(err).message });
    } finally {
      setRcvSaving(false);
    }
  }

  /* ---------- Overview figures (all from purchasesAPI.getAll) ---------- */
  const stats = useMemo(() => {
    const thisMonth = monthKey(todayISO());
    const received = purchases.filter((p) => p.status === "RECEIVED");
    const pend = purchases.filter((p) => p.status === "PENDING");
    const sum = (rows) => rows.reduce((s, p) => s + (Number(p.totalAmount) || 0), 0);
    const monthRows = received.filter((p) => monthKey(p.purchaseDate) === thisMonth);
    return {
      receivedValue: sum(received),
      receivedCount: received.length,
      pendingCount: pend.length,
      pendingValue: sum(pend),
      monthValue: sum(monthRows),
      monthCount: monthRows.length,
      suppliers: new Set(purchases.map((p) => p.supplierId).filter((x) => x != null)).size,
      total: purchases.length,
    };
  }, [purchases]);

  // Received value for the last 6 calendar months (months with no receipts show 0)
  const monthly = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: d.toLocaleDateString("en-IN", { month: "short" }), value: 0, count: 0 });
    }
    purchases.forEach((p) => {
      if (p.status !== "RECEIVED") return;
      const m = months.find((x) => x.key === monthKey(p.purchaseDate));
      if (m) {
        m.value += Number(p.totalAmount) || 0;
        m.count += 1;
      }
    });
    return months;
  }, [purchases]);
  const monthlyEmpty = monthly.every((m) => m.count === 0);

  const recent = useMemo(
    () =>
      [...purchases]
        .sort((a, b) => String(b.purchaseDate || "").localeCompare(String(a.purchaseDate || "")) || (b.invoiceId ?? 0) - (a.invoiceId ?? 0))
        .slice(0, 6),
    [purchases]
  );

  /* ---------- Detail view (supplier history carries the batches per invoice) ---------- */
  const [detail, setDetail] = useState(null); // { row, loading, error, items }

  async function openDetail(row) {
    setDetail({ row, loading: true, error: null, items: [] });
    if (row.status !== "RECEIVED" || row.supplierId == null) {
      setDetail({ row, loading: false, error: null, items: [] });
      return;
    }
    try {
      const res = await suppliersAPI.getHistory(row.supplierId);
      const list = Array.isArray(res.data) ? res.data : [];
      const inv = list.find((h) => h.invoiceId === row.id) || list.find((h) => h.invoiceNumber === row.invoiceNo);
      setDetail((d) => (d && d.row.id === row.id ? { row, loading: false, error: null, items: inv?.items || [] } : d));
    } catch (err) {
      setDetail((d) => (d && d.row.id === row.id ? { row, loading: false, error: handleApiError(err).message, items: [] } : d));
    }
  }

  if (loading) {
    return (
      <div className="mb-page pur">
        <PageHeader icon={Truck} eyebrow="Stock" title="Purchases" subtitle="Loading purchases, suppliers and products…" />
        <LoadingSkeleton variant="stats" rows={4} label="Loading purchases" />
        <div className="card pur-skel"><LoadingSkeleton variant="table" rows={5} /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-page pur">
        <PageHeader icon={Truck} eyebrow="Stock" title="Purchases" subtitle="Raise purchase orders and receive supplier stock into inventory batches" />
        <div className="card pur-error-card">
          <div className="pur-msg pur-msg-error">Could not load data: {error}</div>
          <button className="btn" type="button" onClick={initialLoad}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const today = todayISO();
  const doneShare = stats.total > 0 ? Math.round((stats.receivedCount / stats.total) * 100) : 0;

  return (
    <div className="mb-page pur">
      <PageHeader
        icon={Truck}
        eyebrow="Stock"
        title="Purchases"
        subtitle="Raise purchase orders and receive supplier stock into inventory batches"
        actions={
          pending.length > 0 ? (
            <StatusBadge status="PENDING" label={`${pending.length} pending order${pending.length === 1 ? "" : "s"}`} />
          ) : null
        }
      />

      {suppliers.length === 0 && (
        <div className="pur-msg pur-msg-error">No suppliers yet — add a supplier on the Suppliers page first.</div>
      )}
      {products.length === 0 && (
        <div className="pur-msg pur-msg-error">No products yet — add products before receiving stock.</div>
      )}

      <section className="mb-grid-stats pur-kpis mb-stagger" aria-label="Purchase overview">
        <StatCard icon={IndianRupee} label="Total received value" value={stats.receivedValue} format={inr} tone="teal"
          hint={`${stats.receivedCount} received invoice${stats.receivedCount === 1 ? "" : "s"}`} testId="pur-kpi-total" />
        <StatCard icon={Clock} label="Pending orders" value={stats.pendingCount} tone="warning"
          hint={stats.pendingValue > 0 ? `${inr(stats.pendingValue)} expected` : "Awaiting delivery"} testId="pur-kpi-pending" />
        <StatCard icon={CalendarCheck} label="Received this month" value={stats.monthValue} format={inr} tone="ice"
          hint={`${stats.monthCount} invoice${stats.monthCount === 1 ? "" : "s"} this month`} testId="pur-kpi-month" />
        <StatCard icon={Users} label="Suppliers involved" value={stats.suppliers} tone="lavender"
          hint={`of ${suppliers.length} supplier${suppliers.length === 1 ? "" : "s"} on file`} testId="pur-kpi-suppliers" />
      </section>

      <div className="pur-overview">
        <div className="pur-overview__left">
          <ProgressCard
            icon={PackageCheck}
            title="Orders received"
            value={stats.receivedCount}
            max={Math.max(stats.total, 0)}
            tone="success"
            caption={
              stats.total === 0
                ? "No purchase orders or invoices yet."
                : `${doneShare}% received · ${stats.pendingCount} still pending`
            }
          />
          <ChartCard
            title="Stock received per month"
            subtitle="Value of received supplier invoices, last 6 months"
            height={200}
            empty={monthlyEmpty}
            emptyText="No stock received in the last 6 months."
            testId="pur-monthly-chart"
          >
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={inrShort} width={56} />
                <Tooltip {...tooltipProps} formatter={(v, _n, item) => [`${inrFull(v)} · ${item.payload.count} invoice${item.payload.count === 1 ? "" : "s"}`, "Received"]} />
                <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} maxBarSize={44} {...chartAnimation()} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <section className="card mb-chartcard pur-timeline-card" data-testid="pur-timeline">
          <div className="mb-chartcard__head">
            <div>
              <h3 className="mb-chartcard__title">Purchase timeline</h3>
              <p className="mb-chartcard__sub">Latest orders and receipts</p>
            </div>
          </div>
          {recent.length === 0 ? (
            <EmptyState compact icon={ClipboardList} title="No activity yet" message="Create a purchase order or receive stock to start the timeline." />
          ) : (
            <Timeline
              items={recent.map((p) => ({
                key: `tl${p.invoiceId}`,
                tone: p.status === "RECEIVED" ? "success" : "warning",
                icon: p.status === "RECEIVED" ? PackageCheck : Clock,
                title: (
                  <span>
                    {p.invoiceNumber} <span className="pur-tl-sup">· {p.supplierName || "—"}</span>
                  </span>
                ),
                meta: `${fmtDate(p.purchaseDate)} · ${p.status === "RECEIVED" ? `${p.batchCount ?? 0} batch${p.batchCount === 1 ? "" : "es"} received` : "awaiting delivery"}`,
                right: <span className="pur-tl-amt">{money(p.totalAmount)}</span>,
              }))}
            />
          )}
        </section>
      </div>

      <div className="pur-grid">
        <form className="card pur-form" onSubmit={createPurchaseOrder} noValidate>
          <div className="pur-form-head">
            <span className="pur-form-icon pur-form-icon--amber" aria-hidden="true"><ClipboardList size={18} /></span>
            <div>
              <h3>Create Purchase Order (Pending)</h3>
              <p>Records an order you expect to receive later</p>
            </div>
          </div>
          <div className="pur-form-body">
            <SectionTitle n="1" title="Supplier & reference" />
            <FormField label="Supplier" required>
              <Select aria-label="PO supplier"
                value={po.supplierId}
                onChange={(e) => setPo({ ...po, supplierId: e.target.value })}
                options={supplierOptions}
                placeholder="Select supplier"
              />
            </FormField>
            <FormField label="PO / Invoice reference" required>
              <TextInput aria-label="PO reference" value={po.invoiceNumber} onChange={(e) => setPo({ ...po, invoiceNumber: e.target.value })} placeholder="PO number" />
            </FormField>
            <SectionTitle n="2" title="Expected delivery" hint="Optional" />
            <div className="pur-two">
              <FormField label="Order date" hint="Optional">
                <TextInput aria-label="PO order date" type="date" max={today} value={po.purchaseDate} onChange={(e) => setPo({ ...po, purchaseDate: e.target.value })} />
              </FormField>
              <FormField label="Expected amount (₹)" hint="Optional"
                error={po.totalAmount !== "" && Number(po.totalAmount) < 0 ? "Cannot be negative" : null}>
                <TextInput aria-label="PO expected amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={po.totalAmount}
                  onChange={(e) => setPo({ ...po, totalAmount: e.target.value })}
                  placeholder="0.00"
                  inputMode="decimal"
                />
              </FormField>
            </div>
            <Msg msg={poMsg} />
            <button className="btn btn-navy pur-submit" type="submit" disabled={poSaving}>
              <ClipboardList size={16} aria-hidden="true" /> {poSaving ? "Creating…" : "Create Pending PO"}
            </button>
          </div>
        </form>

        <form className="card pur-form pur-form--receive" onSubmit={receiveStock} noValidate>
          <div className="pur-form-head">
            <span className="pur-form-icon" aria-hidden="true"><PackageCheck size={18} /></span>
            <div>
              <h3>Receive Stock</h3>
              <p>Creates inventory batches (and the purchase invoice, unless receiving a pending order)</p>
            </div>
          </div>
          <div className="pur-form-body">
            <SectionTitle n="1" title="Source invoice" />
            <FormField label="Receive against pending order" hint={pending.length === 0 ? "None pending" : undefined}>
              <Select aria-label="Receive against pending order"
                value={receipt.pendingId || "none"}
                onChange={(e) => choosePending(e.target.value)}
                options={pendingOptions}
                placeholder="Select pending order"
              />
            </FormField>
            {selectedPending && (
              <div className="pur-po-chip">
                <FileText size={14} aria-hidden="true" />
                Receiving PO <strong>{selectedPending.invoiceNumber}</strong> from {selectedPending.supplierName || "supplier"}
                {Number(selectedPending.totalAmount) > 0 ? <> · expected {money(selectedPending.totalAmount)}</> : null}
              </div>
            )}
            <div className="pur-three">
              <FormField label="Supplier" required>
                <Select aria-label="Receipt supplier"
                  value={receipt.supplierId}
                  onChange={(e) => setReceipt({ ...receipt, supplierId: e.target.value })}
                  options={supplierOptions}
                  placeholder="Select supplier"
                  disabled={!!selectedPending}
                />
              </FormField>
              <FormField
                label="Supplier invoice number"
                required={!selectedPending}
                hint={selectedPending ? `Optional — PO ${selectedPending.invoiceNumber}` : undefined}
              >
                <TextInput aria-label="Receipt supplier invoice number"
                  value={receipt.invoiceNumber}
                  onChange={(e) => setReceipt({ ...receipt, invoiceNumber: e.target.value })}
                  placeholder={selectedPending ? selectedPending.invoiceNumber : "INV / BILL NO"}
                />
              </FormField>
              <FormField label="Received date" hint="Optional">
                <TextInput aria-label="Receipt received date"
                  type="date"
                  max={today}
                  value={receipt.purchaseDate}
                  onChange={(e) => setReceipt({ ...receipt, purchaseDate: e.target.value })}
                />
              </FormField>
            </div>

            <SectionTitle n="2" title="Batch lines" hint={`${lines.length} line${lines.length === 1 ? "" : "s"}`} />
            <div className="pur-lines">
              {lines.map((line, idx) => {
                const qty = Number(line.stripQuantity) || 0;
                const cost = Number(line.costPrice) || 0;
                const sellOverMrp = line.sellingPrice !== "" && line.mrp !== "" && Number(line.sellingPrice) > Number(line.mrp);
                const badDates = line.mfgDate && line.expiryDate && line.expiryDate <= line.mfgDate;
                const futureMfg = line.mfgDate && line.mfgDate > today;
                const pastExpiry = !badDates && line.expiryDate && line.expiryDate <= today;
                const badQty = line.stripQuantity !== "" && !(Number.isInteger(Number(line.stripQuantity)) && Number(line.stripQuantity) > 0);
                const costOverMrp = line.costPrice !== "" && line.mrp !== "" && Number(line.costPrice) > Number(line.mrp);
                const productName = products.find((p) => String(p.productId) === line.productId)?.name;
                return (
                  <div className="pur-line mb-animate-in" key={line.key}>
                    <div className="pur-line-head">
                      <span className="pur-line-no" aria-hidden="true">{idx + 1}</span>
                      <div className="pur-line-title">
                        <strong>Batch line {idx + 1}</strong>
                        <span>{productName || "Choose a product"}</span>
                      </div>
                      <span className="pur-line-total">{money(cost * qty)}</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm pur-line-remove"
                        onClick={() => removeLine(line.key)}
                        disabled={lines.length === 1}
                        title="Remove line"
                        aria-label={`Remove batch line ${idx + 1}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="pur-line-grid">
                      <div className="pur-line-wide">
                        <FormField label="Product" required>
                          <Select aria-label={`Line ${idx + 1} product`}
                            value={line.productId}
                            onChange={(e) => updateLine(line.key, "productId", e.target.value)}
                            options={productOptions}
                            placeholder="Select product"
                          />
                        </FormField>
                      </div>
                      <FormField label="Batch no." required>
                        <TextInput aria-label={`Line ${idx + 1} batch no.`} value={line.batchNumber} onChange={(e) => updateLine(line.key, "batchNumber", e.target.value)} placeholder="BATCH-001" />
                      </FormField>
                      <FormField label="Strips" required error={badQty ? "Whole number above 0" : null}>
                        <TextInput aria-label={`Line ${idx + 1} strips`}
                          type="number"
                          min="1"
                          step="1"
                          value={line.stripQuantity}
                          onChange={(e) => updateLine(line.key, "stripQuantity", e.target.value)}
                          inputMode="numeric"
                        />
                      </FormField>
                      <FormField label="Mfg date" required error={futureMfg ? "Cannot be in the future" : null}>
                        <TextInput aria-label={`Line ${idx + 1} mfg date`} type="date" max={today} value={line.mfgDate} onChange={(e) => updateLine(line.key, "mfgDate", e.target.value)} />
                      </FormField>
                      <FormField label="Expiry date" required error={badDates ? "Must be after mfg date" : pastExpiry ? "Must be a future date" : null}>
                        <TextInput aria-label={`Line ${idx + 1} expiry date`}
                          type="date"
                          min={line.mfgDate && line.mfgDate > today ? line.mfgDate : today}
                          value={line.expiryDate}
                          onChange={(e) => updateLine(line.key, "expiryDate", e.target.value)}
                        />
                      </FormField>
                      <FormField label="Cost / pack (₹)" required hint={costOverMrp ? "Above MRP" : undefined}>
                        <TextInput aria-label={`Line ${idx + 1} cost / pack`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.costPrice}
                          onChange={(e) => updateLine(line.key, "costPrice", e.target.value)}
                          inputMode="decimal"
                        />
                      </FormField>
                      <FormField label="MRP / pack (₹)" required>
                        <TextInput aria-label={`Line ${idx + 1} mrp / pack`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.mrp}
                          onChange={(e) => updateLine(line.key, "mrp", e.target.value)}
                          inputMode="decimal"
                        />
                      </FormField>
                      <FormField label="Selling / pack (₹)" required error={sellOverMrp ? "Cannot exceed MRP" : null}>
                        <TextInput aria-label={`Line ${idx + 1} selling / pack`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.sellingPrice}
                          onChange={(e) => updateLine(line.key, "sellingPrice", e.target.value)}
                          inputMode="decimal"
                        />
                      </FormField>
                    </div>
                  </div>
                );
              })}
              <button type="button" className="btn pur-add-line" onClick={() => setLines((prev) => [...prev, newLine()])}>
                <Plus size={14} /> Add batch line
              </button>
            </div>

            <SectionTitle n="3" title="Review & receive" />
            <div className="pur-total">
              <span>Estimated cost (cost × strips)</span>
              <strong>{money(previewTotal)}</strong>
            </div>
            <p className="pur-note">Preview only — the server calculates the invoice total.</p>

            <Msg msg={rcvMsg} />
            <button className="btn btn-primary pur-submit" type="submit" disabled={rcvSaving}>
              <PackageCheck size={16} /> {rcvSaving ? "Saving…" : selectedPending ? `Receive ${selectedPending.invoiceNumber}` : "Receive Stock"}
            </button>
          </div>
        </form>

        <div className="pur-table">
          <DataTable
            title="Purchase Invoices"
            subtitle={rows.length === 0 ? "No purchase invoices or orders yet." : "Pending orders and received supplier invoices"}
            columns={[
              {
                key: "invoiceNo",
                header: "Invoice No",
                cell: (v) => <span className="pur-inv-no">{v}</span>,
              },
              { key: "supplier", header: "Supplier" },
              { key: "date", header: "Date", searchable: false, cell: (v) => fmtDate(v) },
              { key: "amount", header: "Amount", align: "right", cell: (v) => money(v), searchable: false },
              {
                key: "status",
                header: "Status",
                cell: (v) => <StatusBadge status={v} label={v} size="sm" />,
              },
              { key: "batchCount", header: "Batches", align: "right", searchable: false },
              {
                key: "view",
                header: "",
                sortable: false,
                searchable: false,
                accessor: () => "",
                cell: (_, r) => (
                  <button type="button" className="btn btn-ghost btn-sm pur-view" onClick={() => openDetail(r)} aria-label={`View details of ${r.invoiceNo}`}>
                    <Eye size={14} aria-hidden="true" /> View
                  </button>
                ),
              },
            ]}
            rows={rows}
            rowKey={(r) => r.id}
            initialPageSize={10}
          />
        </div>
      </div>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Purchase ${detail.row.invoiceNo}` : "Purchase details"}
        width={640}
        footer={<button type="button" className="btn" onClick={() => setDetail(null)}>Close</button>}
      >
        {detail && (
          <div className="pur-detail">
            <div className="pur-detail__summary">
              <div><span>Supplier</span><strong>{detail.row.supplier}</strong></div>
              <div><span>Date</span><strong>{fmtDate(detail.row.date)}</strong></div>
              <div><span>Amount</span><strong>{money(detail.row.amount)}</strong></div>
              <div><span>Status</span><StatusBadge status={detail.row.status} size="sm" /></div>
            </div>
            {detail.row.status !== "RECEIVED" ? (
              <EmptyState compact icon={Clock} title="Not received yet"
                message="Batches appear here once this order is received in the Receive Stock form." />
            ) : detail.loading ? (
              <LoadingSkeleton variant="lines" rows={3} label="Loading batches" />
            ) : detail.error ? (
              <div className="pur-msg pur-msg-error">Could not load batches: {detail.error}</div>
            ) : detail.items.length === 0 ? (
              <EmptyState compact icon={Boxes} title="No batch details" message="The supplier history has no batch lines for this invoice." />
            ) : (
              <ul className="pur-detail__items">
                {detail.items.map((it, i) => (
                  <li key={`${it.batchNumber}-${i}`} className="pur-detail__item">
                    <div className="pur-detail__item-main">
                      <strong>{it.productName}</strong>
                      <span>{it.company || "—"} · batch <span className="pur-inv-no">{it.batchNumber}</span> · exp {fmtDate(it.expiryDate)}</span>
                    </div>
                    <div className="pur-detail__item-nums">
                      <span>{it.quantity} strips{it.remainingStrips != null ? ` · ${it.remainingStrips} left` : ""}</span>
                      <span>Cost {money(it.costPrice)} · MRP {money(it.mrp)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Purchases;
