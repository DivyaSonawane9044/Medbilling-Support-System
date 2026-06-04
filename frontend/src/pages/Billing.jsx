import React, { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import "./Billing.css";
import FormField from "../components/ui/FormField";
import TextInput from "../components/ui/TextInput";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import { FileText, Printer, Send, Trash2 } from "lucide-react";
import { productsAPI, salesAPI, customersAPI, handleApiError } from "../services/api";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export default function Billing() {
  const medicineSearchRef = useRef(null);
  const [customerName, setCustomerName] = useState("Jane Doe");
  const [doctorName, setDoctorName] = useState("Dr. A. Sharma");
  const [contactNumber, setContactNumber] = useState("+91 98765 43210");
  const [prescriptionFile, setPrescriptionFile] = useState(null);
  const [prescriptionImageUrl, setPrescriptionImageUrl] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [medicineQuery, setMedicineQuery] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [lastInvoiceId, setLastInvoiceId] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [printData, setPrintData] = useState(null);
  const [autoPrintOnAdd, setAutoPrintOnAdd] = useState(false);

  // Fetch products from API
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await productsAPI.getAll();
        setProducts(response.data);
      } catch (err) {
        setError(handleApiError(err).message);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  useEffect(() => {
    if (!companyFilter.trim()) return;
    (async () => {
      try {
        const res = await salesAPI.searchByCompany(companyFilter.trim());
        setProducts(res.data);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [companyFilter]);

  // Quick medicine name search (debounced)
  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        if (!medicineQuery.trim()) return;
        const res = await productsAPI.getAll(medicineQuery.trim());
        if (cancelled) return;
        // backend may wrap results; handle common shapes
        const data = res.data?.content ?? res.data ?? [];
        setProducts(data);
      } catch (err) {
        console.error(err);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [medicineQuery]);

  async function lookupCustomerByFirstName() {
    const first = customerName.trim().split(" ")[0];
    if (!first) return;
    try {
      const res = await customersAPI.lookupByFirstName(first);
      if (res.data?.length === 1) {
        const profile = res.data[0];
        const c = profile.customer;
        setSelectedCustomerId(c.customerId);
        setCustomerName(c.name);
        setContactNumber(c.contactNumber || "");
        setDoctorName(c.doctorName || "");
        if (c.prescriptionImageUrl) setPrescriptionImageUrl(c.prescriptionImageUrl);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function scanBarcode() {
    if (!barcodeInput.trim()) return;
    try {
      const res = await salesAPI.findByBarcode(barcodeInput.trim());
      setSelectedProductId(String(res.data.productId));
    } catch (err) {
      alert("Product not found for barcode: " + barcodeInput);
    }
  }

  const productOptions = useMemo(
    () => products.map((p) => ({ 
      value: String(p.productId), 
      label: `${p.name} • ${p.company || 'N/A'}` 
    })),
    [products]
  );

  const [selectedProductId, setSelectedProductId] = useState("");
  const selectedProduct = useMemo(() => {
    const productId = Number(selectedProductId);
    if (!productId) return null;
    return products.find((p) => p.productId === productId) || null;
  }, [products, selectedProductId]);

  const [unitMode, setUnitMode] = useState("strip"); // strip | tablet
  const [qtyStrips, setQtyStrips] = useState(1);
  const [qtyTablets, setQtyTablets] = useState(1);
  const [items, setItems] = useState([]);

  const [dose, setDose] = useState({
    morning: false,
    afternoon: false,
    evening: true,
    night: false,
    food: "after",
    durationDays: 5,
  });

  const buildPrintData = (overrideItems = items, invoiceIdOverride = null) => ({
    invoiceId: invoiceIdOverride ?? (printData?.invoiceId ?? null),
    customerName,
    contactNumber,
    doctorName,
    items: overrideItems.map((it) => ({
      name: it.name,
      qty: it.mode === 'strip' ? `${it.qtyStrips} strip(s)` : `${it.qtyTablets} tab(s)`,
      taxable: it.taxable,
      cgst: it.cgst,
      sgst: it.sgst,
      total: it.total,
      dosage: it.dose ?? dose,
    })),
    totals,
    createdAt: new Date().toLocaleString('en-IN'),
  });

  useEffect(() => {
    function onKeyDown(e) {
      const isCtrlP = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p";
      const isF1 = e.key === "F1";
      if (isCtrlP || isF1) {
        e.preventDefault();
        medicineSearchRef.current?.focus?.();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function calcLine(product, mode, strips, tablets) {
    const tabletsCount = mode === "strip" ? strips * product.stripSize : tablets;
    // Use a default selling price calculation based on profit margin
    const sellingPrice = product.profitMargin ? 10 * (1 + product.profitMargin) : 15; // Default logic
    const taxable = tabletsCount * sellingPrice;
    const gstPct = product.profitMargin ? 12 : 5; // Default GST
    const gst = (taxable * gstPct) / 100;
    const cgst = gst / 2;
    const sgst = gst / 2;
    return {
      tabletsCount,
      taxable: round2(taxable),
      cgst: round2(cgst),
      sgst: round2(sgst),
      total: round2(taxable + cgst + sgst),
      sellingPrice: round2(sellingPrice),
      gstPct
    };
  }

  function addItem() {
    if (!selectedProduct) return;
    const strips = Math.max(0, Number(qtyStrips || 0));
    const tablets = Math.max(0, Number(qtyTablets || 0));
    if (unitMode === "strip" && strips <= 0) return;
    if (unitMode === "tablet" && tablets <= 0) return;

    const computed = calcLine(selectedProduct, unitMode, strips, tablets);
    const newItem = {
      id: `${selectedProduct.productId}-${Date.now()}`,
      productId: selectedProduct.productId,
      name: selectedProduct.name,
      company: selectedProduct.company || 'N/A',
      hsn: selectedProduct.hsnCode,
      gstPct: computed.gstPct,
      stripSize: selectedProduct.stripSize,
      sellPerTablet: computed.sellingPrice,
      mode: unitMode,
      qtyStrips: unitMode === "strip" ? strips : 0,
      qtyTablets: unitMode === "tablet" ? tablets : 0,
      ...computed,
      dose: { ...dose },
    };

    setItems((prev) => {
      const newArr = [...prev, newItem];
      if (autoPrintOnAdd) {
        // Prepare printable payload immediately using the new array
        handlePrint(newArr);
        setTimeout(() => {
          exportPdf();
        }, 200);
      }
      return newArr;
    });

    setSelectedProductId("");
    setQtyStrips(1);
    setQtyTablets(1);

  }

  function removeItem(id) {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  const totals = useMemo(() => {
    const taxable = items.reduce((s, i) => s + i.taxable, 0);
    const cgst = items.reduce((s, i) => s + i.cgst, 0);
    const sgst = items.reduce((s, i) => s + i.sgst, 0);
    const grand = items.reduce((s, i) => s + i.total, 0);
    return {
      taxable: round2(taxable),
      cgst: round2(cgst),
      sgst: round2(sgst),
      grand: round2(grand),
    };
  }, [items]);

  async function createBill() {
    if (items.length === 0) return;
    
    setSaving(true);
    try {
      let rxUrl = prescriptionImageUrl;
      if (prescriptionFile) {
        rxUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(prescriptionFile);
        });
      }

      const salesData = {
        customerId: selectedCustomerId,
        customerName,
        contactNumber,
        doctorName,
        prescriptionImageUrl: rxUrl || null,
        paymentMethod,
        amountPaid: totals.grand,
        lineItems: items.map(item => ({
          productId: item.productId,
          quantitySoldTablets: item.tabletsCount,
          morning: dose.morning,
          afternoon: dose.afternoon,
          evening: dose.evening,
          night: dose.night,
          beforeFood: dose.food === "before",
          afterFood: dose.food === "after",
          durationDays: dose.durationDays
        })),
      };

      const response = await salesAPI.createBill(salesData);
      setLastInvoiceId(response.data.invoiceId);
      // Prepare printable payload including returned invoice id
      const payload = {
        invoiceId: response.data.invoiceId || response.data.id || null,
        customerName,
        contactNumber,
        doctorName,
        items: items.map((it) => ({ name: it.name, qty: it.mode === 'strip' ? it.qtyStrips + ' strip(s)' : it.qtyTablets + ' tab(s)', taxable: it.taxable, cgst: it.cgst, sgst: it.sgst, total: it.total, dosage: it.dose ?? dose })),
        totals,
        createdAt: new Date().toLocaleString('en-IN'),
      };
      setPrintData(payload);
      await new Promise((resolve) => setTimeout(resolve, 300));
      await exportPdf();

      alert(`Bill created successfully: ${payload.invoiceId || 'N/A'}`);
      setItems([]);
      setCustomerName("");
      setContactNumber("");
      setDoctorName("");
      setPrescriptionFile(null);
    } catch (err) {
      alert('Error creating bill: ' + handleApiError(err).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bill">
        <div className="bill-head">
          <div>
            <h2 className="bill-title">Sales & Billing</h2>
            <p className="bill-subtitle">Loading products...</p>
          </div>
        </div>
        <div className="loading-spinner">Loading products...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bill">
        <div className="bill-head">
          <div>
            <h2 className="bill-title">Sales & Billing</h2>
            <p className="bill-subtitle">Error loading data</p>
          </div>
        </div>
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  function handlePrint() {
    if (items.length === 0) {
      alert('No items to print. Add items first.');
      return;
    }

    const payload = buildPrintData();
    setPrintData(payload);
    return payload;
  }

  async function exportPdf() {
    if (items.length === 0) {
      alert('No items to export. Add items first.');
      return;
    }

    let payload = printData;
    if (!payload || payload.items.length === 0) {
      payload = buildPrintData();
      flushSync(() => setPrintData(payload));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    const billElement = document.getElementById('bill-container');
    if (!billElement) {
      alert('Printable bill container not ready. Add customer details and items first.');
      return;
    }

    try {
      const canvas = await html2canvas(billElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const pdfWidth = pageWidth - 20;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const maxHeight = pageHeight - 20;
      const finalHeight = Math.min(pdfHeight, maxHeight);

      pdf.addImage(imgData, 'PNG', 10, 10, pdfWidth, finalHeight);
      pdf.save(`invoice_${payload.invoiceId || 'preview'}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Failed to generate PDF: ' + (err.message || err));
    }
  }

  return (
    <div className="bill">
      <div className="bill-head">
        <div>
          <h2 className="bill-title">Sales & Billing</h2>
          <p className="bill-subtitle">
            Fast pharmacy billing • Shortcut: <Badge tone="blue">Ctrl + P</Badge> or <Badge tone="blue">F1</Badge> to
            focus medicine search
          </p>
        </div>
        <div className="bill-head-actions">
          <button className="btn" onClick={exportPdf}>
            <Printer size={16} /> Print (Download PDF)
          </button>
          <button className="btn" onClick={exportPdf}>
            <FileText size={16} /> Export PDF
          </button>
          <button
            className="btn"
            type="button"
            disabled={!lastInvoiceId}
            onClick={async () => {
              if (!lastInvoiceId) return;
              try {
                await salesAPI.notify(lastInvoiceId, "whatsapp");
                alert("Bill sent via WhatsApp (logged on server).");
              } catch (err) {
                alert(handleApiError(err).message);
              }
            }}
          >
            <Send size={16} /> WhatsApp/SMS
          </button>
          <button className="btn btn-primary" onClick={createBill} disabled={items.length === 0 || saving}>
            <FileText size={16} /> {saving ? 'Saving...' : 'Save Bill'}
          </button>
        </div>
      </div>

      <div className="bill-grid">
        <div className="card bill-left">
          <h3 className="section-title">Customer & Prescription</h3>

          <div className="form-grid">
            <FormField label="Customer name">
              <TextInput
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onBlur={lookupCustomerByFirstName}
                placeholder="Patient / Customer (first name lookup)"
              />
            </FormField>
            <FormField label="Payment method">
              <Select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                options={[
                  { value: "Cash", label: "Cash" },
                  { value: "UPI", label: "UPI (PhonePe / GPay)" },
                  { value: "Card", label: "Debit / Credit Card" },
                  { value: "Wallet", label: "Wallet" },
                  { value: "NetBanking", label: "Net Banking" },
                ]}
              />
            </FormField>
            <FormField label="Contact number">
              <TextInput value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="Phone number" />
            </FormField>
            <FormField label="Doctor name">
              <TextInput value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="Prescribing doctor" />
            </FormField>
            <FormField label="Prescription image" hint="Optional">
              <input
                className="file"
                type="file"
                accept="image/*"
                onChange={(e) => setPrescriptionFile(e.target.files?.[0] || null)}
              />
              {prescriptionFile ? <div className="file-meta">Selected: {prescriptionFile.name}</div> : null}
            </FormField>
          </div>

          <div className="dose-card">
            <div className="dose-head">
              <h3 className="section-title">Dosage Instructions</h3>
              <Badge tone="gray">Printed on bill (UI)</Badge>
            </div>
            <div className="dose-grid">
              <label className="chk">
                <input
                  type="checkbox"
                  checked={dose.morning}
                  onChange={(e) => setDose((d) => ({ ...d, morning: e.target.checked }))}
                />
                Morning
              </label>
              <label className="chk">
                <input
                  type="checkbox"
                  checked={dose.afternoon}
                  onChange={(e) => setDose((d) => ({ ...d, afternoon: e.target.checked }))}
                />
                Afternoon
              </label>
              <label className="chk">
                <input
                  type="checkbox"
                  checked={dose.evening}
                  onChange={(e) => setDose((d) => ({ ...d, evening: e.target.checked }))}
                />
                Evening
              </label>
              <label className="chk">
                <input
                  type="checkbox"
                  checked={dose.night}
                  onChange={(e) => setDose((d) => ({ ...d, night: e.target.checked }))}
                />
                Night
              </label>
            </div>
            <div className="dose-grid2">
              <FormField label="Before / After food">
                <Select
                  value={dose.food}
                  onChange={(e) => setDose((d) => ({ ...d, food: e.target.value }))}
                  options={[
                    { value: "before", label: "Before food" },
                    { value: "after", label: "After food" },
                  ]}
                />
              </FormField>
              <FormField label="Duration (days)">
                <TextInput
                  type="number"
                  min="1"
                  value={dose.durationDays}
                  onChange={(e) => setDose((d) => ({ ...d, durationDays: Number(e.target.value) }))}
                />
              </FormField>
            </div>
          </div>
        </div>

        <div className="card bill-right">
          <div className="bill-entry-head">
            <div>
              <h3 className="section-title">Add Items</h3>
              <p className="muted">Medicine search + strip/tablet billing</p>
            </div>
          </div>

          <div className="entry-grid">

            <FormField label="Company filter (quick search)">
              <TextInput
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                placeholder="Filter by company name"
              />
            </FormField>
            <FormField label="Barcode scan">
              <div style={{ display: "flex", gap: 8 }}>
                <TextInput value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} placeholder="Scan barcode" />
                <button type="button" className="btn" onClick={scanBarcode}>Find</button>
              </div>
            </FormField>
            <FormField label="Medicine search">
              <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                <input
                  ref={medicineSearchRef}
                  className="txt"
                  placeholder="Type medicine name to search..."
                  value={medicineQuery}
                  onChange={(e) => setMedicineQuery(e.target.value)}
                />
                <select
                  className="sel"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                >
                  <option value="" disabled>
                    Select medicine from results...
                  </option>
                  {productOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </FormField>

            <div className="mode-row">
              <button
                className={`mode-btn ${unitMode === "strip" ? "active" : ""}`}
                type="button"
                onClick={() => setUnitMode("strip")}
              >
                Strip
              </button>
              <button
                className={`mode-btn ${unitMode === "tablet" ? "active" : ""}`}
                type="button"
                onClick={() => setUnitMode("tablet")}
              >
                Tablet
              </button>
              {selectedProduct ? (
                <div className="mode-meta">
                  <Badge tone="blue">Strip size: {selectedProduct.stripSize}</Badge>
                  <Badge tone="green">GST: {selectedProduct.gstPct}%</Badge>
                </div>
              ) : null}
            </div>

            <div className="qty-row">
              {unitMode === "strip" ? (
                <FormField label="Strips quantity">
                  <TextInput
                    type="number"
                    min="1"
                    value={qtyStrips}
                    onChange={(e) => setQtyStrips(Number(e.target.value))}
                  />
                </FormField>
              ) : (
                <FormField label="Tablets quantity">
                  <TextInput
                    type="number"
                    min="1"
                    value={qtyTablets}
                    onChange={(e) => setQtyTablets(Number(e.target.value))}
                  />
                </FormField>
              )}

              <div className="price-preview">
                <div className="muted">Auto price</div>
                <div className="price-value">
                  {selectedProduct
                    ? INR.format(
                        calcLine(
                          selectedProduct,
                          unitMode,
                          Number(qtyStrips || 0),
                          Number(qtyTablets || 0)
                        ).total
                      )
                    : "—"}
                </div>
              </div>
            </div>

            <button className="btn btn-primary add-btn" type="button" onClick={addItem} disabled={!selectedProduct}>
              Add Item
            </button>
            <label className="chk" style={{ marginLeft: 12 }}>
              <input type="checkbox" checked={autoPrintOnAdd} onChange={(e) => setAutoPrintOnAdd(e.target.checked)} />
              Auto print on add
            </label>
          </div>

          <div className="items-wrap">
            <table className="items-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Unit</th>
                  <th className="num">Qty</th>
                  <th className="num">Taxable</th>
                  <th className="num">CGST</th>
                  <th className="num">SGST</th>
                  <th className="num">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty">
                      Add medicines to start billing.
                    </td>
                  </tr>
                ) : (
                  items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <div className="it-name">{i.name}</div>
                        <div className="it-sub">
                          {i.company} • HSN {i.hsn} • GST {i.gstPct}%
                        </div>
                      </td>
                      <td>{i.mode === "strip" ? "Strip" : "Tablet"}</td>
                      <td className="num">
                        {i.mode === "strip" ? `${i.qtyStrips} strips` : `${i.qtyTablets} tabs`}
                      </td>
                      <td className="num">{INR.format(i.taxable)}</td>
                      <td className="num">{INR.format(i.cgst)}</td>
                      <td className="num">{INR.format(i.sgst)}</td>
                      <td className="num strong">{INR.format(i.total)}</td>
                      <td className="num">
                        <button className="icon-btn" onClick={() => removeItem(i.id)} aria-label="Remove item">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="summary">
            <div className="sum-row">
              <span>Taxable</span>
              <b>{INR.format(totals.taxable)}</b>
            </div>
            <div className="sum-row">
              <span>CGST</span>
              <b>{INR.format(totals.cgst)}</b>
            </div>
            <div className="sum-row">
              <span>SGST</span>
              <b>{INR.format(totals.sgst)}</b>
            </div>
            <div className="sum-row sum-grand">
              <span>Grand Total</span>
              <b>{INR.format(totals.grand)}</b>
            </div>
          </div>
        </div>
      </div>

      {printData ? (
        <div id="bill-container" className="print-area">
          <div className="invoice">
            <div className="inv-head">
              <h2>RetailPulse Pharmacy</h2>
              <div>Invoice: {printData.invoiceId || 'PROVISIONAL'}</div>
              <div>Date: {printData.createdAt}</div>
            </div>

            <div className="inv-customer">
              <div><strong>Customer:</strong> {printData.customerName || 'Walk-in'}</div>
              <div><strong>Contact:</strong> {printData.contactNumber || '—'}</div>
              <div><strong>Doctor:</strong> {printData.doctorName || '—'}</div>
            </div>

            <table className="inv-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th className="num">Taxable</th>
                  <th className="num">CGST</th>
                  <th className="num">SGST</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {printData.items.map((it, idx) => (
                  <tr key={idx}>
                    <td>
                      <div className="inv-item-name">{it.name}</div>
                      {it.dosage ? (
                        <div className="inv-dose-wrap">
                          <table className="inv-dose-table">
                            <tbody>
                              <tr>
                                <td>Morning</td>
                                <td>{it.dosage.morning ? '✔' : '-'}</td>
                                <td>Afternoon</td>
                                <td>{it.dosage.afternoon ? '✔' : '-'}</td>
                                <td>Evening</td>
                                <td>{it.dosage.evening ? '✔' : '-'}</td>
                                <td>Night</td>
                                <td>{it.dosage.night ? '✔' : '-'}</td>
                              </tr>
                              <tr>
                                <td>Food</td>
                                <td colSpan="3">{it.dosage.food === 'before' ? 'Before food' : 'After food'}</td>
                                <td>Days</td>
                                <td colSpan="3">{it.dosage.durationDays}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </td>
                    <td className="num">{it.qty}</td>
                    <td className="num">{INR.format(it.taxable)}</td>
                    <td className="num">{INR.format(it.cgst)}</td>
                    <td className="num">{INR.format(it.sgst)}</td>
                    <td className="num strong">{INR.format(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="inv-totals">
              <div><span>Taxable:</span><b>{INR.format(printData.totals.taxable)}</b></div>
              <div><span>CGST:</span><b>{INR.format(printData.totals.cgst)}</b></div>
              <div><span>SGST:</span><b>{INR.format(printData.totals.sgst)}</b></div>
              <div className="grand"><span>Grand Total:</span><b>{INR.format(printData.totals.grand)}</b></div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
