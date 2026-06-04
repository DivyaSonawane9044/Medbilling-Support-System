import React, { useMemo, useState, useEffect } from "react";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import "./Inventory.css";
import { inventoryAPI, handleApiError } from "../services/api";

function monthsFromNow(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}

function parseDateISO(iso) {
  if (!iso || iso === "N/A") return 0;
  const parts = String(iso).split("-").map(Number);
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return 0;
  return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
}

function classifyStock({ totalTablets, reorderLevel }) {
  if (totalTablets <= 0) return "out";
  if (totalTablets <= reorderLevel) return "low";
  return "in";
}

function normalizeBatch(item) {
  const product = item.product || {};
  const stripSize = Math.max(1, product.stripSize || item.stripSize || 1);
  const stripQty = item.stripStock ?? item.strips ?? 0;
  const tabletQty = item.tabletStock ?? item.tablets ?? 0;
  const totalTablets = stripQty * stripSize + tabletQty;
  const reorderLevel = product.reorderLevel ?? item.reorderLevel ?? 0;
  const mfgRaw = item.mfgDate || item.manufacturingDate;
  const expRaw = item.expiryDate;

  return {
    batchId: item.batchId,
    name: product.name || item.name || "Unknown",
    company: product.company || item.company || "N/A",
    batch: item.batchNumber || item.batch || "N/A",
    mfg: mfgRaw ? String(mfgRaw).split("T")[0] : "N/A",
    exp: expRaw ? String(expRaw).split("T")[0] : "N/A",
    stripQty,
    stripSize,
    tabletQty,
    reorderLevel,
    totalTablets,
    status: classifyStock({ totalTablets, reorderLevel }),
  };
}

function Inventory() {
  const [tab, setTab] = useState("all");
  const [allStock, setAllStock] = useState([]);
  const [nearExpiry, setNearExpiry] = useState([]);
  const [expired, setExpired] = useState([]);
  const [agingReport, setAgingReport] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInventoryData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [allStockResponse, nearExpiryResponse, expiredResponse, agingResponse] = await Promise.all([
          inventoryAPI.getAllStock(),
          inventoryAPI.getNearExpiry(),
          inventoryAPI.getExpired(),
          inventoryAPI.getAgingReport(),
        ]);

        setAllStock(allStockResponse.data || []);
        setNearExpiry(nearExpiryResponse.data || []);
        setExpired(expiredResponse.data || []);
        setAgingReport(agingResponse.data || []);
      } catch (err) {
        setError(handleApiError(err).message);
      } finally {
        setLoading(false);
      }
    };

    fetchInventoryData();
  }, []);

  const enriched = useMemo(() => {
    const nearExpiryBefore = monthsFromNow(3);
    const today = new Date();

    let dataToProcess = [];
    if (tab === "all" || tab === "low" || tab === "out") {
      dataToProcess = allStock;
    } else if (tab === "nearExpiry") {
      dataToProcess = nearExpiry;
    } else if (tab === "expired") {
      dataToProcess = expired;
    } else if (tab === "aging") {
      dataToProcess = agingReport;
    }

    return dataToProcess.map((item) => {
      const row = normalizeBatch(item);
      const expDate = row.exp !== "N/A" ? new Date(row.exp) : null;
      const isExpired = expDate && expDate < today;
      const isNearExpiry = expDate && !isExpired && expDate <= nearExpiryBefore;

      return {
        ...row,
        isExpired,
        isNearExpiry,
        stockLabel: `${row.stripQty} strips + ${row.tabletQty} tablets`,
      };
    });
  }, [allStock, nearExpiry, expired, agingReport, tab]);

  const filtered = useMemo(() => {
    let base = [...enriched].sort((a, b) => a.name.localeCompare(b.name));

    if (tab === "all") return base;
    if (tab === "low") return base.filter((r) => r.status === "low");
    if (tab === "out") return base.filter((r) => r.status === "out");
    if (tab === "aging") return [...base].sort((a, b) => parseDateISO(a.mfg) - parseDateISO(b.mfg));
    if (tab === "nearExpiry") return base.filter((r) => r.isNearExpiry);
    if (tab === "expired") return base.filter((r) => r.isExpired);
    return base;
  }, [enriched, tab]);

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "Medicine",
        accessor: (r) => r.name,
        cell: (v, r) => (
          <div className="inv-med">
            <div className="inv-med-name">{v}</div>
            <div className="inv-med-sub">{r.company}</div>
          </div>
        ),
      },
      { key: "batch", header: "Batch", accessor: (r) => r.batch, searchable: true },
      { key: "mfg", header: "MFG", accessor: (r) => r.mfg, searchable: false },
      { key: "exp", header: "EXP", accessor: (r) => r.exp, searchable: false },
      {
        key: "stockLabel",
        header: "Stock",
        accessor: (r) => r.stockLabel,
        align: "right",
        searchable: false,
      },
      {
        key: "status",
        header: "Status",
        accessor: (r) => r.status,
        searchable: false,
        cell: (v, r) => {
          if (r.isExpired) return <Badge tone="red">Expired</Badge>;
          if (r.isNearExpiry) return <Badge tone="amber">Near Expiry</Badge>;
          if (v === "out") return <Badge tone="red">Out of Stock</Badge>;
          if (v === "low") return <Badge tone="amber">Low Stock</Badge>;
          return <Badge tone="green">In Stock</Badge>;
        },
      },
    ],
    []
  );

  if (loading) {
    return (
      <div className="inv">
        <div className="inv-head">
          <div>
            <h2 className="inv-title">Inventory</h2>
            <p className="inv-subtitle">Loading inventory data...</p>
          </div>
        </div>
        <div className="loading-spinner">Loading inventory...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="inv">
        <div className="inv-head">
          <div>
            <h2 className="inv-title">Inventory</h2>
            <p className="inv-subtitle">Error loading data</p>
          </div>
        </div>
        <div className="error-message">Error: {error}. Ensure backend is running on port 8081.</div>
      </div>
    );
  }

  return (
    <div className="inv">
      <div className="inv-head">
        <div>
          <h2 className="inv-title">Inventory</h2>
          <p className="inv-subtitle">Stock levels, batch tracking, and expiry monitoring</p>
        </div>
        <div className="inv-tabs">
          <button className={`inv-tab ${tab === "all" ? "active" : ""}`} onClick={() => setTab("all")}>
            All Medicines
          </button>
          <button className={`inv-tab ${tab === "low" ? "active" : ""}`} onClick={() => setTab("low")}>
            Low Stock
          </button>
          <button className={`inv-tab ${tab === "out" ? "active" : ""}`} onClick={() => setTab("out")}>
            Out of Stock
          </button>
          <button className={`inv-tab ${tab === "nearExpiry" ? "active" : ""}`} onClick={() => setTab("nearExpiry")}>
            Near Expiry (3 mo)
          </button>
          <button className={`inv-tab ${tab === "expired" ? "active" : ""}`} onClick={() => setTab("expired")}>
            Expired
          </button>
          <button className={`inv-tab ${tab === "aging" ? "active" : ""}`} onClick={() => setTab("aging")}>
            Stock Aging
          </button>
        </div>
      </div>

      <DataTable
        title="Medicine Stock Register"
        subtitle={`Showing ${filtered.length} batch record(s)`}
        columns={columns}
        rows={filtered}
        initialPageSize={10}
        rowKey={(r) => String(r.batchId ?? `${r.name}-${r.batch}`)}
      />
    </div>
  );
}

export default Inventory;
