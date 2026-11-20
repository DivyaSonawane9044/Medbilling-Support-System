import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar,
  DataTable,
  EmptyState,
  FormField,
  LoadingSkeleton,
  Modal,
  PageHeader,
  StatCard,
  StatusBadge,
  TextInput,
  inr,
  inr2,
} from "../components/ui";
import {
  Boxes,
  Building2,
  CheckCircle2,
  ChevronRight,
  HandCoins,
  Landmark,
  PackageCheck,
  Pencil,
  Phone,
  ReceiptIndianRupee,
  Search,
  ShieldCheck,
  Truck,
  Wallet,
} from "lucide-react";
import { suppliersAPI, handleApiError } from "../services/api";
import { Msg } from "./people/Dosage";
import "./people/people.css";
import "./Suppliers.css";

const money = inr2;
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString("en-IN") : "—");
const ITEMS_PER_INVOICE = 6;

const EMPTY_SUPPLIER = { name: "", contactNumber: "", company: "", gstIn: "" };
// Must match SupplierService.GSTIN_REGEX (13th char is 1-9 or A-Z, never 0).
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** ledgerBalance > 0 means we owe the supplier; < 0 means we paid in advance. */
function balanceInfo(raw) {
  const b = Number(raw) || 0;
  if (b > 0) return { tone: "warning", kind: "owe", text: `We owe ${money(b)}` };
  if (b < 0) return { tone: "info", kind: "advance", text: `Advance ${money(-b)}` };
  return { tone: "success", kind: "settled", text: "Settled" };
}

function validateSupplier(form) {
  if (!form.name.trim()) return "Supplier name is required.";
  const gst = form.gstIn.trim().toUpperCase();
  if (gst && !GSTIN_RE.test(gst)) return "GSTIN format looks wrong (expected e.g. 27ABCDE1234F1Z5).";
  return null;
}

function supplierPayload(form) {
  return {
    name: form.name.trim(),
    contactNumber: form.contactNumber.trim(),
    company: form.company.trim(),
    gstIn: form.gstIn.trim().toUpperCase() || null,
  };
}

/** Live GSTIN hint under the field: format check only, the save still validates. */
function gstinHint(value) {
  const v = value.trim().toUpperCase();
  if (!v) return "Optional";
  if (GSTIN_RE.test(v)) return "Format OK";
  return `${v.length}/15 characters`;
}

function SupplierFields({ value, onChange, prefix }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });
  return (
    <div className="sup-form-grid">
      <FormField label="Supplier Name" required>
        <TextInput value={value.name} onChange={set("name")} placeholder="Supplier name" aria-label={`${prefix} name`} />
      </FormField>
      <FormField label="Contact">
        <TextInput value={value.contactNumber} onChange={set("contactNumber")} placeholder="Phone number" inputMode="tel" aria-label={`${prefix} contact`} />
      </FormField>
      <FormField label="Company">
        <TextInput value={value.company} onChange={set("company")} placeholder="Company name" aria-label={`${prefix} company`} />
      </FormField>
      <FormField label="GSTIN" hint={gstinHint(value.gstIn)}>
        <TextInput
          value={value.gstIn}
          onChange={set("gstIn")}
          placeholder="27ABCDE1234F1Z5"
          maxLength={15}
          className="ti pp-mono sup-gstin-input"
          aria-label={`${prefix} GSTIN`}
        />
      </FormField>
    </div>
  );
}

function BalanceChip({ value }) {
  const b = balanceInfo(value);
  return (
    <span className={`pp-chip pp-chip--${b.tone}`}>
      {b.kind === "settled" ? <CheckCircle2 size={12} aria-hidden="true" /> : null}
      {b.text}
    </span>
  );
}

function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [allSuppliers, setAllSuppliers] = useState([]); // unfiltered, for the summary cards
  const [statsLoading, setStatsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [listError, setListError] = useState(null);
  const requestId = useRef(0);
  const detailRef = useRef(null);

  const [newSupplier, setNewSupplier] = useState(EMPTY_SUPPLIER);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_SUPPLIER);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editMsg, setEditMsg] = useState(null);
  const [detailMsg, setDetailMsg] = useState(null);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [payMsg, setPayMsg] = useState(null);

  const refreshStats = useCallback(async () => {
    try {
      const res = await suppliersAPI.getAll();
      const data = res.data?.content ?? res.data ?? [];
      setAllSuppliers(Array.isArray(data) ? data : []);
    } catch {
      /* directory shows its own error */
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadSuppliers = useCallback(async (term) => {
    const id = ++requestId.current;
    setSearching(true);
    try {
      const response = await suppliersAPI.getAll(term || undefined);
      if (id !== requestId.current) return;
      const data = response.data?.content ?? response.data ?? [];
      const list = Array.isArray(data) ? data : [];
      setSuppliers(list);
      if (!term) {
        setAllSuppliers(list);
        setStatsLoading(false);
      }
      setListError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setListError(handleApiError(err).message);
      setStatsLoading(false);
    } finally {
      if (id === requestId.current) {
        setSearching(false);
        setInitialLoading(false);
      }
    }
  }, []);

  // Debounced search; only the table area reflects loading so the input keeps focus.
  useEffect(() => {
    const t = setTimeout(() => loadSuppliers(searchTerm.trim()), 250);
    return () => clearTimeout(t);
  }, [searchTerm, loadSuppliers]);

  const loadHistory = useCallback(async (id) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await suppliersAPI.getHistory(id);
      setHistory(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setHistory([]);
      setHistoryError(handleApiError(err).message);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  function openSupplier(id) {
    setSelectedId(id);
    setEditing(false);
    setEditMsg(null);
    setDetailMsg(null);
    setPayMsg(null);
    setPaymentAmount("");
    setHistory([]);
    loadHistory(id);
    if (typeof window !== "undefined" && window.matchMedia?.("(max-width: 1099px)").matches) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      requestAnimationFrame(() => detailRef.current?.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", block: "start" }));
    }
  }

  // Keep the open supplier visible even when a later search no longer lists it.
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const listed = useMemo(() => suppliers.find((s) => s.supplierId === selectedId) || null, [suppliers, selectedId]);
  useEffect(() => {
    if (listed) setSelectedSnapshot(listed);
  }, [listed]);
  const selected = listed || (selectedSnapshot?.supplierId === selectedId ? selectedSnapshot : null);

  const stats = useMemo(() => {
    let payable = 0;
    let payableCount = 0;
    let advance = 0;
    let advanceCount = 0;
    allSuppliers.forEach((s) => {
      const b = Number(s.ledgerBalance) || 0;
      if (b > 0) {
        payable += b;
        payableCount += 1;
      } else if (b < 0) {
        advance += -b;
        advanceCount += 1;
      }
    });
    return {
      total: allSuppliers.length,
      payable,
      payableCount,
      advance,
      advanceCount,
      withGstin: allSuppliers.filter((s) => s.gstIn).length,
    };
  }, [allSuppliers]);

  const historyTotals = useMemo(() => {
    const received = history.filter((h) => h.status === "RECEIVED");
    return {
      invoices: history.length,
      purchased: received.reduce((s, h) => s + (Number(h.totalAmount) || 0), 0),
      batches: history.reduce((s, h) => s + (h.items || []).length, 0),
    };
  }, [history]);

  async function handleCreateSupplier(event) {
    event.preventDefault();
    const problem = validateSupplier(newSupplier);
    if (problem) {
      setCreateMsg({ type: "error", text: problem });
      return;
    }
    try {
      setCreating(true);
      setCreateMsg(null);
      const response = await suppliersAPI.create(supplierPayload(newSupplier));
      setSuppliers((prev) => [response.data, ...prev]);
      setNewSupplier(EMPTY_SUPPLIER);
      setCreateMsg({ type: "success", text: `Supplier "${response.data?.name}" added.` });
      refreshStats();
    } catch (err) {
      setCreateMsg({ type: "error", text: handleApiError(err).message });
    } finally {
      setCreating(false);
    }
  }

  function startEdit() {
    if (!selected) return;
    setEditForm({
      name: selected.name || "",
      contactNumber: selected.contactNumber || "",
      company: selected.company || "",
      gstIn: selected.gstIn || "",
    });
    setEditMsg(null);
    setDetailMsg(null);
    setEditing(true);
  }

  async function handleUpdate(event) {
    event.preventDefault();
    const problem = validateSupplier(editForm);
    if (problem) {
      setEditMsg({ type: "error", text: problem });
      return;
    }
    try {
      setSavingEdit(true);
      setEditMsg(null);
      const response = await suppliersAPI.update(selectedId, supplierPayload(editForm));
      if (response.data?.supplierId) {
        setSelectedSnapshot(response.data);
        setSuppliers((prev) => prev.map((s) => (s.supplierId === selectedId ? response.data : s)));
      } else {
        await loadSuppliers(searchTerm.trim());
      }
      setEditing(false);
      setDetailMsg({ type: "success", text: "Supplier details updated." });
      refreshStats();
    } catch (err) {
      setEditMsg({ type: "error", text: handleApiError(err).message });
    } finally {
      setSavingEdit(false);
    }
  }

  async function addSupplierPayment(event) {
    event.preventDefault();
    if (!selected) return;
    const amt = Number(paymentAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setPayMsg({ type: "error", text: "Enter a payment amount greater than 0." });
      return;
    }
    try {
      setPaying(true);
      setPayMsg(null);
      const res = await suppliersAPI.processPayment(selected.supplierId, amt);
      setPaymentAmount("");
      const after = res.data?.ledgerBalance;
      if (after != null) {
        setSelectedSnapshot((prev) => (prev && prev.supplierId === selected.supplierId ? { ...prev, ledgerBalance: after } : prev));
        setSuppliers((prev) => prev.map((s) => (s.supplierId === selected.supplierId ? { ...s, ledgerBalance: after } : s)));
      }
      await loadSuppliers(searchTerm.trim());
      refreshStats();
      setPayMsg({
        type: "success",
        text: `Payment of ${money(amt)} recorded.${after != null ? ` Balance now: ${balanceInfo(after).text}.` : ""}`,
      });
    } catch (err) {
      setPayMsg({ type: "error", text: handleApiError(err).message });
    } finally {
      setPaying(false);
    }
  }

  const selectedBalance = balanceInfo(selected?.ledgerBalance);

  return (
    <div className="mb-page sup">
      <PageHeader
        icon={Truck}
        eyebrow="People"
        title="Suppliers"
        subtitle="Supplier directory, ledger balances, purchase history and payments."
      />

      <section className="mb-grid-stats mb-stagger" aria-label="Supplier summary">
        <StatCard
          icon={Building2}
          label="Total suppliers"
          value={stats.total}
          tone="navy"
          loading={statsLoading}
          hint={`${stats.withGstin} with GSTIN on file`}
        />
        <StatCard
          icon={Wallet}
          label="Total payable"
          value={stats.payable}
          format={inr}
          tone="warning"
          loading={statsLoading}
          hint={stats.payableCount ? `We owe ${stats.payableCount} supplier${stats.payableCount === 1 ? "" : "s"}` : "Nothing owed"}
        />
        <StatCard
          icon={HandCoins}
          label="Advances paid"
          value={stats.advance}
          format={inr}
          tone="ice"
          loading={statsLoading}
          hint={stats.advanceCount ? `${stats.advanceCount} supplier${stats.advanceCount === 1 ? "" : "s"} in advance` : "No advances"}
        />
        <StatCard
          icon={CheckCircle2}
          label="Settled accounts"
          value={stats.total - stats.payableCount - stats.advanceCount}
          tone="mint"
          loading={statsLoading}
          hint="Ledger balance is zero"
        />
      </section>

      <div className="sup-grid">
        <div className="sup-list">
          <div className="card sup-search-card">
            <div className="sup-search">
              <Search size={18} className="sup-search__icon" aria-hidden="true" />
              <TextInput
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search suppliers by name or company"
                aria-label="Search suppliers"
              />
              {searching && !initialLoading && <span className="sup-searching">Searching…</span>}
            </div>
          </div>

          {initialLoading ? (
            <div className="card sup-state">
              <LoadingSkeleton variant="table" rows={5} label="Loading suppliers" />
            </div>
          ) : listError ? (
            <div className="card sup-state">
              <Msg msg={{ type: "error", text: `Could not load suppliers: ${listError}` }} />
              <button className="btn" type="button" onClick={() => loadSuppliers(searchTerm.trim())}>
                Retry
              </button>
            </div>
          ) : (
            <div className={`sup-directory ${searching ? "sup-table-busy" : ""}`}>
              <DataTable
                title="Supplier List"
                subtitle={
                  searching
                    ? "Searching…"
                    : suppliers.length === 0
                      ? searchTerm.trim()
                        ? "No suppliers match your search."
                        : "No suppliers yet. Add one below."
                      : "Click View to see the ledger and purchase history"
                }
                columns={[
                  {
                    key: "name",
                    header: "Supplier",
                    cell: (v, r) => (
                      <div className="sup-name">
                        <Avatar name={v || ""} size={36} />
                        <div className="sup-name-text">
                          <div className="sup-name-main">{v}</div>
                          <div className="sup-name-sub">
                            {r.company ? <span>{r.company}</span> : null}
                            {r.contactNumber ? (
                              <span>
                                <Phone size={11} aria-hidden="true" /> {r.contactNumber}
                              </span>
                            ) : null}
                            {!r.company && !r.contactNumber && !r.gstIn ? <span>No details</span> : null}
                          </div>
                          {r.gstIn ? <span className="sup-gstin-chip pp-mono">GSTIN {r.gstIn}</span> : null}
                          {/* phones: the Balance column is hidden, so show the ledger chip here */}
                          <span className="sup-name-balance">
                            <BalanceChip value={r.ledgerBalance} />
                          </span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "ledgerBalance",
                    header: "Balance",
                    align: "right",
                    searchable: false,
                    cell: (v) => <BalanceChip value={v} />,
                  },
                  {
                    key: "action",
                    header: "",
                    searchable: false,
                    sortable: false,
                    cell: (_v, r) => (
                      <button
                        className={`btn btn-sm sup-view-btn ${r.supplierId === selectedId ? "is-active" : ""}`}
                        type="button"
                        onClick={() => openSupplier(r.supplierId)}
                      >
                        View <ChevronRight size={14} aria-hidden="true" />
                      </button>
                    ),
                  },
                ]}
                rows={suppliers}
                rowKey={(r) => r.supplierId}
                searchable={false}
                initialPageSize={10}
              />
            </div>
          )}

          <form className="sup-form card" onSubmit={handleCreateSupplier} noValidate>
            <div className="pp-card-head">
              <span className="pp-card-head__icon pp-card-head__icon--navy" aria-hidden="true">
                <Building2 size={18} />
              </span>
              <div className="pp-card-head__text">
                <h3>Add Supplier</h3>
                <p>GSTIN is optional; when given it must match the 15-character format.</p>
              </div>
            </div>
            <SupplierFields value={newSupplier} onChange={setNewSupplier} prefix="New supplier" />
            <Msg msg={createMsg} />
            <button className="btn btn-primary" type="submit" disabled={creating}>
              {creating ? "Adding…" : "Add Supplier"}
            </button>
          </form>
        </div>

        <div className="card sup-detail" ref={detailRef}>
          {!selected ? (
            <EmptyState
              icon={Landmark}
              title="Select a supplier"
              message={selectedId ? "This supplier is not in the current search results." : "Open a supplier to see the ledger and purchase history."}
            />
          ) : (
            <div className="sup-detail-inner mb-animate-in" key={selected.supplierId}>
              <div className="sup-detail-head">
                <div className="sup-profile">
                  <Avatar name={selected.name || ""} size={56} />
                  <div className="sup-profile__text">
                    <h3 className="sup-detail-title">{selected.name}</h3>
                    <div className="sup-contact">
                      {selected.company && (
                        <span>
                          <Building2 size={14} aria-hidden="true" /> {selected.company}
                        </span>
                      )}
                      {selected.contactNumber && (
                        <span>
                          <Phone size={14} aria-hidden="true" /> {selected.contactNumber}
                        </span>
                      )}
                      {!selected.company && !selected.contactNumber && <span>No contact details</span>}
                    </div>
                    {selected.gstIn ? (
                      <span className="sup-gstin-chip sup-gstin-chip--lg pp-mono">
                        <ShieldCheck size={13} aria-hidden="true" /> GSTIN: {selected.gstIn}
                      </span>
                    ) : (
                      <span className="sup-gstin-missing">No GSTIN on file</span>
                    )}
                  </div>
                </div>
                <div className={`sup-ledger-card sup-ledger-card--${selectedBalance.kind}`}>
                  <span className="sup-ledger-card__cap">Ledger balance</span>
                  <strong className="sup-ledger-card__val">{selectedBalance.text}</strong>
                </div>
              </div>

              <div className="sup-actions">
                <button className="btn" type="button" onClick={startEdit} disabled={editing}>
                  <Pencil size={14} /> Edit
                </button>
              </div>
              <Msg msg={detailMsg} />

              <div className="sup-kpis">
                <div className="sup-kpi">
                  <span className="sup-kpi__cap">Purchase invoices</span>
                  <strong>{historyLoading ? "…" : historyTotals.invoices}</strong>
                </div>
                <div className="sup-kpi">
                  <span className="sup-kpi__cap">Received value</span>
                  <strong>{historyLoading ? "…" : money(historyTotals.purchased)}</strong>
                </div>
                <div className="sup-kpi">
                  <span className="sup-kpi__cap">Batches supplied</span>
                  <strong>{historyLoading ? "…" : historyTotals.batches}</strong>
                </div>
              </div>

              <form className="sup-pay" onSubmit={addSupplierPayment} noValidate>
                <div className="pp-card-head">
                  <span className="pp-card-head__icon" aria-hidden="true">
                    <ReceiptIndianRupee size={18} />
                  </span>
                  <div className="pp-card-head__text">
                    <h4>Record payment</h4>
                    <p>Paying more than the balance is kept as an advance.</p>
                  </div>
                </div>
                <div className="sup-pay__row">
                  <FormField label="Add supplier payment" hint="Money paid toward the supplier balance">
                    <TextInput
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="Amount"
                      aria-label="Supplier payment amount"
                      inputMode="decimal"
                    />
                  </FormField>
                  <button className="btn btn-primary" type="submit" disabled={paying}>
                    <ReceiptIndianRupee size={16} /> {paying ? "Saving…" : "Add Payment"}
                  </button>
                </div>
                <Msg msg={payMsg} />
              </form>

              <section className="sup-ledger">
                <div className="pp-card-head">
                  <span className="pp-card-head__icon pp-card-head__icon--navy" aria-hidden="true">
                    <Boxes size={18} />
                  </span>
                  <div className="pp-card-head__text">
                    <h4 className="sup-ledger-title">Purchase History</h4>
                    <p>{history.length > 10 ? `Latest 10 of ${history.length} invoices` : "Invoices and the batches received on each"}</p>
                  </div>
                </div>
                {historyLoading ? (
                  <LoadingSkeleton variant="lines" rows={4} label="Loading purchase history" />
                ) : historyError ? (
                  <div className="sup-state">
                    <Msg msg={{ type: "error", text: historyError }} />
                    <button className="btn" type="button" onClick={() => loadHistory(selectedId)}>
                      Retry
                    </button>
                  </div>
                ) : history.length === 0 ? (
                  <EmptyState compact icon={PackageCheck} title="No purchases yet" message="No purchase history found for this supplier." />
                ) : (
                  <ol className="mb-timeline sup-timeline">
                    {history.slice(0, 10).map((e) => {
                      const items = e.items || [];
                      return (
                        <li
                          className={`mb-timeline__item mb-timeline__item--${e.status === "RECEIVED" ? "success" : "warning"} sup-ledger-row sup-inv`}
                          key={e.invoiceId}
                        >
                          <span className="mb-timeline__dot" aria-hidden="true">
                            <PackageCheck size={12} />
                          </span>
                          <div className="mb-timeline__body">
                            <div className="sup-inv__head">
                              <div className="sup-inv__main">
                                <div className="sup-ledger-main pp-mono">{e.invoiceNumber}</div>
                                <div className="sup-ledger-sub">
                                  {fmtDate(e.purchaseDate)} • {items.length} batch{items.length === 1 ? "" : "es"}
                                </div>
                              </div>
                              <div className="sup-ledger-amt">
                                <StatusBadge status={e.status} size="sm" />
                                <div>{money(e.totalAmount)}</div>
                              </div>
                            </div>
                            {items.length > 0 && (
                              <div className="sup-supplies">
                                {items.slice(0, ITEMS_PER_INVOICE).map((item, idx) => (
                                  <div className="sup-ledger-row sup-item" key={`${e.invoiceId}-${idx}`}>
                                    <div className="sup-item__main">
                                      <div className="sup-item__name">{item.productName}</div>
                                      <div className="sup-ledger-sub">
                                        {[item.company, `Batch ${item.batchNumber || "—"}`, `Exp ${fmtDate(item.expiryDate)}`].filter(Boolean).join(" • ")}
                                      </div>
                                    </div>
                                    <div className="sup-item__meta">
                                      <span className="pp-chip pp-chip--navy">
                                        <b>{Number(item.quantity || 0).toLocaleString("en-IN")}</b> strips received
                                      </span>
                                      {item.remainingStrips != null && (
                                        <span className="pp-chip">{Number(item.remainingStrips).toLocaleString("en-IN")} left</span>
                                      )}
                                      <span className="sup-item__price">
                                        Cost {money(item.costPrice)} • Sell {money(item.sellingPrice)}
                                        {item.mrp != null ? ` • MRP ${money(item.mrp)}` : ""}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                                {items.length > ITEMS_PER_INVOICE && (
                                  <div className="sup-ledger-sub">+{items.length - ITEMS_PER_INVOICE} more batches</div>
                                )}
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            </div>
          )}
        </div>
      </div>

      <Modal open={editing} onClose={() => !savingEdit && setEditing(false)} title="Edit supplier" width={620}>
        <form className="sup-modal-form" onSubmit={handleUpdate} noValidate>
          <SupplierFields value={editForm} onChange={setEditForm} prefix="Edit supplier" />
          <Msg msg={editMsg} />
          <div className="sup-modal-actions">
            <button className="btn" type="button" onClick={() => setEditing(false)} disabled={savingEdit}>
              Cancel
            </button>
            <button className="btn btn-primary" type="submit" disabled={savingEdit}>
              {savingEdit ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Suppliers;
