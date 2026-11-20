import React, { useMemo, useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { Boxes, Layers, PackageCheck, AlertTriangle, PackageX, Clock, IndianRupee, RefreshCw, Gauge } from "lucide-react";
import { PageHeader, StatCard, inr, StatusBadge, LoadingSkeleton, ProgressBar, ChartCard, DataTable } from "../components/ui";
import QuietEmpty from "./stock/QuietEmpty";
import { parseLocalDate, startOfToday, daysUntil, daysLeftText, batchCostValue } from "./stock/stockUtils";
import { CHART_COLORS, tooltipProps, chartAnimation, chartSurface } from "../utils/chartTheme";
import "./Inventory.css";
import { inventoryAPI, productsAPI, handleApiError } from "../services/api";

/** Near-expiry window used by the backend (InventoryService.NEAR_EXPIRY_MONTHS). */
const NEAR_EXPIRY_MONTHS = 3;

function nearExpiryCutoff() {
  const d = startOfToday();
  d.setMonth(d.getMonth() + NEAR_EXPIRY_MONTHS);
  return d;
}

function normalizeBatch(item) {
  const product = item.product || {};
  const unitsPerPack = Math.max(1, Number(product.stripSize) || 1);
  const stripQty = item.stripStock ?? 0;
  const tabletQty = item.tabletStock ?? 0;
  const totalUnits = item.totalUnits ?? stripQty * unitsPerPack + tabletQty;
  const mfg = item.mfgDate ? String(item.mfgDate).split("T")[0] : null;
  const exp = item.expiryDate ? String(item.expiryDate).split("T")[0] : null;
  const expDate = parseLocalDate(exp);
  const isExpired = !!expDate && expDate < startOfToday();

  return {
    batchId: item.batchId,
    name: product.name || "Unknown",
    company: product.company || "—",
    batch: item.batchNumber || "—",
    supplier: item.supplierName || "Opening stock",
    mfg: mfg || "—",
    mfgTime: parseLocalDate(mfg)?.getTime() ?? 0,
    exp: exp || "—",
    days: daysUntil(exp),
    stripQty,
    tabletQty,
    totalUnits,
    value: batchCostValue({ ...item, totalUnits }),
    isExpired,
    // stock-list's isNearExpiry is a stored flag that is not kept up to date, so derive it from the expiry date.
    isNearExpiry: !isExpired && !!expDate && (expDate <= nearExpiryCutoff() || !!item.isNearExpiry),
  };
}

const SUMMARY_STATUS = { in_stock: ["IN_STOCK", "In Stock"], low_stock: ["LOW_STOCK", "Low Stock"], out_of_stock: ["OUT_OF_STOCK", "Out of Stock"] };

const SOURCES = [
  ["all", "stock list", () => inventoryAPI.getAllStock()],
  ["nearExpiry", "near-expiry batches", () => inventoryAPI.getNearExpiry()],
  ["expired", "expired batches", () => inventoryAPI.getExpired()],
  ["aging", "aging report", () => inventoryAPI.getAgingReport()],
  ["summary", "stock summary", () => inventoryAPI.getStockSummary()],
  ["products", "products", () => productsAPI.getAll()],
];

const listOf = (res) => {
  const d = res?.data?.content ?? res?.data;
  return Array.isArray(d) ? d : [];
};

function Inventory() {
  const [tab, setTab] = useState("all");
  const [data, setData] = useState({ all: [], nearExpiry: [], expired: [], aging: [], summary: [], products: [] });
  const [failed, setFailed] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [loadSeq, setLoadSeq] = useState(0); // remounts the register after each load (fresh search/paging, as before)

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled(SOURCES.map(([, , fn]) => fn()));
    const next = {};
    const errs = {};
    results.forEach((r, i) => {
      const [key, label] = SOURCES[i];
      if (r.status === "fulfilled") {
        next[key] = listOf(r.value);
      } else {
        next[key] = [];
        errs[key] = `${label}: ${handleApiError(r.reason).message}`;
      }
    });
    setData(next);
    setFailed(errs);
    setLoading(false);
    setLoadedOnce(true);
    setLoadSeq((n) => n + 1);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isProductTab = tab === "low" || tab === "out";

  const batchRows = useMemo(() => {
    if (isProductTab) return [];
    const rows = (data[tab] || []).map(normalizeBatch);
    if (tab === "aging") return rows.sort((a, b) => a.mfgTime - b.mfgTime);
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [data, tab, isProductTab]);

  const productById = useMemo(() => {
    const m = {};
    (data.products || []).forEach((p) => { m[p.productId] = p; });
    return m;
  }, [data.products]);

  const productRows = useMemo(() => {
    const wanted = tab === "low" ? "low_stock" : "out_of_stock";
    return (data.summary || [])
      .filter((s) => s.status === wanted)
      .map((s) => ({ ...s, targetStockLevel: productById[s.productId]?.targetStockLevel ?? null }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [data.summary, tab, productById]);

  const counts = useMemo(() => ({
    low: (data.summary || []).filter((s) => s.status === "low_stock").length,
    out: (data.summary || []).filter((s) => s.status === "out_of_stock").length,
  }), [data.summary]);

  /* ---------- KPIs (all from the API responses above) ---------- */
  const kpi = useMemo(() => {
    const all = data.all || [];
    return {
      batches: all.length,
      saleable: (data.summary || []).reduce((s, x) => s + (Number(x.saleableUnits) || 0), 0),
      near: (data.nearExpiry || []).length,
      value: all.reduce((s, b) => s + batchCostValue(b), 0),
    };
  }, [data]);

  /* Saleable units grouped by the product's dosage form (stock-summary + products). */
  const formSlices = useMemo(() => {
    const by = {};
    (data.summary || []).forEach((s) => {
      const units = Number(s.saleableUnits) || 0;
      if (units <= 0) return;
      const form = (productById[s.productId]?.dosageForm || "").trim() || "Unspecified";
      by[form] = (by[form] || 0) + units;
    });
    const sorted = Object.entries(by).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    // Never more than 6 hues: fold the tail into "Other"
    if (sorted.length <= 6) return sorted;
    const head = sorted.slice(0, 5);
    head.push({ name: "Other", value: sorted.slice(5).reduce((s, x) => s + x.value, 0) });
    return head;
  }, [data.summary, productById]);
  const formTotal = formSlices.reduce((s, x) => s + x.value, 0);

  /* Products closest to running out: saleable vs target (or reorder) level. */
  const levelRows = useMemo(() => {
    return (data.summary || [])
      .map((s) => {
        const p = productById[s.productId] || {};
        const target = Number(p.targetStockLevel) || 0;
        const reorder = Number(s.reorderLevel ?? p.reorderLevel) || 0;
        const max = target > 0 ? target : reorder > 0 ? reorder * 2 : 0;
        const saleable = Number(s.saleableUnits) || 0;
        return { id: s.productId, name: s.name, status: s.status, saleable, reorder, target, max, ratio: max > 0 ? saleable / max : Infinity };
      })
      .filter((r) => r.max > 0 && r.saleable > 0)
      .sort((a, b) => a.ratio - b.ratio || a.name.localeCompare(b.name))
      .slice(0, 6);
  }, [data.summary, productById]);

  const medicineCell = (v, r) => (
    <div className="inv-med">
      <div className="inv-med-name">{v}</div>
      <div className="inv-med-sub">{r.company || "—"}</div>
    </div>
  );

  const batchColumns = [
    { key: "name", header: "Medicine", accessor: (r) => r.name, cell: medicineCell },
    { key: "batch", header: "Batch", accessor: (r) => r.batch, cell: (v) => <span className="inv-batch">{v}</span> },
    { key: "supplier", header: "Supplier", accessor: (r) => r.supplier },
    { key: "mfg", header: "MFG", accessor: (r) => r.mfg, searchable: false },
    {
      key: "exp",
      header: "EXP",
      accessor: (r) => r.exp,
      searchable: false,
      cell: (v, r) => (
        <div>
          <div>{v}</div>
          {r.days !== null ? (
            <div className={`inv-days ${r.days < 0 ? "is-danger" : r.days <= 90 ? "is-warning" : ""}`}>{daysLeftText(r.days)}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: "totalUnits",
      header: "Stock (units)",
      accessor: (r) => r.totalUnits,
      align: "right",
      searchable: false,
      cell: (v, r) => (
        <div>
          <div className="inv-units">{v}</div>
          <div className="inv-med-sub">{r.stripQty} packs + {r.tabletQty} loose</div>
        </div>
      ),
    },
    { key: "value", header: "Value (cost)", accessor: (r) => r.value, align: "right", searchable: false, cell: (v) => inr(v) },
    {
      key: "status",
      header: "Status",
      accessor: (r) => (r.isExpired ? "expired" : r.isNearExpiry ? "near" : r.totalUnits <= 0 ? "empty" : "ok"),
      searchable: false,
      cell: (v) => {
        if (v === "expired") return <StatusBadge status="EXPIRED" label="Expired" size="sm" />;
        if (v === "near") return <StatusBadge status="NEAR_EXPIRY" label="Near Expiry" size="sm" />;
        if (v === "empty") return <StatusBadge status="EMPTY" label="Empty" size="sm" />;
        return <StatusBadge status="OK" label="OK" size="sm" />;
      },
    },
  ];

  const productColumns = [
    { key: "name", header: "Medicine", accessor: (r) => r.name, cell: medicineCell },
    {
      key: "saleableUnits",
      header: "Saleable Units",
      accessor: (r) => r.saleableUnits,
      align: "right",
      searchable: false,
      cell: (v, r) => {
        const max = Number(r.targetStockLevel) > 0 ? Number(r.targetStockLevel) : Number(r.reorderLevel) > 0 ? Number(r.reorderLevel) : 0;
        return (
          <div className="inv-level-cell">
            <span className="inv-units">{v}</span>
            {max > 0 ? (
              <ProgressBar
                value={v}
                max={max}
                size="sm"
                tone={v <= 0 ? "danger" : "warning"}
                label={`${r.name}: ${v} of ${max} units (${Number(r.targetStockLevel) > 0 ? "target" : "reorder level"})`}
              />
            ) : null}
          </div>
        );
      },
    },
    { key: "totalTablets", header: "Total Units (incl. expired)", accessor: (r) => r.totalTablets, align: "right", searchable: false },
    { key: "reorderLevel", header: "Reorder Level", accessor: (r) => r.reorderLevel, align: "right", searchable: false },
    {
      key: "status",
      header: "Status",
      accessor: (r) => r.status,
      searchable: false,
      cell: (v) => {
        const [status, label] = SUMMARY_STATUS[v] || [v, v];
        return <StatusBadge status={status} label={label} size="sm" />;
      },
    },
  ];

  const errorList = Object.values(failed);
  const currentFailed = isProductTab ? failed.summary : failed[tab];

  const tabs = [
    ["all", "All Batches"],
    ["low", `Low Stock${failed.summary ? "" : ` (${counts.low})`}`],
    ["out", `Out of Stock${failed.summary ? "" : ` (${counts.out})`}`],
    ["nearExpiry", "Near Expiry (3 mo)"],
    ["expired", "Expired"],
    ["aging", "Stock Aging"],
  ];

  const showSkeleton = loading && !loadedOnce;

  return (
    <div className="mb-page inv">
      <PageHeader
        icon={Boxes}
        eyebrow="Stock"
        title="Inventory"
        subtitle="Batch stock, low/out-of-stock medicines and expiry monitoring"
      />

      {errorList.length > 0 && !loading && (
        <div className="inv-error" role="alert">
          <strong>Some inventory data could not be loaded:</strong>
          <ul>
            {errorList.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      <section className="inv-kpis mb-stagger" aria-label="Stock overview">
        <StatCard icon={Layers} label="Total batches" value={failed.all ? null : kpi.batches} tone="navy" loading={showSkeleton}
          hint="Batch records in the stock list" onClick={() => setTab("all")} testId="inv-kpi-batches" />
        <StatCard icon={PackageCheck} label="Saleable units" value={failed.summary ? null : kpi.saleable} tone="teal" loading={showSkeleton}
          hint="Excludes expired batches" testId="inv-kpi-saleable" />
        <StatCard icon={AlertTriangle} label="Low stock medicines" value={failed.summary ? null : counts.low} tone="warning" loading={showSkeleton}
          hint="At or below reorder level" onClick={() => setTab("low")} testId="inv-kpi-low" />
        <StatCard icon={PackageX} label="Out of stock medicines" value={failed.summary ? null : counts.out} tone="danger" loading={showSkeleton}
          hint="No saleable units left" onClick={() => setTab("out")} testId="inv-kpi-out" />
        <StatCard icon={Clock} label="Near-expiry batches" value={failed.nearExpiry ? null : kpi.near} tone="coral" loading={showSkeleton}
          hint="Expiring within 3 months" onClick={() => setTab("nearExpiry")} testId="inv-kpi-near" />
        <StatCard icon={IndianRupee} label="Stock value at cost" value={failed.all ? null : kpi.value} format={inr} tone="lavender" loading={showSkeleton}
          hint="Cost per unit × units on hand" testId="inv-kpi-value" />
      </section>

      <div className="inv-charts">
        <ChartCard
          title="Stock distribution"
          subtitle="Saleable units by dosage form"
          loading={showSkeleton}
          height={240}
          testId="inv-form-chart"
        >
          {formSlices.length === 0 ? (
            <QuietEmpty icon={Boxes} title="No saleable stock" message="Receive stock in Purchases to see how it is spread across dosage forms." />
          ) : (
            <div className="inv-donut">
              <div className="inv-donut__chart">
                <PieChart width={220} height={220}>
                    <Pie data={formSlices} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={2}
                      stroke={chartSurface()} strokeWidth={2} {...chartAnimation()}>
                      {formSlices.map((s, i) => <Cell key={s.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...tooltipProps} formatter={(v, n) => [`${Number(v).toLocaleString("en-IN")} units`, n]} />
                  </PieChart>
                <div className="inv-donut__center" aria-hidden="true">
                  <strong>{formTotal.toLocaleString("en-IN")}</strong>
                  <span>units</span>
                </div>
              </div>
              <ul className="inv-legend">
                {formSlices.map((s, i) => (
                  <li key={s.name}>
                    <span className="inv-legend__dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} aria-hidden="true" />
                    <span className="inv-legend__name">{s.name}</span>
                    <span className="inv-legend__val">
                      {s.value.toLocaleString("en-IN")} <small>({Math.round((s.value / formTotal) * 100)}%)</small>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Stock levels"
          subtitle={`Lowest saleable stock vs target (or 2× reorder level)${counts.out ? ` · ${counts.out} out of stock not shown` : ""}`}
          loading={showSkeleton}
          height={240}
          testId="inv-levels"
        >
          {levelRows.length === 0 ? (
            <QuietEmpty icon={Gauge} title="No stock levels set" message="Set a reorder or target level on medicines to track them here." />
          ) : (
            <ul className="inv-levels">
              {levelRows.map((r) => (
                <li key={r.id}>
                  <div className="inv-levels__row">
                    <span className="inv-levels__name" title={r.name}>{r.name}</span>
                    <span className="inv-levels__num">
                      {r.saleable.toLocaleString("en-IN")} <small>/ {r.max.toLocaleString("en-IN")}</small>
                    </span>
                  </div>
                  <ProgressBar
                    value={r.saleable}
                    max={r.max}
                    tone={r.status === "out_of_stock" ? "danger" : r.status === "low_stock" ? "warning" : "success"}
                    label={`${r.name} saleable stock`}
                  />
                  <div className="inv-levels__meta">
                    Reorder at {r.reorder.toLocaleString("en-IN")}
                    {r.target > 0 ? ` · target ${r.target.toLocaleString("en-IN")}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>

      <section className="inv-register">
        <div className="inv-tabs" role="toolbar" aria-label="Stock views">
          {tabs.map(([key, label]) => (
            <button key={key} type="button" className={`inv-tab ${tab === key ? "active" : ""}`} aria-pressed={tab === key} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
          <button type="button" className="inv-tab inv-tab--refresh" onClick={load} disabled={loading}>
            <RefreshCw size={14} aria-hidden="true" className={loading ? "inv-spin" : ""} />
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {showSkeleton ? (
          <div className="card inv-skel"><LoadingSkeleton variant="table" rows={6} label="Loading inventory" /></div>
        ) : currentFailed ? (
          <div className="card inv-state">This view is unavailable because its data failed to load.</div>
        ) : isProductTab ? (
          <DataTable
            key={`${tab}-${loadSeq}`}
            title={tab === "low" ? "Low Stock Medicines" : "Out of Stock Medicines"}
            subtitle={
              productRows.length === 0
                ? tab === "low" ? "No medicines are below their reorder level." : "No medicines are out of stock."
                : `${productRows.length} medicine(s) — saleable stock excludes expired batches`
            }
            columns={productColumns}
            rows={productRows}
            initialPageSize={10}
            rowKey={(r) => String(r.productId)}
          />
        ) : (
          <DataTable
            key={`${tab}-${loadSeq}`}
            title={tab === "aging" ? "Stock Aging (oldest first)" : "Batch Stock Register"}
            subtitle={batchRows.length === 0 ? "No batches to show." : `${batchRows.length} batch record(s)`}
            columns={batchColumns}
            rows={batchRows}
            initialPageSize={10}
            rowKey={(r) => String(r.batchId ?? `${r.name}-${r.batch}`)}
          />
        )}
      </section>
    </div>
  );
}

export default Inventory;
