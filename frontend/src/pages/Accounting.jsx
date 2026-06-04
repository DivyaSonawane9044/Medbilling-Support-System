import React, { useMemo, useState, useEffect } from "react";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import FormField from "../components/ui/FormField";
import Select from "../components/ui/Select";
import { analyticsAPI, salesAPI, handleApiError } from "../services/api";
import "./Accounting.css";

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

function Accounting() {
  const [period, setPeriod] = useState("today");
  const [salesData, setSalesData] = useState([]);
  const [profitLoss, setProfitLoss] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAccountingData = async () => {
      try {
        setLoading(true);
        const [dashboardRes, invoicesRes] = await Promise.all([
          analyticsAPI.getDashboard(),
          salesAPI.listInvoices(),
        ]);
        setProfitLoss(dashboardRes.data);
        setSalesData(mapInvoicesToSalesRows(invoicesRes.data, period));
      } catch (err) {
        setError(handleApiError(err).message);
      } finally {
        setLoading(false);
      }
    };

    fetchAccountingData();
  }, [period]);

  function mapInvoicesToSalesRows(invoices, period) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    return (invoices || [])
      .filter((inv) => {
        const d = inv.saleDateTime ? new Date(inv.saleDateTime) : null;
        if (!d) return false;
        if (period === "today") {
          return d.toDateString() === now.toDateString();
        }
        if (period === "month") return d >= startOfMonth;
        return d >= startOfYear;
      })
      .map((inv) => {
        const taxable = Number(inv.totalTaxableAmount) || 0;
        const cgst = Number(inv.totalCgst) || 0;
        const sgst = Number(inv.totalSgst) || 0;
        const gstAmount = cgst + sgst;
        const total = Number(inv.grandTotal) || 0;
        const profit = taxable * 0.25;
        return {
          id: inv.invoiceNumber,
          date: inv.saleDateTime ? String(inv.saleDateTime).split("T")[0] : "",
          customerName: inv.customerName || "Walk-in",
          taxable,
          gstRate: taxable > 0 ? Math.round((gstAmount / taxable) * 100) : 12,
          cgst,
          sgst,
          gstAmount,
          total,
          costPrice: taxable - profit,
          profit,
          margin: taxable > 0 ? ((profit / taxable) * 100).toFixed(2) : "0",
        };
      });
  }

  const summary = useMemo(() => {
    const totalSales = salesData.reduce((sum, item) => sum + item.total, 0);
    const totalTaxable = salesData.reduce((sum, item) => sum + item.taxable, 0);
    const totalCGST = salesData.reduce((sum, item) => sum + item.cgst, 0);
    const totalSGST = salesData.reduce((sum, item) => sum + item.sgst, 0);
    const totalGST = salesData.reduce((sum, item) => sum + item.gstAmount, 0);
    const totalCost = salesData.reduce((sum, item) => sum + item.costPrice, 0);
    const totalProfit = salesData.reduce((sum, item) => sum + item.profit, 0);
    const avgMargin = salesData.length > 0 ? (totalProfit / totalTaxable) * 100 : 0;

    return {
      totalSales,
      totalTaxable,
      totalCGST,
      totalSGST,
      totalGST,
      totalCost,
      totalProfit,
      avgMargin: avgMargin.toFixed(2),
    };
  }, [salesData]);

  const periodOptions = [
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "quarter", label: "This Quarter" },
    { value: "year", label: "This Year" },
  ];

  const columns = useMemo(
    () => [
      { key: "id", header: "Invoice ID", searchable: true },
      { key: "date", header: "Date", searchable: false },
      { key: "customerName", header: "Customer", searchable: true },
      {
        key: "taxable",
        header: "Taxable Amount",
        align: "right",
        cell: (v) => INR.format(v),
        searchable: false,
      },
      {
        key: "gstRate",
        header: "GST Rate",
        align: "right",
        cell: (v) => `${v}%`,
        searchable: false,
      },
      {
        key: "cgst",
        header: "CGST",
        align: "right",
        cell: (v) => INR.format(v),
        searchable: false,
      },
      {
        key: "sgst",
        header: "SGST",
        align: "right",
        cell: (v) => INR.format(v),
        searchable: false,
      },
      {
        key: "total",
        header: "Total",
        align: "right",
        cell: (v) => INR.format(v),
        searchable: false,
      },
      {
        key: "profit",
        header: "Profit",
        align: "right",
        cell: (v) => INR.format(v),
        searchable: false,
      },
      {
        key: "margin",
        header: "Margin %",
        align: "right",
        cell: (v) => `${v}%`,
        searchable: false,
      },
    ],
    []
  );

  if (loading) {
    return (
      <div className="accounting">
        <div className="accounting-head">
          <div>
            <h2 className="accounting-title">Tax & Financial Accounting</h2>
            <p className="accounting-subtitle">Loading accounting data...</p>
          </div>
        </div>
        <div className="loading-spinner">Loading accounting data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="accounting">
        <div className="accounting-head">
          <div>
            <h2 className="accounting-title">Tax & Financial Accounting</h2>
            <p className="accounting-subtitle">Error loading data</p>
          </div>
        </div>
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="accounting">
      <div className="accounting-head">
        <div>
          <h2 className="accounting-title">Tax & Financial Accounting</h2>
          <p className="accounting-subtitle">Daily sales, GST breakup, profit & loss tracking</p>
        </div>
        <div className="accounting-controls">
          <FormField label="Period">
            <Select value={period} onChange={(e) => setPeriod(e.target.value)} options={periodOptions} />
          </FormField>
        </div>
      </div>

      <div className="accounting-summary">
        <div className="summary-card">
          <div className="summary-label">Total Sales</div>
          <div className="summary-value">{INR.format(summary.totalSales)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total Taxable</div>
          <div className="summary-value">{INR.format(summary.totalTaxable)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total CGST</div>
          <div className="summary-value">{INR.format(summary.totalCGST)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total SGST</div>
          <div className="summary-value">{INR.format(summary.totalSGST)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total GST</div>
          <div className="summary-value">{INR.format(summary.totalGST)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total Cost</div>
          <div className="summary-value">{INR.format(summary.totalCost)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total Profit</div>
          <div className="summary-value profit">{INR.format(summary.totalProfit)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Avg Margin</div>
          <div className="summary-value">{summary.avgMargin}%</div>
        </div>
      </div>

      <DataTable
        title="Sales Report with GST Breakup"
        subtitle={`Sales data for ${periodOptions.find(o => o.value === period)?.label}`}
        columns={columns}
        rows={salesData}
        initialPageSize={15}
        rowKey={(r) => r.id}
      />
    </div>
  );
}

export default Accounting;
