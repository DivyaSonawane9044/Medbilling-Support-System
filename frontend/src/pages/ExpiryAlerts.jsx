import React, { useEffect, useState } from "react";
import { inventoryAPI, analyticsAPI, purchasesAPI, handleApiError } from "../services/api";
import "./ExpiryAlerts.css";

export default function ExpiryAlerts() {
  const [expiryData, setExpiryData] = useState([]);
  const [lowStockData, setLowStockData] = useState([]);
  const [expiredData, setExpiredData] = useState([]);
  const [pendingPurchases, setPendingPurchases] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [near, expired, lowStock, pending] = await Promise.all([
          inventoryAPI.getNearExpiry(),
          inventoryAPI.getExpired(),
          analyticsAPI.getStockAlerts(30),
          purchasesAPI.getPending(),
        ]);
        setExpiryData(near.data);
        setExpiredData(expired.data);
        setLowStockData(lowStock.data);
        setPendingPurchases(pending.data);
      } catch (err) {
        setError(handleApiError(err).message);
      }
    })();
  }, []);

  if (error) {
    return <div className="alerts-container"><p>{error}</p></div>;
  }

  return (
    <div className="alerts-container">
      <div className="alert-card expiry-alerts">
        <h2>Near Expiry (3 months)</h2>
        {expiryData.length === 0 ? (
          <p className="no-alerts">No medicines expiring soon.</p>
        ) : (
          <ul>
            {expiryData.map((b) => (
              <li key={b.batchId}>
                {b.product?.name || "Product"} — Batch {b.batchNumber} — Expires: {b.expiryDate}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="alert-card low-stock-alerts">
        <h2>Low Stock</h2>
        {lowStockData.length === 0 ? (
          <p className="no-alerts">Stock levels OK.</p>
        ) : (
          <ul>
            {lowStockData.map((p) => (
              <li key={p.productId}>{p.name} — Reorder level: {p.reorderLevel}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="alert-card expired-alerts">
        <h2>Expired Stock</h2>
        {expiredData.length === 0 ? (
          <p className="no-alerts">No expired batches.</p>
        ) : (
          <ul>
            {expiredData.map((b) => (
              <li key={b.batchId}>
                {b.product?.name} — Batch {b.batchNumber} — Expired: {b.expiryDate}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="alert-card overdue-orders">
        <h2>Pending Purchases</h2>
        {pendingPurchases.length === 0 ? (
          <p className="no-alerts">No pending purchase orders.</p>
        ) : (
          <ul>
            {pendingPurchases.map((po) => (
              <li key={po.invoiceId}>
                {po.invoiceNumber} — {po.supplier?.name || "Supplier"} — {po.status}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
