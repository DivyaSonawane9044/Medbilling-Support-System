import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { productsAPI, inventoryAPI, handleApiError } from "../services/api";
import { PageHeader, DataTable, Badge, FormField, TextInput, Select, StatusBadge, ProgressBar, Modal, LoadingSkeleton, EmptyState } from "../components/ui";
import { DosageChip } from "./pos/dosageIcon";
import "./ProductMaster.css";
import {
  Package2, Calculator, AlertTriangle, Plus, Edit, Trash2, Save, Search, Download, Pill, IndianRupee, BarChart3,
  CheckCircle2, RefreshCw, Tag, Boxes, PackageCheck, PackageX, Layers, Eye, Info,
} from "lucide-react";

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

const SCHEDULE_TYPES = [
  { value: "OTC", label: "OTC (Over the Counter)" },
  { value: "Rx", label: "Rx (Prescription)" },
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

// Values match what the backend stores (seed data uses "Drop", not "Drops").
const DOSAGE_FORMS = ["Tablet", "Capsule", "Syrup", "Injection", "Cream", "Drop", "Ointment", "Suspension", "Other"];
const UNIT_TYPES = ["Strip", "Bottle", "Tube", "Vial", "Box", "Sachet", "Other"];

const EMPTY_FORM = {
  name: "",
  genericName: "",
  company: "",
  hsnCode: "30049099",
  scheduleDrugType: "OTC",
  dosageForm: "Tablet",
  unitType: "Strip",
  stripSize: "10",
  price: "",
  gstRate: "12",
  reorderLevel: "10",
  targetStockLevel: "100",
  barcode: "",
  composition: "",
  // opening stock (create only)
  openingQuantity: "",
  batchNumber: "",
  mfgDate: "",
  expiryDate: "",
  mrp: "",
  costPrice: "",
};

const STATUS_META = {
  in_stock: { label: "In Stock", badge: "IN_STOCK", tone: "success" },
  low_stock: { label: "Low Stock", badge: "LOW_STOCK", tone: "warning" },
  out_of_stock: { label: "Out of Stock", badge: "OUT_OF_STOCK", tone: "danger" },
};

const STOCK_CHIPS = [
  { value: "", label: "All" },
  { value: "in_stock", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
];

/** Options for a select, keeping any existing value that is not in the default list. */
function withCurrent(list, current) {
  const values = current && !list.includes(current) ? [...list, current] : list;
  return values.map((v) => ({ value: v, label: v }));
}

const pad2 = (n) => String(n).padStart(2, "0");
function localISO(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function todayLocalISO() {
  return localISO(new Date());
}

// Expiry status of a batch: same 3-month near-expiry window as the backend
function expiryStatus(expiry) {
  if (!expiry) return null;
  const today = todayLocalISO();
  const near = new Date();
  near.setMonth(near.getMonth() + 3);
  if (expiry < today) return "EXPIRED";
  if (expiry <= localISO(near)) return "NEAR_EXPIRY";
  return "OK";
}

const numOrNull = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
const intOrNull = (v) => (v === "" || v === null || v === undefined ? null : parseInt(v, 10));
const strOrNull = (v) => (typeof v === "string" && v.trim() === "" ? null : v ?? null);

export default function ProductMaster() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [stockById, setStockById] = useState({});
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [stockError, setStockError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  // Filters
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [filterCompany, setFilterCompany] = useState("");
  const [filterSchedule, setFilterSchedule] = useState("");
  const [filterStock, setFilterStock] = useState("");

  // Modal / form
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [errorField, setErrorField] = useState(null);
  const [saving, setSaving] = useState(false);

  // Detail view (batches)
  const [detail, setDetail] = useState(null);
  const [batches, setBatches] = useState(null); // null = not loaded
  const [batchError, setBatchError] = useState(null);

  // Navbar search navigates here with ?search=
  useEffect(() => {
    const q = searchParams.get("search");
    if (q !== null) setSearchTerm(q);
  }, [searchParams]);

  /* ── data fetching ── */
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    setStockError(null);
    const [prodRes, stockRes] = await Promise.allSettled([
      productsAPI.getAll(),
      inventoryAPI.getStockSummary(),
    ]);
    if (prodRes.status === "fulfilled") {
      setProducts(Array.isArray(prodRes.value.data) ? prodRes.value.data : []);
    } else {
      setApiError(handleApiError(prodRes.reason).message);
    }
    if (stockRes.status === "fulfilled") {
      const map = {};
      (stockRes.value.data || []).forEach((s) => { map[s.productId] = s; });
      setStockById(map);
    } else {
      setStockById({});
      setStockError(`Stock levels unavailable: ${handleApiError(stockRes.reason).message}`);
    }
    setBatches(null); // batch list is re-read the next time a detail view opens
    setLoading(false);
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // The "Add Medicine" route opens the add form straight away.
  useEffect(() => {
    if (location.pathname.startsWith("/add-medicine")) {
      setEditingProduct(null);
      setFormData(EMPTY_FORM);
      setFormError(null);
      setErrorField(null);
      setShowForm(true);
    }
  }, [location.pathname]);

  const stockOf = useCallback((p) => stockById[p.productId] || null, [stockById]);

  /* ── derived stats (from stock summary) ── */
  const stats = useMemo(() => {
    const summaries = Object.values(stockById);
    return {
      total: products.length,
      inStock: summaries.filter((s) => s.status === "in_stock").length,
      lowStock: summaries.filter((s) => s.status === "low_stock").length,
      outOfStock: summaries.filter((s) => s.status === "out_of_stock").length,
    };
  }, [products, stockById]);

  const hasStock = Object.keys(stockById).length > 0;
  const chipCount = { "": stats.total, in_stock: stats.inStock, low_stock: stats.lowStock, out_of_stock: stats.outOfStock };

  /* ── filter lists ── */
  const companyOptions = useMemo(() =>
    [{ value: "", label: "All Companies" },
      ...[...new Set(products.map((p) => p.company).filter(Boolean))].sort().map((c) => ({ value: c, label: c }))],
    [products]
  );

  /* ── filtered rows ── */
  const rows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return products.filter((p) => {
      const matchSearch = !q ||
        (p.name || "").toLowerCase().includes(q) ||
        (p.genericName || "").toLowerCase().includes(q) ||
        (p.company || "").toLowerCase().includes(q) ||
        (p.hsnCode || "").toLowerCase().includes(q) ||
        (p.barcode || "").toLowerCase().includes(q);
      const matchCompany = !filterCompany || p.company === filterCompany;
      const matchSched = !filterSchedule || p.scheduleDrugType === filterSchedule;
      const matchStock = !filterStock || stockOf(p)?.status === filterStock;
      return matchSearch && matchCompany && matchSched && matchStock;
    });
  }, [products, searchTerm, filterCompany, filterSchedule, filterStock, stockOf]);

  /* ── form helpers ── */
  const openAdd = () => {
    setEditingProduct(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setErrorField(null);
    setShowForm(true);
  };

  const openEdit = (p) => {
    setDetail(null);
    setEditingProduct(p);
    setFormData({
      ...EMPTY_FORM,
      name: p.name || "",
      genericName: p.genericName || "",
      company: p.company || "",
      hsnCode: p.hsnCode || "",
      scheduleDrugType: p.scheduleDrugType || "",
      dosageForm: p.dosageForm || "",
      unitType: p.unitType || "",
      stripSize: p.stripSize != null ? String(p.stripSize) : "",
      price: p.price != null ? String(p.price) : "",
      gstRate: p.gstRate != null ? String(Number(p.gstRate)) : "12",
      reorderLevel: p.reorderLevel != null ? String(p.reorderLevel) : "",
      targetStockLevel: p.targetStockLevel != null ? String(p.targetStockLevel) : "",
      barcode: p.barcode || "",
      composition: p.composition || "",
    });
    setFormError(null);
    setErrorField(null);
    setShowForm(true);
  };

  // Stable callback: the Modal re-focuses its panel whenever onClose changes
  const closeForm = useCallback(() => {
    setShowForm(false);
    setEditingProduct(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setErrorField(null);
  }, []);

  const closeDetail = useCallback(() => setDetail(null), []);

  const setF = (key, val) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
    if (errorField === key) setErrorField(null);
  };

  const openingQty = parseInt(formData.openingQuantity, 10) || 0;

  // Returns [message, field] for the first problem, or null
  const validate = () => {
    if (!formData.name.trim()) return ["Medicine name is required.", "name"];
    if (!formData.hsnCode.trim()) return ["HSN code is required.", "hsnCode"];
    if (!(parseInt(formData.stripSize, 10) > 0)) return ["Units per pack must be greater than 0.", "stripSize"];
    const price = parseFloat(formData.price);
    if (!(price > 0)) return ["Selling price must be greater than 0.", "price"];
    if (formData.reorderLevel !== "" && !(parseInt(formData.reorderLevel, 10) >= 0)) return ["Reorder level cannot be negative.", "reorderLevel"];
    if (formData.targetStockLevel !== "" && !(parseInt(formData.targetStockLevel, 10) >= 0)) return ["Target stock level cannot be negative.", "targetStockLevel"];
    const dupName = formData.name.trim().toLowerCase();
    if (products.some((p) => (p.name || "").trim().toLowerCase() === dupName && p.productId !== editingProduct?.productId)) {
      return [`A medicine named '${formData.name.trim()}' already exists.`, "name"];
    }
    if (!editingProduct && formData.openingQuantity !== "") {
      if (openingQty < 0) return ["Opening stock cannot be negative.", "openingQuantity"];
      if (openingQty > 0) {
        if (!formData.expiryDate) return ["Expiry date is required for opening stock.", "expiryDate"];
        if (formData.expiryDate <= todayLocalISO()) return ["Expiry date must be in the future.", "expiryDate"];
        if (formData.mfgDate && formData.mfgDate > todayLocalISO()) return ["Manufacturing date cannot be in the future.", "mfgDate"];
        if (formData.mfgDate && formData.expiryDate <= formData.mfgDate) return ["Expiry date must be after the manufacturing date.", "expiryDate"];
        if (!(parseFloat(formData.costPrice) > 0)) return ["Cost price per pack is required for opening stock.", "costPrice"];
        const mrp = parseFloat(formData.mrp);
        if (!(mrp > 0)) return ["MRP per pack is required for opening stock.", "mrp"];
        if (price > mrp) return ["Selling price cannot be more than MRP.", "price"];
      }
    }
    return null;
  };

  const buildPayload = () => {
    // Start from the full existing product so fields the form doesn't show
    // (volumeMl, weightGm, profitMargin, …) are not wiped by the PUT.
    const base = editingProduct
      ? {
          name: editingProduct.name,
          genericName: editingProduct.genericName,
          company: editingProduct.company,
          composition: editingProduct.composition,
          hsnCode: editingProduct.hsnCode,
          stripSize: editingProduct.stripSize,
          scheduleDrugType: editingProduct.scheduleDrugType,
          dosageForm: editingProduct.dosageForm,
          unitType: editingProduct.unitType,
          volumeMl: editingProduct.volumeMl,
          weightGm: editingProduct.weightGm,
          reorderLevel: editingProduct.reorderLevel,
          targetStockLevel: editingProduct.targetStockLevel,
          price: editingProduct.price,
          profitMargin: editingProduct.profitMargin,
          gstRate: editingProduct.gstRate,
          barcode: editingProduct.barcode,
        }
      : {};

    const payload = {
      ...base,
      name: formData.name.trim(),
      genericName: strOrNull(formData.genericName),
      company: strOrNull(formData.company),
      composition: strOrNull(formData.composition),
      hsnCode: formData.hsnCode.trim(),
      stripSize: intOrNull(formData.stripSize),
      scheduleDrugType: strOrNull(formData.scheduleDrugType),
      dosageForm: strOrNull(formData.dosageForm),
      unitType: strOrNull(formData.unitType),
      reorderLevel: intOrNull(formData.reorderLevel) ?? 0,
      targetStockLevel: intOrNull(formData.targetStockLevel),
      price: numOrNull(formData.price),
      gstRate: numOrNull(formData.gstRate) ?? 12,
      barcode: strOrNull(formData.barcode),
    };

    if (!editingProduct && openingQty > 0) {
      payload.openingQuantity = openingQty;
      payload.batchNumber = strOrNull(formData.batchNumber);
      payload.mfgDate = formData.mfgDate || null;
      payload.expiryDate = formData.expiryDate;
      payload.mrp = numOrNull(formData.mrp);
      payload.costPrice = numOrNull(formData.costPrice);
    }
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setFormError(problem[0]);
      setErrorField(problem[1]);
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      setErrorField(null);
      const payload = buildPayload();
      if (editingProduct) {
        await productsAPI.update(editingProduct.productId, payload);
        showSuccess("Medicine updated successfully.");
      } else {
        await productsAPI.create(payload);
        showSuccess(openingQty > 0 ? "Medicine added with opening stock." : "Medicine added successfully.");
      }
      closeForm();
      await loadProducts();
    } catch (err) {
      setFormError(handleApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.\n\nMedicines that have stock batches or sales cannot be deleted.`)) return;
    try {
      setApiError(null);
      await productsAPI.delete(p.productId);
      setProducts((prev) => prev.filter((x) => x.productId !== p.productId));
      showSuccess(`"${p.name}" deleted.`);
    } catch (err) {
      setApiError(handleApiError(err).message);
    }
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 5000);
  };

  const handleExport = () => {
    const csv = [
      ["Name", "Generic", "Company", "HSN", "Schedule", "Dosage", "Unit Type", "Units/Pack", "Selling Price/Pack", "GST%", "Reorder Lvl", "Target Lvl", "Saleable Units", "Status", "Barcode", "Composition"],
      ...products.map((p) => {
        const s = stockOf(p);
        return [
          p.name, p.genericName, p.company, p.hsnCode, p.scheduleDrugType, p.dosageForm, p.unitType,
          p.stripSize, p.price, p.gstRate, p.reorderLevel, p.targetStockLevel,
          s ? s.saleableUnits : "", s ? STATUS_META[s.status]?.label || s.status : "",
          p.barcode, p.composition,
        ];
      }),
    ].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "medicine_catalog.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── detail view: batches from the stock list ── */
  const openDetail = async (p) => {
    setDetail(p);
    setBatchError(null);
    if (batches) return;
    try {
      const res = await inventoryAPI.getAllStock();
      setBatches(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setBatchError(handleApiError(err).message);
    }
  };

  const detailBatches = useMemo(
    () =>
      detail && batches
        ? batches
            .filter((b) => b.product?.productId === detail.productId)
            .sort((a, b) => String(a.expiryDate || "").localeCompare(String(b.expiryDate || "")))
        : [],
    [detail, batches]
  );

  /* ── live margin for opening stock (per pack, GST excluded) ── */
  const livePrice = parseFloat(formData.price) || 0;
  const liveCost = parseFloat(formData.costPrice) || 0;
  const liveGst = parseFloat(formData.gstRate) || 0;
  const liveTaxable = livePrice / (1 + liveGst / 100);
  const liveProfit = liveCost > 0 && livePrice > 0 ? liveTaxable - liveCost : null;
  const liveMargin = liveProfit !== null ? (liveProfit / liveCost) * 100 : null;

  /* ── stock meter: saleable units vs target (or twice the reorder level when no target is set) ── */
  const stockMeter = (r, s) => {
    const target = Number(r.targetStockLevel) || 0;
    const reorder = Number(r.reorderLevel) || 0;
    const max = target > 0 ? target : reorder > 0 ? reorder * 2 : 0;
    const tone = STATUS_META[s.status]?.tone;
    return max > 0 ? <ProgressBar value={s.saleableUnits} max={max} tone={tone} size="sm" label={`Saleable stock of ${r.name} vs target`} /> : null;
  };

  /* ── table columns ── */
  const columns = [
    {
      key: "name",
      header: "Medicine",
      accessor: (r) => r.name,
      cell: (_, r) => (
        <div className="pm-name-cell">
          <DosageChip form={r.dosageForm} size={38} />
          <div className="pm-name-text">
            <button type="button" className="pm-name pm-link" onClick={() => openDetail(r)}>{r.name}</button>
            {r.genericName && <div className="pm-generic">{r.genericName}</div>}
            <div className="pm-company">{r.company || "—"}</div>
          </div>
        </div>
      ),
    },
    {
      key: "regulatory",
      header: "Form & pack",
      accessor: (r) => r.dosageForm || "",
      cell: (_, r) => (
        <div className="pm-reg-cell">
          <div className="pm-reg-main">{r.dosageForm || "—"} · {r.stripSize} / {r.unitType || "pack"}</div>
          <div className="pm-reg-sub">
            <Badge tone={r.scheduleDrugType === "OTC" ? "green" : r.scheduleDrugType === "X" || r.scheduleDrugType === "H1" ? "red" : "amber"}>
              {r.scheduleDrugType || "—"}
            </Badge>
            <span className="pm-hsn">HSN {r.hsnCode || "—"}</span>
          </div>
        </div>
      ),
    },
    {
      key: "gst",
      header: "GST",
      accessor: (r) => Number(r.gstRate) || 0,
      cell: (_, r) => <span className="pm-gst-pill">{r.gstRate != null ? `${Number(r.gstRate)}%` : "—"}</span>,
    },
    {
      key: "pricing",
      header: "Price / pack",
      align: "right",
      accessor: (r) => Number(r.price) || 0,
      cell: (_, r) => <span className="pm-sell">{INR.format(Number(r.price) || 0)}</span>,
    },
    {
      key: "stock",
      header: "Stock",
      accessor: (r) => stockOf(r)?.saleableUnits ?? -1,
      cell: (_, r) => {
        const s = stockOf(r);
        if (!s) return <span className="pm-stock-sub">Unavailable</span>;
        const st = STATUS_META[s.status];
        return (
          <div className="pm-stock-cell">
            <div className="pm-stock-top">
              <span className="pm-stock-num"><span className="pm-stock-qty">{s.saleableUnits}</span> <small>units</small></span>
              {st ? <StatusBadge status={st.badge} size="sm" /> : <StatusBadge status={s.status} size="sm" />}
            </div>
            {stockMeter(r, s)}
            <div className="pm-stock-sub">reorder at {r.reorderLevel ?? 0}{Number(r.targetStockLevel) ? ` · target ${r.targetStockLevel}` : ""}</div>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      sortable: false,
      searchable: false,
      accessor: () => "",
      cell: (_, r) => (
        <div className="pm-actions-cell">
          <button className="pm-action-btn pm-view-btn" onClick={() => openDetail(r)} title="View batches" aria-label={`View ${r.name}`}>
            <Eye size={15} />
          </button>
          <button className="pm-action-btn pm-edit-btn" onClick={() => openEdit(r)} title="Edit Medicine" aria-label={`Edit ${r.name}`}>
            <Edit size={15} />
          </button>
          <button className="pm-action-btn pm-delete-btn" onClick={() => handleDelete(r)} title="Delete Medicine" aria-label={`Delete ${r.name}`}>
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  const editingStock = editingProduct ? stockOf(editingProduct) : null;
  const detailStock = detail ? stockOf(detail) : null;
  const fe = (key) => (errorField === key ? formError : null);
  const statCards = [
    { cls: "pm-stat-blue", tone: "ice", icon: Pill, label: "Total medicines", value: stats.total, chip: "", hint: "In the catalogue" },
    { cls: "pm-stat-green", tone: "mint", icon: PackageCheck, label: "In stock", value: hasStock ? stats.inStock : "—", chip: "in_stock", hint: "Above reorder level" },
    { cls: "pm-stat-amber", tone: "warning", icon: AlertTriangle, label: "Low stock", value: hasStock ? stats.lowStock : "—", chip: "low_stock", hint: "At or below reorder level" },
    { cls: "pm-stat-red", tone: "danger", icon: PackageX, label: "Out of stock", value: hasStock ? stats.outOfStock : "—", chip: "out_of_stock", hint: "No saleable units" },
  ];

  /* ── render ── */
  return (
    <div className="mb-page pm-page">
      {successMsg && (
        <div className="pm-success-banner" role="status">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      <PageHeader
        icon={Package2}
        eyebrow="Catalogue"
        title="Medicine Catalog & Pricing"
        subtitle="Medicine registry — pricing, GST, HSN codes, schedules & reorder levels"
        actions={
          <>
            <button className="btn" onClick={loadProducts} title="Refresh" disabled={loading}>
              <RefreshCw size={16} /> Refresh
            </button>
            <button className="btn" onClick={handleExport} disabled={products.length === 0}>
              <Download size={16} /> Export CSV
            </button>
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={16} /> Add Medicine
            </button>
          </>
        }
      />

      {/* ── stats (click to filter) ── */}
      <div className="mb-grid-stats mb-stagger pm-stats-strip">
        {statCards.map(({ cls, tone, icon: Icon, label, value, chip, hint }) => (
          <button
            key={cls}
            type="button"
            className={`mb-stat mb-stat--${tone} mb-stat--clickable pm-stat ${cls} ${filterStock === chip && chip ? "is-active" : ""}`}
            onClick={() => setFilterStock(chip)}
            disabled={chip !== "" && !hasStock}
            aria-label={`${label}: show ${chip ? label.toLowerCase() : "all medicines"}`}
          >
            <div className="mb-stat__top">
              <span className="mb-stat__label">{label}</span>
              <span className="mb-stat__icon" aria-hidden="true"><Icon size={20} /></span>
            </div>
            <div className="mb-stat__value pm-stat-val">{loading ? "…" : value}</div>
            <div className="mb-stat__hint">{hint}</div>
          </button>
        ))}
      </div>

      {/* ── filters ── */}
      <div className="card pm-filters">
        <div className="pm-search-wrap">
          <Search size={16} className="pm-search-icon" />
          <input
            type="text"
            className="pm-search-input"
            aria-label="Search medicines catalog"
            placeholder="Search by name, generic, company, HSN, barcode…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select className="pm-filter-select" aria-label="Filter by company" value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
          {companyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="pm-filter-select" aria-label="Filter by schedule" value={filterSchedule} onChange={(e) => setFilterSchedule(e.target.value)}>
          <option value="">All Schedules</option>
          {SCHEDULE_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="pm-chips" role="group" aria-label="Filter by stock level">
          {STOCK_CHIPS.map((c) => (
            <button
              key={c.value || "all"}
              type="button"
              className={`pm-chip pm-chip--${c.value || "all"} ${filterStock === c.value ? "is-on" : ""}`}
              aria-pressed={filterStock === c.value}
              data-testid={`stock-chip-${c.value || "all"}`}
              disabled={c.value !== "" && !hasStock}
              onClick={() => setFilterStock(c.value)}
            >
              {c.label}
              <span className="pm-chip-count">{loading ? "…" : hasStock || !c.value ? chipCount[c.value] : "—"}</span>
            </button>
          ))}
        </div>
      </div>

      {apiError && (
        <div className="pm-error-banner" role="alert">
          <AlertTriangle size={16} /> {apiError}
        </div>
      )}
      {stockError && (
        <div className="pm-error-banner" role="alert">
          <AlertTriangle size={16} /> {stockError}
        </div>
      )}

      {/* ── table ── */}
      {loading ? (
        <div className="card pm-loading-wrap">
          <LoadingSkeleton variant="table" rows={6} label="Loading medicine catalog…" />
        </div>
      ) : products.length === 0 && !apiError ? (
        <div className="card">
          <EmptyState icon={Pill} title="No medicines yet" message="Use “Add Medicine” to create the first one." action={<button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add first medicine</button>} />
        </div>
      ) : (
        <div className="pm-table-wrap">
          <DataTable
            title={`Medicine Catalog (${rows.length} records)`}
            subtitle="Stock is the saleable quantity across non-expired batches"
            columns={columns}
            rows={rows}
            initialPageSize={10}
            rowKey={(r) => r.productId}
            searchable={false}
          />
        </div>
      )}

      {/* ── Detail view: batches ── */}
      <Modal
        open={!!detail}
        onClose={closeDetail}
        title={detail ? detail.name : "Medicine"}
        width={820}
        footer={
          detail ? (
            <>
              <button type="button" className="btn" onClick={closeDetail}>Close</button>
              <button type="button" className="btn btn-primary" onClick={() => openEdit(detail)}><Edit size={16} /> Edit medicine</button>
            </>
          ) : null
        }
      >
        {detail ? (
          <div className="pm-detail">
            <div className="pm-detail-hero">
              <DosageChip form={detail.dosageForm} size={52} />
              <div className="pm-detail-id">
                <div className="pm-detail-generic">{detail.genericName || "—"}</div>
                <div className="pm-detail-company">{detail.company || "—"}{detail.composition ? ` · ${detail.composition}` : ""}</div>
                <div className="pm-detail-badges">
                  {detailStock && STATUS_META[detailStock.status] ? <StatusBadge status={STATUS_META[detailStock.status].badge} /> : null}
                  <Badge tone="blue">{detail.dosageForm || "—"}</Badge>
                  <Badge tone={detail.scheduleDrugType === "OTC" ? "green" : "amber"}>{detail.scheduleDrugType || "—"}</Badge>
                  {detail.barcode ? <span className="pm-detail-barcode"><Tag size={12} /> {detail.barcode}</span> : null}
                </div>
              </div>
            </div>

            <div className="pm-detail-facts">
              <div><span>Saleable units</span><b>{detailStock ? detailStock.saleableUnits : "—"}</b></div>
              <div><span>Selling / pack</span><b>{INR.format(Number(detail.price) || 0)}</b></div>
              <div><span>GST</span><b>{detail.gstRate != null ? `${Number(detail.gstRate)}%` : "—"}</b></div>
              <div><span>Pack</span><b>{detail.stripSize} / {detail.unitType || "pack"}</b></div>
              <div><span>HSN</span><b>{detail.hsnCode || "—"}</b></div>
              <div><span>Reorder / target</span><b>{detail.reorderLevel ?? 0} / {detail.targetStockLevel ?? "—"}</b></div>
            </div>
            {detailStock ? stockMeter(detail, detailStock) : null}

            <h3 className="pm-detail-title"><Layers size={16} /> Batches (FEFO order)</h3>
            {batchError ? (
              <div className="pm-error-banner"><AlertTriangle size={16} /> {batchError}</div>
            ) : !batches ? (
              <LoadingSkeleton variant="table" rows={3} label="Loading batches" />
            ) : detailBatches.length === 0 ? (
              <div className="pm-detail-empty"><Boxes size={20} aria-hidden="true" /> No batches on hand. Stock arrives through Purchases or opening stock.</div>
            ) : (
              <div className="mb-scroll-x pm-batch-wrap">
                <table className="pm-batch-table">
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Expiry</th>
                      <th className="num">Units</th>
                      <th className="num">MRP</th>
                      <th className="num">Cost</th>
                      <th className="num">Selling</th>
                      <th>Supplier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailBatches.map((b) => {
                      const ex = expiryStatus(b.expiryDate);
                      return (
                        <tr key={b.batchId}>
                          <td className="pm-batch-no">{b.batchNumber}</td>
                          <td>
                            <div className="pm-batch-exp">
                              <span>{b.expiryDate || "—"}</span>
                              {ex === "OK" ? <StatusBadge status="OK" label="Valid" size="sm" /> : ex ? <StatusBadge status={ex} size="sm" /> : null}
                            </div>
                          </td>
                          <td className="num">
                            {b.totalUnits}
                            <div className="pm-batch-sub">{b.stripStock} pack(s){b.tabletStock ? ` + ${b.tabletStock}` : ""}</div>
                          </td>
                          <td className="num">{INR.format(Number(b.mrp) || 0)}</td>
                          <td className="num">{INR.format(Number(b.costPrice) || 0)}</td>
                          <td className="num">{INR.format(Number(b.sellingPrice) || 0)}</td>
                          <td>{b.supplierName || <span className="pm-batch-sub">Opening stock</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* ── Add / Edit Modal ── */}
      <Modal
        open={showForm}
        onClose={closeForm}
        title={editingProduct ? "Edit Medicine" : "Add New Medicine"}
        width={800}
        footer={
          <>
            <button type="button" className="btn" onClick={closeForm} disabled={saving}>Cancel</button>
            <button type="submit" form="pm-medicine-form" className="btn btn-primary" disabled={saving}>
              <Save size={16} /> {saving ? "Saving…" : editingProduct ? "Update Medicine" : "Add Medicine"}
            </button>
          </>
        }
      >
        <form id="pm-medicine-form" className="pm-form" onSubmit={handleSubmit} noValidate>
          {formError && (
            <div className="pm-form-error" role="alert"><AlertTriangle size={14} /> {formError}</div>
          )}

          {/* Section 1 — Basic */}
          <section className="pm-form-section">
            <h3><span className="pm-sec-icon"><Pill size={15} /></span> Basic information</h3>
            <div className="pm-form-grid">
              <FormField label="Medicine Name" required error={fe("name")}>
                <TextInput aria-label="Medicine Name" aria-invalid={errorField === "name"} value={formData.name} onChange={(e) => setF("name", e.target.value)} placeholder="e.g., Paracetamol 500mg" required />
              </FormField>
              <FormField label="Generic Name">
                <TextInput aria-label="Generic Name" value={formData.genericName} onChange={(e) => setF("genericName", e.target.value)} placeholder="e.g., Paracetamol" />
              </FormField>
              <FormField label="Company / Manufacturer">
                <TextInput aria-label="Company / Manufacturer" value={formData.company} onChange={(e) => setF("company", e.target.value)} placeholder="e.g., Cipla Ltd" />
              </FormField>
              <FormField label="Barcode">
                <TextInput aria-label="Barcode" value={formData.barcode} onChange={(e) => setF("barcode", e.target.value)} placeholder="Scan or enter barcode" />
              </FormField>
              <div className="pm-full-width">
                <FormField label="Composition">
                  <TextInput aria-label="Composition" value={formData.composition} onChange={(e) => setF("composition", e.target.value)} placeholder="Active ingredients / composition" />
                </FormField>
              </div>
            </div>
          </section>

          {/* Section 2 — Regulatory */}
          <section className="pm-form-section">
            <h3><span className="pm-sec-icon pm-sec-icon--info"><Tag size={15} /></span> Regulatory &amp; packaging</h3>
            <div className="pm-form-grid">
              <FormField label="HSN Code" required error={fe("hsnCode")}>
                <TextInput aria-label="HSN Code" aria-invalid={errorField === "hsnCode"} value={formData.hsnCode} onChange={(e) => setF("hsnCode", e.target.value)} placeholder="e.g., 30049099" />
              </FormField>
              <FormField label="Schedule Drug Type">
                <Select aria-label="Schedule Drug Type"
                  value={formData.scheduleDrugType}
                  onChange={(e) => setF("scheduleDrugType", e.target.value)}
                  options={SCHEDULE_TYPES.some((o) => o.value === formData.scheduleDrugType) || !formData.scheduleDrugType
                    ? SCHEDULE_TYPES
                    : [...SCHEDULE_TYPES, { value: formData.scheduleDrugType, label: formData.scheduleDrugType }]}
                />
              </FormField>
              <FormField label="Dosage Form">
                <Select aria-label="Dosage Form" value={formData.dosageForm} onChange={(e) => setF("dosageForm", e.target.value)} options={withCurrent(DOSAGE_FORMS, formData.dosageForm)} />
              </FormField>
              <FormField label="Pack Type">
                <Select aria-label="Pack Type" value={formData.unitType} onChange={(e) => setF("unitType", e.target.value)} options={withCurrent(UNIT_TYPES, formData.unitType)} />
              </FormField>
              <FormField label="Units per Pack" hint="tablets per strip; 1 for a bottle" required error={fe("stripSize")}>
                <TextInput aria-label="Units per Pack" aria-invalid={errorField === "stripSize"} type="number" min="1" value={formData.stripSize} onChange={(e) => setF("stripSize", e.target.value)} placeholder="e.g., 10" />
              </FormField>
            </div>
          </section>

          {/* Section 3 — Pricing */}
          <section className="pm-form-section">
            <h3><span className="pm-sec-icon pm-sec-icon--purple"><IndianRupee size={15} /></span> Pricing &amp; GST</h3>
            <div className="pm-form-grid">
              <FormField label="Selling Price per Pack (₹)" hint="GST incl., ≤ MRP" required error={fe("price")}>
                <TextInput aria-label="Selling Price per Pack" aria-invalid={errorField === "price"} type="number" step="0.01" min="0" value={formData.price} onChange={(e) => setF("price", e.target.value)} placeholder="0.00" />
              </FormField>
              <FormField label="GST Rate">
                <Select aria-label="GST Rate" value={formData.gstRate} onChange={(e) => setF("gstRate", e.target.value)} options={GST_RATES.some((o) => o.value === formData.gstRate) ? GST_RATES : [...GST_RATES, { value: formData.gstRate, label: `${formData.gstRate}%` }]} />
              </FormField>
            </div>
            {livePrice > 0 ? (
              <p className="pm-form-note"><Info size={13} /> Taxable value per pack {INR.format(liveTaxable)} + GST {INR.format(livePrice - liveTaxable)} (CGST/SGST split equally).</p>
            ) : null}
            {editingProduct && (
              <p className="pm-form-note">MRP and cost price are recorded per batch when stock is purchased.</p>
            )}
          </section>

          {/* Section 4 — Stock levels */}
          <section className="pm-form-section">
            <h3><span className="pm-sec-icon pm-sec-icon--warning"><BarChart3 size={15} /></span> Stock alerts</h3>
            <div className="pm-form-grid">
              <FormField label="Reorder Level (units)" error={fe("reorderLevel")}>
                <TextInput aria-label="Reorder Level (units)" type="number" min="0" value={formData.reorderLevel} onChange={(e) => setF("reorderLevel", e.target.value)} placeholder="e.g., 10" />
              </FormField>
              <FormField label="Target Stock Level (units)" error={fe("targetStockLevel")}>
                <TextInput aria-label="Target Stock Level (units)" type="number" min="0" value={formData.targetStockLevel} onChange={(e) => setF("targetStockLevel", e.target.value)} placeholder="e.g., 100" />
              </FormField>
              {editingProduct && (
                <div className="pm-full-width">
                  <div className="pm-readonly-stock">
                    <Boxes size={16} />
                    <span>
                      Current stock:{" "}
                      <strong>{editingStock ? `${editingStock.saleableUnits} saleable units` : "unavailable"}</strong>
                    </span>
                    {editingStock && STATUS_META[editingStock.status] && (
                      <StatusBadge status={STATUS_META[editingStock.status].badge} size="sm" />
                    )}
                  </div>
                  <p className="pm-form-note">Stock changes only through Purchases, Billing and returns.</p>
                </div>
              )}
            </div>
          </section>

          {/* Section 5 — Opening stock (create only) */}
          {!editingProduct && (
            <section className="pm-form-section">
              <h3><span className="pm-sec-icon pm-sec-icon--success"><Boxes size={15} /></span> Opening stock (optional)</h3>
              <p className="pm-form-note">Stock you already have on the shelf. It is saved as a batch without a supplier. Leave quantity empty to skip.</p>
              <div className="pm-form-grid">
                <FormField label="Opening Quantity (units)" error={fe("openingQuantity")}>
                  <TextInput aria-label="Opening Quantity (units)" type="number" min="0" value={formData.openingQuantity} onChange={(e) => setF("openingQuantity", e.target.value)} placeholder="0" />
                </FormField>
                <FormField label="Batch Number" hint="auto if blank">
                  <TextInput aria-label="Batch Number" value={formData.batchNumber} onChange={(e) => setF("batchNumber", e.target.value)} placeholder="e.g., B2401" disabled={openingQty <= 0} />
                </FormField>
                <FormField label="Mfg Date" error={fe("mfgDate")}>
                  <TextInput aria-label="Mfg Date" type="date" max={todayLocalISO()} value={formData.mfgDate} onChange={(e) => setF("mfgDate", e.target.value)} disabled={openingQty <= 0} />
                </FormField>
                <FormField label="Expiry Date" required={openingQty > 0} error={fe("expiryDate")}>
                  <TextInput aria-label="Expiry Date" aria-invalid={errorField === "expiryDate"} type="date" value={formData.expiryDate} onChange={(e) => setF("expiryDate", e.target.value)} disabled={openingQty <= 0} />
                </FormField>
                <FormField label="MRP per Pack (₹)" required={openingQty > 0} error={fe("mrp")}>
                  <TextInput aria-label="MRP per Pack" aria-invalid={errorField === "mrp"} type="number" step="0.01" min="0" value={formData.mrp} onChange={(e) => setF("mrp", e.target.value)} placeholder="0.00" disabled={openingQty <= 0} />
                </FormField>
                <FormField label="Cost Price per Pack (₹)" required={openingQty > 0} error={fe("costPrice")}>
                  <TextInput aria-label="Cost Price per Pack" aria-invalid={errorField === "costPrice"} type="number" step="0.01" min="0" value={formData.costPrice} onChange={(e) => setF("costPrice", e.target.value)} placeholder="0.00" disabled={openingQty <= 0} />
                </FormField>
              </div>

              {openingQty > 0 && liveMargin !== null && (
                <div className="pm-profit-calc">
                  <Calculator size={16} />
                  <span className="pm-calc-label">Estimated margin (excl. GST):</span>
                  <span className={`pm-calc-margin ${liveMargin > 20 ? "high" : liveMargin > 10 ? "mid" : liveMargin > 0 ? "low" : "zero"}`}>
                    {liveMargin.toFixed(1)}%
                  </span>
                  <span className="pm-calc-sep">•</span>
                  <span className="pm-calc-profit">{INR.format(liveProfit)} per pack</span>
                </div>
              )}
            </section>
          )}
        </form>
      </Modal>
    </div>
  );
}
