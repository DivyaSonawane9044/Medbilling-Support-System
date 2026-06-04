import React, { useMemo, useState, useEffect } from "react";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import Select from "../components/ui/Select";
import "./Payments.css";
import { CreditCard, Landmark, Wallet } from "lucide-react";
import { paymentsAPI, salesAPI, handleApiError } from "../services/api";
import { openRazorpayCheckout } from "../utils/razorpay";

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

function Payments() {
  const [method, setMethod] = useState("");
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState("");
  const [razorpayInvoice, setRazorpayInvoice] = useState("");
  const [recordMethod, setRecordMethod] = useState("Cash");
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [paying, setPaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    const [payRes, invRes, configRes] = await Promise.all([
      paymentsAPI.getAll(),
      salesAPI.listInvoices(),
      paymentsAPI.getConfig(),
    ]);
    setPayments(payRes.data || []);
    setInvoices(invRes.data || []);
    setPaymentConfig(configRes.data);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await load();
      } catch (err) {
        setError(handleApiError(err).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rows = useMemo(() => {
    const mapped = payments.map((p) => ({
      billId: p.invoiceNumber || p.invoiceId,
      date: p.paymentDate ? new Date(p.paymentDate).toLocaleString("en-IN") : "—",
      customer: p.customerName || "—",
      amount: Number(p.amountPaid) || 0,
      method: p.paymentMethod || "—",
      status: p.paymentStatus || "—",
    }));
    return method ? mapped.filter((r) => r.method === method) : mapped;
  }, [payments, method]);

  const unpaidInvoices = useMemo(
    () =>
      invoices.filter(
        (inv) =>
          !payments.some(
            (p) => p.invoiceId === inv.invoiceId && p.paymentStatus === "SUCCESS"
          )
      ),
    [invoices, payments]
  );

  const selectedRazorpayInv = useMemo(
    () => unpaidInvoices.find((inv) => String(inv.invoiceId) === razorpayInvoice),
    [unpaidInvoices, razorpayInvoice]
  );

  async function recordPayment() {
    if (!selectedInvoice) return;
    try {
      await paymentsAPI.recordPayment({
        invoiceId: Number(selectedInvoice),
        paymentMethod: recordMethod,
      });
      await load();
      setSelectedInvoice("");
      alert("Payment recorded");
    } catch (err) {
      alert(handleApiError(err).message);
    }
  }

  async function payWithRazorpay() {
    if (!razorpayInvoice || !selectedRazorpayInv) {
      alert("Select an unpaid invoice first");
      return;
    }
    const amount = Number(selectedRazorpayInv.grandTotal);
    if (!amount || amount <= 0) {
      alert("Invalid invoice amount");
      return;
    }

    setPaying(true);
    try {
      const orderRes = await paymentsAPI.createOrder({
        amount,
        invoiceId: String(selectedRazorpayInv.invoiceId),
      });
      const order = orderRes.data;

      await openRazorpayCheckout({
        order,
        invoiceId: selectedRazorpayInv.invoiceId,
        customerName: selectedRazorpayInv.customerName,
        onSuccess: async (payload) => {
          await paymentsAPI.verifyPayment(payload);
          await load();
          setRazorpayInvoice("");
          alert(order.mock ? "Demo payment recorded successfully" : "Payment verified and recorded");
        },
      });
    } catch (err) {
      const msg = handleApiError(err).message;
      if (msg !== "Payment cancelled") alert(msg);
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return <div className="pay"><p>Loading payments...</p></div>;
  }

  if (error) {
    return <div className="pay"><p className="error-message">{error}</p></div>;
  }

  return (
    <div className="pay">
      <div className="pay-head">
        <div>
          <h2 className="pay-title">Payments</h2>
          <p className="pay-subtitle">Cash, UPI, and Razorpay online payments</p>
        </div>
        <div className="pay-filter card">
          <div className="pay-filter-label">Filter method</div>
          <Select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            placeholder="All methods"
            options={[
              { value: "Cash", label: "Cash" },
              { value: "UPI", label: "UPI" },
              { value: "RAZORPAY", label: "Razorpay" },
              { value: "Card", label: "Card" },
            ]}
          />
        </div>
      </div>

      <div className="card pay-banner" style={{ marginBottom: 16 }}>
        <div className="pay-banner-title">Record payment for invoice</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <Select
            value={selectedInvoice}
            onChange={(e) => setSelectedInvoice(e.target.value)}
            placeholder="Select unpaid invoice"
            options={unpaidInvoices.map((inv) => ({
              value: String(inv.invoiceId),
              label: `${inv.invoiceNumber} — ${inv.customerName} (${INR.format(inv.grandTotal)})`,
            }))}
          />
          <Select
            value={recordMethod}
            onChange={(e) => setRecordMethod(e.target.value)}
            options={[
              { value: "Cash", label: "Cash" },
              { value: "UPI", label: "UPI" },
              { value: "Card", label: "Card" },
            ]}
          />
          <button type="button" className="btn btn-primary" onClick={recordPayment}>
            Record Payment
          </button>
        </div>
      </div>

      <div className="card pay-banner" style={{ marginBottom: 16 }}>
        <div className="pay-banner-left">
          <div className="pay-banner-title">Pay online with Razorpay</div>
          <div className="pay-banner-sub">
            {paymentConfig?.mock
              ? "Demo mode: no Razorpay keys configured — payments are simulated and saved locally."
              : paymentConfig?.configured
                ? "Live Razorpay checkout is enabled."
                : "Configure razorpay.api.key and razorpay.api.secret in application.properties."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
          <Select
            value={razorpayInvoice}
            onChange={(e) => setRazorpayInvoice(e.target.value)}
            placeholder="Invoice for online payment"
            options={unpaidInvoices.map((inv) => ({
              value: String(inv.invoiceId),
              label: `${inv.invoiceNumber} — ${INR.format(inv.grandTotal)}`,
            }))}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={paying || !razorpayInvoice}
            onClick={payWithRazorpay}
          >
            {paying ? "Processing…" : paymentConfig?.mock ? "Demo Pay (Razorpay)" : "Pay with Razorpay"}
          </button>
          {paymentConfig?.mock ? (
            <Badge tone="amber">Demo mode</Badge>
          ) : paymentConfig?.configured ? (
            <Badge tone="green">Live</Badge>
          ) : null}
        </div>
        <div className="pay-icons" style={{ marginTop: 12 }}>
          <span className="pay-icon"><Wallet size={18} /></span>
          <span className="pay-icon"><CreditCard size={18} /></span>
          <span className="pay-icon"><Landmark size={18} /></span>
        </div>
      </div>

      <DataTable
        title="Payment Records"
        subtitle="From payment table"
        columns={[
          { key: "billId", header: "Invoice" },
          { key: "date", header: "Date", searchable: false },
          { key: "customer", header: "Customer" },
          { key: "amount", header: "Amount", align: "right", cell: (v) => INR.format(v), searchable: false },
          { key: "method", header: "Method" },
          {
            key: "status",
            header: "Status",
            cell: (v) => (
              <Badge tone={v === "SUCCESS" ? "green" : "amber"}>{v}</Badge>
            ),
          },
        ]}
        rows={rows}
        rowKey={(r) => `${r.billId}-${r.date}`}
        initialPageSize={10}
      />
    </div>
  );
}

export default Payments;
