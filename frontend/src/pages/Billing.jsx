import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./Billing.css";
import { PageHeader, AnimatedCounter, StatusBadge, Avatar, FormField, TextInput, Select, Badge, LoadingSkeleton } from "../components/ui";
import {
  FileText, Printer, Send, Trash2, RotateCcw, ShoppingCart, Search, ScanBarcode, Minus, Plus, Banknote, Smartphone,
  CreditCard, Wallet, Landmark, Receipt, UserRound, CheckCircle2, Layers, Pill, X, Upload,
} from "lucide-react";
import { productsAPI, salesAPI, customersAPI, handleApiError } from "../services/api";
import { DosageChip } from "./pos/dosageIcon";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const fmtINR = (n) => INR.format(n);
const MAX_RX_BYTES = 2 * 1024 * 1024;
const MAX_RESULTS = 100;

const emptyDose = { morning: false, afternoon: false, evening: false, night: false, food: "after", durationDays: "" };

const PAY_METHODS = [
  { value: "Cash", label: "Cash", icon: Banknote },
  { value: "UPI", label: "UPI", icon: Smartphone, hint: "PhonePe / GPay" },
  { value: "Card", label: "Card", icon: CreditCard, hint: "Debit / Credit" },
  { value: "Wallet", label: "Wallet", icon: Wallet },
  { value: "NetBanking", label: "Net Banking", icon: Landmark },
];

// Shop details for the invoice header come from Settings (stored in this browser).
function shopDetails() {
  try {
    const s = JSON.parse(localStorage.getItem("pharmacy_settings") || "{}");
    return {
      name: s.pharmacyName || s.name || "Pharmacy",
      address: s.address || "",
      phone: s.phone || s.contactNumber || "",
      gstin: s.gstin || s.gstNumber || "",
      license: s.licenseNumber || s.drugLicense || "",
    };
  } catch {
    return { name: "Pharmacy", address: "", phone: "", gstin: "", license: "" };
  }
}

function doseText(d) {
  if (!d) return "";
  const times = ["morning", "afternoon", "evening", "night"].filter((k) => d[k]).map((k) => k[0].toUpperCase() + k.slice(1));
  const parts = [];
  if (times.length) parts.push(times.join(" / "));
  if (d.beforeFood) parts.push("Before food");
  if (d.afterFood) parts.push("After food");
  if (d.durationDays) parts.push(`${d.durationDays} days`);
  return parts.join(" • ");
}

// Stock indicator for a search result, from the product's real units on hand and its reorder level
function stockStatus(p) {
  const q = Number(p.quantity) || 0;
  if (q <= 0) return "OUT_OF_STOCK";
  if (q <= (Number(p.reorderLevel) || 0)) return "LOW_STOCK";
  return "IN_STOCK";
}

const unitsPerPack = (p) =>
  p && (p.dosageForm?.toLowerCase() === "syrup" || p.unitType?.toLowerCase() === "bottle") ? 1 : Math.max(1, p?.stripSize || 1);

const unitsFor = (p, mode, q) => (mode === "strip" ? q * unitsPerPack(p) : q);

export default function Billing() {
  const medicineSearchRef = useRef(null);
  const resultsRef = useRef(null);
  const savingRef = useRef(false); // blocks a second Save while the first is in flight (double click)
  const [customerName, setCustomerName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerHint, setCustomerHint] = useState("");
  const [prescriptionFile, setPrescriptionFile] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [amountReceived, setAmountReceived] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [companyFilter, setCompanyFilter] = useState("");
  const [medicineQuery, setMedicineQuery] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [unitMode, setUnitMode] = useState("strip"); // strip | tablet
  const [qty, setQty] = useState(1);
  const [dose, setDose] = useState(emptyDose);
  const [items, setItems] = useState([]);

  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null); // {tone, text}
  const [invoice, setInvoice] = useState(null); // saved invoice from the server

  const loadProducts = useCallback(async (search) => {
    const res = await productsAPI.getAll(search || undefined);
    setProducts(res.data || []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadProducts();
      } catch (err) {
        setError(handleApiError(err).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadProducts]);

  // Medicine name search; an empty box restores the full list
  useEffect(() => {
    if (loading) return undefined;
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const res = companyFilter.trim() && !medicineQuery.trim()
          ? await salesAPI.searchByCompany(companyFilter.trim())
          : await productsAPI.getAll(medicineQuery.trim() || undefined);
        if (cancelled) return;
        let data = res.data || [];
        if (companyFilter.trim() && medicineQuery.trim()) {
          const c = companyFilter.trim().toLowerCase();
          data = data.filter((p) => (p.company || "").toLowerCase().includes(c));
        }
        setProducts(data);
      } catch (err) {
        if (!cancelled) setNotice({ tone: "red", text: handleApiError(err).message });
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [medicineQuery, companyFilter, loading]);

  // F1 / Ctrl+K focus the medicine search (Ctrl+P is left to the browser for printing)
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "F1" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        medicineSearchRef.current?.focus?.();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const lineItems = useMemo(
    () =>
      items.map((it) => ({
        productId: it.productId,
        quantitySoldTablets: it.units,
        morning: it.dose.morning,
        afternoon: it.dose.afternoon,
        evening: it.dose.evening,
        night: it.dose.night,
        beforeFood: it.dose.food === "before",
        afterFood: it.dose.food === "after",
        durationDays: it.dose.durationDays ? Number(it.dose.durationDays) : null,
      })),
    [items]
  );

  const discountValue = discountPercent === "" ? 0 : Number(discountPercent);

  // Server-side pricing for the whole cart (same rules as the saved bill)
  useEffect(() => {
    if (items.length === 0) {
      setQuote(null);
      setQuoteError("");
      return undefined;
    }
    let cancelled = false;
    setQuoting(true);
    const id = setTimeout(async () => {
      try {
        const res = await salesAPI.quote({ discountPercent: discountValue, lineItems });
        if (!cancelled) {
          setQuote(res.data);
          setQuoteError("");
        }
      } catch (err) {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(handleApiError(err).message);
        }
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [lineItems, discountValue, items.length]);

  // Price preview for the item being added
  useEffect(() => {
    const q = Number(qty);
    if (!selectedProduct || !(q > 0) || !Number.isInteger(q)) {
      setPreview(null);
      return undefined;
    }
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const res = await salesAPI.quote({
          lineItems: [{ productId: selectedProduct.productId, quantitySoldTablets: unitsFor(selectedProduct, unitMode, q) }],
        });
        if (!cancelled) setPreview({ total: res.data.grandTotal });
      } catch (err) {
        if (!cancelled) setPreview({ error: handleApiError(err).message });
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [selectedProduct, unitMode, qty]);

  // Totals per cart line (one product may be split across batches on the server, FEFO)
  const lineTotals = useMemo(() => {
    const map = {};
    (quote?.items || []).forEach((l) => {
      const t = (map[l.productId] ||= { taxable: 0, cgst: 0, sgst: 0, total: 0, batches: [] });
      t.taxable += Number(l.taxable);
      t.cgst += Number(l.cgst);
      t.sgst += Number(l.sgst);
      t.total += Number(l.total);
      t.batches.push({ batch: l.batchNumber, expiry: l.expiryDate, units: l.quantityTablets });
    });
    return map;
  }, [quote]);

  async function lookupCustomer() {
    const first = customerName.trim().split(" ")[0];
    if (!first || selectedCustomerId) return;
    try {
      const res = await customersAPI.lookupByFirstName(first);
      const exact = (res.data || []).filter(
        (p) => p.customer.name.toLowerCase() === customerName.trim().toLowerCase()
      );
      if (exact.length === 1) {
        const c = exact[0].customer;
        setSelectedCustomerId(c.customerId);
        setContactNumber(c.contactNumber || "");
        setDoctorName(c.doctorName || "");
        setCustomerHint(
          `Existing customer${Number(c.remainingBalance) > 0 ? ` • outstanding ${INR.format(c.remainingBalance)}` : ""}`
        );
      } else if (res.data?.length > 1) {
        setCustomerHint(`${res.data.length} customers start with "${first}" — type the full name and phone`);
      } else {
        setCustomerHint("New customer will be created");
      }
    } catch (err) {
      setCustomerHint(handleApiError(err).message);
    }
  }

  async function scanBarcode() {
    if (!barcodeInput.trim()) return;
    try {
      const res = await salesAPI.findByBarcode(barcodeInput.trim());
      // Scanned medicine goes to the top of the results so it is always visible and selected
      setProducts((prev) => [res.data, ...prev.filter((p) => p.productId !== res.data.productId)]);
      setSelectedProduct(res.data);
      setBarcodeInput("");
    } catch (err) {
      setNotice({ tone: "red", text: handleApiError(err).message });
    }
  }

  function chooseProduct(p) {
    if (!p.quantity) return; // out of stock cannot be sold
    setSelectedProduct(p);
  }

  function addItem() {
    const q = Number(qty);
    if (!selectedProduct) {
      setNotice({ tone: "red", text: "Choose a medicine first." });
      return;
    }
    if (String(qty).trim() === "" || !Number.isInteger(q) || q <= 0) {
      setNotice({ tone: "red", text: "Enter a whole quantity greater than zero." });
      return;
    }
    const units = unitsFor(selectedProduct, unitMode, q);
    setItems((prev) => {
      const existing = prev.find((x) => x.productId === selectedProduct.productId);
      if (existing) {
        // Same medicine twice is one line on the bill
        return prev.map((x) => (x === existing ? { ...x, units: x.units + units } : x));
      }
      return [
        ...prev,
        {
          key: `${selectedProduct.productId}-${Date.now()}`,
          productId: selectedProduct.productId,
          name: selectedProduct.name,
          company: selectedProduct.company || "—",
          dosageForm: selectedProduct.dosageForm,
          hsn: selectedProduct.hsnCode,
          gstRate: selectedProduct.gstRate,
          unitsPerPack: unitsPerPack(selectedProduct),
          mode: unitMode,
          units,
          dose: { ...dose },
        },
      ];
    });
    setSelectedProduct(null);
    setQty(1);
    setNotice(null);
  }

  // +/- on a cart line: one pack for lines added as packs, one unit for loose lines (never below 1 unit)
  function stepLine(key, dir) {
    setItems((prev) =>
      prev.map((x) => {
        if (x.key !== key) return x;
        const step = x.mode === "strip" ? x.unitsPerPack : 1;
        const next = x.units + dir * step;
        return next >= 1 ? { ...x, units: next } : x;
      })
    );
  }

  const removeItem = (key) => setItems((prev) => prev.filter((x) => x.key !== key));

  function resetBill() {
    setItems([]);
    setCustomerName("");
    setContactNumber("");
    setDoctorName("");
    setSelectedCustomerId(null);
    setCustomerHint("");
    setPrescriptionFile(null);
    setAmountReceived("");
    setDiscountPercent("");
    setDose(emptyDose);
    setPaymentMethod("Cash");
  }

  // "Clear" button: start a fresh bill, including the item being entered
  function clearAll() {
    resetBill();
    setSelectedProduct(null);
    setQty(1);
    setUnitMode("strip");
    setMedicineQuery("");
    setCompanyFilter("");
    setBarcodeInput("");
    setNotice(null);
    setInvoice(null);
  }

  const grand = quote ? Number(quote.grandTotal) : 0;
  const received = amountReceived === "" ? null : Number(amountReceived);
  const change = received != null && received > grand ? received - grand : 0;
  const due = received != null && received < grand ? grand - received : 0;

  async function createBill() {
    if (items.length === 0 || !quote || quoteError || savingRef.current) return;
    if (received != null && (Number.isNaN(received) || received < 0)) {
      setNotice({ tone: "red", text: "Amount received must be zero or more." });
      return;
    }
    if (due > 0 && !customerName.trim()) {
      setNotice({ tone: "red", text: "Enter the customer's name to record a part-paid (credit) bill." });
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setNotice(null);
    try {
      let rxUrl = null;
      if (prescriptionFile) {
        if (prescriptionFile.size > MAX_RX_BYTES) throw new Error("Prescription image must be under 2 MB.");
        rxUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Could not read the prescription image."));
          reader.readAsDataURL(prescriptionFile);
        });
      }
      const res = await salesAPI.createBill({
        customerId: selectedCustomerId,
        customerName: customerName.trim() || null,
        contactNumber: contactNumber.trim() || null,
        doctorName: doctorName.trim() || null,
        prescriptionImageUrl: rxUrl,
        paymentMethod,
        amountPaid: received,
        discountPercent: discountValue,
        lineItems,
      });
      setInvoice(res.data);
      setNotice({ tone: "green", text: `Bill ${res.data.invoiceNumber} saved (${INR.format(res.data.grandTotal)}).` });
      resetBill();
      loadProducts(medicineQuery.trim()).catch(() => {});
      window.scrollTo?.({ top: 0, behavior: "smooth" });
    } catch (err) {
      setNotice({ tone: "red", text: "Bill not saved: " + (err.response ? handleApiError(err).message : err.message) });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function downloadPdf() {
    const el = document.getElementById("bill-container");
    if (!invoice || !el) return;
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgW = pageW - margin * 2;
      const pxPerMm = canvas.width / imgW;
      const sliceHpx = Math.floor((pageH - margin * 2) * pxPerMm);
      // Long bills are split across pages instead of being squashed onto one
      for (let y = 0, page = 0; y < canvas.height; y += sliceHpx, page++) {
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = Math.min(sliceHpx, canvas.height - y);
        slice.getContext("2d").drawImage(canvas, 0, y, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
        if (page > 0) pdf.addPage();
        pdf.addImage(slice.toDataURL("image/png"), "PNG", margin, margin, imgW, slice.height / pxPerMm);
      }
      pdf.save(`${invoice.invoiceNumber}.pdf`);
    } catch (err) {
      setNotice({ tone: "red", text: "Could not create the PDF: " + (err.message || err) });
    }
  }

  async function sendNotification() {
    if (!invoice) return;
    try {
      const res = await salesAPI.notify(invoice.invoiceId, "sms");
      setNotice({ tone: "yellow", text: res.data.note || "Message logged on the server." });
    } catch (err) {
      setNotice({ tone: "red", text: handleApiError(err).message });
    }
  }

  // Arrow keys move between selectable results; ArrowDown from the search box enters the list
  function focusResult(delta) {
    const list = resultsRef.current;
    if (!list) return;
    const opts = [...list.querySelectorAll("button[role='option']:not(:disabled)")];
    if (!opts.length) return;
    const idx = opts.indexOf(document.activeElement);
    const next = idx === -1 ? 0 : Math.max(0, Math.min(opts.length - 1, idx + delta));
    opts[next].focus();
  }

  function onSearchKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusResult(1);
    } else if (e.key === "Enter") {
      const sellable = products.filter((p) => p.quantity);
      if (sellable.length === 1) chooseProduct(sellable[0]);
    }
  }

  const header = (
    <PageHeader
      icon={ShoppingCart}
      eyebrow="Point of sale"
      title="Sales & Billing"
      subtitle={
        <>
          Prices include GST (MRP basis) and are calculated by the server • <kbd className="pos-kbd">F1</kbd> or{" "}
          <kbd className="pos-kbd">Ctrl + K</kbd> to search medicines
        </>
      }
      actions={
        <button className="btn" onClick={clearAll} disabled={saving} type="button">
          <RotateCcw size={16} /> Clear
        </button>
      }
    />
  );

  if (loading) {
    return (
      <div className="mb-page bill">
        {header}
        <div className="card pos-loading">
          <LoadingSkeleton variant="table" rows={5} label="Loading medicines..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-page bill">
        {header}
        <div className="bill-notice bill-notice-red">Error: {error}</div>
      </div>
    );
  }

  const shop = shopDetails();
  const canSave = items.length > 0 && quote && !quoteError && !quoting && !saving;
  const shown = products.slice(0, MAX_RESULTS);
  const totalUnits = items.reduce((s, i) => s + i.units, 0);
  const previewText = !selectedProduct ? "—" : preview?.error ? null : preview ? INR.format(preview.total) : "…";

  return (
    <div className="mb-page bill">
      {header}

      {notice ? (
        <div className={`bill-notice bill-notice-${notice.tone}`} role="status">
          {notice.text}
        </div>
      ) : null}

      {invoice ? (
        <section className="card invoice-card mb-animate-in" role="region" aria-label="Saved invoice">
          <div className="inv-panel-head">
            <div className="inv-panel-title">
              <span className="inv-panel-icon" aria-hidden="true"><CheckCircle2 size={22} /></span>
              <div>
                <h3 className="section-title">Saved invoice {invoice.invoiceNumber}</h3>
                <div className="inv-panel-meta">
                  {invoice.paymentStatus ? <StatusBadge status={invoice.paymentStatus} size="sm" /> : null}
                  <span>{INR.format(invoice.grandTotal)}</span>
                </div>
              </div>
            </div>
            <div className="bill-head-actions">
              <button className="btn" type="button" onClick={() => window.print()}>
                <Printer size={16} /> Print
              </button>
              <button className="btn" type="button" onClick={downloadPdf}>
                <FileText size={16} /> Download PDF
              </button>
              <button className="btn" type="button" onClick={sendNotification} disabled={!invoice.contactNumber}
                title={invoice.contactNumber ? "" : "No customer phone on this bill"}>
                <Send size={16} /> SMS
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setInvoice(null)}>
                <X size={16} /> Close
              </button>
            </div>
          </div>

          <div id="bill-container" className="print-area">
            <div className="invoice">
              <div className="inv-head">
                <h2>{shop.name}</h2>
                {shop.address ? <div>{shop.address}</div> : null}
                <div>
                  {shop.phone ? `Ph: ${shop.phone}` : ""} {shop.gstin ? ` • GSTIN: ${shop.gstin}` : ""}
                  {shop.license ? ` • DL No: ${shop.license}` : ""}
                </div>
                <div>
                  <strong>Tax Invoice {invoice.invoiceNumber}</strong> • {new Date(invoice.saleDateTime).toLocaleString("en-IN")}
                </div>
              </div>

              <div className="inv-customer">
                <div><strong>Customer:</strong> {invoice.customerName}</div>
                <div><strong>Contact:</strong> {invoice.contactNumber || "—"}</div>
                <div><strong>Doctor:</strong> {invoice.doctorName || "—"}</div>
              </div>

              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Batch / Exp</th>
                    <th className="num">Qty</th>
                    <th className="num">MRP</th>
                    <th className="num">Taxable</th>
                    <th className="num">CGST</th>
                    <th className="num">SGST</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((it) => (
                    <tr key={`${it.batchId}-${it.productId}`}>
                      <td>
                        <div className="inv-item-name">{it.productName}</div>
                        <div className="it-sub">HSN {it.hsnCode} • GST {Number(it.gstRate)}%</div>
                        {doseText(it) ? <div className="it-sub">{doseText(it)}</div> : null}
                      </td>
                      <td>
                        {it.batchNumber}
                        <div className="it-sub">{it.expiryDate}</div>
                      </td>
                      <td className="num">{it.quantityTablets}</td>
                      <td className="num">{INR.format(it.mrp)}</td>
                      <td className="num">{INR.format(it.taxable)}</td>
                      <td className="num">{INR.format(it.cgst)}</td>
                      <td className="num">{INR.format(it.sgst)}</td>
                      <td className="num strong">{INR.format(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="inv-totals">
                {Number(invoice.totalDiscount) > 0 ? (
                  <div><span>Discount ({Number(invoice.discountPercent)}%):</span><b>− {INR.format(invoice.totalDiscount)}</b></div>
                ) : null}
                <div><span>Taxable:</span><b>{INR.format(invoice.totalTaxableAmount)}</b></div>
                <div><span>CGST:</span><b>{INR.format(invoice.totalCgst)}</b></div>
                <div><span>SGST:</span><b>{INR.format(invoice.totalSgst)}</b></div>
                <div className="grand"><span>Grand Total (incl. GST):</span><b>{INR.format(invoice.grandTotal)}</b></div>
                <div><span>Paid:</span><b>{INR.format(invoice.amountPaid)}</b></div>
                {Number(invoice.balanceDue) > 0 ? (
                  <div><span>Balance due:</span><b>{INR.format(invoice.balanceDue)}</b></div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="pos-grid">
        {/* ───────── left: find, add, cart ───────── */}
        <div className="pos-main">
          <div className="pos-pick">
            <section className="card pos-card pos-search-card" aria-label="Find medicine">
              <div className="pos-card-head">
                <span className="pos-card-icon" aria-hidden="true"><Search size={18} /></span>
                <h2 className="pos-card-title">Find medicine</h2>
                <span className="pos-count">{products.length} result{products.length === 1 ? "" : "s"}</span>
              </div>

              <div className="pos-search">
                <input
                  ref={medicineSearchRef}
                  className="ti"
                  type="search"
                  aria-label="Medicine search"
                  placeholder="Type medicine, generic or company..."
                  value={medicineQuery}
                  onChange={(e) => setMedicineQuery(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                />
              </div>

              <div className="pos-filters">
                <FormField label="Company filter">
                  <TextInput value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} placeholder="Filter by company" aria-label="Company filter" />
                </FormField>
                <FormField label="Barcode scan">
                  <div className="barcode-row">
                    <TextInput
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && scanBarcode()}
                      placeholder="Scan or type barcode"
                      aria-label="Barcode"
                    />
                    <button type="button" className="btn" onClick={scanBarcode}>
                      <ScanBarcode size={16} /> Find
                    </button>
                  </div>
                </FormField>
              </div>

              <div
                ref={resultsRef}
                className="pos-results"
                role="listbox"
                aria-label="Select medicine"
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    focusResult(e.key === "ArrowDown" ? 1 : -1);
                  }
                }}
              >
                {shown.length === 0 ? (
                  <div className="pos-results-empty">
                    <Pill size={22} aria-hidden="true" />
                    <span>No medicines found. Try another name, company or barcode.</span>
                  </div>
                ) : (
                  shown.map((p) => {
                    const st = stockStatus(p);
                    const out = st === "OUT_OF_STOCK";
                    const sel = selectedProduct?.productId === p.productId;
                    return (
                      <button
                        key={p.productId}
                        type="button"
                        role="option"
                        aria-selected={sel}
                        disabled={out}
                        data-testid={`med-option-${p.productId}`}
                        className={`pos-result ${sel ? "is-selected" : ""}`}
                        onClick={() => chooseProduct(p)}
                      >
                        <DosageChip form={p.dosageForm} size={36} />
                        <span className="pos-result-main">
                          <span className="pos-result-name">{p.name}</span>
                          <span className="pos-result-sub">
                            {p.company || "—"}
                            {p.dosageForm ? ` · ${p.dosageForm}` : ""}
                          </span>
                        </span>
                        <span className="pos-result-stock">
                          <StatusBadge status={st} size="sm" />
                          <span className="pos-result-units">{out ? "0 units" : `${p.quantity} units`}</span>
                        </span>
                        <span className="pos-result-price">
                          {INR.format(Number(p.price) || 0)}
                          <small>/ pack</small>
                        </span>
                      </button>
                    );
                  })
                )}
                {products.length > MAX_RESULTS ? (
                  <div className="pos-results-more">Showing the first {MAX_RESULTS}. Type more of the name to narrow the list.</div>
                ) : null}
              </div>
            </section>

            <section className="card pos-card pos-add-card" aria-label="Add to bill">
              <div className="pos-card-head">
                <span className="pos-card-icon" aria-hidden="true"><Plus size={18} /></span>
                <h2 className="pos-card-title">Add to bill</h2>
              </div>

              {selectedProduct ? (
                <div className="pos-selected">
                  <DosageChip form={selectedProduct.dosageForm} size={44} />
                  <div className="pos-selected-text">
                    <div className="pos-selected-name">{selectedProduct.name}</div>
                    <div className="pos-selected-meta">
                      <Badge tone="blue">{unitsPerPack(selectedProduct)} per pack</Badge>
                      <Badge tone="green">GST {Number(selectedProduct.gstRate ?? 12)}%</Badge>
                      <span className="pos-selected-stock">{selectedProduct.quantity} units in stock</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pos-selected pos-selected--empty">
                  <span className="pos-selected-ph" aria-hidden="true"><Pill size={20} /></span>
                  <span>Pick a medicine from the results (or scan a barcode) to add it.</span>
                </div>
              )}

              <div className="mode-row" role="group" aria-label="Sell by">
                <button className={`mode-btn ${unitMode === "strip" ? "active" : ""}`} type="button" aria-pressed={unitMode === "strip"} onClick={() => setUnitMode("strip")}>
                  Strip / Pack
                </button>
                <button className={`mode-btn ${unitMode === "tablet" ? "active" : ""}`} type="button" aria-pressed={unitMode === "tablet"} onClick={() => setUnitMode("tablet")}>
                  Loose units
                </button>
              </div>

              <div className="qty-row">
                <FormField label={unitMode === "strip" ? "Packs" : "Units"}>
                  <div className="qty-stepper">
                    <button type="button" className="qty-step" aria-label="One less" onClick={() => setQty((q) => Math.max(1, (parseInt(q, 10) || 1) - 1))}>
                      <Minus size={16} />
                    </button>
                    <TextInput
                      type="number"
                      min="1"
                      step="1"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addItem()}
                      aria-label="Quantity"
                    />
                    <button type="button" className="qty-step" aria-label="One more" onClick={() => setQty((q) => (parseInt(q, 10) > 0 ? parseInt(q, 10) : 0) + 1)}>
                      <Plus size={16} />
                    </button>
                  </div>
                </FormField>
                <div className="price-preview">
                  <div className="muted">Price (incl. GST)</div>
                  <div className="price-value" data-testid="price-preview">
                    {previewText === null ? <span className="price-error">{preview.error}</span> : previewText}
                  </div>
                </div>
              </div>

              <div className="dose-card">
                <div className="dose-head">
                  <h3 className="section-title">Dosage for the next item</h3>
                  <Badge tone="gray">Saved per item & printed</Badge>
                </div>
                <div className="dose-grid">
                  {["morning", "afternoon", "evening", "night"].map((k) => (
                    <label className={`chk ${dose[k] ? "is-on" : ""}`} key={k}>
                      <input type="checkbox" checked={dose[k]} onChange={(e) => setDose((d) => ({ ...d, [k]: e.target.checked }))} />
                      {k[0].toUpperCase() + k.slice(1)}
                    </label>
                  ))}
                </div>
                <div className="dose-grid2">
                  <FormField label="Before / After food">
                    <Select
                      value={dose.food}
                      aria-label="Before / After food"
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
                      aria-label="Duration (days)"
                      onChange={(e) => setDose((d) => ({ ...d, durationDays: e.target.value }))}
                    />
                  </FormField>
                </div>
              </div>

              <button className="btn btn-primary add-btn" type="button" onClick={addItem} disabled={!selectedProduct || !!preview?.error}>
                <Plus size={16} /> Add Item
              </button>
            </section>
          </div>

          <section className="card pos-card pos-cart" aria-label="Cart">
            <div className="pos-card-head">
              <span className="pos-card-icon" aria-hidden="true"><ShoppingCart size={18} /></span>
              <h2 className="pos-card-title">Cart</h2>
              <span className="pos-count">
                {items.length} item{items.length === 1 ? "" : "s"} · {totalUnits} units
              </span>
            </div>

            <div className="items-wrap">
              {items.length === 0 ? (
                <div className="cart-empty" data-testid="cart-empty">
                  <span className="cart-empty-art" aria-hidden="true"><ShoppingCart size={26} /></span>
                  <span className="cart-empty-title">Add medicines to start billing.</span>
                  <span className="cart-empty-msg">Search or scan on the left, choose packs or loose units, then Add Item.</span>
                </div>
              ) : (
                <ul className="cart-list">
                  {items.map((i) => {
                    const t = lineTotals[i.productId];
                    const packs = Math.floor(i.units / i.unitsPerPack);
                    const loose = i.units % i.unitsPerPack;
                    const step = i.mode === "strip" ? i.unitsPerPack : 1;
                    const dText = doseText({ ...i.dose, beforeFood: i.dose.food === "before", afterFood: i.dose.food === "after" });
                    return (
                      <li className="cart-line" key={i.key}>
                        <DosageChip form={i.dosageForm} size={40} />
                        <div className="cart-info">
                          <div className="it-name">{i.name}</div>
                          <div className="it-sub">
                            {i.company} • HSN {i.hsn} • GST {Number(i.gstRate ?? 12)}%
                          </div>
                          {t ? (
                            <div className="cart-batches">
                              {t.batches.map((b) => (
                                <span className="cart-batch" key={b.batch}>
                                  <Layers size={12} aria-hidden="true" /> Batch {b.batch} <span className="cart-batch-exp">exp {b.expiry}</span>
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {dText ? <div className="it-sub cart-dose">Dose: {dText}</div> : null}
                        </div>
                        <div className="cart-qty">
                          <div className="cart-stepper">
                            <button type="button" className="qty-step" aria-label={`Decrease ${i.name}`} disabled={i.units - step < 1} onClick={() => stepLine(i.key, -1)}>
                              <Minus size={14} />
                            </button>
                            <span className="cart-units">{i.units} units</span>
                            <button type="button" className="qty-step" aria-label={`Increase ${i.name}`} onClick={() => stepLine(i.key, 1)}>
                              <Plus size={14} />
                            </button>
                          </div>
                          {i.unitsPerPack > 1 ? <div className="it-sub">{packs} pack(s){loose ? ` + ${loose}` : ""}</div> : null}
                        </div>
                        <div className="cart-money">
                          <div className="cart-total">{t ? INR.format(t.total) : "—"}</div>
                          {t ? (
                            <>
                              <div className="it-sub">Taxable {INR.format(t.taxable)}</div>
                              <div className="it-sub">CGST {INR.format(t.cgst)} · SGST {INR.format(t.sgst)}</div>
                            </>
                          ) : null}
                        </div>
                        <button className="icon-btn cart-remove" onClick={() => removeItem(i.key)} aria-label={`Remove ${i.name}`} type="button">
                          <Trash2 size={16} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {quoteError ? <div className="bill-notice bill-notice-red">{quoteError}</div> : null}
          </section>
        </div>

        {/* ───────── right: bill summary ───────── */}
        <aside className="bill-summary" aria-label="Bill summary">
          <div className="sum-scroll">
            <div className="sum-head">
              <span className="pos-card-icon" aria-hidden="true"><Receipt size={18} /></span>
              <h2 className="pos-card-title">Bill summary</h2>
            </div>

            <div className="sum-section">
              <div className="sum-section-title"><UserRound size={14} aria-hidden="true" /> Customer</div>
              {customerName.trim() ? (
                <div className="sum-customer">
                  <Avatar name={customerName} size={34} />
                  <div className="sum-customer-text">
                    <div className="sum-customer-name">{customerName}</div>
                    <div className="sum-customer-sub">{selectedCustomerId ? "Existing customer" : contactNumber || "New or walk-in"}</div>
                  </div>
                </div>
              ) : null}
              <div className="form-grid">
                <FormField label="Customer name" hint={customerHint || "Leave blank for a walk-in sale"}>
                  <TextInput
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      setSelectedCustomerId(null);
                      setCustomerHint("");
                    }}
                    onBlur={lookupCustomer}
                    placeholder="Patient / customer"
                    aria-label="Customer name"
                  />
                </FormField>
                <div className="sum-two">
                  <FormField label="Contact number">
                    <TextInput value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="Phone number" aria-label="Contact number" />
                  </FormField>
                  <FormField label="Doctor name">
                    <TextInput value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="Prescribing doctor" aria-label="Doctor name" />
                  </FormField>
                </div>
                <FormField label="Prescription image" hint="Optional, max 2 MB">
                  <label className="rx-drop">
                    <Upload size={16} aria-hidden="true" />
                    <span className="rx-drop-text">{prescriptionFile ? prescriptionFile.name : "Attach prescription photo"}</span>
                    <input
                      className="rx-file"
                      type="file"
                      accept="image/*"
                      aria-label="Prescription image"
                      onChange={(e) => setPrescriptionFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </FormField>
              </div>
            </div>

            <div className="sum-section">
              <div className="sum-section-title" id="pay-method-label"><Wallet size={14} aria-hidden="true" /> Payment method</div>
              <div
                className="pay-seg"
                role="radiogroup"
                aria-labelledby="pay-method-label"
                onKeyDown={(e) => {
                  if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
                  e.preventDefault();
                  const idx = PAY_METHODS.findIndex((m) => m.value === paymentMethod);
                  const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
                  const next = PAY_METHODS[(idx + d + PAY_METHODS.length) % PAY_METHODS.length];
                  setPaymentMethod(next.value);
                  e.currentTarget.querySelector(`[data-method="${next.value}"]`)?.focus();
                }}
              >
                {PAY_METHODS.map(({ value, label, icon: Icon, hint }) => {
                  const on = paymentMethod === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      tabIndex={on ? 0 : -1}
                      data-method={value}
                      title={hint || label}
                      className={`pay-seg-btn ${on ? "is-on" : ""}`}
                      onClick={() => setPaymentMethod(value)}
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="sum-section">
              <div className="sum-two">
                <FormField label="Discount %" hint="Whole bill">
                  <TextInput
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    placeholder="0"
                    aria-label="Discount %"
                  />
                </FormField>
                <FormField label="Amount received" hint="Blank = paid in full">
                  <TextInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    aria-label="Amount received"
                    placeholder={quote ? String(quote.grandTotal) : "0.00"}
                  />
                </FormField>
              </div>
            </div>

            <div className="summary sum-section" role="region" aria-label="GST breakdown">
              {quote && Number(quote.totalDiscount) > 0 ? (
                <div className="sum-row sum-row--discount">
                  <span>Discount ({Number(quote.discountPercent)}%)</span>
                  <b>− {INR.format(quote.totalDiscount)}</b>
                </div>
              ) : null}
              <div className="sum-row">
                <span>Taxable value</span>
                <b data-testid="sum-taxable">{quote ? INR.format(quote.totalTaxableAmount) : "—"}</b>
              </div>
              <div className="sum-row">
                <span>CGST</span>
                <b data-testid="sum-cgst">{quote ? INR.format(quote.totalCgst) : "—"}</b>
              </div>
              <div className="sum-row">
                <span>SGST</span>
                <b data-testid="sum-sgst">{quote ? INR.format(quote.totalSgst) : "—"}</b>
              </div>
            </div>
          </div>

          <div className="sum-foot">
            <div className="sum-grand-card">
              <div className="sum-grand-label">
                Grand Total {quoting ? <span className="sum-updating">(updating…)</span> : null}
              </div>
              <div className="sum-grand-value" aria-hidden="true">
                {quote ? <AnimatedCounter value={Number(quote.grandTotal)} format={fmtINR} duration={450} /> : "—"}
              </div>
              <span className="mb-sr-only" data-testid="sum-grand">{quote ? INR.format(quote.grandTotal) : "—"}</span>
              <div className="sum-grand-sub">
                {items.length} item{items.length === 1 ? "" : "s"} · incl. GST · {PAY_METHODS.find((m) => m.value === paymentMethod)?.label}
              </div>
            </div>
            {change > 0 ? (
              <div className="sum-callout sum-callout--change">
                <span>Change to return</span>
                <b data-testid="sum-change">{INR.format(change)}</b>
              </div>
            ) : null}
            {due > 0 ? (
              <div className="sum-callout sum-callout--due">
                <span>Balance due (credit)</span>
                <b data-testid="sum-due">{INR.format(due)}</b>
              </div>
            ) : null}
            <button className="btn btn-primary pos-checkout" onClick={createBill} disabled={!canSave} type="button">
              <FileText size={18} /> {saving ? "Saving..." : "Save Bill"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
