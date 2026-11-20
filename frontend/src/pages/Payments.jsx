import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import {
  PageHeader, StatCard, inr, DataTable, Select, TextInput, StatusBadge, ChartCard, Timeline, ProgressBar, Avatar, LoadingSkeleton,
} from "../components/ui";
import "./Payments.css";
import {
  CreditCard, Landmark, Wallet, Banknote, Smartphone, IndianRupee, CalendarDays, HandCoins, AlertOctagon, ShieldOff,
  ShieldCheck, CheckCircle2, XCircle, Clock, Receipt,
} from "lucide-react";
import { paymentsAPI, salesAPI, handleApiError } from "../services/api";
import { openRazorpayCheckout, CheckoutDismissed } from "../utils/razorpay";
import { CHART_COLORS, tooltipProps, inrFull, chartAnimation, chartSurface } from "../utils/chartTheme";

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

const METHOD_ICON = { cash: Banknote, upi: Smartphone, card: CreditCard, wallet: Wallet, netbanking: Landmark, razorpay: ShieldCheck };
const methodIcon = (m) => METHOD_ICON[String(m || "").toLowerCase().replace(/[\s_-]+/g, "")] || IndianRupee;

const pad2 = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function Payments() {
  const [method, setMethod] = useState("");
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [paymentConfig, setPaymentConfig] = useState({ configured: false });
  const [selectedInvoice, setSelectedInvoice] = useState("");
  const [recordMethod, setRecordMethod] = useState("Cash");
  const [recordAmount, setRecordAmount] = useState("");
  const [razorpayInvoice, setRazorpayInvoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  // Synchronous guard so a fast double click cannot record the same payment twice
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    const [payRes, invRes, configRes] = await Promise.allSettled([
      paymentsAPI.getAll(),
      salesAPI.listInvoices(),
      paymentsAPI.getConfig(),
    ]);
    if (payRes.status === "rejected" || invRes.status === "rejected") {
      throw payRes.reason || invRes.reason;
    }
    setPayments(payRes.value.data || []);
    setInvoices(invRes.value.data || []);
    // If config can't be read, online payment simply stays disabled
    setPaymentConfig(configRes.status === "fulfilled" ? configRes.value.data : { configured: false });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (err) {
        setError(handleApiError(err).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const rows = useMemo(() => {
    const mapped = payments.map((p) => ({
      id: p.paymentId,
      billId: p.invoiceNumber || "Balance settlement",
      date: p.paymentDate ? new Date(p.paymentDate).toLocaleString("en-IN") : "—",
      customer: p.customerName || "—",
      amount: Number(p.amountPaid) || 0,
      method: p.paymentMethod || "—",
      reference: p.transactionReference || p.razorpayOrderId || "—",
      status: p.paymentStatus || "—",
    }));
    return method ? mapped.filter((r) => r.method.toLowerCase() === method.toLowerCase()) : mapped;
  }, [payments, method]);

  // Filter choices: the usual methods plus any other method found in the records (e.g. Wallet, NetBanking)
  const methodOptions = useMemo(() => {
    const base = [
      { value: "Cash", label: "Cash" },
      { value: "UPI", label: "UPI" },
      { value: "Card", label: "Card" },
      { value: "RAZORPAY", label: "Razorpay" },
    ];
    const seen = new Set(base.map((o) => o.value.toLowerCase()));
    payments.forEach((p) => {
      const m = (p.paymentMethod || "").trim();
      if (m && !seen.has(m.toLowerCase())) {
        seen.add(m.toLowerCase());
        base.push({ value: m, label: m });
      }
    });
    return base;
  }, [payments]);

  /* ── KPIs, all from real payment / invoice rows ── */
  const kpi = useMemo(() => {
    const now = new Date();
    const today = dayKey(now);
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const yesterday = dayKey(y);
    const month = today.slice(0, 7);
    let todaySum = 0, todayCount = 0, ySum = 0, monthSum = 0, monthCount = 0, failed = 0, pending = 0;
    payments.forEach((p) => {
      const st = String(p.paymentStatus || "").toUpperCase();
      if (st === "FAILED") failed += 1;
      if (st === "CREATED") pending += 1;
      if (st !== "SUCCESS" || !p.paymentDate) return;
      const d = new Date(p.paymentDate);
      if (Number.isNaN(d.getTime())) return;
      const k = dayKey(d);
      const amt = Number(p.amountPaid) || 0;
      if (k === today) { todaySum += amt; todayCount += 1; }
      if (k === yesterday) ySum += amt;
      if (k.slice(0, 7) === month) { monthSum += amt; monthCount += 1; }
    });
    const due = invoices.filter((i) => Number(i.balanceDue) > 0);
    return {
      todaySum, todayCount, monthSum, monthCount, failed, pending,
      // A % change against a near-zero day is noise, so only show moderate changes
      trend: ySum > 0 && Math.abs(((todaySum - ySum) / ySum) * 100) < 1000 ? { value: ((todaySum - ySum) / ySum) * 100, label: "vs yesterday" } : null,
      outstanding: due.reduce((s, i) => s + (Number(i.balanceDue) || 0), 0),
      outstandingCount: due.length,
    };
  }, [payments, invoices]);

  // Successful collections by method (amounts), largest first; colour follows the method, not its rank
  const byMethod = useMemo(() => {
    const map = new Map();
    payments.forEach((p) => {
      if (String(p.paymentStatus || "").toUpperCase() !== "SUCCESS") return;
      const raw = (p.paymentMethod || "Other").trim() || "Other";
      // "CASH" and "Cash" are the same method; show the readable spelling
      const label = raw.length > 3 && raw === raw.toUpperCase() ? raw[0] + raw.slice(1).toLowerCase() : raw;
      const key = raw.toLowerCase();
      const cur = map.get(key) || { name: label, value: 0, count: 0 };
      cur.value += Number(p.amountPaid) || 0;
      cur.count += 1;
      map.set(key, cur);
    });
    const order = [...map.keys()].sort(); // stable colour per method name
    const list = [...map.entries()].map(([k, v]) => ({ ...v, color: CHART_COLORS[order.indexOf(k) % CHART_COLORS.length] }));
    list.sort((a, b) => b.value - a.value);
    // More than 6 methods fold into "Other" so no colour repeats
    if (list.length > 6) {
      const rest = list.splice(5);
      list.push({ name: "Other", value: rest.reduce((s, r) => s + r.value, 0), count: rest.reduce((s, r) => s + r.count, 0), color: "#71717a" });
    }
    return list;
  }, [payments]);
  const collectedTotal = byMethod.reduce((s, m) => s + m.value, 0);

  const recent = useMemo(
    () =>
      payments.slice(0, 6).map((p) => {
        const st = String(p.paymentStatus || "").toUpperCase();
        const Icon = st === "SUCCESS" ? CheckCircle2 : st === "FAILED" ? XCircle : Clock;
        return {
          key: p.paymentId,
          icon: Icon,
          tone: st === "SUCCESS" ? "success" : st === "FAILED" ? "danger" : "info",
          title: (
            <span className="pay-tl-title">
              <b>{INR.format(Number(p.amountPaid) || 0)}</b> · {p.invoiceNumber || "Balance settlement"}
            </span>
          ),
          meta: `${p.paymentMethod || "—"} · ${p.customerName || "—"} · ${p.paymentDate ? new Date(p.paymentDate).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}`,
          right: <StatusBadge status={st || "—"} size="sm" />,
        };
      }),
    [payments]
  );

  // Outstanding amounts come from the server (grand total minus successful payments)
  const unpaidInvoices = useMemo(() => invoices.filter((inv) => Number(inv.balanceDue) > 0), [invoices]);
  const invoiceOptions = unpaidInvoices.map((inv) => ({
    value: String(inv.invoiceId),
    label: `${inv.invoiceNumber} — ${inv.customerName} — due ${INR.format(inv.balanceDue)}`,
  }));
  const selected = unpaidInvoices.find((inv) => String(inv.invoiceId) === selectedInvoice);

  async function recordPayment() {
    if (!selected || inFlight.current) return;
    const amount = recordAmount === "" ? null : Number(recordAmount);
    if (amount != null && (!(amount > 0) || amount > Number(selected.balanceDue))) {
      setNotice({ tone: "red", text: `Amount must be more than 0 and at most ${INR.format(selected.balanceDue)}.` });
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await paymentsAPI.recordPayment({ invoiceId: selected.invoiceId, paymentMethod: recordMethod, amount });
      await load();
      setSelectedInvoice("");
      setRecordAmount("");
      setNotice({ tone: "green", text: `Recorded ${INR.format(res.data.amountPaid)} for ${selected.invoiceNumber}.` });
    } catch (err) {
      setNotice({ tone: "red", text: handleApiError(err).message });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function payWithRazorpay() {
    const inv = unpaidInvoices.find((i) => String(i.invoiceId) === razorpayInvoice);
    if (!inv || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setNotice(null);
    let orderId = null;
    try {
      // The server sets the amount from the invoice's outstanding balance
      const { data: order } = await paymentsAPI.createOrder(inv.invoiceId);
      orderId = order.orderId;
      await openRazorpayCheckout({
        order,
        description: `Invoice ${inv.invoiceNumber}`,
        customerName: inv.customerName === "Walk-in" ? "" : inv.customerName,
        onSuccess: (response) => paymentsAPI.verifyPayment(response),
        onFailure: (reason) => paymentsAPI.reportFailure(orderId, reason).catch(() => {}),
      });
      setRazorpayInvoice("");
      setNotice({ tone: "green", text: `Payment for ${inv.invoiceNumber} verified by the server.` });
    } catch (err) {
      if (!(err instanceof CheckoutDismissed)) {
        setNotice({ tone: "red", text: err.response ? handleApiError(err).message : err.message });
      }
    } finally {
      await load().catch(() => {});
      inFlight.current = false;
      setBusy(false);
    }
  }

  const header = (
    <PageHeader
      icon={CreditCard}
      eyebrow="Finance"
      title="Payments"
      subtitle="Collect outstanding amounts by cash, UPI, card or Razorpay"
      actions={
        loading || error ? null : (
          <div className="pay-filter">
            <Select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="All methods"
              aria-label="Filter method"
              options={methodOptions}
            />
            {method ? (
              <button type="button" className="btn" onClick={() => setMethod("")}>
                Show all
              </button>
            ) : null}
          </div>
        )
      }
    />
  );

  if (loading) {
    return (
      <div className="mb-page pay">
        {header}
        <LoadingSkeleton variant="stats" rows={4} label="Loading payments..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-page pay">
        {header}
        <p className="pay-notice pay-notice-red">{error}</p>
      </div>
    );
  }

  const paidShare = selected ? Number(selected.amountPaid) || 0 : 0;

  return (
    <div className="mb-page pay">
      {header}

      {notice ? <div className={`pay-notice pay-notice-${notice.tone}`} role="status">{notice.text}</div> : null}

      <div className="mb-grid-stats mb-stagger">
        <StatCard icon={IndianRupee} tone="teal" label="Collected today" value={kpi.todaySum} format={inr}
          trend={kpi.trend || undefined} hint={`${kpi.todayCount} successful payment${kpi.todayCount === 1 ? "" : "s"}`} testId="kpi-today" />
        <StatCard icon={CalendarDays} tone="navy" label="Collected this month" value={kpi.monthSum} format={inr}
          hint={`${kpi.monthCount} successful payment${kpi.monthCount === 1 ? "" : "s"}`} testId="kpi-month" />
        <StatCard icon={HandCoins} tone="warning" label="Outstanding" value={kpi.outstanding} format={inr}
          hint={`${kpi.outstandingCount} invoice${kpi.outstandingCount === 1 ? "" : "s"} with balance due`} testId="kpi-outstanding" />
        <StatCard icon={AlertOctagon} tone="danger" label="Failed attempts" value={kpi.failed}
          hint={kpi.pending ? `${kpi.pending} awaiting payment` : "Online payment attempts"} testId="kpi-failed" />
      </div>

      <div className="pay-grid">
        <ChartCard title="Collection by method" subtitle="Successful payments, all time" height={240} testId="pay-method-chart">
          {byMethod.length === 0 ? (
            <div className="pay-empty"><Receipt size={22} aria-hidden="true" /> No successful payments recorded yet.</div>
          ) : (
            <div className="pay-donut">
              <div className="pay-donut-chart">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={byMethod} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={byMethod.length > 1 ? 2 : 0}
                      stroke={chartSurface()} strokeWidth={2} {...chartAnimation()}>
                      {byMethod.map((m) => <Cell key={m.name} fill={m.color} />)}
                    </Pie>
                    <Tooltip {...tooltipProps} formatter={(v, n) => [inrFull(v), n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pay-donut-center" aria-hidden="true">
                  <span>Collected</span>
                  <b>{inr(collectedTotal)}</b>
                </div>
              </div>
              <ul className="pay-legend" aria-label="Collection by method">
                {byMethod.map((m) => {
                  const Icon = methodIcon(m.name);
                  return (
                    <li key={m.name}>
                      <span className="pay-legend-dot" style={{ background: m.color }} aria-hidden="true" />
                      <Icon size={16} aria-hidden="true" className="pay-legend-icon" />
                      <span className="pay-legend-name">{m.name}</span>
                      <span className="pay-legend-nums">
                        <span className="pay-legend-val">{inrFull(m.value)}</span>
                        <span className="pay-legend-pct">{collectedTotal > 0 ? `${((m.value / collectedTotal) * 100).toFixed(1)}%` : "—"} · {m.count}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </ChartCard>

        <section className="card pay-card">
          <div className="pay-card-head">
            <span className="pay-card-icon pay-card-icon--purple" aria-hidden="true"><Clock size={18} /></span>
            <div>
              <h3 className="pay-card-title">Recent activity</h3>
              <p className="pay-card-sub">Latest {recent.length} payment attempts</p>
            </div>
          </div>
          {recent.length ? <Timeline items={recent} /> : <div className="pay-empty"><Receipt size={22} aria-hidden="true" /> Nothing recorded yet.</div>}
        </section>
      </div>

      <div className="pay-grid">
        <section className="card pay-card pay-record">
          <div className="pay-card-head">
            <span className="pay-card-icon" aria-hidden="true"><HandCoins size={18} /></span>
            <div>
              <h3 className="pay-card-title pay-banner-title">Record payment for an invoice</h3>
              <p className="pay-card-sub pay-banner-sub">
                {unpaidInvoices.length ? `${unpaidInvoices.length} invoice(s) have a balance due.` : "No invoices have a balance due."}
              </p>
            </div>
          </div>
          <div className="pay-form">
            <Select
              value={selectedInvoice}
              onChange={(e) => setSelectedInvoice(e.target.value)}
              placeholder="Select invoice with balance due"
              aria-label="Invoice with balance due"
              options={invoiceOptions}
            />
            {selected ? (
              <div className="pay-selected">
                <Avatar name={selected.customerName || "?"} size={36} />
                <div className="pay-selected-main">
                  <div className="pay-selected-top">
                    <b>{selected.customerName}</b>
                    <StatusBadge status={selected.paymentStatus} size="sm" />
                  </div>
                  <ProgressBar value={paidShare} max={Number(selected.grandTotal) || 0} tone="success" size="sm" label="Share of invoice already paid" />
                  <div className="pay-selected-nums">
                    <span>Paid {INR.format(paidShare)} of {INR.format(selected.grandTotal)}</span>
                    <b>Due {INR.format(selected.balanceDue)}</b>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="pay-form-row">
              <Select
                value={recordMethod}
                onChange={(e) => setRecordMethod(e.target.value)}
                aria-label="Payment method"
                options={[
                  { value: "Cash", label: "Cash" },
                  { value: "UPI", label: "UPI" },
                  { value: "Card", label: "Card" },
                ]}
              />
              <TextInput
                type="number"
                min="0"
                step="0.01"
                value={recordAmount}
                onChange={(e) => setRecordAmount(e.target.value)}
                placeholder={selected ? `Full: ${Number(selected.balanceDue).toFixed(2)}` : "Amount"}
                aria-label="Amount"
              />
            </div>
            <button type="button" className="btn btn-primary pay-record-btn" onClick={recordPayment} disabled={!selected || busy}>
              <CheckCircle2 size={16} /> Record Payment
            </button>
          </div>
        </section>

        <section className={`card pay-card pay-rzp ${paymentConfig.configured ? "is-on" : "is-off"}`} role="region" aria-label="Razorpay online payment">
          <div className="pay-card-head">
            <span className={`pay-card-icon ${paymentConfig.configured ? "" : "pay-card-icon--muted"}`} aria-hidden="true">
              {paymentConfig.configured ? <ShieldCheck size={18} /> : <ShieldOff size={18} />}
            </span>
            <div className="pay-rzp-titles">
              <h3 className="pay-card-title">Pay online with Razorpay</h3>
              {paymentConfig.configured ? (
                <StatusBadge status="SUCCESS" label="Enabled" size="sm" />
              ) : (
                <StatusBadge status="NOT_CONFIGURED" label="Not configured" size="sm" />
              )}
            </div>
          </div>
          <p className="pay-card-sub">
            {paymentConfig.configured
              ? "Opens Razorpay checkout; the payment is recorded only after the server verifies Razorpay's signature."
              : "Online payments are off. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (test keys: rzp_test_…) on the backend to enable them."}
          </p>
          {paymentConfig.configured ? (
            <div className="pay-form-row">
              <Select
                value={razorpayInvoice}
                onChange={(e) => setRazorpayInvoice(e.target.value)}
                placeholder="Invoice for online payment"
                aria-label="Invoice for online payment"
                options={invoiceOptions}
              />
              <button type="button" className="btn btn-primary" disabled={busy || !razorpayInvoice} onClick={payWithRazorpay}>
                {busy ? "Processing…" : "Pay with Razorpay"}
              </button>
            </div>
          ) : (
            <ol className="pay-rzp-steps">
              <li>Create test keys in the Razorpay dashboard.</li>
              <li>Add them to the backend environment and restart it.</li>
              <li>Reload this page — the online checkout appears here.</li>
            </ol>
          )}
          <div className="pay-icons" aria-hidden="true">
            <span className="pay-icon"><Smartphone size={16} /></span>
            <span className="pay-icon"><CreditCard size={16} /></span>
            <span className="pay-icon"><Wallet size={16} /></span>
            <span className="pay-icon"><Landmark size={16} /></span>
          </div>
        </section>
      </div>

      <DataTable
        title="Payment Records"
        subtitle="Every payment attempt, including failed online payments"
        columns={[
          { key: "billId", header: "Invoice", cell: (v) => <span className="pay-inv">{v}</span> },
          { key: "date", header: "Date", searchable: false },
          { key: "customer", header: "Customer" },
          { key: "amount", header: "Amount", align: "right", cell: (v) => <b className="pay-amt">{INR.format(v)}</b>, searchable: false },
          {
            key: "method",
            header: "Method",
            cell: (v) => {
              const Icon = methodIcon(v);
              return <span className="pay-method"><Icon size={14} aria-hidden="true" />{v}</span>;
            },
          },
          { key: "reference", header: "Reference", cell: (v) => <span className="pay-ref">{v}</span> },
          { key: "status", header: "Status", cell: (v) => <StatusBadge status={v} label={v} size="sm" /> },
        ]}
        rows={rows}
        rowKey={(r) => r.id}
        initialPageSize={10}
      />
    </div>
  );
}

export default Payments;
