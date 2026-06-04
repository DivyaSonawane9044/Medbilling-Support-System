import React, { useMemo, useState, useEffect } from "react";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import { inventoryAPI, analyticsAPI, purchasesAPI, reportsAPI, downloadBlob, handleApiError } from "../services/api";
import { 
  Clock, 
  AlertTriangle, 
  RotateCcw, 
  Layers, 
  FileText, 
  CalendarDays, 
  ChevronRight, 
  RefreshCw,
  Search,
  CheckCircle2
} from "lucide-react";
import "./ExpiryTracking.css";

function monthsFromNow(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
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
    costPrice: item.costPrice || 0,
    mrp: item.mrp || 0,
    supplier: item.supplier?.name || "N/A",
    totalValue: totalTablets * (item.costPrice || 0),
    stockLabel: `${stripQty} strips + ${tabletQty} tablets`,
  };
}

function ExpiryTracking() {
  const [tab, setTab] = useState("nearExpiry");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  
  // Data States
  const [nearExpiry, setNearExpiry] = useState([]);
  const [expired, setExpired] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [pendingPurchases, setPendingPurchases] = useState([]);
  const [allStock, setAllStock] = useState([]);

  // Supplier Return Modal State
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [returnStrips, setReturnStrips] = useState(0);
  const [returnTablets, setReturnTablets] = useState(0);
  const [returning, setReturning] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [
        nearExpiryRes, 
        expiredRes, 
        lowStockRes, 
        pendingRes, 
        allStockRes
      ] = await Promise.all([
        inventoryAPI.getNearExpiry(),
        inventoryAPI.getExpired(),
        analyticsAPI.getStockAlerts(),
        purchasesAPI.getPending(),
        inventoryAPI.getAllStock()
      ]);

      setNearExpiry(nearExpiryRes.data || []);
      setExpired(expiredRes.data || []);
      
      // Map low stock products properly
      setLowStock(
        (lowStockRes.data || []).map((p) => ({
          productId: p.productId,
          name: p.name || "Unknown",
          company: p.company || "N/A",
          currentStock: p.quantity ?? 0,
          reorderLevel: p.reorderLevel ?? 0,
          supplier: p.supplier || "—",
          status: (p.quantity ?? 0) === 0 ? "out" : "low"
        }))
      );

      // Map pending purchase invoices
      setPendingPurchases(
        (pendingRes.data || []).map((po) => ({
          id: po.invoiceNumber || po.invoiceId || "—",
          supplier: po.supplier?.name || "—",
          items: po.batches?.length || 0,
          status: po.status || "PENDING",
          date: po.purchaseDate || "—",
          amount: po.totalAmount || 0,
        }))
      );

      setAllStock(allStockRes.data || []);
    } catch (err) {
      setError(handleApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExportPDF = async () => {
    try {
      const response = await reportsAPI.expiry();
      downloadBlob(response, "expiry_report.pdf");
    } catch (err) {
      alert("Failed to export expiry PDF report: " + err.message);
    }
  };

  const handleOpenReturnModal = (batch) => {
    setSelectedBatch(batch);
    setReturnStrips(0);
    setReturnTablets(0);
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBatch) return;

    try {
      setReturning(true);
      await inventoryAPI.processReturn({
        batchId: selectedBatch.batchId,
        strips: parseInt(returnStrips || 0),
        tablets: parseInt(returnTablets || 0)
      });
      
      setSuccessMessage(`Successfully returned stock for ${selectedBatch.name} (Batch: ${selectedBatch.batch}) to supplier.`);
      setSelectedBatch(null);
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => setSuccessMessage(""), 5000);
      
      // Refresh database records
      await fetchData();
    } catch (err) {
      alert("Failed to process return: " + handleApiError(err).message);
    } finally {
      setReturning(false);
    }
  };

  // Build Enriched Datasets for specific views
  const nearExpiryEnriched = useMemo(() => {
    const today = new Date();
    const nearExpiryBefore = monthsFromNow(3);
    
    return nearExpiry.map((item) => {
      const row = normalizeBatch(item);
      const expDate = row.exp !== "N/A" ? new Date(row.exp) : null;
      const daysToExpiry = expDate ? Math.ceil((expDate - today) / (1000 * 60 * 60 * 24)) : 0;
      
      return {
        ...row,
        daysToExpiry,
        status: "nearExpiry"
      };
    });
  }, [nearExpiry]);

  const expiredEnriched = useMemo(() => {
    const today = new Date();
    
    return expired.map((item) => {
      const row = normalizeBatch(item);
      const expDate = row.exp !== "N/A" ? new Date(row.exp) : null;
      const daysToExpiry = expDate ? Math.ceil((expDate - today) / (1000 * 60 * 60 * 24)) : 0;
      
      return {
        ...row,
        daysToExpiry,
        status: "expired"
      };
    });
  }, [expired]);

  const batchStockEnriched = useMemo(() => {
    const today = new Date();
    const nearExpiryBefore = monthsFromNow(3);
    
    return allStock.map((item) => {
      const row = normalizeBatch(item);
      const expDate = row.exp !== "N/A" ? new Date(row.exp) : null;
      const isExpired = expDate && expDate < today;
      const isNearExpiry = expDate && !isExpired && expDate <= nearExpiryBefore;
      
      return {
        ...row,
        isExpired,
        isNearExpiry,
        status: isExpired ? "expired" : (isNearExpiry ? "nearExpiry" : "ok")
      };
    });
  }, [allStock]);

  const supplierReturnsEnriched = useMemo(() => {
    // Expiry returns can be made from expired or near-expiry batches
    return [...expiredEnriched, ...nearExpiryEnriched];
  }, [expiredEnriched, nearExpiryEnriched]);

  // Determine which rows & columns to feed to DataTable based on Active Tab
  const activeRows = useMemo(() => {
    if (tab === "nearExpiry") return nearExpiryEnriched;
    if (tab === "expired") return expiredEnriched;
    if (tab === "lowStock") return lowStock;
    if (tab === "pendingPurchases") return pendingPurchases;
    if (tab === "batchStock") return batchStockEnriched;
    if (tab === "supplierReturns") return supplierReturnsEnriched;
    return [];
  }, [tab, nearExpiryEnriched, expiredEnriched, lowStock, pendingPurchases, batchStockEnriched, supplierReturnsEnriched]);

  const columns = useMemo(() => {
    if (tab === "nearExpiry" || tab === "expired") {
      return [
        {
          key: "name",
          header: "Medicine",
          accessor: (r) => r.name,
          cell: (v, r) => (
            <div className="expiry-med">
              <div className="expiry-med-name">{v}</div>
              <div className="expiry-med-sub">{r.company}</div>
            </div>
          ),
        },
        { key: "batch", header: "Batch No.", accessor: (r) => r.batch, searchable: true },
        { key: "mfg", header: "MFG Date", accessor: (r) => r.mfg, searchable: false },
        { key: "exp", header: "EXP Date", accessor: (r) => r.exp, searchable: false },
        {
          key: "daysToExpiry",
          header: "Days to Expiry",
          accessor: (r) => r.daysToExpiry,
          cell: (v) => (
            <span className={v <= 30 ? "expiry-critical" : v <= 90 ? "expiry-warning" : "expiry-ok"}>
              {v <= 0 ? `Expired (${Math.abs(v)}d ago)` : `${v} days`}
            </span>
          ),
          searchable: false,
        },
        {
          key: "stockLabel",
          header: "Stock Quantity",
          accessor: (r) => r.stockLabel,
          align: "right",
          searchable: false,
        },
        {
          key: "supplier",
          header: "Supplier",
          accessor: (r) => r.supplier,
          searchable: true,
        },
        {
          key: "status",
          header: "Status",
          accessor: (r) => r.status,
          searchable: false,
          cell: (v) => (
            <Badge tone={v === "expired" ? "red" : "amber"}>
              {v === "expired" ? "Expired" : "Near Expiry"}
            </Badge>
          ),
        },
      ];
    }

    if (tab === "lowStock") {
      return [
        {
          key: "name",
          header: "Medicine",
          accessor: (r) => r.name,
          cell: (v, r) => (
            <div className="expiry-med">
              <div className="expiry-med-name">{v}</div>
              <div className="expiry-med-sub">{r.company}</div>
            </div>
          ),
        },
        {
          key: "currentStock",
          header: "Current Stock",
          accessor: (r) => r.currentStock,
          align: "right",
          cell: (v) => <span className="font-semibold text-red-600">{v} units</span>,
          searchable: false,
        },
        {
          key: "reorderLevel",
          header: "Reorder Level",
          accessor: (r) => r.reorderLevel,
          align: "right",
          searchable: false,
        },
        {
          key: "supplier",
          header: "Supplier",
          accessor: (r) => r.supplier,
          searchable: true,
        },
        {
          key: "status",
          header: "Status",
          accessor: (r) => r.status,
          searchable: false,
          cell: (v) => (
            <Badge tone="red">
              {v === "out" ? "Out of Stock" : "Low Stock"}
            </Badge>
          ),
        },
      ];
    }

    if (tab === "pendingPurchases") {
      return [
        { key: "id", header: "Invoice/PO ID", accessor: (r) => r.id, searchable: true },
        { key: "supplier", header: "Supplier", accessor: (r) => r.supplier, searchable: true },
        { key: "date", header: "Order Date", accessor: (r) => r.date, searchable: false },
        {
          key: "amount",
          header: "Total Amount",
          accessor: (r) => `₹${Number(r.amount).toFixed(2)}`,
          align: "right",
          searchable: false,
        },
        {
          key: "status",
          header: "Order Status",
          accessor: (r) => r.status,
          searchable: false,
          cell: () => <Badge tone="amber">Pending</Badge>,
        },
      ];
    }

    if (tab === "batchStock") {
      return [
        {
          key: "name",
          header: "Medicine",
          accessor: (r) => r.name,
          cell: (v, r) => (
            <div className="expiry-med">
              <div className="expiry-med-name">{v}</div>
              <div className="expiry-med-sub">{r.company}</div>
            </div>
          ),
        },
        { key: "batch", header: "Batch No.", accessor: (r) => r.batch, searchable: true },
        { key: "mfg", header: "MFG Date", accessor: (r) => r.mfg, searchable: false },
        { key: "exp", header: "EXP Date", accessor: (r) => r.exp, searchable: false },
        {
          key: "mrp",
          header: "MRP",
          accessor: (r) => `₹${Number(r.mrp).toFixed(2)}`,
          align: "right",
          searchable: false,
        },
        {
          key: "stockLabel",
          header: "Stock Quantity",
          accessor: (r) => r.stockLabel,
          align: "right",
          searchable: false,
        },
        {
          key: "totalValue",
          header: "Stock Value",
          accessor: (r) => `₹${Number(r.totalValue).toFixed(2)}`,
          align: "right",
          searchable: false,
        },
        {
          key: "status",
          header: "Status",
          accessor: (r) => r.status,
          searchable: false,
          cell: (v) => {
            if (v === "expired") return <Badge tone="red">Expired</Badge>;
            if (v === "nearExpiry") return <Badge tone="amber">Near Expiry</Badge>;
            return <Badge tone="green">In Stock</Badge>;
          },
        },
      ];
    }

    if (tab === "supplierReturns") {
      return [
        {
          key: "name",
          header: "Medicine",
          accessor: (r) => r.name,
          cell: (v, r) => (
            <div className="expiry-med">
              <div className="expiry-med-name">{v}</div>
              <div className="expiry-med-sub">{r.company}</div>
            </div>
          ),
        },
        { key: "batch", header: "Batch No.", accessor: (r) => r.batch, searchable: true },
        { key: "exp", header: "EXP Date", accessor: (r) => r.exp, searchable: false },
        {
          key: "stockLabel",
          header: "Available Stock",
          accessor: (r) => r.stockLabel,
          searchable: false,
        },
        { key: "supplier", header: "Supplier", accessor: (r) => r.supplier, searchable: true },
        {
          key: "status",
          header: "Stock Condition",
          accessor: (r) => r.status,
          searchable: false,
          cell: (v) => (
            <Badge tone={v === "expired" ? "red" : "amber"}>
              {v === "expired" ? "Expired" : "Near Expiry"}
            </Badge>
          ),
        },
        {
          key: "actions",
          header: "Action",
          accessor: () => "",
          searchable: false,
          cell: (_, r) => (
            <button 
              className="btn btn-sm btn-primary return-action-btn"
              onClick={() => handleOpenReturnModal(r)}
              disabled={r.stripQty === 0 && r.tabletQty === 0}
            >
              Return to Supplier
            </button>
          ),
        },
      ];
    }

    return [];
  }, [tab]);

  if (loading) {
    return (
      <div className="expiry-tracking">
        <div className="expiry-head">
          <div>
            <h2 className="expiry-title">Expiry & Batch Tracking</h2>
            <p className="expiry-subtitle">Access alerts, batch histories, and supplier return systems</p>
          </div>
        </div>
        <div className="loading-spinner-container">
          <div className="loading-spinner"></div>
          <p>Analyzing stock records and alert schedules...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="expiry-tracking">
        <div className="expiry-head">
          <div>
            <h2 className="expiry-title">Expiry & Batch Tracking</h2>
            <p className="expiry-subtitle">Error loading unified records</p>
          </div>
        </div>
        <div className="error-message">
          <AlertTriangle size={20} />
          <span>Error loading data: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="expiry-tracking">
      {successMessage && (
        <div className="success-banner">
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="expiry-head">
        <div>
          <h2 className="expiry-title">Expiry & Batch Tracking</h2>
          <p className="expiry-subtitle">Consolidated manager for near-expiry stock, low stock warnings, and returns</p>
        </div>
        <div className="expiry-head-actions">
          <button className="btn btn-secondary flex items-center gap-2" onClick={fetchData} title="Sync Data">
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-primary flex items-center gap-2" onClick={handleExportPDF}>
            <FileText size={14} /> Export Expiry Report (PDF)
          </button>
        </div>
      </div>

      <div className="expiry-tabs-wrapper">
        <div className="expiry-tabs">
          <button 
            className={`expiry-tab ${tab === "nearExpiry" ? "active" : ""}`} 
            onClick={() => setTab("nearExpiry")}
          >
            <Clock size={15} />
            <span>Near Expiry ({nearExpiryEnriched.length})</span>
          </button>
          <button 
            className={`expiry-tab ${tab === "expired" ? "active" : ""}`} 
            onClick={() => setTab("expired")}
          >
            <AlertTriangle size={15} />
            <span>Expired Stock ({expiredEnriched.length})</span>
          </button>
          <button 
            className={`expiry-tab ${tab === "lowStock" ? "active" : ""}`} 
            onClick={() => setTab("lowStock")}
          >
            <Layers size={15} />
            <span>Low Stock Alerts ({lowStock.length})</span>
          </button>
          <button 
            className={`expiry-tab ${tab === "pendingPurchases" ? "active" : ""}`} 
            onClick={() => setTab("pendingPurchases")}
          >
            <CalendarDays size={15} />
            <span>Pending Purchases ({pendingPurchases.length})</span>
          </button>
          <button 
            className={`expiry-tab ${tab === "batchStock" ? "active" : ""}`} 
            onClick={() => setTab("batchStock")}
          >
            <Layers size={15} />
            <span>Batch-wise Stock ({batchStockEnriched.length})</span>
          </button>
          <button 
            className={`expiry-tab ${tab === "supplierReturns" ? "active" : ""}`} 
            onClick={() => setTab("supplierReturns")}
          >
            <RotateCcw size={15} />
            <span>Supplier Returns ({supplierReturnsEnriched.length})</span>
          </button>
        </div>
      </div>

      <div className="tab-explanation-card">
        {tab === "nearExpiry" && (
          <p>⚠️ Showing batches expiring within the next 3 months. Plan promotions or prioritize these batches on invoices.</p>
        )}
        {tab === "expired" && (
          <p>❌ Showing expired batches. These items have been blocked from sales and must be returned or disposed of.</p>
        )}
        {tab === "lowStock" && (
          <p>📉 Showing medicines with stock levels below their configured reorder points. Consider issuing purchase orders.</p>
        )}
        {tab === "pendingPurchases" && (
          <p>⏳ Showing purchase invoices currently in pending status. These must be received to update stock quantities.</p>
        )}
        {tab === "batchStock" && (
          <p>📋 Showing all active batches recorded in database. Filter or search by batch number or medicine name.</p>
        )}
        {tab === "supplierReturns" && (
          <p>🔄 Select an expired or near-expiry batch below to return stock back to its designated supplier.</p>
        )}
      </div>

      <DataTable
        title={
          tab === "nearExpiry" ? "Near Expiry Alerts" :
          tab === "expired" ? "Expired Stock Registry" :
          tab === "lowStock" ? "Low Stock Warnings" :
          tab === "pendingPurchases" ? "Pending Purchase Orders" :
          tab === "batchStock" ? "Batch Ledger Register" :
          "Returns to Suppliers Ledger"
        }
        subtitle={`Displaying ${activeRows.length} entry/entries`}
        columns={columns}
        rows={activeRows}
        initialPageSize={10}
        rowKey={(r) => r.batchId ? String(r.batchId) : r.productId ? String(r.productId) : r.id ? String(r.id) : `${r.name}-${r.batch}`}
      />

      {/* Supplier Return Modal Backdrop */}
      {selectedBatch && (
        <div className="return-modal-backdrop">
          <div className="return-modal">
            <div className="return-modal-header">
              <h3>Process Expiry Return</h3>
              <button className="close-button" onClick={() => setSelectedBatch(null)}>×</button>
            </div>
            
            <form onSubmit={handleReturnSubmit}>
              <div className="return-modal-body">
                <div className="return-modal-info-card">
                  <div className="info-row">
                    <span className="info-label">Medicine:</span>
                    <span className="info-val">{selectedBatch.name}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Company:</span>
                    <span className="info-val">{selectedBatch.company}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Batch Number:</span>
                    <span className="info-val font-mono">{selectedBatch.batch}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Supplier:</span>
                    <span className="info-val font-semibold">{selectedBatch.supplier}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Available Stock:</span>
                    <span className="info-val text-blue-600 font-medium">{selectedBatch.stockLabel}</span>
                  </div>
                </div>

                <div className="form-group-row">
                  <div className="form-group">
                    <label htmlFor="returnStripsInput">Strips to Return</label>
                    <input
                      id="returnStripsInput"
                      type="number"
                      min="0"
                      max={selectedBatch.stripQty}
                      value={returnStrips}
                      onChange={(e) => setReturnStrips(Math.min(selectedBatch.stripQty, parseInt(e.target.value) || 0))}
                      required
                    />
                    <span className="input-hint">Max: {selectedBatch.stripQty} strips</span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="returnTabletsInput">Tablets to Return</label>
                    <input
                      id="returnTabletsInput"
                      type="number"
                      min="0"
                      max={selectedBatch.tabletQty}
                      value={returnTablets}
                      onChange={(e) => setReturnTablets(Math.min(selectedBatch.tabletQty, parseInt(e.target.value) || 0))}
                      required
                    />
                    <span className="input-hint">Max: {selectedBatch.tabletQty} tablets</span>
                  </div>
                </div>

                <div className="return-warning-note">
                  This action will immediately reduce current batch inventory and record the supplier return transaction.
                </div>
              </div>
              
              <div className="return-modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setSelectedBatch(null)}
                  disabled={returning}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={returning || (returnStrips === 0 && returnTablets === 0)}
                >
                  {returning ? "Processing..." : "Process Return"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExpiryTracking;
