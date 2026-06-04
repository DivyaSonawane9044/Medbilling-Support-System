import React, { useMemo, useState, useEffect } from "react";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import { inventoryAPI, analyticsAPI, purchasesAPI, handleApiError } from "../services/api";
import "./StockAlerts.css";

function monthsFromNow(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}

function parseDateISO(iso) {
  if (!iso) return new Date();
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function StockAlerts() {
  const [tab, setTab] = useState("lowStock");
  const [stockAlerts, setStockAlerts] = useState([]);
  const [nearExpiry, setNearExpiry] = useState([]);
  const [expired, setExpired] = useState([]);
  const [pendingPurchases, setPendingPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAlertData = async () => {
      try {
        setLoading(true);
        const [stockAlertsResponse, nearExpiryResponse, expiredResponse, pendingRes] = await Promise.all([
          analyticsAPI.getStockAlerts(),
          inventoryAPI.getNearExpiry(),
          inventoryAPI.getExpired(),
          purchasesAPI.getPending(),
        ]);

        setStockAlerts(stockAlertsResponse.data);
        setNearExpiry(nearExpiryResponse.data);
        setExpired(expiredResponse.data);
        setPendingPurchases(
          pendingRes.data.map((po) => ({
            id: po.invoiceNumber,
            supplier: po.supplier?.name || "—",
            items: po.batches?.length || 0,
            status: po.status,
            date: po.purchaseDate,
          }))
        );
      } catch (err) {
        setError(handleApiError(err).message);
      } finally {
        setLoading(false);
      }
    };

    fetchAlertData();
  }, []);

  const enriched = useMemo(() => {
    const today = new Date();
    const nearExpiryBefore = monthsFromNow(3);
    
    let dataToProcess = [];
    if (tab === "lowStock") {
      dataToProcess = stockAlerts;
    } else if (tab === "nearExpiry") {
      dataToProcess = nearExpiry;
    } else if (tab === "expired") {
      dataToProcess = expired;
    } else if (tab === "pendingPurchases") {
      dataToProcess = pendingPurchases;
    }

    return dataToProcess.map((item) => {
      const expDate = item.expiryDate ? new Date(item.expiryDate) : null;
      const isExpired = expDate && expDate < today;
      const isNearExpiry = expDate && !isExpired && expDate <= nearExpiryBefore;
      const daysToExpiry = expDate ? Math.ceil((expDate - today) / (1000 * 60 * 60 * 24)) : 0;
      
      return {
        name: item.product?.name || item.name || 'Unknown',
        company: item.product?.company || item.company || 'N/A',
        batch: item.batchNumber || item.batch || 'N/A',
        currentStock: item.quantity || item.currentStock || 0,
        reorderLevel: item.reorderLevel || item.product?.reorderLevel || 0,
        exp: item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : 'N/A',
        isExpired,
        isNearExpiry,
        daysToExpiry,
        status: isExpired ? 'expired' : (isNearExpiry ? 'nearExpiry' : (item.currentStock <= item.reorderLevel ? 'low' : 'ok')),
        supplier: item.supplier || 'N/A',
        items: item.items || 0,
        purchaseDate: item.date || 'N/A',
      };
    });
  }, [stockAlerts, nearExpiry, expired, pendingPurchases, tab]);

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "Medicine",
        accessor: (r) => r.name,
        cell: (v, r) => (
          <div className="alert-med">
            <div className="alert-med-name">{v}</div>
            <div className="alert-med-sub">{r.company}</div>
          </div>
        ),
      },
      { key: "batch", header: "Batch", accessor: (r) => r.batch, searchable: true },
      {
        key: "currentStock",
        header: "Current Stock",
        accessor: (r) => r.currentStock,
        align: "right",
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
        key: "exp",
        header: "Expiry Date",
        accessor: (r) => r.exp,
        searchable: false,
      },
      {
        key: "daysToExpiry",
        header: "Days to Expiry",
        accessor: (r) => r.daysToExpiry,
        cell: (v) => v ? `${v} days` : 'N/A',
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
        cell: (v) => {
          if (v === "expired") return <Badge tone="red">Expired</Badge>;
          if (v === "nearExpiry") return <Badge tone="amber">Near Expiry</Badge>;
          if (v === "low") return <Badge tone="amber">Low Stock</Badge>;
          if (v === "ok") return <Badge tone="green">OK</Badge>;
          if (v === "Pending") return <Badge tone="amber">Pending</Badge>;
          return <Badge tone="gray">Unknown</Badge>;
        },
      },
    ],
    []
  );

  if (loading) {
    return (
      <div className="stock-alerts">
        <div className="alerts-head">
          <div>
            <h2 className="alerts-title">Stock Alerts & Notifications</h2>
            <p className="alerts-subtitle">Loading alerts...</p>
          </div>
        </div>
        <div className="loading-spinner">Loading alerts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stock-alerts">
        <div className="alerts-head">
          <div>
            <h2 className="alerts-title">Stock Alerts & Notifications</h2>
            <p className="alerts-subtitle">Error loading data</p>
          </div>
        </div>
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="stock-alerts">
      <div className="alerts-head">
        <div>
          <h2 className="alerts-title">Stock Alerts & Notifications</h2>
          <p className="alerts-subtitle">Monitor low stock, expiry alerts, and pending purchases</p>
        </div>
        <div className="alerts-tabs">
          <button className={`alerts-tab ${tab === "lowStock" ? "active" : ""}`} onClick={() => setTab("lowStock")}>
            Low Stock ({stockAlerts.length})
          </button>
          <button className={`alerts-tab ${tab === "nearExpiry" ? "active" : ""}`} onClick={() => setTab("nearExpiry")}>
            Near Expiry ({nearExpiry.length})
          </button>
          <button className={`alerts-tab ${tab === "expired" ? "active" : ""}`} onClick={() => setTab("expired")}>
            Expired ({expired.length})
          </button>
          <button className={`alerts-tab ${tab === "pendingPurchases" ? "active" : ""}`} onClick={() => setTab("pendingPurchases")}>
            Pending Purchases ({pendingPurchases.length})
          </button>
        </div>
      </div>

      <DataTable
        title="Stock Alerts Dashboard"
        subtitle="Real-time monitoring of inventory alerts and notifications"
        columns={columns}
        rows={enriched}
        initialPageSize={15}
        rowKey={(r) => `${r.name}-${r.batch}`}
      />
    </div>
  );
}

export default StockAlerts;
