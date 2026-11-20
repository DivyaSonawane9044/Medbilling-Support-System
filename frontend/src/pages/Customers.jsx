import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar,
  DataTable,
  EmptyState,
  FormField,
  LoadingSkeleton,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  StatCard,
  StatusBadge,
  TextInput,
  inr,
  inr2,
} from "../components/ui";
import {
  BadgeIndianRupee,
  CheckCircle2,
  ChevronRight,
  FilePlus2,
  History,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Pill,
  ReceiptText,
  Search,
  Stethoscope,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { customersAPI, prescriptionAPI, handleApiError } from "../services/api";
import { DoseChips, DoseToggles, Msg, Segmented, doseCode } from "./people/Dosage";
import "./people/people.css";
import "./Customers.css";

const money = inr2;
const fmtDateTime = (v) =>
  v ? new Date(v).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

const EMPTY_CUSTOMER = { name: "", contactNumber: "", email: "", address: "", doctorName: "" };
const EMPTY_RX = {
  medicineName: "",
  morning: false,
  afternoon: false,
  evening: false,
  night: false,
  food: "",
  durationDays: "",
  notes: "",
};
const PAYMENT_METHODS = [
  { value: "Cash", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "Card", label: "Card" },
];
const FOOD_OPTIONS = [
  { value: "", label: "Any time" },
  { value: "before", label: "Before food" },
  { value: "after", label: "After food" },
];

// The first-name lookup can match dozens of customers; keep the quick-pick short so the form and directory stay in view.
const LOOKUP_LIMIT = 5;

const STATUS_DOT = { PAID: "success", PARTIAL: "warning", UNPAID: "danger" };

function customerPayload(form) {
  return {
    name: form.name.trim(),
    contactNumber: form.contactNumber.trim(),
    email: form.email.trim(),
    address: form.address.trim(),
    doctorName: form.doctorName.trim(),
  };
}

// Same rules as the backend (CustomerController.applyEditable) so bad input never reaches the server.
const PHONE_RE = /^\+?[0-9][0-9 -]{6,14}[0-9]$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function validateCustomer(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Name is required.";
  const phone = form.contactNumber.trim();
  if (phone && !PHONE_RE.test(phone)) errors.contactNumber = "Enter a valid phone number (8-16 digits).";
  const email = form.email.trim();
  if (email && !EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  return errors;
}

function CustomerFields({ value, onChange, errors = {}, prefix }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });
  return (
    <div className="cus-form-grid">
      <FormField label="Name" required error={errors.name}>
        <TextInput
          value={value.name}
          onChange={set("name")}
          placeholder="Customer name"
          aria-label={`${prefix} name`}
          aria-invalid={!!errors.name}
        />
      </FormField>
      <FormField label="Phone" error={errors.contactNumber}>
        <TextInput
          value={value.contactNumber}
          onChange={set("contactNumber")}
          placeholder="Phone number"
          inputMode="tel"
          aria-label={`${prefix} phone`}
          aria-invalid={!!errors.contactNumber}
        />
      </FormField>
      <FormField label="Email" error={errors.email}>
        <TextInput
          inputMode="email"
          value={value.email}
          onChange={set("email")}
          placeholder="name@example.com"
          aria-label={`${prefix} email`}
          aria-invalid={!!errors.email}
        />
      </FormField>
      <FormField label="Doctor">
        <TextInput value={value.doctorName} onChange={set("doctorName")} placeholder="Referring doctor" aria-label={`${prefix} doctor`} />
      </FormField>
      <div className="cus-form-wide">
        <FormField label="Address">
          <TextInput value={value.address} onChange={set("address")} placeholder="Street, city, state" aria-label={`${prefix} address`} />
        </FormField>
      </div>
    </div>
  );
}

/** Outstanding-balance chip used in the directory and quick lookup. */
function DueChip({ amount }) {
  return amount > 0 ? (
    <span className="pp-chip pp-chip--warning">Due {money(amount)}</span>
  ) : (
    <span className="pp-chip pp-chip--success">
      <CheckCircle2 size={12} aria-hidden="true" /> Settled
    </span>
  );
}

function Customers() {
  // Directory
  const [customers, setCustomers] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]); // unfiltered, for the summary cards
  const [statsLoading, setStatsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [listError, setListError] = useState(null);
  const [lookupProfiles, setLookupProfiles] = useState([]);
  const requestId = useRef(0);
  const detailRef = useRef(null);

  // Create
  const [newCustomer, setNewCustomer] = useState(EMPTY_CUSTOMER);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState(null);
  const [createErrors, setCreateErrors] = useState({});

  // Selected profile
  const [selectedId, setSelectedId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);

  // Edit (modal)
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_CUSTOMER);
  const [editErrors, setEditErrors] = useState({});
  const [editMsg, setEditMsg] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Collect payment (modal)
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [paying, setPaying] = useState(false);
  const [payMsg, setPayMsg] = useState(null);

  // Prescriptions (modal)
  const [rxOpen, setRxOpen] = useState(false);
  const [rx, setRx] = useState(EMPTY_RX);
  const [savingRx, setSavingRx] = useState(false);
  const [rxMsg, setRxMsg] = useState(null);

  const refreshStats = useCallback(async () => {
    try {
      const res = await customersAPI.getAll();
      setAllCustomers(Array.isArray(res.data) ? res.data : []);
    } catch {
      /* the directory shows its own error; cards keep their last values */
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadCustomers = useCallback(async (term) => {
    const id = ++requestId.current;
    setSearching(true);
    try {
      const response = await customersAPI.getAll(term || undefined);
      if (id !== requestId.current) return;
      const data = Array.isArray(response.data) ? response.data : [];
      setCustomers(data);
      if (!term) {
        setAllCustomers(data);
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

  // Debounced live search; only the table reflects loading so the input keeps focus.
  useEffect(() => {
    const t = setTimeout(() => loadCustomers(searchTerm.trim()), 250);
    return () => clearTimeout(t);
  }, [searchTerm, loadCustomers]);

  useEffect(() => {
    const first = searchTerm.trim().split(" ")[0];
    if (!first || first.length < 2) {
      setLookupProfiles([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await customersAPI.lookupByFirstName(first);
        setLookupProfiles(Array.isArray(res.data) ? res.data : []);
      } catch {
        setLookupProfiles([]);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const loadProfile = useCallback(async (id) => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const res = await customersAPI.getById(id);
      setProfile(res.data);
      if (res.data?.customer) {
        setCustomers((prev) => prev.map((c) => (c.customerId === id ? res.data.customer : c)));
      }
    } catch (err) {
      setProfileError(handleApiError(err).message);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  function openCustomer(id) {
    setSelectedId(id);
    setEditing(false);
    setPayOpen(false);
    setRxOpen(false);
    setActionMsg(null);
    setPayMsg(null);
    setRxMsg(null);
    setPayAmount("");
    setRx(EMPTY_RX);
    setProfile(null);
    loadProfile(id);
    // On stacked (narrow) layouts the profile sits below the directory: bring it into view.
    if (typeof window !== "undefined" && window.matchMedia?.("(max-width: 1099px)").matches) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      requestAnimationFrame(() => detailRef.current?.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", block: "start" }));
    }
  }

  const selected = useMemo(() => {
    if (!selectedId) return null;
    if (profile?.customer?.customerId === selectedId) {
      return { ...profile.customer, remainingBalance: profile.remainingBalance ?? profile.customer.remainingBalance };
    }
    return customers.find((c) => c.customerId === selectedId) || null;
  }, [customers, profile, selectedId]);

  const rows = useMemo(() => customers.map((c) => ({ ...c, remainingBalance: Number(c.remainingBalance) || 0 })), [customers]);

  const stats = useMemo(() => {
    const balances = allCustomers.map((c) => Number(c.remainingBalance) || 0);
    const withDue = balances.filter((b) => b > 0);
    return {
      total: allCustomers.length,
      withDue: withDue.length,
      totalDue: withDue.reduce((s, b) => s + b, 0),
      settled: allCustomers.length - withDue.length,
    };
  }, [allCustomers]);

  const purchaseHistory = profile?.purchaseHistory || [];
  const paymentHistory = profile?.paymentHistory || [];
  const prescriptions = profile?.prescriptions || [];
  const balance = Number(selected?.remainingBalance) || 0;
  const totalSpend = Number(profile?.totalSpend) || 0;

  async function handleCreateCustomer(event) {
    event.preventDefault();
    const errors = validateCustomer(newCustomer);
    setCreateErrors(errors);
    if (Object.keys(errors).length) {
      setCreateMsg({ type: "error", text: "Please fix the highlighted fields." });
      return;
    }
    try {
      setCreating(true);
      setCreateMsg(null);
      const response = await customersAPI.create(customerPayload(newCustomer));
      setCustomers((prev) => [response.data, ...prev]);
      setNewCustomer(EMPTY_CUSTOMER);
      setCreateMsg({ type: "success", text: `Customer "${response.data?.name}" added.` });
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
      email: selected.email || "",
      address: selected.address || "",
      doctorName: selected.doctorName || "",
    });
    setActionMsg(null);
    setEditMsg(null);
    setEditErrors({});
    setEditing(true);
  }

  async function handleUpdate(event) {
    event.preventDefault();
    const errors = validateCustomer(editForm);
    setEditErrors(errors);
    if (Object.keys(errors).length) {
      setEditMsg({ type: "error", text: "Please fix the highlighted fields." });
      return;
    }
    try {
      setSavingEdit(true);
      setEditMsg(null);
      await customersAPI.update(selectedId, customerPayload(editForm));
      setEditing(false);
      setActionMsg({ type: "success", text: "Customer details updated." });
      await loadProfile(selectedId);
    } catch (err) {
      setEditMsg({ type: "error", text: handleApiError(err).message });
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!window.confirm(`Delete customer "${selected.name}"? This cannot be undone.`)) return;
    try {
      setDeleting(true);
      await customersAPI.delete(selectedId);
      setCustomers((prev) => prev.filter((c) => c.customerId !== selectedId));
      setSelectedId(null);
      setProfile(null);
      setCreateMsg({ type: "success", text: `Customer "${selected.name}" deleted.` });
      refreshStats();
    } catch (err) {
      setActionMsg({ type: "error", text: handleApiError(err).message });
    } finally {
      setDeleting(false);
    }
  }

  function openPayment() {
    setPayMsg(null);
    setPayAmount("");
    setActionMsg(null);
    setPayOpen(true);
  }

  async function handleCollectPayment(event) {
    event.preventDefault();
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      setPayMsg({ type: "error", text: "Enter an amount greater than 0." });
      return;
    }
    if (amount > balance) {
      setPayMsg({ type: "error", text: `Amount cannot exceed the outstanding balance of ${money(balance)}.` });
      return;
    }
    try {
      setPaying(true);
      setPayMsg(null);
      await customersAPI.processPayment(selectedId, amount, payMethod);
      setPayAmount("");
      const text = `Collected ${money(amount)} by ${payMethod}.`;
      if (amount >= balance) {
        // Fully settled: nothing left to collect, close the dialog and confirm on the profile.
        setPayOpen(false);
        setActionMsg({ type: "success", text });
      } else {
        setPayMsg({ type: "success", text });
      }
      await loadProfile(selectedId);
      refreshStats();
    } catch (err) {
      setPayMsg({ type: "error", text: handleApiError(err).message });
    } finally {
      setPaying(false);
    }
  }

  function openRx() {
    setRxMsg(null);
    setRx(EMPTY_RX);
    setActionMsg(null);
    setRxOpen(true);
  }

  async function handleAddPrescription(event) {
    event.preventDefault();
    if (!selectedId) return;
    if (!rx.medicineName.trim()) {
      setRxMsg({ type: "error", text: "Medicine name is required." });
      return;
    }
    const days = rx.durationDays === "" ? null : Number(rx.durationDays);
    if (days !== null && (!Number.isFinite(days) || days <= 0)) {
      setRxMsg({ type: "error", text: "Duration must be a positive number of days." });
      return;
    }
    const parts = [];
    if (rx.food === "before") parts.push("Before food");
    if (rx.food === "after") parts.push("After food");
    if (days) parts.push(`for ${days} day${days === 1 ? "" : "s"}`);
    if (rx.notes.trim()) parts.push(rx.notes.trim());

    try {
      setSavingRx(true);
      setRxMsg(null);
      await prescriptionAPI.save({
        customerId: selectedId,
        medicineName: rx.medicineName.trim(),
        morning: rx.morning,
        afternoon: rx.afternoon,
        evening: rx.evening,
        night: rx.night,
        instructions: parts.join("; "),
      });
      setRx(EMPTY_RX);
      setRxMsg({ type: "success", text: "Prescription saved." });
      await loadProfile(selectedId);
    } catch (err) {
      setRxMsg({ type: "error", text: handleApiError(err).message });
    } finally {
      setSavingRx(false);
    }
  }

  const directorySubtitle = searching
    ? "Searching…"
    : rows.length === 0
      ? searchTerm.trim()
        ? "No customers match your search."
        : "No customers yet. Add one below."
      : "Click View to open a profile";

  return (
    <div className="mb-page cus">
      <PageHeader
        icon={Users}
        eyebrow="People"
        title="Customers"
        subtitle="Search patients, review purchase history, collect dues and store prescriptions."
        actions={
          <span className="pp-chip pp-chip--info">
            <Search size={12} aria-hidden="true" /> Type a first name for quick lookup
          </span>
        }
      />

      <section className="mb-grid-stats mb-stagger" aria-label="Customer summary">
        <StatCard icon={Users} label="Total customers" value={stats.total} tone="teal" loading={statsLoading} hint="In the customer directory" />
        <StatCard
          icon={Wallet}
          label="With outstanding dues"
          value={stats.withDue}
          tone="warning"
          loading={statsLoading}
          hint={stats.total ? `${Math.round((stats.withDue / stats.total) * 100)}% of customers` : "No customers yet"}
        />
        <StatCard
          icon={BadgeIndianRupee}
          label="Total outstanding"
          value={stats.totalDue}
          format={inr}
          tone="coral"
          loading={statsLoading}
          hint="Credit still to be collected"
        />
        <StatCard icon={CheckCircle2} label="Fully settled" value={stats.settled} tone="mint" loading={statsLoading} hint="Customers with no dues" />
      </section>

      <div className="cus-grid">
        <div className="cus-list">
          <div className="card cus-search-card">
            <div className="cus-search">
              <Search size={18} className="cus-search__icon" aria-hidden="true" />
              <TextInput
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search customers by name or phone"
                type="search"
                aria-label="Search customers"
              />
              {searching && !initialLoading && <span className="cus-searching">Searching…</span>}
            </div>

            {lookupProfiles.length > 0 && (
              <div className="cus-lookup">
                <div className="cus-lookup__head">
                  <strong>First-name matches</strong>
                  {lookupProfiles.length > LOOKUP_LIMIT && (
                    <span className="cus-muted">
                      Showing {LOOKUP_LIMIT} of {lookupProfiles.length}. Refine the search or use the directory below.
                    </span>
                  )}
                </div>
                {lookupProfiles.slice(0, LOOKUP_LIMIT).map((p) => (
                  <button
                    key={p.customer?.customerId}
                    type="button"
                    className="cus-lookup-btn"
                    onClick={() => openCustomer(p.customer.customerId)}
                  >
                    <Avatar name={p.customer?.name || ""} size={30} />
                    <span className="cus-lookup-btn__text">
                      <span className="cus-lookup-btn__name">{p.customer?.name}</span>
                      {p.customer?.contactNumber ? <span className="cus-lookup-btn__sub">{p.customer.contactNumber}</span> : null}
                    </span>
                    <DueChip amount={Number(p.remainingBalance) || 0} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {initialLoading ? (
            <div className="card cus-state">
              <LoadingSkeleton variant="table" rows={5} label="Loading customers" />
            </div>
          ) : listError ? (
            <div className="card cus-state">
              <Msg msg={{ type: "error", text: `Could not load customers: ${listError}` }} />
              <button className="btn" type="button" onClick={() => loadCustomers(searchTerm.trim())}>
                Retry
              </button>
            </div>
          ) : (
            <div className={`cus-directory ${searching ? "cus-table-busy" : ""}`}>
              <DataTable
                title="Customer Directory"
                subtitle={directorySubtitle}
                columns={[
                  {
                    key: "name",
                    header: "Customer",
                    cell: (v, r) => (
                      <div className="cus-name">
                        <Avatar name={v || ""} size={36} />
                        <div className="cus-name-text">
                          <div className="cus-name-main">{v}</div>
                          <div className="cus-name-sub">
                            {r.contactNumber ? (
                              <span>
                                <Phone size={11} aria-hidden="true" /> {r.contactNumber}
                              </span>
                            ) : null}
                            {r.address ? <span className="cus-name-addr">{r.address}</span> : null}
                            {!r.contactNumber && !r.address ? <span>No contact details</span> : null}
                          </div>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "remainingBalance",
                    header: "Balance",
                    align: "right",
                    searchable: false,
                    cell: (v) => <DueChip amount={v} />,
                  },
                  {
                    key: "action",
                    header: "",
                    searchable: false,
                    sortable: false,
                    cell: (_v, r) => (
                      <button
                        className={`btn btn-sm cus-view-btn ${r.customerId === selectedId ? "is-active" : ""}`}
                        type="button"
                        onClick={() => openCustomer(r.customerId)}
                      >
                        View <ChevronRight size={14} aria-hidden="true" />
                      </button>
                    ),
                  },
                ]}
                rows={rows}
                rowKey={(r) => r.customerId}
                searchable={false}
                initialPageSize={10}
              />
            </div>
          )}

          <form className="cus-form card" onSubmit={handleCreateCustomer} noValidate>
            <div className="pp-card-head">
              <span className="pp-card-head__icon" aria-hidden="true">
                <UserPlus size={18} />
              </span>
              <div className="pp-card-head__text">
                <h3>Add New Customer</h3>
                <p>Just a name to start; phone, email and doctor help with lookups.</p>
              </div>
            </div>
            <CustomerFields value={newCustomer} onChange={setNewCustomer} errors={createErrors} prefix="New customer" />
            <Msg msg={createMsg} />
            <button className="btn btn-primary" type="submit" disabled={creating}>
              <UserPlus size={16} aria-hidden="true" /> {creating ? "Adding…" : "Add Customer"}
            </button>
          </form>
        </div>

        <div className="card cus-detail" ref={detailRef}>
          {!selectedId ? (
            <EmptyState
              icon={UserRound}
              title="Select a customer"
              message="Open a profile from the directory to see purchase history, payments and prescriptions."
            />
          ) : profileLoading && !profile ? (
            <div className="cus-state">
              <LoadingSkeleton variant="lines" rows={6} label="Loading profile" />
            </div>
          ) : profileError && !profile ? (
            <div className="cus-state">
              <Msg msg={{ type: "error", text: profileError }} />
              <button className="btn" type="button" onClick={() => loadProfile(selectedId)}>
                Retry
              </button>
            </div>
          ) : selected ? (
            <div className="cus-detail-inner mb-animate-in" key={selectedId}>
              <div className="cus-profile">
                <Avatar name={selected.name || ""} size={56} />
                <div className="cus-profile__text">
                  <h3 className="cus-detail-title">{selected.name}</h3>
                  <div className="cus-contact">
                    {selected.contactNumber && (
                      <span>
                        <Phone size={14} aria-hidden="true" /> {selected.contactNumber}
                      </span>
                    )}
                    {selected.email && (
                      <span>
                        <Mail size={14} aria-hidden="true" /> {selected.email}
                      </span>
                    )}
                    {selected.address && (
                      <span>
                        <MapPin size={14} aria-hidden="true" /> {selected.address}
                      </span>
                    )}
                    {selected.doctorName && (
                      <span>
                        <Stethoscope size={14} aria-hidden="true" /> Doctor: {selected.doctorName}
                      </span>
                    )}
                    {!selected.contactNumber && !selected.email && !selected.address && <span>No contact details</span>}
                  </div>
                </div>
              </div>

              <div className="cus-detail-badges">
                <div className={`cus-kpi ${balance > 0 ? "cus-kpi--due" : "cus-kpi--ok"}`}>
                  {balance > 0 ? (
                    <>
                      <span className="cus-kpi__cap">Due</span> <strong className="cus-kpi__val">{money(balance)}</strong>
                    </>
                  ) : (
                    <>
                      <span className="cus-kpi__cap">Balance</span> <strong className="cus-kpi__val">No dues</strong>
                    </>
                  )}
                </div>
                {profile && (
                  <div className="cus-kpi cus-kpi--spend">
                    <span className="cus-kpi__cap">Total spend</span> <strong className="cus-kpi__val">{money(profile.totalSpend)}</strong>
                  </div>
                )}
                <div className="cus-kpi cus-kpi--bills">
                  <strong className="cus-kpi__val">{purchaseHistory.length}</strong> <span className="cus-kpi__cap">bills</span>
                </div>
              </div>

              {totalSpend > 0 && (
                <div className="cus-paid-meter">
                  <div className="cus-paid-meter__row">
                    <span>Paid of billed amount</span>
                    <b>
                      {money(Math.max(0, totalSpend - balance))} / {money(totalSpend)}
                    </b>
                  </div>
                  <ProgressBar value={Math.max(0, totalSpend - balance)} max={totalSpend} tone={balance > 0 ? "warning" : "success"} label="Share of billed amount paid" size="sm" />
                </div>
              )}
              {profile && balance <= 0 && (
                <p className="cus-settled">
                  <CheckCircle2 size={15} aria-hidden="true" /> No outstanding balance.
                </p>
              )}

              <div className="cus-actions">
                <button className="btn" type="button" onClick={startEdit} disabled={editing}>
                  <Pencil size={14} /> Edit
                </button>
                {balance > 0 && (
                  <button className="btn btn-primary" type="button" onClick={openPayment}>
                    <Wallet size={14} /> Collect payment
                  </button>
                )}
                <button className="btn" type="button" onClick={openRx}>
                  <FilePlus2 size={14} /> New prescription
                </button>
                <button className="btn cus-btn-danger" type="button" onClick={handleDelete} disabled={deleting}>
                  <Trash2 size={14} /> {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
              <Msg msg={actionMsg} />

              <section className="cus-section" data-testid="cus-purchase-history">
                <div className="pp-card-head">
                  <span className="pp-card-head__icon pp-card-head__icon--navy" aria-hidden="true">
                    <History size={18} />
                  </span>
                  <div className="pp-card-head__text">
                    <h4>Purchase History</h4>
                    <p>
                      {purchaseHistory.length > 8 ? `Latest 8 of ${purchaseHistory.length} bills` : "Bills issued to this customer"}
                    </p>
                  </div>
                </div>
                {purchaseHistory.length === 0 ? (
                  <EmptyState compact icon={ReceiptText} title="No bills yet" message="No bills found yet for this customer." />
                ) : (
                  <ol className="mb-timeline cus-timeline">
                    {purchaseHistory.slice(0, 8).map((p) => (
                      <li className={`mb-timeline__item mb-timeline__item--${STATUS_DOT[p.paymentStatus] || "info"} mini-row`} key={p.invoiceId}>
                        <span className="mb-timeline__dot" aria-hidden="true">
                          <ReceiptText size={12} />
                        </span>
                        <div className="mb-timeline__body">
                          <div className="mb-timeline__title pp-mono">{p.invoiceNumber}</div>
                          <div className="mb-timeline__meta">
                            {fmtDateTime(p.saleDateTime)}
                            {p.itemCount != null ? ` • ${p.itemCount} item${p.itemCount === 1 ? "" : "s"}` : ""}
                          </div>
                        </div>
                        <div className="cus-tl-right">
                          <div className="cus-tl-amt">{money(p.grandTotal)}</div>
                          <StatusBadge status={p.paymentStatus} size="sm" />
                          {Number(p.balanceDue) > 0 && <div className="cus-tl-due">Due {money(p.balanceDue)}</div>}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className="cus-section" data-testid="cus-payment-history">
                <div className="pp-card-head">
                  <span className="pp-card-head__icon" aria-hidden="true">
                    <Wallet size={18} />
                  </span>
                  <div className="pp-card-head__text">
                    <h4>Payment History</h4>
                    <p>Payments at the counter and balance settlements</p>
                  </div>
                </div>
                {paymentHistory.length === 0 ? (
                  <EmptyState compact icon={Wallet} title="No payments" message="No payments recorded." />
                ) : (
                  <div className="cus-pay-list">
                    {paymentHistory.map((p) => (
                      <div className="mini-row cus-pay-row" key={p.paymentId}>
                        <span className="cus-pay-row__icon" aria-hidden="true">
                          <BadgeIndianRupee size={16} />
                        </span>
                        <div className="cus-pay-row__main">
                          <div className="cus-pay-row__title">{p.invoiceNumber || "Balance settlement"}</div>
                          <div className="cus-pay-row__sub">{fmtDateTime(p.paymentDate)}</div>
                        </div>
                        <div className="cus-pay-row__right">
                          <div className="cus-tl-amt">{money(p.amountPaid)}</div>
                          <div className="cus-pay-row__tags">
                            <span className="pp-chip">{p.paymentMethod || "—"}</span>
                            {p.paymentStatus ? <StatusBadge status={p.paymentStatus} size="sm" /> : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="cus-section">
                <div className="pp-card-head">
                  <span className="pp-card-head__icon pp-card-head__icon--purple" aria-hidden="true">
                    <Pill size={18} />
                  </span>
                  <div className="pp-card-head__text">
                    <h4>Prescriptions</h4>
                    <p>{prescriptions.length ? `${prescriptions.length} stored` : "Dosage schedules for this customer"}</p>
                  </div>
                  <button className="btn btn-sm btn-ghost" type="button" onClick={openRx} aria-label="Add a prescription for this customer">
                    <FilePlus2 size={14} />
                  </button>
                </div>
                {prescriptions.length === 0 ? (
                  <EmptyState compact icon={Pill} title="No prescriptions" message="No prescriptions stored yet." />
                ) : (
                  <div className="rx-list">
                    {prescriptions.map((p) => (
                      <div className="rx-item" key={p.prescriptionId}>
                        <div className="rx-item__top">
                          <div className="rx-title">{p.medicineName}</div>
                          <span className="pp-dose-code" title="Morning-Afternoon-Evening-Night">
                            {doseCode(p)}
                          </span>
                        </div>
                        <div className="rx-dosage">
                          <DoseChips row={p} />
                        </div>
                        {p.instructions && <div className="rx-notes">{p.instructions}</div>}
                        <div className="rx-sub">Added {fmtDateTime(p.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : (
            <EmptyState icon={UserRound} title="Customer not found" message="This customer may have been removed." />
          )}
        </div>
      </div>

      {/* Edit customer */}
      <Modal open={editing} onClose={() => !savingEdit && setEditing(false)} title="Edit customer" width={620}>
        <form className="cus-modal-form" onSubmit={handleUpdate} noValidate>
          <CustomerFields value={editForm} onChange={setEditForm} errors={editErrors} prefix="Edit customer" />
          <Msg msg={editMsg} />
          <div className="cus-modal-actions">
            <button className="btn" type="button" onClick={() => setEditing(false)} disabled={savingEdit}>
              Cancel
            </button>
            <button className="btn btn-primary" type="submit" disabled={savingEdit}>
              {savingEdit ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Collect payment */}
      <Modal open={payOpen} onClose={() => !paying && setPayOpen(false)} title="Collect payment" width={480}>
        <div className="cus-modal-form">
          <div className="cus-pay-summary">
            <Avatar name={selected?.name || ""} size={40} />
            <div>
              <div className="cus-pay-summary__name">{selected?.name}</div>
              <div className="cus-pay-summary__sub">Outstanding balance</div>
            </div>
            <strong className="cus-pay-summary__amt">{money(balance)}</strong>
          </div>
          <form className="cus-pay" onSubmit={handleCollectPayment} noValidate>
            <FormField label="Amount" hint={`Outstanding ${money(balance)}`}>
              <TextInput
                type="number"
                min="0.01"
                step="0.01"
                max={balance}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Amount"
                inputMode="decimal"
              />
            </FormField>
            <FormField label="Method">
              <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} options={PAYMENT_METHODS} />
            </FormField>
            <button className="btn btn-primary" type="submit" disabled={paying}>
              {paying ? "Processing…" : "Collect"}
            </button>
          </form>
          <Msg msg={payMsg} />
        </div>
      </Modal>

      {/* New prescription */}
      <Modal open={rxOpen} onClose={() => !savingRx && setRxOpen(false)} title="New prescription" width={600}>
        <form className="cus-modal-form rx-add" onSubmit={handleAddPrescription} noValidate>
          <FormField label="Medicine" required>
            <TextInput
              value={rx.medicineName}
              onChange={(e) => setRx({ ...rx, medicineName: e.target.value })}
              placeholder="e.g., Paracetamol 500mg"
            />
          </FormField>
          <div className="rx-block">
            <div className="rx-label">Dosage</div>
            <DoseToggles value={rx} onToggle={(key, on) => setRx((prev) => ({ ...prev, [key]: on }))} />
          </div>
          <div className="rx-block">
            <div className="rx-label">Food timing</div>
            <Segmented name="rx-food" label="Food timing" options={FOOD_OPTIONS} value={rx.food} onChange={(food) => setRx((prev) => ({ ...prev, food }))} />
          </div>
          <div className="rx-row">
            <FormField label="Duration (days)">
              <TextInput
                type="number"
                min="1"
                value={rx.durationDays}
                onChange={(e) => setRx({ ...rx, durationDays: e.target.value })}
                placeholder="e.g., 5"
                inputMode="numeric"
              />
            </FormField>
            <FormField label="Notes">
              <TextInput value={rx.notes} onChange={(e) => setRx({ ...rx, notes: e.target.value })} placeholder="Optional" />
            </FormField>
          </div>
          <Msg msg={rxMsg} />
          <div className="cus-modal-actions">
            <button className="btn" type="button" onClick={() => setRxOpen(false)} disabled={savingRx}>
              Done
            </button>
            <button className="btn btn-primary" type="submit" disabled={savingRx}>
              {savingRx ? "Saving…" : "Add prescription"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Customers;
