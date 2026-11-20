import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgePercent,
  Calculator,
  CheckCircle2,
  Coins,
  FileStack,
  IndianRupee,
  Landmark,
  PiggyBank,
  ReceiptText,
  Scale,
  Wallet,
} from "lucide-react";
import { PageHeader, StatusBadge, EmptyState, LoadingSkeleton, DataTable } from "../components/ui";
import { accountingAPI, salesAPI, handleApiError } from "../services/api";
import { withTimeout } from "./insights/useSections";
import SectionError from "./insights/SectionError";
import { num, money } from "./insights/insightsUtils";
import "./Accounting.css";

const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
];

function inPeriod(value, period) {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  if (period === "today") return d.toDateString() === now.toDateString();
  if (period === "month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  return d.getFullYear() === now.getFullYear();
}

const pct = (part, whole) => (whole > 0 ? Math.max(0, Math.min(100, (part / whole) * 100)) : 0);

/** 100% stacked bar built from real totals. segments: [{label, value, tone}] */
function StackBar({ label, segments, total }) {
  return (
    <div className="acc-stack">
      <div className="acc-stack__bar" role="img" aria-label={`${label}: ${segments.map((s) => `${s.label} ${money(s.value)}`).join(", ")}`}>
        {segments.map((s) => (
          <span key={s.label} className={`acc-stack__seg acc-stack__seg--${s.tone}`} style={{ flexGrow: Math.max(0, s.value) }} />
        ))}
      </div>
      <ul className="acc-stack__legend">
        {segments.map((s) => (
          <li key={s.label}>
            <span className={`acc-dot acc-dot--${s.tone}`} aria-hidden="true" />
            <span className="acc-stack__name">{s.label}</span>
            <span className="acc-stack__val">
              {money(s.value)} <small>{pct(s.value, total).toFixed(1)}%</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Accounting() {
  const [period, setPeriod] = useState("today");
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [invoicesError, setInvoicesError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p) => {
    setLoading(true);
    const [summaryRes, invoicesRes] = await Promise.allSettled([
      withTimeout(accountingAPI.getSummary(p)),
      withTimeout(salesAPI.listInvoices()),
    ]);
    if (summaryRes.status === "fulfilled") {
      setSummary(summaryRes.value.data || null);
      setSummaryError(null);
    } else {
      setSummary(null);
      setSummaryError(handleApiError(summaryRes.reason).message);
    }
    if (invoicesRes.status === "fulfilled") {
      setInvoices(Array.isArray(invoicesRes.value.data) ? invoicesRes.value.data : []);
      setInvoicesError(null);
    } else {
      setInvoicesError(handleApiError(invoicesRes.reason).message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(period);
  }, [period, load]);

  const rows = useMemo(
    () =>
      invoices
        .filter((inv) => inPeriod(inv.saleDateTime, period))
        .map((inv) => ({
          invoiceId: inv.invoiceId,
          invoiceNumber: inv.invoiceNumber,
          date: inv.saleDateTime ? new Date(inv.saleDateTime).toLocaleDateString("en-IN") : "-",
          customerName: inv.customerName || "Walk-in",
          taxable: num(inv.totalTaxableAmount),
          cgst: num(inv.totalCgst),
          sgst: num(inv.totalSgst),
          total: num(inv.grandTotal),
          balanceDue: num(inv.balanceDue),
          paymentStatus: inv.paymentStatus || "-",
        })),
    [invoices, period]
  );

  const columns = useMemo(
    () => [
      { key: "invoiceNumber", header: "Invoice" },
      { key: "date", header: "Date", searchable: false },
      { key: "customerName", header: "Customer" },
      { key: "taxable", header: "Taxable", align: "right", cell: (v) => money(v), searchable: false },
      { key: "cgst", header: "CGST", align: "right", cell: (v) => money(v), searchable: false },
      { key: "sgst", header: "SGST", align: "right", cell: (v) => money(v), searchable: false },
      { key: "total", header: "Total", align: "right", cell: (v) => money(v), searchable: false },
      { key: "balanceDue", header: "Balance Due", align: "right", cell: (v) => money(v), searchable: false },
      { key: "paymentStatus", header: "Payment", cell: (v) => <StatusBadge status={v} size="sm" /> },
    ],
    []
  );

  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label;
  const taxable = num(summary?.totalTaxable);
  const cgst = num(summary?.totalCgst);
  const sgst = num(summary?.totalSgst);
  const grand = num(summary?.grandTotal);
  const cost = num(summary?.totalCost);
  const profit = num(summary?.profit);
  const margin = taxable > 0 ? ((profit / taxable) * 100).toFixed(2) : null;
  const reconciled = taxable + cgst + sgst;
  const diff = grand - reconciled;

  const cards = summary
    ? [
        { label: "Invoices", value: Number(summary.invoiceCount || 0).toLocaleString("en-IN"), icon: FileStack, tone: "ice", hint: `Bills in ${periodLabel?.toLowerCase()}` },
        { label: "Total Sales", value: money(summary.grandTotal), icon: IndianRupee, tone: "teal", hint: "Grand total, GST included" },
        { label: "Total Taxable", value: money(summary.totalTaxable), icon: Landmark, tone: "navy", hint: "Value before GST" },
        { label: "Total CGST", value: money(summary.totalCgst), icon: ReceiptText, tone: "lavender", hint: "Central GST" },
        { label: "Total SGST", value: money(summary.totalSgst), icon: ReceiptText, tone: "lavender", hint: "State GST" },
        { label: "Total GST", value: money(summary.totalGst), icon: Coins, tone: "warning", hint: "CGST + SGST" },
        { label: "Total Cost", value: money(summary.totalCost), icon: Wallet, tone: "coral", hint: "Purchase cost of goods sold" },
        { label: "Profit", value: money(summary.profit), icon: PiggyBank, tone: profit >= 0 ? "mint" : "danger", hint: "Taxable value minus cost", className: profit >= 0 ? "profit" : "loss" },
        { label: "Margin on Taxable", value: margin !== null ? `${margin}%` : "-", icon: BadgePercent, tone: "mint", hint: "Profit ÷ taxable value" },
      ]
    : [];

  return (
    <div className="mb-page accounting">
      <PageHeader
        icon={Calculator}
        eyebrow="Finance & insights"
        title="Tax & Financial Accounting"
        subtitle="Sales, GST breakup and profit (taxable value minus cost, GST excluded)"
        actions={
          <div className="ins-seg" role="group" aria-label="Period">
            {PERIOD_OPTIONS.map((o) => (
              <button key={o.value} type="button" aria-pressed={period === o.value} onClick={() => setPeriod(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        }
      />

      {summaryError && (
        <SectionError
          title={`Could not load the ${periodLabel?.toLowerCase()} summary`}
          message={summaryError}
          onRetry={() => load(period)}
        />
      )}
      {invoicesError && <SectionError title="Could not load invoices" message={invoicesError} onRetry={() => load(period)} />}

      {loading && !summary && !summaryError ? (
        <LoadingSkeleton variant="stats" rows={8} label="Loading accounting summary" />
      ) : cards.length > 0 ? (
        <section className={`accounting-summary mb-stagger ${loading ? "is-loading" : ""}`} aria-label={`${periodLabel} summary`} aria-busy={loading || undefined}>
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div className={`mb-stat mb-stat--${c.tone} summary-card`} key={c.label} data-testid={`acc-card-${c.label}`}>
                <div className="mb-stat__top">
                  <span className="mb-stat__label summary-label">{c.label}</span>
                  <span className="mb-stat__icon" aria-hidden="true">
                    <Icon size={18} />
                  </span>
                </div>
                <div className={`mb-stat__value summary-value ${c.className || ""}`}>{c.value}</div>
                <div className="mb-stat__hint">{c.hint}</div>
              </div>
            );
          })}
        </section>
      ) : null}

      {summary && (
        <section className="card ins-card acc-split" aria-label="Taxable and GST split">
          <div className="ins-card__head">
            <div className="ins-card__title">
              <span className="ins-card__icon ins-card__icon--purple" aria-hidden="true">
                <Scale size={18} />
              </span>
              <div>
                <h3>Where the money goes ({periodLabel})</h3>
                <p>Grand total split into taxable value and GST, and taxable value split into cost and profit</p>
              </div>
            </div>
          </div>
          {grand <= 0 && taxable <= 0 ? (
            <EmptyState compact icon={Scale} title="No sales in this period" message={`No invoices for ${periodLabel?.toLowerCase()} yet.`} />
          ) : (
            <div className="acc-split__grid">
              <div className="acc-split__col">
                <h4>Grand total {money(grand)}</h4>
                <StackBar
                  label="Grand total split"
                  total={reconciled}
                  segments={[
                    { label: "Taxable", value: taxable, tone: "teal" },
                    { label: "CGST", value: cgst, tone: "purple" },
                    { label: "SGST", value: sgst, tone: "info" },
                  ]}
                />
              </div>
              <div className="acc-split__col">
                <h4>Taxable value {money(taxable)}</h4>
                <StackBar
                  label="Taxable value split"
                  total={taxable}
                  segments={
                    profit >= 0
                      ? [
                          { label: "Cost", value: cost, tone: "navy" },
                          { label: "Profit", value: profit, tone: "success" },
                        ]
                      : [{ label: "Cost", value: cost, tone: "navy" }]
                  }
                />
                {profit < 0 ? <p className="ins-note acc-loss">Loss of {money(Math.abs(profit))}: cost exceeds taxable value.</p> : null}
              </div>
            </div>
          )}
          <p className={`acc-recon ${Math.abs(diff) < 0.05 * Math.max(1, num(summary.invoiceCount)) ? "is-ok" : "is-off"}`}>
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>
              Reconciliation: taxable {money(taxable)} + CGST {money(cgst)} + SGST {money(sgst)} = {money(reconciled)}; grand total{" "}
              {money(grand)}
              {Math.abs(diff) >= 0.005 ? ` (difference ${money(diff)} from per-line rounding)` : " (matches)"}.
            </span>
          </p>
        </section>
      )}

      {loading && invoices.length === 0 && !invoicesError ? (
        <LoadingSkeleton variant="table" rows={5} label="Loading invoices" />
      ) : !invoicesError && rows.length === 0 && !loading ? (
        <div className="card accounting-empty">
          <EmptyState icon={ReceiptText} title={`No invoices for ${periodLabel?.toLowerCase()}`} message="Bills you create appear here with their GST breakup." />
        </div>
      ) : (
        <div className="accounting-table">
          <DataTable
            title="Sales Report with GST Breakup"
            subtitle={`Invoices for ${periodLabel}`}
            columns={columns}
            rows={rows}
            initialPageSize={15}
            rowKey={(r) => r.invoiceId}
          />
        </div>
      )}
    </div>
  );
}

export default Accounting;
