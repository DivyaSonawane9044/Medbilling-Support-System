import React, { useState, useMemo, useEffect, useCallback } from "react";
import { productsAPI, medicinesAPI, handleApiError } from "../services/api";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import FormField from "../components/ui/FormField";
import TextInput from "../components/ui/TextInput";
import Select from "../components/ui/Select";
import "./ProductMaster.css";
import {
  Package2,
  Calculator,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Search,
  Download,
  Upload,
  Pill,
  IndianRupee,
  BarChart3,
  CheckCircle2,
  RefreshCw,
  Tag,
} from "lucide-react";

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

const SCHEDULE_TYPES = [
  { value: "OTC", label: "OTC (Over the Counter)" },
  { value: "H", label: "Schedule H" },
  { value: "H1", label: "Schedule H1" },
  { value: "G", label: "Schedule G" },
  { value: "X", label: "Schedule X" },
  { value: "C", label: "Schedule C" },
  { value: "C1", label: "Schedule C1" },
  { value: "OTHER", label: "Other" },
];

const GST_RATES = [
  { value: "0", label: "0%" },
  { value: "5", label: "5%" },
  { value: "12", label: "12%" },
  { value: "18", label: "18%" },
  { value: "28", label: "28%" },
];

const DOSAGE_FORMS = [
  { value: "Tablet", label: "Tablet" },
  { value: "Capsule", label: "Capsule" },
  { value: "Syrup", label: "Syrup" },
  { value: "Injection", label: "Injection" },
  { value: "Cream", label: "Cream" },
  { value: "Drops", label: "Drops" },
  { value: "Ointment", label: "Ointment" },
  { value: "Suspension", label: "Suspension" },
  { value: "Other", label: "Other" },
];

const EMPTY_FORM = {
  name: "",
  genericName: "",
  company: "",
  hsnCode: "30049099",
  scheduleType: "OTC",
  dosageForm: "Tablet",
  stripSize: "10",
  mrp: "",
  costPrice: "",
  sellingPrice: "",
  gstRate: "12",
  reorderLevel: "10",
  targetStockLevel: "100",
  currentStock: "0",
  expiryDate: "",
  barcode: "",
  composition: "",
  storageConditions: "",
};

function mapFromApi(p) {
  const price = Number(p.price) || 0;
  const margin = Number(p.profitMargin) || 0.2;
  const costPrice = price > 0 ? +(price / (1 + margin)).toFixed(2) : 0;
  return {
    id: String(p.productId),
    productId: p.productId,
    name: p.name || "",
    genericName: p.genericName || "",
    company: p.company || "",
    hsnCode: p.hsnCode || "",
    scheduleType: p.scheduleDrugType || "OTC",
    dosageForm: p.dosageForm || "Tablet",
    stripSize: p.stripSize || 10,
    sellingPrice: price,
    mrp: price,
    costPrice,
    gstRate: "12",
    reorderLevel: p.reorderLevel || 0,
    targetStockLevel: p.targetStockLevel || 100,
    currentStock: p.quantity || 0,
    expiryDate: p.expiryDate || "",
    barcode: p.barcode || "",
    composition: p.composition || "",
    storageConditions: "",
    profitMarginPct: margin * 100,
  };
}

function mapToApi(fd) {
  const mrp = parseFloat(fd.mrp) || 0;
  const cost = parseFloat(fd.costPrice) || 0;
  const selling = parseFloat(fd.sellingPrice) || mrp;
  const margin = cost > 0 ? (selling - cost) / cost : 0.2;
  return {
    name: fd.name,
    genericName: fd.genericName || null,
    company: fd.company || null,
    hsnCode: fd.hsnCode || "30049099",
    scheduleDrugType: fd.scheduleType || "OTC",
    dosageForm: fd.dosageForm || "Tablet",
    stripSize: parseInt(fd.stripSize, 10) || 10,
    reorderLevel: parseInt(fd.reorderLevel, 10) || 0,
    targetStockLevel: parseInt(fd.targetStockLevel, 10) || 100,
    price: selling || mrp,
    quantity: parseInt(fd.currentStock, 10) || 0,
    expiryDate: fd.expiryDate || null,
    composition: fd.composition || null,
    barcode: fd.barcode || null,
    profitMargin: parseFloat(margin.toFixed(4)),
  };
}

function calcMargin(cost, sell) {
  const c = parseFloat(cost);
  const s = parseFloat(sell);
  if (!c || !s || c === 0) return 0;
  return ((s - c) / c) * 100;
}

function calcProfit(cost, sell) {
  const c = parseFloat(cost);
  const s = parseFloat(sell);
  if (!c || !s) return 0;
  return s - c;
}

function getStockStatus(current, reorder) {
  const cur = Number(current);
  const reord = Number(reorder);
  if (cur === 0) return { label: "Out of Stock", tone: "red" };
  if (cur <= reord) return { label: "Low Stock", tone: "amber" };
  return { label: "In Stock", tone: "green" };
}

export default function ProductMaster() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [filterSchedule, setFilterSchedule] = useState("");
  const [filterStock, setFilterStock] = useState("");

  // Modal / form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  /* ── data fetching ── */
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setApiError(null);
      const res = await productsAPI.getAll();
      setProducts((res.data || []).map(mapFromApi));
    } catch (err) {
      setApiError(handleApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  /* ── derived stats ── */
  const stats = useMemo(() => ({
    total: products.length,
    inStock: products.filter(p => p.currentStock > p.reorderLevel).length,
    lowStock: products.filter(p => p.currentStock > 0 && p.currentStock <= p.reorderLevel).length,
    outOfStock: products.filter(p => p.currentStock === 0).length,
  }), [products]);

  /* ── filter lists ── */
  const companyOptions = useMemo(() =>
    [{ value: "", label: "All Companies" },
      ...[...new Set(products.map(p => p.company).filter(Boolean))].map(c => ({ value: c, label: c }))],
    [products]
  );

  /* ── filtered rows ── */
  const rows = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return products.filter(p => {
      const matchSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        (p.genericName || "").toLowerCase().includes(q) ||
        (p.company || "").toLowerCase().includes(q) ||
        (p.hsnCode || "").toLowerCase().includes(q);
      const matchCompany = !filterCompany || p.company === filterCompany;
      const matchSched = !filterSchedule || p.scheduleType === filterSchedule;
      let matchStock = true;
      if (filterStock === "in-stock") matchStock = p.currentStock > p.reorderLevel;
      if (filterStock === "low-stock") matchStock = p.currentStock > 0 && p.currentStock <= p.reorderLevel;
      if (filterStock === "out-of-stock") matchStock = p.currentStock === 0;
      return matchSearch && matchCompany && matchSched && matchStock;
    });
  }, [products, searchTerm, filterCompany, filterSchedule, filterStock]);

  /* ── form helpers ── */
  const openAdd = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (row) => {
    setEditingId(row.productId);
    setFormData({
      name: row.name,
      genericName: row.genericName,
      company: row.company,
      hsnCode: row.hsnCode,
      scheduleType: row.scheduleType,
      dosageForm: row.dosageForm,
      stripSize: String(row.stripSize),
      mrp: String(row.mrp),
      costPrice: String(row.costPrice),
      sellingPrice: String(row.sellingPrice),
      gstRate: row.gstRate,
      reorderLevel: String(row.reorderLevel),
      targetStockLevel: String(row.targetStockLevel),
      currentStock: String(row.currentStock),
      expiryDate: row.expiryDate,
      barcode: row.barcode,
      composition: row.composition,
      storageConditions: row.storageConditions,
    });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
  };

  const setF = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { setFormError("Medicine name is required."); return; }
    if (!formData.mrp || parseFloat(formData.mrp) <= 0) { setFormError("MRP must be greater than 0."); return; }
    try {
      setSaving(true);
      setFormError(null);
      const payload = mapToApi(formData);
      if (editingId) {
        await productsAPI.update(editingId, payload);
        showSuccess("Medicine updated successfully.");
      } else {
        await productsAPI.create(payload);
        showSuccess("Medicine added successfully.");
      }
      closeForm();
      await loadProducts();
    } catch (err) {
      setFormError(handleApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
    try {
      await productsAPI.delete(row.productId);
      setProducts(prev => prev.filter(p => p.productId !== row.productId));
      showSuccess(`"${row.name}" deleted.`);
    } catch (err) {
      alert(handleApiError(err).message);
    }
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 5000);
  };

  const handleExport = () => {
    const csv = [
      ["Name", "Generic", "Company", "HSN", "Schedule", "Dosage", "Strip Size", "MRP", "Cost", "Selling", "Margin%", "GST%", "Reorder Lvl", "Stock", "Barcode", "Composition"],
      ...products.map(p => [
        p.name, p.genericName, p.company, p.hsnCode, p.scheduleType, p.dosageForm,
        p.stripSize, p.mrp, p.costPrice, p.sellingPrice,
        calcMargin(p.costPrice, p.sellingPrice).toFixed(2),
        p.gstRate, p.reorderLevel, p.currentStock, p.barcode, p.composition
      ])
    ].map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "medicine_catalog.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── computed live margin for form ── */
  const liveMargin = calcMargin(formData.costPrice, formData.sellingPrice);
  const liveProfit = calcProfit(formData.costPrice, formData.sellingPrice);

  /* ── table columns ── */
  const columns = useMemo(() => [
    {
      key: "name",
      header: "Medicine",
      accessor: r => r.name,
      cell: (_, r) => (
        <div className="pm-name-cell">
          <div className="pm-name">{r.name}</div>
          {r.genericName && <div className="pm-generic">{r.genericName}</div>}
          <div className="pm-company">{r.company || "—"}</div>
          {r.barcode && <div className="pm-barcode"><Tag size={11} /> {r.barcode}</div>}
        </div>
      ),
    },
    {
      key: "regulatory",
      header: "Regulatory",
      accessor: r => r.hsnCode,
      cell: (_, r) => (
        <div className="pm-reg-cell">
          <div className="pm-reg-row"><span className="pm-lbl">HSN:</span><span className="pm-val mono">{r.hsnCode || "—"}</span></div>
          <div className="pm-reg-row">
            <span className="pm-lbl">Schedule:</span>
            <Badge tone={r.scheduleType === "OTC" ? "green" : r.scheduleType === "X" || r.scheduleType === "H1" ? "red" : "amber"}>
              {r.scheduleType}
            </Badge>
          </div>
          <div className="pm-reg-row"><span className="pm-lbl">Form:</span><span className="pm-val">{r.dosageForm}</span></div>
          <div className="pm-reg-row"><span className="pm-lbl">Strip:</span><span className="pm-val">{r.stripSize} tabs</span></div>
        </div>
      ),
    },
    {
      key: "pricing",
      header: "Pricing (₹)",
      accessor: r => r.mrp,
      cell: (_, r) => (
        <div className="pm-price-cell">
          <div className="pm-price-row"><span className="pm-lbl">MRP:</span><span className="pm-val pm-mrp">{INR.format(r.mrp)}</span></div>
          <div className="pm-price-row"><span className="pm-lbl">Cost:</span><span className="pm-val pm-cost">{INR.format(r.costPrice)}</span></div>
          <div className="pm-price-row"><span className="pm-lbl">Selling:</span><span className="pm-val pm-sell">{INR.format(r.sellingPrice)}</span></div>
          <div className="pm-price-row"><span className="pm-lbl">GST:</span><span className="pm-val pm-gst">{r.gstRate}%</span></div>
        </div>
      ),
    },
    {
      key: "profit",
      header: "Profit Analysis",
      accessor: r => calcMargin(r.costPrice, r.sellingPrice),
      cell: (_, r) => {
        const margin = calcMargin(r.costPrice, r.sellingPrice);
        const profit = calcProfit(r.costPrice, r.sellingPrice);
        const cls = margin > 20 ? "pm-margin-high" : margin > 10 ? "pm-margin-mid" : "pm-margin-low";
        return (
          <div className="pm-profit-cell">
            <div className={`pm-margin-badge ${cls}`}>
              <BarChart3 size={12} />
              <span>{margin.toFixed(1)}% margin</span>
            </div>
            <div className="pm-profit-row"><span className="pm-lbl">Per unit:</span><span className="pm-val pm-profit">{INR.format(profit)}</span></div>
            <div className="pm-profit-row"><span className="pm-lbl">Reorder:</span><span className="pm-val">{r.reorderLevel}</span></div>
          </div>
        );
      },
    },
    {
      key: "stock",
      header: "Stock",
      accessor: r => r.currentStock,
      cell: (_, r) => {
        const st = getStockStatus(r.currentStock, r.reorderLevel);
        return (
          <div className="pm-stock-cell">
            <div className="pm-stock-qty">{r.currentStock}</div>
            <div className="pm-stock-sub">of {r.targetStockLevel} target</div>
            <div className="pm-stock-bar-wrap">
              <div
                className="pm-stock-bar"
                style={{ width: `${Math.min(100, r.targetStockLevel > 0 ? (r.currentStock / r.targetStockLevel) * 100 : 0)}%`, background: st.tone === "green" ? "#10b981" : st.tone === "amber" ? "#f59e0b" : "#ef4444" }}
              />
            </div>
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      accessor: () => "",
      cell: (_, r) => (
        <div className="pm-actions-cell">
          <button className="pm-action-btn pm-edit-btn" onClick={() => openEdit(r)} title="Edit Medicine">
            <Edit size={15} />
          </button>
          <button className="pm-action-btn pm-delete-btn" onClick={() => handleDelete(r)} title="Delete Medicine">
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ], []);

  /* ── render ── */
  return (
    <div className="pm-page">

      {/* success banner */}
      {successMsg && (
        <div className="pm-success-banner">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ── header ── */}
      <div className="pm-header">
        <div className="pm-header-left">
          <div className="pm-title-icon"><Package2 size={32} /></div>
          <div>
            <h1 className="pm-title">Medicine Catalog &amp; Pricing</h1>
            <p className="pm-subtitle">Unified medicine registry — catalog, pricing, HSN codes, schedules &amp; reorder levels</p>
          </div>
        </div>
        <div className="pm-header-actions">
          <button className="pm-btn pm-btn-secondary" onClick={loadProducts} title="Refresh">
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="pm-btn pm-btn-export" onClick={handleExport}>
            <Download size={14} /> Export CSV
          </button>
          <button className="pm-btn pm-btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add Medicine
          </button>
        </div>
      </div>

      {/* ── stats strip ── */}
      <div className="pm-stats-strip">
        <div className="pm-stat pm-stat-blue">
          <Pill size={20} />
          <div>
            <div className="pm-stat-val">{stats.total}</div>
            <div className="pm-stat-lbl">Total Medicines</div>
          </div>
        </div>
        <div className="pm-stat pm-stat-green">
          <TrendingUp size={20} />
          <div>
            <div className="pm-stat-val">{stats.inStock}</div>
            <div className="pm-stat-lbl">In Stock</div>
          </div>
        </div>
        <div className="pm-stat pm-stat-amber">
          <AlertTriangle size={20} />
          <div>
            <div className="pm-stat-val">{stats.lowStock}</div>
            <div className="pm-stat-lbl">Low Stock</div>
          </div>
        </div>
        <div className="pm-stat pm-stat-red">
          <TrendingDown size={20} />
          <div>
            <div className="pm-stat-val">{stats.outOfStock}</div>
            <div className="pm-stat-lbl">Out of Stock</div>
          </div>
        </div>
      </div>

      {/* ── filters ── */}
      <div className="pm-filters">
        <div className="pm-search-wrap">
          <Search size={16} className="pm-search-icon" />
          <input
            type="text"
            className="pm-search-input"
            placeholder="Search by name, generic, company, HSN…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <select className="pm-filter-select" value={filterCompany} onChange={e => setFilterCompany(e.target.value)}>
          {companyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="pm-filter-select" value={filterSchedule} onChange={e => setFilterSchedule(e.target.value)}>
          <option value="">All Schedules</option>
          {SCHEDULE_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="pm-filter-select" value={filterStock} onChange={e => setFilterStock(e.target.value)}>
          <option value="">All Stock Levels</option>
          <option value="in-stock">In Stock</option>
          <option value="low-stock">Low Stock</option>
          <option value="out-of-stock">Out of Stock</option>
        </select>
      </div>

      {/* ── error banner ── */}
      {apiError && (
        <div className="pm-error-banner">
          <AlertTriangle size={16} /> {apiError}
        </div>
      )}

      {/* ── table ── */}
      {loading ? (
        <div className="pm-loading-wrap">
          <div className="pm-spinner" />
          <p>Loading medicine catalog…</p>
        </div>
      ) : (
        <div className="pm-table-wrap">
          <DataTable
            title={`Medicine Catalog (${rows.length} records)`}
            subtitle="Full product register with pricing and regulatory details"
            columns={columns}
            rows={rows}
            initialPageSize={10}
            rowKey={r => r.id}
          />
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div className="pm-modal-backdrop">
          <div className="pm-modal">
            <div className="pm-modal-header">
              <h2>{editingId ? "Edit Medicine" : "Add New Medicine"}</h2>
              <button className="pm-modal-close" onClick={closeForm}><X size={20} /></button>
            </div>

            <form className="pm-form" onSubmit={handleSubmit}>
              {formError && (
                <div className="pm-form-error"><AlertTriangle size={14} /> {formError}</div>
              )}

              {/* Section 1 — Basic */}
              <div className="pm-form-section">
                <h3><Pill size={15} /> Basic Information</h3>
                <div className="pm-form-grid">
                  <FormField label="Medicine Name" required>
                    <TextInput value={formData.name} onChange={e => setF("name", e.target.value)} placeholder="e.g., Paracetamol 500mg" required />
                  </FormField>
                  <FormField label="Generic Name">
                    <TextInput value={formData.genericName} onChange={e => setF("genericName", e.target.value)} placeholder="e.g., Paracetamol" />
                  </FormField>
                  <FormField label="Company / Manufacturer">
                    <TextInput value={formData.company} onChange={e => setF("company", e.target.value)} placeholder="e.g., Cipla Ltd" />
                  </FormField>
                  <FormField label="Barcode">
                    <TextInput value={formData.barcode} onChange={e => setF("barcode", e.target.value)} placeholder="Scan or enter barcode" />
                  </FormField>
                  <FormField label="Composition" className="pm-full-width">
                    <TextInput value={formData.composition} onChange={e => setF("composition", e.target.value)} placeholder="Active ingredients / composition" />
                  </FormField>
                </div>
              </div>

              {/* Section 2 — Regulatory */}
              <div className="pm-form-section">
                <h3><Tag size={15} /> Regulatory &amp; Packaging</h3>
                <div className="pm-form-grid">
                  <FormField label="HSN Code">
                    <TextInput value={formData.hsnCode} onChange={e => setF("hsnCode", e.target.value)} placeholder="e.g., 30049099" />
                  </FormField>
                  <FormField label="Schedule Drug Type">
                    <Select value={formData.scheduleType} onChange={e => setF("scheduleType", e.target.value)} options={SCHEDULE_TYPES} />
                  </FormField>
                  <FormField label="Dosage Form">
                    <Select value={formData.dosageForm} onChange={e => setF("dosageForm", e.target.value)} options={DOSAGE_FORMS} />
                  </FormField>
                  <FormField label="Strip Size (tablets)">
                    <TextInput type="number" min="1" value={formData.stripSize} onChange={e => setF("stripSize", e.target.value)} placeholder="e.g., 10" />
                  </FormField>
                </div>
              </div>

              {/* Section 3 — Pricing */}
              <div className="pm-form-section">
                <h3><IndianRupee size={15} /> Pricing &amp; Profit</h3>
                <div className="pm-form-grid">
                  <FormField label="MRP (₹)" required>
                    <TextInput type="number" step="0.01" min="0" value={formData.mrp} onChange={e => setF("mrp", e.target.value)} placeholder="0.00" required />
                  </FormField>
                  <FormField label="Cost Price (₹)" required>
                    <TextInput type="number" step="0.01" min="0" value={formData.costPrice} onChange={e => setF("costPrice", e.target.value)} placeholder="0.00" required />
                  </FormField>
                  <FormField label="Selling Price (₹)" required>
                    <TextInput type="number" step="0.01" min="0" value={formData.sellingPrice} onChange={e => setF("sellingPrice", e.target.value)} placeholder="0.00" required />
                  </FormField>
                  <FormField label="GST Rate">
                    <Select value={formData.gstRate} onChange={e => setF("gstRate", e.target.value)} options={GST_RATES} />
                  </FormField>
                </div>

                {/* Live profit calculator */}
                <div className="pm-profit-calc">
                  <Calculator size={16} />
                  <span className="pm-calc-label">Auto Profit:</span>
                  <span className={`pm-calc-margin ${liveMargin > 20 ? "high" : liveMargin > 10 ? "mid" : liveMargin > 0 ? "low" : "zero"}`}>
                    {liveMargin.toFixed(2)}%
                  </span>
                  <span className="pm-calc-sep">•</span>
                  <span className="pm-calc-profit">{INR.format(liveProfit)} per unit</span>
                </div>
              </div>

              {/* Section 4 — Stock */}
              <div className="pm-form-section">
                <h3><BarChart3 size={15} /> Stock &amp; Alerts</h3>
                <div className="pm-form-grid">
                  <FormField label="Current Stock (units)">
                    <TextInput type="number" min="0" value={formData.currentStock} onChange={e => setF("currentStock", e.target.value)} placeholder="0" />
                  </FormField>
                  <FormField label="Reorder Level (alert threshold)">
                    <TextInput type="number" min="0" value={formData.reorderLevel} onChange={e => setF("reorderLevel", e.target.value)} placeholder="e.g., 10" />
                  </FormField>
                  <FormField label="Target Stock Level">
                    <TextInput type="number" min="0" value={formData.targetStockLevel} onChange={e => setF("targetStockLevel", e.target.value)} placeholder="e.g., 100" />
                  </FormField>
                  <FormField label="Expiry Date">
                    <TextInput type="date" value={formData.expiryDate} onChange={e => setF("expiryDate", e.target.value)} />
                  </FormField>
                  <FormField label="Storage Conditions" className="pm-full-width">
                    <TextInput value={formData.storageConditions} onChange={e => setF("storageConditions", e.target.value)} placeholder="e.g., Store below 25°C, away from moisture" />
                  </FormField>
                </div>
              </div>

              <div className="pm-form-actions">
                <button type="button" className="pm-btn pm-btn-secondary" onClick={closeForm} disabled={saving}>Cancel</button>
                <button type="submit" className="pm-btn pm-btn-primary" disabled={saving}>
                  <Save size={15} /> {saving ? "Saving…" : editingId ? "Update Medicine" : "Add Medicine"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
