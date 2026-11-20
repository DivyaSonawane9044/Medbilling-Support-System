import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  Clock,
  AlertTriangle,
  RotateCcw,
  Layers,
  FileText,
  CalendarDays,
  CalendarClock,
  RefreshCw,
  CheckCircle2,
  Trash2,
  XOctagon,
  ShieldCheck,
  Truck,
  IndianRupee,
  PackageSearch,
} from "lucide-react";
import { PageHeader, StatCard, StatusBadge, ProgressBar, LoadingSkeleton, Timeline, Modal, DataTable, inr } from "../components/ui";
import QuietEmpty from "./stock/QuietEmpty";
import { parseLocalDate, daysUntil, fmtDate } from "./stock/stockUtils";
import { axisProps, gridProps, tooltipProps, chartAnimation, inrShort } from "../utils/chartTheme";
import { inventoryAPI, analyticsAPI, purchasesAPI, reportsAPI, downloadBlob, handleApiError } from "../services/api";
import "./ExpiryTracking.css";

const STOCK_ALERT_THRESHOLD = 30; // % of target stock level
const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

// Status colours for the bucket chart (chart props may use raw hex; they mirror --mb-danger / --mb-warning / amber / info).
const BUCKET_COLORS = ["#f87171", "#fb923c", "#fbbf24", "#7cb7ff"];

const NEAR_EXPIRY_MONTHS = 3;

function isWithinNearExpiry(value) {
  const exp = parseLocalDate(value);
  if (!exp) return false;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setMonth(cutoff.getMonth() + NEAR_EXPIRY_MONTHS);
  return exp <= cutoff;
}

function normalizeBatch(item) {
  const product = item.product || {};
  const unitsPerPack = Math.max(1, Number(product.stripSize) || 1);
  const stripQty = item.stripStock ?? 0;
  const tabletQty = item.tabletStock ?? 0;
  const totalUnits = item.totalUnits ?? stripQty * unitsPerPack + tabletQty;
  const costPrice = Number(item.costPrice) || 0;
  const exp = item.expiryDate ? String(item.expiryDate).split("T")[0] : null;
  const daysToExpiry = daysUntil(exp);

  return {
    batchId: item.batchId,
    productId: product.productId,
    name: product.name || "Unknown",
    company: product.company || "—",
    batch: item.batchNumber || "—",
    mfg: item.mfgDate ? String(item.mfgDate).split("T")[0] : "—",
    exp: exp || "—",
    daysToExpiry,
    stripQty,
    tabletQty,
    unitsPerPack,
    totalUnits,
    costPrice,
    mrp: Number(item.mrp) || 0,
    supplierId: item.supplierId ?? null,
    supplier: item.supplierName || "Opening stock",
    totalValue: (costPrice / unitsPerPack) * totalUnits,
    stockLabel: `${stripQty} packs + ${tabletQty} loose (${totalUnits} units)`,
    isExpired: daysToExpiry !== null && daysToExpiry < 0,
    // stock-list's isNearExpiry is a stored flag that is not kept up to date, so derive it from the expiry date
    // (same 3-month window as the near-expiry endpoint).
    isNearExpiry: daysToExpiry !== null && daysToExpiry >= 0 && (isWithinNearExpiry(exp) || !!item.isNearExpiry),
  };
}

const daysText = (v) => (v === null ? "—" : v < 0 ? `Expired (${Math.abs(v)}d ago)` : v === 0 ? "Expires today" : `${v} days`);

const ENDPOINT_LABELS = ["near-expiry batches", "expired batches", "stock alerts", "pending purchases", "batch stock", "stock summary"];

function initialTabFor(pathname) {
  if (pathname.startsWith("/stock-alerts")) return "lowStock";
  return "nearExpiry";
}

function ExpiryTracking() {
  const location = useLocation();
  const [tab, setTab] = useState(() => initialTabFor(location.pathname));
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [actionError, setActionError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const [writingOffId, setWritingOffId] = useState(null);

  // Data
  const [nearExpiry, setNearExpiry] = useState([]);
  const [expired, setExpired] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [pendingPurchases, setPendingPurchases] = useState([]);
  const [allStock, setAllStock] = useState([]);

  // Supplier return modal
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [returnStrips, setReturnStrips] = useState(0);
  const [returnTablets, setReturnTablets] = useState(0);
  const [returning, setReturning] = useState(false);
  const [returnError, setReturnError] = useState(null);

  useEffect(() => {
    setTab(initialTabFor(location.pathname));
  }, [location.pathname]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    const results = await Promise.allSettled([
      inventoryAPI.getNearExpiry(),
      inventoryAPI.getExpired(),
      analyticsAPI.getStockAlerts(STOCK_ALERT_THRESHOLD),
      purchasesAPI.getPending(),
      inventoryAPI.getAllStock(),
      inventoryAPI.getStockSummary(),
    ]);
    const dataOf = (i) => (results[i].status === "fulfilled" && Array.isArray(results[i].value.data) ? results[i].value.data : []);

    setNearExpiry(dataOf(0));
    setExpired(dataOf(1));
    // Alerts are computed on saleable (non-expired) stock, so show that figure when the summary is available.
    const saleableById = {};
    dataOf(5).forEach((s) => { saleableById[s.productId] = s.saleableUnits; });
    setLowStock(
      dataOf(2).map((p) => {
        const current = saleableById[p.productId] ?? p.quantity ?? 0;
        return {
          productId: p.productId,
          name: p.name || "Unknown",
          company: p.company || "—",
          currentStock: current,
          reorderLevel: p.reorderLevel ?? 0,
          targetStockLevel: p.targetStockLevel ?? 0,
          status: current <= 0 ? "out" : "low",
        };
      })
    );
    setPendingPurchases(
      dataOf(3).map((po) => ({
        invoiceId: po.invoiceId,
        id: po.invoiceNumber || String(po.invoiceId ?? "—"),
        supplier: po.supplierName || "Opening stock",
        items: po.batchCount ?? 0,
        status: po.status || "PENDING",
        date: po.purchaseDate || "—",
        amount: Number(po.totalAmount) || 0,
      }))
    );
    setAllStock(dataOf(4));

    setErrors(
      results
        .map((r, i) => (r.status === "rejected" ? `${ENDPOINT_LABELS[i]}: ${handleApiError(r.reason).message}` : null))
        .filter(Boolean)
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const flashSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 5000);
  };

  const handleExportPDF = async () => {
    try {
      setExporting(true);
      setActionError(null);
      const response = await reportsAPI.expiry();
      downloadBlob(response, "expiry_report.pdf");
    } catch (err) {
      setActionError(`Could not export expiry report: ${handleApiError(err).message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleOpenReturnModal = (batch) => {
    setSelectedBatch(batch);
    setReturnStrips(0);
    setReturnTablets(0);
    setReturnError(null);
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBatch) return;
    try {
      setReturning(true);
      setReturnError(null);
      const res = await inventoryAPI.processReturn({
        batchId: selectedBatch.batchId,
        strips: parseInt(returnStrips || 0, 10),
        tablets: parseInt(returnTablets || 0, 10),
      });
      const credit = res.data?.creditValue;
      flashSuccess(
        `Returned ${res.data?.unitsReturned ?? ""} units of ${selectedBatch.name} (Batch ${selectedBatch.batch}) to ${selectedBatch.supplier}` +
          (credit != null ? ` — credit ${INR.format(Number(credit))}.` : ".")
      );
      setSelectedBatch(null);
      await fetchData();
    } catch (err) {
      setReturnError(handleApiError(err).message);
    } finally {
      setReturning(false);
    }
  };

  const handleWriteOff = async (row) => {
    const why = row.status === "expired" ? "expired" : "near expiry";
    if (!window.confirm(
      `Write off all ${row.totalUnits} units of ${row.name} (Batch ${row.batch})?\n\nThe stock is removed as ${why} and cannot be sold or returned afterwards.`
    )) return;
    try {
      setWritingOffId(row.batchId);
      setActionError(null);
      const res = await inventoryAPI.writeOff(row.batchId, { reason: why });
      flashSuccess(`Wrote off ${res.data?.unitsWrittenOff ?? row.totalUnits} units of ${row.name} (Batch ${row.batch}).`);
      await fetchData();
    } catch (err) {
      setActionError(`Write-off failed: ${handleApiError(err).message}`);
    } finally {
      setWritingOffId(null);
    }
  };

  /* ── enriched datasets ── */
  const nearExpiryEnriched = useMemo(
    () => nearExpiry.map((item) => ({ ...normalizeBatch(item), status: "nearExpiry" })),
    [nearExpiry]
  );

  const expiredEnriched = useMemo(
    () => expired.map((item) => ({ ...normalizeBatch(item), status: "expired" })),
    [expired]
  );

  const batchStockEnriched = useMemo(
    () =>
      allStock.map((item) => {
        const row = normalizeBatch(item);
        return { ...row, status: row.isExpired ? "expired" : row.isNearExpiry ? "nearExpiry" : "ok" };
      }),
    [allStock]
  );

  const supplierReturnsEnriched = useMemo(
    () => [...expiredEnriched, ...nearExpiryEnriched].filter((r) => r.totalUnits > 0),
    [expiredEnriched, nearExpiryEnriched]
  );

  /* ── risk overview (expired / near-expiry batches that still hold stock) ── */
  const risk = useMemo(() => {
    const withStock = (rows) => rows.filter((r) => r.totalUnits > 0);
    const exp = withStock(expiredEnriched);
    const soon = withStock(nearExpiryEnriched).filter((r) => r.daysToExpiry !== null && r.daysToExpiry <= 30);
    const sum = (rows) => rows.reduce((s, r) => s + r.totalValue, 0);
    const near = withStock(nearExpiryEnriched);
    const bucket = (lo, hi) => near.filter((r) => r.daysToExpiry !== null && r.daysToExpiry >= lo && r.daysToExpiry <= hi);
    const buckets = [
      ["Expired", exp],
      ["≤ 30 days", bucket(0, 30)],
      ["31–60 days", bucket(31, 60)],
      ["61–90 days", bucket(61, 90)],
    ].map(([name, rows]) => ({ name, batches: rows.length, value: sum(rows), units: rows.reduce((s, r) => s + r.totalUnits, 0) }));
    return {
      expiredCount: exp.length,
      expiredValue: sum(exp),
      soonCount: soon.length,
      soonValue: sum(soon),
      nearValue: sum(near),
      buckets,
      timeline: [...exp, ...near].sort((a, b) => (a.daysToExpiry ?? 0) - (b.daysToExpiry ?? 0)),
      critical: [...exp, ...soon].sort((a, b) => b.totalValue - a.totalValue),
    };
  }, [expiredEnriched, nearExpiryEnriched]);

  const activeRows = useMemo(() => {
    if (tab === "nearExpiry") return nearExpiryEnriched;
    if (tab === "expired") return expiredEnriched;
    if (tab === "lowStock") return lowStock;
    if (tab === "pendingPurchases") return pendingPurchases;
    if (tab === "batchStock") return batchStockEnriched;
    if (tab === "supplierReturns") return supplierReturnsEnriched;
    return [];
  }, [tab, nearExpiryEnriched, expiredEnriched, lowStock, pendingPurchases, batchStockEnriched, supplierReturnsEnriched]);

  /* ── shared cells ── */
  const medicineCol = {
    key: "name",
    header: "Medicine",
    accessor: (r) => r.name,
    cell: (v, r) => (
      <div className="expiry-med">
        <div className="expiry-med-name">{v}</div>
        <div className="expiry-med-sub">{r.company}</div>
      </div>
    ),
  };

  const conditionBadge = (v) =>
    v === "expired" ? <StatusBadge status="EXPIRED" label="Expired" size="sm" /> : <StatusBadge status="NEAR_EXPIRY" label="Near Expiry" size="sm" />;

  const renderActions = (r) => {
    const noStock = r.totalUnits <= 0;
    const noSupplier = r.supplierId == null;
    return (
      <div className="expiry-actions">
        <span title={noSupplier ? "Opening stock has no supplier, so it cannot be returned. Write it off instead." : noStock ? "No stock left in this batch" : "Return this batch to its supplier"}>
          <button
            type="button"
            className="btn btn-sm return-action-btn"
            onClick={() => handleOpenReturnModal(r)}
            disabled={noStock || noSupplier}
            aria-label={`Return ${r.name} batch ${r.batch}`}
          >
            <RotateCcw size={14} aria-hidden="true" /> Return
          </button>
        </span>
        {(r.status === "expired" || r.status === "nearExpiry") && (
          <button
            type="button"
            aria-label={`Write off ${r.name} batch ${r.batch}`}
            className="btn btn-sm btn-danger writeoff-action-btn"
            onClick={() => handleWriteOff(r)}
            disabled={noStock || writingOffId === r.batchId}
            title={noStock ? "No stock left in this batch" : r.status === "expired" ? "Remove this expired stock from inventory" : "Remove this near-expiry stock from inventory (e.g. opening stock that cannot be returned)"}
          >
            <Trash2 size={14} aria-hidden="true" /> {writingOffId === r.batchId ? "Writing off…" : "Write off"}
          </button>
        )}
      </div>
    );
  };

  const actionsCell = (_, r) => renderActions(r);

  const daysCell = (v) =>
    v === null ? "—" : (
      <span className={`expiry-days ${v <= 30 ? "expiry-critical" : v <= 90 ? "expiry-warning" : "expiry-ok"}`}>{daysText(v)}</span>
    );

  const columns = (() => {
    if (tab === "nearExpiry" || tab === "expired") {
      return [
        medicineCol,
        { key: "batch", header: "Batch No.", accessor: (r) => r.batch },
        { key: "mfg", header: "MFG Date", accessor: (r) => r.mfg, searchable: false },
        { key: "exp", header: "EXP Date", accessor: (r) => r.exp, searchable: false },
        { key: "daysToExpiry", header: "Days to Expiry", accessor: (r) => r.daysToExpiry, searchable: false, cell: daysCell },
        { key: "totalUnits", header: "Stock", accessor: (r) => r.totalUnits, align: "right", searchable: false, cell: (_, r) => r.stockLabel },
        { key: "totalValue", header: "Value (cost)", accessor: (r) => r.totalValue, align: "right", searchable: false, cell: (v) => INR.format(v) },
        { key: "supplier", header: "Supplier", accessor: (r) => r.supplier },
        { key: "status", header: "Status", accessor: (r) => r.status, searchable: false, cell: conditionBadge },
        ...(tab === "expired"
          ? [{ key: "actions", header: "Action", accessor: () => "", sortable: false, searchable: false, cell: actionsCell }]
          : []),
      ];
    }

    if (tab === "lowStock") {
      return [
        medicineCol,
        {
          key: "currentStock",
          header: "Current Stock",
          accessor: (r) => r.currentStock,
          searchable: false,
          cell: (v, r) => (
            <div className="expiry-level">
              <span className="expiry-critical">{v} units</span>
              {Number(r.targetStockLevel) > 0 ? (
                <ProgressBar value={v} max={r.targetStockLevel} size="sm" tone={v <= 0 ? "danger" : "warning"}
                  label={`${r.name}: ${v} of ${r.targetStockLevel} target units`} />
              ) : null}
            </div>
          ),
        },
        { key: "reorderLevel", header: "Reorder Level", accessor: (r) => r.reorderLevel, align: "right", searchable: false },
        { key: "targetStockLevel", header: "Target Level", accessor: (r) => r.targetStockLevel, align: "right", searchable: false },
        {
          key: "status",
          header: "Status",
          accessor: (r) => r.status,
          searchable: false,
          cell: (v) => (v === "out" ? <StatusBadge status="OUT_OF_STOCK" label="Out of Stock" size="sm" /> : <StatusBadge status="LOW_STOCK" label="Low Stock" size="sm" />),
        },
      ];
    }

    if (tab === "pendingPurchases") {
      return [
        { key: "id", header: "Invoice / PO No.", accessor: (r) => r.id },
        { key: "supplier", header: "Supplier", accessor: (r) => r.supplier },
        { key: "date", header: "Order Date", accessor: (r) => r.date, searchable: false },
        { key: "items", header: "Batches", accessor: (r) => r.items, align: "right", searchable: false },
        { key: "amount", header: "Total Amount", accessor: (r) => r.amount, align: "right", searchable: false, cell: (v) => INR.format(v) },
        {
          key: "status",
          header: "Order Status",
          accessor: (r) => r.status,
          searchable: false,
          cell: (v) => <StatusBadge status={v === "RECEIVED" ? "RECEIVED" : "PENDING"} size="sm" />,
        },
      ];
    }

    if (tab === "batchStock") {
      return [
        medicineCol,
        { key: "batch", header: "Batch No.", accessor: (r) => r.batch },
        { key: "supplier", header: "Supplier", accessor: (r) => r.supplier },
        { key: "mfg", header: "MFG Date", accessor: (r) => r.mfg, searchable: false },
        { key: "exp", header: "EXP Date", accessor: (r) => r.exp, searchable: false },
        { key: "mrp", header: "MRP / pack", accessor: (r) => r.mrp, align: "right", searchable: false, cell: (v) => INR.format(v) },
        { key: "totalUnits", header: "Stock", accessor: (r) => r.totalUnits, align: "right", searchable: false, cell: (_, r) => r.stockLabel },
        { key: "totalValue", header: "Value (cost)", accessor: (r) => r.totalValue, align: "right", searchable: false, cell: (v) => INR.format(v) },
        {
          key: "status",
          header: "Status",
          accessor: (r) => r.status,
          searchable: false,
          cell: (v) => (v === "ok" ? <StatusBadge status="OK" label="OK" size="sm" /> : conditionBadge(v)),
        },
      ];
    }

    if (tab === "supplierReturns") {
      return [
        medicineCol,
        { key: "batch", header: "Batch No.", accessor: (r) => r.batch },
        { key: "exp", header: "EXP Date", accessor: (r) => r.exp, searchable: false },
        { key: "totalUnits", header: "Available Stock", accessor: (r) => r.totalUnits, searchable: false, cell: (_, r) => r.stockLabel },
        { key: "supplier", header: "Supplier", accessor: (r) => r.supplier },
        { key: "status", header: "Stock Condition", accessor: (r) => r.status, searchable: false, cell: conditionBadge },
        { key: "actions", header: "Action", accessor: () => "", sortable: false, searchable: false, cell: actionsCell },
      ];
    }

    return [];
  })();

  const header = (
    <PageHeader
      icon={CalendarClock}
      eyebrow="Stock safety"
      title="Expiry & Batch Tracking"
      subtitle="Near-expiry and expired stock, low stock warnings, write-offs and supplier returns"
      actions={
        <>
          <button type="button" className="btn" onClick={fetchData} title="Reload data" disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" className={loading ? "expiry-spin" : ""} /> Refresh
          </button>
          <button type="button" className="btn btn-primary" onClick={handleExportPDF} disabled={exporting}>
            <FileText size={16} aria-hidden="true" /> {exporting ? "Exporting…" : "Export Expiry Report (PDF)"}
          </button>
        </>
      }
    />
  );

  if (loading) {
    return (
      <div className="mb-page expiry-tracking">
        {header}
        <LoadingSkeleton variant="stats" rows={4} label="Loading stock and expiry records" />
        <div className="card expiry-skel">
          <span className="mb-skel mb-skel--chart" />
        </div>
      </div>
    );
  }

  const allFailed = errors.length === ENDPOINT_LABELS.length;

  const tabDefs = [
    ["nearExpiry", Clock, `Near Expiry (${nearExpiryEnriched.length})`],
    ["expired", AlertTriangle, `Expired Stock (${expiredEnriched.length})`],
    ["lowStock", Layers, `Low Stock Alerts (${lowStock.length})`],
    ["pendingPurchases", CalendarDays, `Pending Purchases (${pendingPurchases.length})`],
    ["batchStock", Layers, `Batch-wise Stock (${batchStockEnriched.length})`],
    ["supplierReturns", RotateCcw, `Returns & Write-offs (${supplierReturnsEnriched.length})`],
  ];

  return (
    <div className="mb-page expiry-tracking">
      {successMessage && (
        <div className="success-banner mb-animate-in" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{successMessage}</span>
        </div>
      )}

      {header}

      {errors.length > 0 && (
        <div className="error-message" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <div>
            <strong>{allFailed ? "Could not load any data." : "Some data could not be loaded:"}</strong>
            <ul className="expiry-error-list">
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </div>
        </div>
      )}
      {actionError && (
        <div className="error-message" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {/* ── Critical alert banners ── */}
      <section className="expiry-alerts mb-stagger" aria-label="Critical expiry alerts">
        <div className={`expiry-alert expiry-alert--danger ${risk.expiredCount === 0 ? "is-clear" : ""}`} data-testid="expiry-alert-expired">
          <span className="expiry-alert__icon" aria-hidden="true"><XOctagon size={22} /></span>
          <div className="expiry-alert__body">
            <div className="expiry-alert__title">
              {risk.expiredCount === 0 ? "No expired stock on hand" : `${risk.expiredCount} expired batch${risk.expiredCount === 1 ? "" : "es"} still in stock`}
            </div>
            <div className="expiry-alert__meta">
              {risk.expiredCount === 0 ? "Expired batches are blocked from sale automatically." : <>Value at risk <strong>{inr(risk.expiredValue)}</strong> at cost · blocked from sale</>}
            </div>
          </div>
          {risk.expiredCount > 0 && (
            <button type="button" className="btn btn-sm expiry-alert__cta" onClick={() => setTab("expired")}>View expired</button>
          )}
        </div>
        <div className={`expiry-alert expiry-alert--warning ${risk.soonCount === 0 ? "is-clear" : ""}`} data-testid="expiry-alert-soon">
          <span className="expiry-alert__icon" aria-hidden="true"><AlertTriangle size={22} /></span>
          <div className="expiry-alert__body">
            <div className="expiry-alert__title">
              {risk.soonCount === 0 ? "Nothing expires in the next 30 days" : `${risk.soonCount} batch${risk.soonCount === 1 ? "" : "es"} expiring ≤ 30 days`}
            </div>
            <div className="expiry-alert__meta">
              {risk.soonCount === 0 ? "Keep selling oldest batches first (FEFO)." : <>Value at risk <strong>{inr(risk.soonValue)}</strong> at cost · sell first or return</>}
            </div>
          </div>
          {risk.soonCount > 0 && (
            <button type="button" className="btn btn-sm expiry-alert__cta" onClick={() => setTab("nearExpiry")}>View batches</button>
          )}
        </div>
      </section>

      <section className="mb-grid-stats expiry-kpis mb-stagger" aria-label="Expiry overview">
        <StatCard icon={Clock} label="Near expiry (3 months)" value={nearExpiryEnriched.length} tone="warning" hint={`${inr(risk.nearValue)} at cost`} onClick={() => setTab("nearExpiry")} />
        <StatCard icon={IndianRupee} label="Total value at risk" value={risk.expiredValue + risk.nearValue} format={inr} tone="danger" hint="Expired + near-expiry stock at cost" />
        <StatCard icon={Layers} label="Low stock alerts" value={lowStock.length} tone="coral" hint={`≤ ${STOCK_ALERT_THRESHOLD}% of target level`} onClick={() => setTab("lowStock")} />
        <StatCard icon={Truck} label="Pending purchase orders" value={pendingPurchases.length} tone="ice" hint={`${inr(pendingPurchases.reduce((s, p) => s + p.amount, 0))} expected`} onClick={() => setTab("pendingPurchases")} />
      </section>

      <div className="expiry-overview">
        <section className="card mb-chartcard" data-testid="expiry-buckets">
          <div className="mb-chartcard__head">
            <div>
              <h3 className="mb-chartcard__title">Expiry buckets</h3>
              <p className="mb-chartcard__sub">Batches with stock, by time left to expiry</p>
            </div>
          </div>
          {risk.buckets.every((b) => b.batches === 0) ? (
            <QuietEmpty icon={ShieldCheck} title="All clear" message="No batch with stock expires within the next 90 days." />
          ) : (
            <>
              <div className="expiry-chart">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={risk.buckets} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="name" {...axisProps} interval={0} tick={{ ...axisProps.tick, fontSize: 11 }} />
                    <YAxis allowDecimals={false} {...axisProps} />
                    <Tooltip
                      {...tooltipProps}
                      formatter={(v, _n, item) => [`${v} batch${v === 1 ? "" : "es"} · ${inrShort(item.payload.value)} at cost`, "Stock"]}
                    />
                    <Bar dataKey="batches" radius={[6, 6, 0, 0]} maxBarSize={56} {...chartAnimation()}>
                      {risk.buckets.map((b, i) => <Cell key={b.name} fill={BUCKET_COLORS[i]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="expiry-bucket-legend">
                {risk.buckets.map((b, i) => (
                  <li key={b.name}>
                    <span className="expiry-bucket-legend__dot" style={{ background: BUCKET_COLORS[i] }} aria-hidden="true" />
                    <span className="expiry-bucket-legend__name">{b.name}</span>
                    <span className="expiry-bucket-legend__val">{b.batches} · {inr(b.value)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card mb-chartcard" data-testid="expiry-timeline">
          <div className="mb-chartcard__head">
            <div>
              <h3 className="mb-chartcard__title">Expiry timeline</h3>
              <p className="mb-chartcard__sub">Soonest first — expired and near-expiry batches with stock</p>
            </div>
          </div>
          {risk.timeline.length === 0 ? (
            <QuietEmpty icon={CalendarClock} title="Nothing on the horizon" message="No batch with stock expires within 3 months." />
          ) : (
            <div className="expiry-timeline-scroll">
              <Timeline
                items={risk.timeline.slice(0, 8).map((r) => ({
                  key: `t${r.batchId}`,
                  tone: r.daysToExpiry < 0 ? "danger" : r.daysToExpiry <= 30 ? "warning" : "info",
                  title: (
                    <span className="expiry-tl-title">
                      {r.name} <span className="expiry-tl-batch">{r.batch}</span>
                    </span>
                  ),
                  meta: `${fmtDate(r.exp)} · ${r.totalUnits} units · ${r.supplier}`,
                  right: (
                    <span className={`expiry-tl-days ${r.daysToExpiry < 0 ? "is-danger" : r.daysToExpiry <= 30 ? "is-warning" : ""}`}>
                      {r.daysToExpiry < 0 ? `${Math.abs(r.daysToExpiry)}d ago` : r.daysToExpiry === 0 ? "today" : `${r.daysToExpiry}d left`}
                    </span>
                  ),
                }))}
              />
              {risk.timeline.length > 8 && (
                <p className="expiry-more">+{risk.timeline.length - 8} more in the tables below</p>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ── Batches that need action now ── */}
      {risk.critical.length > 0 && (
        <section className="expiry-critical-section" aria-labelledby="expiry-critical-title">
          <div className="expiry-section-head">
            <h3 id="expiry-critical-title">Needs action now</h3>
            <span className="expiry-section-sub">Expired or expiring within 30 days, highest value first</span>
          </div>
          <div className="expiry-cards mb-stagger">
            {risk.critical.slice(0, 6).map((r) => (
              <article key={`c${r.batchId}`} className={`expiry-card mb-lift ${r.status === "expired" ? "is-expired" : "is-soon"}`}>
                <div className="expiry-card__top">
                  <div className="expiry-card__name">
                    <strong title={r.name}>{r.name}</strong>
                    <span>{r.company}</span>
                  </div>
                  {r.status === "expired" ? <StatusBadge status="EXPIRED" size="sm" /> : <StatusBadge status="NEAR_EXPIRY" size="sm" />}
                </div>
                <dl className="expiry-card__facts">
                  <div><dt>Batch</dt><dd className="expiry-mono">{r.batch}</dd></div>
                  <div><dt>Expiry</dt><dd>{fmtDate(r.exp)}</dd></div>
                  <div><dt>Supplier</dt><dd title={r.supplier}>{r.supplier}</dd></div>
                  <div><dt>Stock value</dt><dd>{INR.format(r.totalValue)}</dd></div>
                </dl>
                <div className="expiry-card__days">
                  <PackageSearch size={14} aria-hidden="true" />
                  {r.totalUnits} units · {r.daysToExpiry < 0 ? `expired ${Math.abs(r.daysToExpiry)}d ago` : r.daysToExpiry === 0 ? "expires today" : `${r.daysToExpiry} days left`}
                </div>
                {renderActions(r)}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── Detailed registers ── */}
      <section className="expiry-register" aria-label="Expiry registers">
        <div className="expiry-tabs-wrapper">
          <div className="expiry-tabs" role="toolbar" aria-label="Expiry views">
            {tabDefs.map(([key, Icon, label]) => (
              <button key={key} type="button" className={`expiry-tab ${tab === key ? "active" : ""}`} aria-pressed={tab === key} onClick={() => setTab(key)}>
                <Icon size={15} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="tab-explanation-card">
          {tab === "nearExpiry" && <p>Batches expiring within the next 3 months. Sell these first or return them to the supplier.</p>}
          {tab === "expired" && <p>Expired batches are blocked from sale. Return them to the supplier, or write them off (opening stock has no supplier).</p>}
          {tab === "lowStock" && <p>Medicines whose saleable stock is at or below {STOCK_ALERT_THRESHOLD}% of their target stock level. Consider raising purchase orders.</p>}
          {tab === "pendingPurchases" && <p>Purchase orders that have not been received yet. Receive them in Purchases to add the stock.</p>}
          {tab === "batchStock" && <p>All batches with their remaining stock. Value is at cost price.</p>}
          {tab === "supplierReturns" && <p>Expired or near-expiry batches with stock. Return them to their supplier, or write them off (opening stock has no supplier).</p>}
        </div>

        <DataTable
          title={
            tab === "nearExpiry" ? "Near Expiry Alerts" :
            tab === "expired" ? "Expired Stock" :
            tab === "lowStock" ? "Low Stock Warnings" :
            tab === "pendingPurchases" ? "Pending Purchase Orders" :
            tab === "batchStock" ? "Batch Register" :
            "Returns & Write-offs"
          }
          subtitle={activeRows.length === 0 ? "Nothing to show here right now" : `${activeRows.length} entr${activeRows.length === 1 ? "y" : "ies"}`}
          columns={columns}
          rows={activeRows}
          initialPageSize={10}
          rowKey={(r) => (r.batchId != null ? `b${r.batchId}` : r.invoiceId != null ? `i${r.invoiceId}` : r.productId != null ? `p${r.productId}` : `${r.name}-${r.batch}`)}
        />
      </section>

      <Modal
        open={!!selectedBatch}
        onClose={() => !returning && setSelectedBatch(null)}
        title="Return to supplier"
        width={540}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setSelectedBatch(null)} disabled={returning}>
              Cancel
            </button>
            <button type="submit" form="expiry-return-form" className="btn btn-primary"
              disabled={returning || (returnStrips === 0 && returnTablets === 0)}>
              <RotateCcw size={16} aria-hidden="true" /> {returning ? "Processing…" : "Process Return"}
            </button>
          </>
        }
      >
        {selectedBatch && (
          <form id="expiry-return-form" onSubmit={handleReturnSubmit} className="return-form">
            {returnError && (
              <div className="error-message" role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{returnError}</span>
              </div>
            )}
            <div className="return-modal-info-card">
              <div className="return-modal-info-head">
                <strong>{selectedBatch.name}</strong>
                <span>{selectedBatch.company}</span>
              </div>
              <dl>
                <div><dt>Batch</dt><dd className="expiry-mono">{selectedBatch.batch}</dd></div>
                <div><dt>Supplier</dt><dd>{selectedBatch.supplier}</dd></div>
                <div><dt>Expiry</dt><dd>{fmtDate(selectedBatch.exp)}</dd></div>
                <div><dt>Available</dt><dd>{selectedBatch.stockLabel}</dd></div>
              </dl>
            </div>

            <div className="form-group-row">
              <div className="form-group">
                <label htmlFor="returnStripsInput">Packs to Return</label>
                <input
                  id="returnStripsInput"
                  type="number"
                  min="0"
                  max={selectedBatch.stripQty}
                  value={returnStrips}
                  onChange={(e) => setReturnStrips(Math.max(0, Math.min(selectedBatch.stripQty, parseInt(e.target.value, 10) || 0)))}
                />
                <span className="input-hint">Max: {selectedBatch.stripQty} packs</span>
              </div>

              <div className="form-group">
                <label htmlFor="returnTabletsInput">Loose Units to Return</label>
                <input
                  id="returnTabletsInput"
                  type="number"
                  min="0"
                  max={selectedBatch.tabletQty}
                  value={returnTablets}
                  onChange={(e) => setReturnTablets(Math.max(0, Math.min(selectedBatch.tabletQty, parseInt(e.target.value, 10) || 0)))}
                />
                <span className="input-hint">Max: {selectedBatch.tabletQty} units</span>
              </div>
            </div>

            <div className="return-warning-note">
              This immediately reduces the batch stock and records a credit against the supplier.
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default ExpiryTracking;
