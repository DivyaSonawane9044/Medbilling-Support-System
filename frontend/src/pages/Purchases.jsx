import React, { useMemo, useState, useEffect } from "react";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import FormField from "../components/ui/FormField";
import TextInput from "../components/ui/TextInput";
import Select from "../components/ui/Select";
import "./Purchases.css";
import { ClipboardList, PackageCheck } from "lucide-react";
import { suppliersAPI, purchasesAPI, productsAPI, handleApiError } from "../services/api";

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [productId, setProductId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [stripQty, setStripQty] = useState(10);
  const [mrp, setMrp] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [mfgDate, setMfgDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [poAmount, setPoAmount] = useState(0);

  const loadData = async () => {
    const [suppliersRes, purchasesRes, productsRes] = await Promise.all([
      suppliersAPI.getAll(),
      purchasesAPI.getAll(),
      productsAPI.getAll(),
    ]);
    setSuppliers(suppliersRes.data);
    setPurchases(purchasesRes.data);
    setProducts(productsRes.data);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadData();
      } catch (err) {
        setError(handleApiError(err).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: String(s.supplierId), label: s.name })),
    [suppliers]
  );

  const productOptions = useMemo(
    () => products.map((p) => ({ value: String(p.productId), label: `${p.name} (${p.company || "N/A"})` })),
    [products]
  );

  const rows = useMemo(
    () =>
      purchases.map((p) => ({
        id: p.invoiceId,
        supplier: p.supplierName || "—",
        invoiceNo: p.invoiceNumber,
        date: p.purchaseDate,
        amount: Number(p.totalAmount) || 0,
        status: p.status || "RECEIVED",
        batchCount: p.batchCount || 0,
      })),
    [purchases]
  );

  async function createPurchaseOrder(e) {
    e.preventDefault();
    if (!supplierId || !invoiceNo.trim()) return;
    try {
      setSaving(true);
      await purchasesAPI.createOrder({
        supplierId: Number(supplierId),
        invoiceNumber: invoiceNo.trim(),
        purchaseDate: new Date().toISOString().split("T")[0],
        totalAmount: Number(poAmount) || 0,
        batchItems: [],
      });
      await loadData();
      alert("Purchase order created (PENDING)");
    } catch (err) {
      alert(handleApiError(err).message);
    } finally {
      setSaving(false);
    }
  }

  async function receiveStock(e) {
    e.preventDefault();
    if (!supplierId || !invoiceNo.trim() || !productId || !batchNumber.trim()) return;
    const lineTotal = Number(costPrice) * Number(stripQty);
    const payload = {
      supplierId: Number(supplierId),
      invoiceNumber: invoiceNo.trim(),
      purchaseDate: new Date().toISOString().split("T")[0],
      totalAmount: lineTotal,
      batchItems: [
        {
          productId: Number(productId),
          batchNumber: batchNumber.trim(),
          mfgDate: mfgDate || new Date().toISOString().split("T")[0],
          expiryDate: expiryDate || new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
          mrp: Number(mrp) || Number(sellingPrice),
          costPrice: Number(costPrice),
          sellingPrice: Number(sellingPrice) || Number(mrp),
          stripQuantity: Number(stripQty),
        },
      ],
    };
    try {
      setSaving(true);
      await purchasesAPI.receiveStock(payload);
      await loadData();
      setInvoiceNo("");
      setBatchNumber("");
    } catch (err) {
      alert(handleApiError(err).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="pur">
        <div className="pur-head">
          <h2 className="pur-title">Purchases</h2>
          <p className="pur-subtitle">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pur">
        <div className="pur-head">
          <h2 className="pur-title">Purchases</h2>
          <p className="error-message">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pur">
      <div className="pur-head">
        <div>
          <h2 className="pur-title">Purchases</h2>
          <p className="pur-subtitle">Receive supplier stock into inventory batches</p>
        </div>
      </div>

      <div className="pur-grid">
        <form className="card pur-form" onSubmit={createPurchaseOrder}>
          <div className="pur-form-head">
            <h3><ClipboardList size={16} /> Create Purchase Order (Pending)</h3>
          </div>
          <div className="pur-form-body">
            <FormField label="Supplier">
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} options={supplierOptions} placeholder="Select supplier" />
            </FormField>
            <FormField label="PO / Invoice reference">
              <TextInput value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="PO number" />
            </FormField>
            <FormField label="Expected amount">
              <TextInput type="number" min="0" value={poAmount} onChange={(e) => setPoAmount(Number(e.target.value))} />
            </FormField>
            <button className="btn" type="submit" disabled={saving}>Create Pending PO</button>
          </div>
        </form>

        <form className="card pur-form" onSubmit={receiveStock}>
          <div className="pur-form-head">
            <h3>
              <ClipboardList size={16} /> Receive Stock
            </h3>
            <p>Creates purchase invoice and inventory batch</p>
          </div>
          <div className="pur-form-body">
            <FormField label="Supplier">
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} options={supplierOptions} placeholder="Select supplier" />
            </FormField>
            <FormField label="Supplier invoice number">
              <TextInput value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="INV / BILL NO" required />
            </FormField>
            <FormField label="Product">
              <Select value={productId} onChange={(e) => setProductId(e.target.value)} options={productOptions} placeholder="Select product" />
            </FormField>
            <FormField label="Batch number">
              <TextInput value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="BATCH-001" required />
            </FormField>
            <FormField label="Strip quantity">
              <TextInput type="number" min="1" value={stripQty} onChange={(e) => setStripQty(Number(e.target.value))} />
            </FormField>
            <FormField label="Cost / MRP / Selling (per strip)">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <TextInput type="number" min="0" value={costPrice} onChange={(e) => setCostPrice(Number(e.target.value))} placeholder="Cost" />
                <TextInput type="number" min="0" value={mrp} onChange={(e) => setMrp(Number(e.target.value))} placeholder="MRP" />
                <TextInput type="number" min="0" value={sellingPrice} onChange={(e) => setSellingPrice(Number(e.target.value))} placeholder="Sell" />
              </div>
            </FormField>
            <FormField label="Mfg / Expiry">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <TextInput type="date" value={mfgDate} onChange={(e) => setMfgDate(e.target.value)} />
                <TextInput type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
            </FormField>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              <PackageCheck size={16} /> {saving ? "Saving..." : "Receive Stock"}
            </button>
          </div>
        </form>

        <DataTable
          title="Purchase Invoices"
          subtitle="Received supplier invoices from backend"
          columns={[
            { key: "id", header: "ID" },
            { key: "supplier", header: "Supplier" },
            { key: "invoiceNo", header: "Invoice No" },
            { key: "date", header: "Date", searchable: false },
            { key: "amount", header: "Amount", align: "right", cell: (v) => INR.format(v), searchable: false },
            {
              key: "status",
              header: "Status",
              searchable: false,
              cell: (v) => (
                <Badge tone={v === "RECEIVED" ? "green" : "amber"}>{v}</Badge>
              ),
            },
            { key: "batchCount", header: "Batches", searchable: false },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          initialPageSize={10}
        />
      </div>
    </div>
  );
}

export default Purchases;
