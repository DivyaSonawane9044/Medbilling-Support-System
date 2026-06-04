import React, { useState, useMemo, useEffect } from "react";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import FormField from "../components/ui/FormField";
import TextInput from "../components/ui/TextInput";
import Select from "../components/ui/Select";
import "./Medicines.css";
import { 
  Pill, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Upload,
  Edit,
  Trash2,
  AlertTriangle,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { medicinesAPI, handleApiError } from "../services/api";

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

function Medicines() {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newMedicine, setNewMedicine] = useState({
    name: "",
    price: "",
    quantity: "",
    expiryDate: "",
    company: "",
  });
  const [formError, setFormError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");

  // Fetch medicines from API with debounce when searchTerm changes
  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);
        const q = (searchTerm || "").trim();
        const response = q ? await medicinesAPI.search(q) : await medicinesAPI.getAll("");
        if (cancelled) return;
        // API returns either array or { content: [...] } depending on backend; handle common shapes
        const data = response.data?.content ?? response.data ?? [];
        setMedicines(data || []);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(handleApiError(err).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [searchTerm]);
  const [filterCompany, setFilterCompany] = useState("");
  const [filterSchedule, setFilterSchedule] = useState("");
  const [filterStock, setFilterStock] = useState("");

  // Calculate profit margin
  const calculateProfitMargin = (costPrice, sellingPrice) => {
    if (!costPrice || !sellingPrice) return 0;
    return ((sellingPrice - costPrice) / costPrice * 100).toFixed(2);
  };

  // Get stock status
  const getStockStatus = (currentStock, reorderLevel) => {
    if (currentStock === 0) return { status: "Out of Stock", color: "red" };
    if (currentStock <= reorderLevel) return { status: "Low Stock", color: "orange" };
    return { status: "In Stock", color: "green" };
  };

  // Check if near expiry
  const isNearExpiry = (expiryDate) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 90;
  };

  // Filter medicines
  const filteredMedicines = useMemo(() => {
    return medicines.filter(medicine => {
      const matchesCompany = !filterCompany || medicine.company === filterCompany;
      const matchesSchedule = !filterSchedule || medicine.scheduleDrugType === filterSchedule;
      let matchesStock = true;
      return matchesCompany && matchesSchedule && matchesStock;
    });
  }, [medicines, filterCompany, filterSchedule, filterStock]);

  // Get unique companies for filter
  const companies = useMemo(() => {
    const uniqueCompanies = [...new Set(medicines.map(m => m.company).filter(Boolean))];
    return uniqueCompanies.map(company => ({ value: company, label: company }));
  }, [medicines]);

  // Get schedule types for filter
  const scheduleTypes = useMemo(() => {
    const uniqueTypes = [...new Set(medicines.map(m => m.scheduleDrugType).filter(Boolean))];
    return uniqueTypes.map(type => ({ value: type, label: type }));
  }, [medicines]);

  // Table columns
  const columns = [
    {
      key: "name",
      header: "Medicine Details",
      cell: (value, row) => (
        <div className="medicine-name-cell">
          <div className="medicine-name">{row.name}</div>
          <div className="medicine-generic">Generic: {row.genericName || 'N/A'}</div>
          <div className="medicine-company">{row.company || 'N/A'}</div>
          <div className="medicine-batch">Strip Size: {row.stripSize} tablets</div>
        </div>
      )
    },
    {
      key: "quantity",
      header: "Quantity",
      align: "right",
      cell: (value, row) => row.quantity ?? 0,
    },
    {
      key: "expiryDate",
      header: "Expiry",
      align: "right",
      cell: (value, row) => row.expiryDate ? new Date(row.expiryDate).toLocaleDateString('en-IN') : 'N/A',
    },
    {
      key: "regulatory",
      header: "Regulatory Info",
      cell: (value, row) => (
        <div className="regulatory-cell">
          <div className="regulatory-row">
            <span className="label">HSN:</span>
            <span className="value">{row.hsnCode}</span>
          </div>
          <div className="regulatory-row">
            <span className="label">Schedule:</span>
            <Badge type={row.scheduleDrugType === "OTC" ? "success" : "warning"}>
              {row.scheduleDrugType || 'N/A'}
            </Badge>
          </div>
          <div className="regulatory-row">
            <span className="label">GST:</span>
            <span className="value">{row.profitMargin ? `${(row.profitMargin * 100).toFixed(2)}%` : 'N/A'}</span>
          </div>
        </div>
      )
    },
    {
      key: "pricing",
      header: "Pricing",
      cell: (value, row) => (
        <div className="pricing-cell">
          <div className="price-row">
            <span className="label">Margin:</span>
            <span className={`value margin ${row.profitMargin > 0.2 ? "high" : row.profitMargin > 0.1 ? "medium" : "low"}`}>
              {row.profitMargin ? `${(row.profitMargin * 100).toFixed(2)}%` : 'N/A'}
            </span>
          </div>
          <div className="price-row">
            <span className="label">Barcode:</span>
            <span className="value">{row.barcode || 'N/A'}</span>
          </div>
          <div className="price-row">
            <span className="label">Dosage:</span>
            <span className="value">{row.dosageForm || 'N/A'}</span>
          </div>
          <div className="price-row">
            <span className="label">Reorder:</span>
            <span className="value">{row.reorderLevel || 'N/A'}</span>
          </div>
        </div>
      )
    },
    {
      key: "stock",
      header: "Stock Status",
      cell: (value, row) => {
        // Stock status would need to be calculated from inventory API
        const stockStatus = { status: "In Stock", color: "green" }; // Placeholder
        return (
          <div className="stock-cell">
            <div className="stock-row">
              <span className="label">Target:</span>
              <span className="value current">{row.targetStockLevel || 'N/A'}</span>
            </div>
            <div className="stock-row">
              <span className="label">Reorder:</span>
              <span className="value reorder">{row.reorderLevel || 'N/A'}</span>
            </div>
            <div className="stock-row">
              <span className="label">Strip:</span>
              <span className="value">{row.stripSize} tabs</span>
            </div>
            <Badge type={stockStatus.color}>
              {stockStatus.status}
            </Badge>
          </div>
        );
      }
    },
    {
      key: "dates",
      header: "Additional Info",
      cell: (value, row) => (
        <div className="dates-cell">
          <div className="date-row">
            <span className="label">Volume:</span>
            <span className="value">{row.volumeMl ? `${row.volumeMl}ml` : 'N/A'}</span>
          </div>
          <div className="date-row">
            <span className="label">Weight:</span>
            <span className="value">{row.weightGm ? `${row.weightGm}g` : 'N/A'}</span>
          </div>
          <div className="storage-info">
            <span className="label">Composition:</span>
            <span className="value">{row.composition || 'N/A'}</span>
          </div>
        </div>
      )
    },
    {
      key: "actions",
      header: "Actions",
      cell: (value, row) => (
        <div className="actions-cell">
          <button className="action-btn edit-btn" title="Edit Medicine">
            <Edit size={16} />
          </button>
          <button className="action-btn delete-btn" title="Delete Medicine">
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ];

  const handleExport = () => {
    const dataStr = JSON.stringify(medicines, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'medicines.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  if (loading) {
    return (
      <div className="medicines-container">
        <div className="medicines-header">
          <div className="header-content">
            <div className="header-title">
              <Pill className="title-icon" size={32} />
              <div>
                <h1>Medicines Inventory</h1>
                <p>Loading medicines...</p>
              </div>
            </div>
          </div>
        </div>
        <div className="loading-spinner">Loading medicines...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="medicines-container">
        <div className="medicines-header">
          <div className="header-content">
            <div className="header-title">
              <Pill className="title-icon" size={32} />
              <div>
                <h1>Medicines Inventory</h1>
                <p>Error loading data</p>
              </div>
            </div>
          </div>
        </div>
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="medicines-container">
      <div className="medicines-header">
        <div className="header-content">
          <div className="header-title">
            <Pill className="title-icon" size={32} />
            <div>
              <h1>Medicines Inventory</h1>
              <p>Manage your complete medicine database with pricing and stock information</p>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn btn-export" onClick={handleExport}>
              <Download size={16} />
              Export
            </button>
            <button className="btn btn-import">
              <Upload size={16} />
              Import
            </button>
          </div>
        </div>
      </div>

      <div className="medicine-form card">
        <h3>Add Medicine</h3>
        <div className="form-row">
          <FormField label="Name" required>
            <TextInput
              value={newMedicine.name}
              onChange={(e) => setNewMedicine({ ...newMedicine, name: e.target.value })}
              placeholder="Medicine name"
            />
          </FormField>
          <FormField label="Company">
            <TextInput
              value={newMedicine.company}
              onChange={(e) => setNewMedicine({ ...newMedicine, company: e.target.value })}
              placeholder="Manufacturer"
            />
          </FormField>
        </div>
        <div className="form-row">
          <FormField label="Price" required>
            <TextInput
              type="number"
              min="0"
              step="0.01"
              value={newMedicine.price}
              onChange={(e) => setNewMedicine({ ...newMedicine, price: e.target.value })}
              placeholder="Unit price"
            />
          </FormField>
          <FormField label="Quantity" required>
            <TextInput
              type="number"
              min="0"
              value={newMedicine.quantity}
              onChange={(e) => setNewMedicine({ ...newMedicine, quantity: e.target.value })}
              placeholder="Stock quantity"
            />
          </FormField>
          <FormField label="Expiry Date">
            <TextInput
              type="date"
              value={newMedicine.expiryDate}
              onChange={(e) => setNewMedicine({ ...newMedicine, expiryDate: e.target.value })}
            />
          </FormField>
        </div>
        {formError && <div className="error-message">{formError}</div>}
        <button
          className="btn btn-primary"
          onClick={async () => {
            if (!newMedicine.name.trim()) {
              setFormError('Medicine name is required.');
              return;
            }
            if (!newMedicine.price || Number(newMedicine.price) <= 0) {
              setFormError('Valid price is required.');
              return;
            }

            try {
              setLoading(true);
              setFormError(null);
              const response = await medicinesAPI.create({
                name: newMedicine.name,
                company: newMedicine.company || null,
                price: Number(newMedicine.price),
                quantity: Number(newMedicine.quantity) || 0,
                expiryDate: newMedicine.expiryDate || null,
                hsnCode: '30049099',
                stripSize: 10,
                reorderLevel: 10,
                targetStockLevel: 100,
                scheduleDrugType: 'OTC',
                profitMargin: 0.20,
                genericName: null,
              });
              setMedicines((prev) => [response.data, ...prev]);
              setNewMedicine({ name: "", price: "", quantity: "", expiryDate: "", company: "" });
            } catch (err) {
              setFormError(handleApiError(err).message);
            } finally {
              setLoading(false);
            }
          }}
        >
          Add Medicine
        </button>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search medicines..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="filter-group">
          <Select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            placeholder="Filter by Company"
            options={[{ value: "", label: "All Companies" }, ...companies]}
          />
        </div>
        <div className="filter-group">
          <Select
            value={filterSchedule}
            onChange={(e) => setFilterSchedule(e.target.value)}
            placeholder="Filter by Schedule"
            options={[{ value: "", label: "All Schedules" }, ...scheduleTypes]}
          />
        </div>
        <div className="filter-group">
          <Select
            value={filterStock}
            onChange={(e) => setFilterStock(e.target.value)}
            placeholder="Filter by Stock"
            options={[
              { value: "", label: "All Stock Levels" },
              { value: "in-stock", label: "In Stock" },
              { value: "low-stock", label: "Low Stock" },
              { value: "out-of-stock", label: "Out of Stock" }
            ]}
          />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-cards">
        <div className="stat-card total">
          <div className="stat-icon">
            <Pill size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{medicines.length}</div>
            <div className="stat-label">Total Medicines</div>
          </div>
        </div>
        <div className="stat-card in-stock">
          <div className="stat-icon">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{medicines.filter(m => m.currentStock > m.reorderLevel).length}</div>
            <div className="stat-label">In Stock</div>
          </div>
        </div>
        <div className="stat-card low-stock">
          <div className="stat-icon">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{medicines.filter(m => m.currentStock > 0 && m.currentStock <= m.reorderLevel).length}</div>
            <div className="stat-label">Low Stock</div>
          </div>
        </div>
        <div className="stat-card out-of-stock">
          <div className="stat-icon">
            <TrendingDown size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{medicines.filter(m => m.currentStock === 0).length}</div>
            <div className="stat-label">Out of Stock</div>
          </div>
        </div>
      </div>

      {/* Medicines Table */}
      <div className="medicines-table-section">
        <DataTable
          columns={columns}
          rows={filteredMedicines}
          className="medicines-table"
        />
      </div>
    </div>
  );
}

export default Medicines;
