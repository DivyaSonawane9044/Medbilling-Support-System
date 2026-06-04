import React, { useMemo, useState, useEffect } from "react";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import "./Reports.css";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { analyticsAPI, inventoryAPI, productsAPI, salesAPI, reportsAPI, downloadBlob, handleApiError } from "../services/api";

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function Reports() {
  const [tab, setTab] = useState("daily");
  const [dashboardData, setDashboardData] = useState(null);
  const [stockData, setStockData] = useState([]);
  const [products, setProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      setError(null);
      const errors = [];

      try {
        const dashboardResponse = await analyticsAPI.getDashboard();
        setDashboardData(dashboardResponse.data);
      } catch (err) {
        errors.push(`Dashboard: ${handleApiError(err).message}`);
      }

      try {
        const stockResponse = await inventoryAPI.getAllStock();
        setStockData(stockResponse.data || []);
      } catch (err) {
        errors.push(`Stock: ${handleApiError(err).message}`);
      }

      try {
        const productsResponse = await productsAPI.getAll();
        setProducts(productsResponse.data || []);
      } catch (err) {
        errors.push(`Products: ${handleApiError(err).message}`);
      }

      try {
        const invoicesResponse = await salesAPI.listInvoices();
        setInvoices(invoicesResponse.data || []);
      } catch (err) {
        errors.push(`Invoices: ${handleApiError(err).message}`);
      }

      if (errors.length === 4) {
        setError(errors.join(" · "));
      } else if (errors.length > 0) {
        setError(errors.join(" · "));
      }
      setLoading(false);
    };

    fetchReportData();
  }, []);

  const today = useMemo(() => new Date(), []);

  const dailyRows = useMemo(() => {
    const byDate = new Map();
    for (const inv of invoices) {
      const key = inv.saleDateTime ? String(inv.saleDateTime).split("T")[0] : "unknown";
      const curr = byDate.get(key) || { date: key, invoices: 0, taxable: 0, cgst: 0, sgst: 0, grand: 0 };
      curr.invoices += 1;
      curr.taxable += Number(inv.totalTaxableAmount) || 0;
      curr.cgst += Number(inv.totalCgst) || 0;
      curr.sgst += Number(inv.totalSgst) || 0;
      curr.grand += Number(inv.grandTotal) || 0;
      byDate.set(key, curr);
    }
    return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [invoices]);

  const todaySummary = useMemo(() => {
    const rows = invoices.filter((inv) => {
      if (!inv.saleDateTime) return false;
      return sameDay(new Date(inv.saleDateTime), today);
    });
    return {
      invoices: rows.length,
      total: rows.reduce((s, inv) => s + (Number(inv.grandTotal) || 0), 0),
      gst: rows.reduce((s, inv) => s + (Number(inv.totalCgst) || 0) + (Number(inv.totalSgst) || 0), 0),
    };
  }, [invoices, today]);

  const stockReport = useMemo(() => {
    return (stockData || []).map((item) => {
      const product = item.product || {};
      const stripSize = Math.max(1, product.stripSize || 1);
      const strips = item.stripStock ?? item.strips ?? 0;
      const tablets = item.tabletStock ?? item.tablets ?? 0;
      return {
        batchId: item.batchId,
        name: product.name || item.name || "Unknown",
        company: product.company || item.company || "N/A",
        batch: item.batchNumber || item.batch || "N/A",
        stock: strips * stripSize + tablets,
        mrp: Number(item.mrp) || 0,
        expiry: item.expiryDate ? String(item.expiryDate).split("T")[0] : "N/A",
      };
    });
  }, [stockData]);

  const alphabeticalMedicines = useMemo(() => {
    return (products || [])
      .map((p) => ({
        name: p.name || "—",
        company: p.company || "N/A",
        genericName: p.genericName || "N/A",
        stripSize: p.stripSize || 1,
        mrp: Number(p.price) || Number(p.mrp) || 0,
        stock: p.quantity || 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const profitLossReport = useMemo(() => {
    if (!dashboardData) return [];
    return [{
      metric: 'Today Revenue',
      value: dashboardData.todayRevenue || 0,
    }, {
      metric: 'Yesterday Revenue',
      value: dashboardData.yesterdayRevenue || 0,
    }, {
      metric: 'Monthly Revenue',
      value: dashboardData.monthlyRevenue || 0,
    }, {
      metric: 'Profit',
      value: dashboardData.profit || 0,
    }, {
      metric: 'Stock Value (MRP)',
      value: dashboardData.totalStockValueMrp || 0,
    }, {
      metric: 'Stock Value (Cost)',
      value: dashboardData.totalStockValueCost || 0,
    }];
  }, [dashboardData]);

  const invoiceRows = useMemo(
    () =>
      invoices.map((inv) => ({
        id: inv.invoiceNumber,
        date: inv.saleDateTime ? new Date(inv.saleDateTime).toLocaleString("en-IN") : "—",
        customer: inv.customerName || "—",
        amount: Number(inv.grandTotal) || 0,
        method: "—",
        status: "Paid",
      })),
    [invoices]
  );

  async function downloadReport(fetcher, filename) {
    try {
      const res = await fetcher();
      downloadBlob(res, filename);
    } catch (err) {
      alert(handleApiError(err).message);
    }
  }

  if (loading) {
    return (
      <div className="rep">
        <div className="rep-head">
          <div>
            <h2 className="rep-title">Reports</h2>
            <p className="rep-subtitle">Loading report data...</p>
          </div>
        </div>
        <div className="loading-spinner">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="rep">
      {error ? (
        <div className="error-message" style={{ marginBottom: 12 }}>
          Some data could not be loaded: {error}
        </div>
      ) : null}

      <div className="rep-head">
        <div>
          <h2 className="rep-title">Reports</h2>
          <p className="rep-subtitle">Daily sales, GST breakdown, and invoice exports</p>
        </div>
        <div className="rep-actions">
          <button className="btn" onClick={() => downloadReport(reportsAPI.daily, 'daily_sales.pdf')}>
            <FileText size={16} /> Daily PDF
          </button>
          <button className="btn" onClick={() => downloadReport(reportsAPI.gstMonthly, 'gst_monthly.csv')}>
            <FileSpreadsheet size={16} /> GST CSV
          </button>
          <button className="btn btn-primary" onClick={() => downloadReport(reportsAPI.profitLoss, 'profit_loss.pdf')}>
            <Download size={16} /> P&amp;L PDF
          </button>
        </div>
      </div>

      <div className="card rep-summary">
        <div className="sum-box">
          <div className="sum-label">Today</div>
          <div className="sum-value">{INR.format(todaySummary.total)}</div>
          <div className="sum-sub">
            <Badge tone="blue">{todaySummary.invoices} invoices</Badge>{" "}
            <Badge tone="green">GST {INR.format(todaySummary.gst)}</Badge>
          </div>
        </div>
        <div className="sum-note" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={() => downloadReport(reportsAPI.stock, 'stock.pdf')}>Stock PDF</button>
          <button type="button" className="btn" onClick={() => downloadReport(reportsAPI.expiry, 'expiry.pdf')}>Expiry PDF</button>
          <button type="button" className="btn" onClick={() => downloadReport(reportsAPI.purchases, 'purchases.pdf')}>Purchase PDF</button>
          <button type="button" className="btn" onClick={() => downloadReport(reportsAPI.medicines, 'medicines.pdf')}>Medicines A-Z</button>
        </div>
      </div>

      <div className="rep-tabs">
        <button className={`rep-tab ${tab === "daily" ? "active" : ""}`} onClick={() => setTab("daily")}>
          Daily Sales (GST)
        </button>
        <button className={`rep-tab ${tab === "invoices" ? "active" : ""}`} onClick={() => setTab("invoices")}>
          Recent Invoices
        </button>
        <button className={`rep-tab ${tab === "stock" ? "active" : ""}`} onClick={() => setTab("stock")}>
          Stock Report
        </button>
        <button className={`rep-tab ${tab === "profit" ? "active" : ""}`} onClick={() => setTab("profit")}>
          Profit & Loss
        </button>
        <button className={`rep-tab ${tab === "alphabetical" ? "active" : ""}`} onClick={() => setTab("alphabetical")}>
          Medicines A-Z
        </button>
      </div>

      {tab === "daily" ? (
        <DataTable
          title="Daily Sales Report"
          subtitle="Includes taxable, CGST, SGST, and gross totals"
          columns={[
            { key: "date", header: "Date" },
            { key: "invoices", header: "Invoices", align: "right" },
            { key: "taxable", header: "Taxable", align: "right", cell: (v) => INR.format(v) },
            { key: "cgst", header: "CGST", align: "right", cell: (v) => INR.format(v) },
            { key: "sgst", header: "SGST", align: "right", cell: (v) => INR.format(v) },
            { key: "grand", header: "Gross", align: "right", cell: (v) => INR.format(v) },
          ]}
          rows={dailyRows}
          rowKey={(r) => r.date}
          initialPageSize={10}
        />
      ) : tab === "invoices" ? (
        <DataTable
          title="Recent Invoices"
          subtitle="Search by invoice id or customer"
          columns={[
            { key: "id", header: "Invoice ID" },
            { key: "date", header: "Date/Time", searchable: false },
            { key: "customer", header: "Customer" },
            { key: "amount", header: "Amount", align: "right", cell: (v) => INR.format(v) },
            { key: "method", header: "Payment", searchable: false },
            {
              key: "status",
              header: "Status",
              searchable: false,
              cell: (v) => (v === "Paid" ? <Badge tone="green">Paid</Badge> : <Badge tone="amber">{v}</Badge>),
            },
          ]}
          rows={invoiceRows}
          rowKey={(r) => r.id}
          initialPageSize={10}
        />
      ) : tab === "stock" ? (
        <DataTable
          title="Stock Report"
          subtitle="Current stock levels and expiry information"
          columns={[
            { key: "name", header: "Medicine" },
            { key: "company", header: "Company" },
            { key: "batch", header: "Batch" },
            { key: "stock", header: "Stock", align: "right" },
            { key: "mrp", header: "MRP", align: "right", cell: (v) => INR.format(v) },
            { key: "expiry", header: "Expiry" },
          ]}
          rows={stockReport}
          rowKey={(r) => String(r.batchId ?? `${r.name}-${r.batch}`)}
          initialPageSize={15}
        />
      ) : tab === "profit" ? (
        <DataTable
          title="Profit & Loss Statement"
          subtitle="Revenue, profit, and stock value metrics"
          columns={[
            { key: "metric", header: "Metric" },
            { key: "value", header: "Value", align: "right", cell: (v) => INR.format(v) },
          ]}
          rows={profitLossReport}
          rowKey={(r) => r.metric}
          initialPageSize={10}
        />
      ) : tab === "alphabetical" ? (
        <DataTable
          title="Alphabetical List of Medicines"
          subtitle="All medicines sorted alphabetically"
          columns={[
            { key: "name", header: "Medicine Name" },
            { key: "company", header: "Company" },
            { key: "genericName", header: "Generic Name" },
            { key: "stripSize", header: "Strip Size", align: "right" },
            { key: "mrp", header: "MRP", align: "right", cell: (v) => INR.format(v) },
            { key: "stock", header: "Stock", align: "right" },
          ]}
          rows={alphabeticalMedicines}
          rowKey={(r) => r.name}
          initialPageSize={20}
        />
      ) : null}
    </div>
  );
}

export default Reports;

