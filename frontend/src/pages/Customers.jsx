import React, { useMemo, useState, useEffect } from "react";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import FormField from "../components/ui/FormField";
import TextInput from "../components/ui/TextInput";
import "./Customers.css";
import { FilePlus2, History, UserRound } from "lucide-react";
import { customersAPI, handleApiError } from "../services/api";

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

function loadBills() {
  try {
    return JSON.parse(localStorage.getItem("rp_bills") || "[]");
  } catch {
    return [];
  }
}

function loadCustomerPrescriptions() {
  try {
    return JSON.parse(localStorage.getItem("rp_customer_prescriptions") || "{}");
  } catch {
    return {};
  }
}

function saveCustomerPrescriptions(map) {
  localStorage.setItem("rp_customer_prescriptions", JSON.stringify(map));
}

function saveDosageInstructions(customerId, instructions) {
  const map = loadCustomerPrescriptions();
  map[customerId] = { ...map[customerId], dosageInstructions: instructions };
  saveCustomerPrescriptions(map);
}

function Customers() {
  const [selectedId, setSelectedId] = useState(null);
  const [rxTitle, setRxTitle] = useState("");
  const [customers, setCustomers] = useState([]);
  const [customerHistory, setCustomerHistory] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newCustomer, setNewCustomer] = useState({ name: "", contactNumber: "", address: "" });
  const [formError, setFormError] = useState(null);
  const [dosageInstructions, setDosageInstructions] = useState({
    morning: false,
    afternoon: false,
    evening: false,
    night: false,
    beforeFood: false,
    afterFood: false,
    duration: "",
  });
  const [prescriptions, setPrescriptions] = useState(loadCustomerPrescriptions());
  const [lookupProfiles, setLookupProfiles] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);

  // Fetch customers from API with live search support
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);
        const response = await customersAPI.getAll(searchTerm.trim());
        setCustomers(response.data || []);
        setError(null);
      } catch (err) {
        setError(handleApiError(err).message);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    if (selectedId) {
      (async () => {
        try {
          const [historyRes, payRes, profileRes] = await Promise.all([
            customersAPI.getHistory(selectedId),
            customersAPI.getPayments(selectedId),
            customersAPI.getById(selectedId),
          ]);
          setCustomerHistory((prev) => ({ ...prev, [selectedId]: historyRes.data }));
          setPaymentHistory(payRes.data || []);
          if (profileRes.data?.customer) {
            setCustomers((prev) =>
              prev.map((c) => (c.customerId === selectedId ? profileRes.data.customer : c))
            );
          }
        } catch (err) {
          console.error(err);
        }
      })();
    }
  }, [selectedId]);

  useEffect(() => {
    const first = searchTerm.trim().split(" ")[0];
    if (!first || first.length < 2) {
      setLookupProfiles([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await customersAPI.lookupByFirstName(first);
        setLookupProfiles(res.data || []);
      } catch {
        setLookupProfiles([]);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const bills = useMemo(() => loadBills(), []);
  const [rxMap, setRxMap] = useState(() => loadCustomerPrescriptions());

  const selected = useMemo(() => customers.find((c) => c.customerId === selectedId) || null, [customers, selectedId]);

  const customerRows = useMemo(
    () =>
      customers.map((c) => {
        const name = c.name || '';
        const spend = bills
          .filter((b) => (b.customerName || "").toLowerCase().includes(name.toLowerCase()))
          .reduce((s, b) => s + (b.totals?.grand || 0), 0);
        const rxCount = (rxMap[c.customerId] || []).length;
        return { 
          ...c, 
          id: c.customerId,
          name: name, 
          spend: Math.round(spend), 
          rxCount,
          phone: c.contactNumber || '',
          city: '', // Would need to be added to backend model
          age: '', // Would need to be added to backend model
        };
      }),
    [customers, bills, rxMap]
  );

  const filteredCustomers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return customerRows;
    }
    return customerRows.filter((row) => {
      return (
        String(row.name || "").toLowerCase().includes(query) ||
        String(row.phone || "").toLowerCase().includes(query) ||
        String(row.id || "").toLowerCase().includes(query)
      );
    });
  }, [customerRows, searchTerm]);

  const purchaseHistory = useMemo(() => {
    if (!selected || !customerHistory[selectedId]) return [];
    
    return customerHistory[selectedId].map((invoice) => ({
      id: invoice.invoiceId || invoice.id,
      date: new Date(invoice.saleDateTime || invoice.invoiceDate || invoice.createdAt).toLocaleString("en-IN"),
      amount: invoice.grandTotal || invoice.totalAmount || 0,
      status: invoice.status || "Paid",
      method: invoice.paymentMethod || "Cash",
    }));
  }, [selected, customerHistory, selectedId]);

  const customerPrescriptions = useMemo(() => (selected ? rxMap[selected.id] || [] : []), [selected, rxMap]);

  async function handleCreateCustomer(event) {
    event.preventDefault();
    if (!newCustomer.name.trim()) {
      setFormError('Name is required.');
      return;
    }

    try {
      setLoading(true);
      setFormError(null);
      const response = await customersAPI.create(newCustomer);
      setCustomers((prev) => [response.data, ...prev]);
      setNewCustomer({ name: "", contactNumber: "", address: "" });
    } catch (err) {
      setFormError(handleApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  function addPrescription() {
    if (!selected) return;
    if (!rxTitle.trim()) return;
    const next = { ...rxMap };
    const list = next[selected.id] ? [...next[selected.id]] : [];
    list.unshift({ title: rxTitle.trim(), createdAt: new Date().toISOString(), dosageInstructions: { ...dosageInstructions } });
    next[selected.id] = list.slice(0, 20);
    saveCustomerPrescriptions(next);
    setRxMap(next);
    setRxTitle("");
    setDosageInstructions({
      morning: false,
      afternoon: false,
      evening: false,
      night: false,
      beforeFood: false,
      afterFood: false,
      duration: "",
    });
  }

  if (loading) {
    return (
      <div className="cus">
        <div className="cus-head">
          <div>
            <h2 className="cus-title">Customers</h2>
            <p className="cus-subtitle">Loading customer data...</p>
          </div>
        </div>
        <div className="loading-spinner">Loading customers...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cus">
        <div className="cus-head">
          <div>
            <h2 className="cus-title">Customers</h2>
            <p className="cus-subtitle">Error loading data</p>
          </div>
        </div>
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="cus">
      <div className="cus-head">
        <div>
          <h2 className="cus-title">Customers</h2>
          <p className="cus-subtitle">Search patients/customers, view purchase history, and store prescriptions</p>
        </div>
        <div className="cus-hint">
          <Badge tone="blue">Lookup: type first name in search</Badge>
        </div>
      </div>

      <div className="cus-grid">
        <div className="cus-list">
          <div className="cus-search-row">
            <TextInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search customers by name (first name lookup)"
            />
          </div>
          {lookupProfiles.length > 0 && (
            <div className="card" style={{ marginBottom: 12, padding: 12 }}>
              <strong>First-name matches</strong>
              {lookupProfiles.map((p) => (
                <button
                  key={p.customer?.customerId}
                  type="button"
                  className="btn"
                  style={{ display: 'block', width: '100%', marginTop: 8, textAlign: 'left' }}
                  onClick={() => setSelectedId(p.customer.customerId)}
                >
                  {p.customer?.name} — Due {INR.format(p.remainingBalance || 0)}
                </button>
              ))}
            </div>
          )}

          <div className="cus-form card">
            <h3>Add New Customer</h3>
            <div className="form-row">
              <FormField label="Name" required>
                <TextInput
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  placeholder="Customer name"
                />
              </FormField>
              <FormField label="Phone">
                <TextInput
                  value={newCustomer.contactNumber}
                  onChange={(e) => setNewCustomer({ ...newCustomer, contactNumber: e.target.value })}
                  placeholder="Phone number"
                />
              </FormField>
            </div>
            <div className="form-row">
              <FormField label="Address">
                <TextInput
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  placeholder="Street, city, state"
                />
              </FormField>
            </div>
            {formError && <div className="error-message">{formError}</div>}
            <button className="btn btn-primary" onClick={handleCreateCustomer}>
              Add Customer
            </button>
          </div>

          <DataTable
            title="Customer Directory"
            subtitle="Search by first name to instantly find full details"
            columns={[
              {
                key: "name",
                header: "Customer",
                cell: (v, r) => (
                  <div className="cus-name">
                    <div className="cus-name-main">{v}</div>
                    <div className="cus-name-sub">
                      {r.age} yrs • {r.phone} • {r.city}
                    </div>
                  </div>
                ),
              },
              { key: "rxCount", header: "Rx", align: "right", searchable: false, cell: (v) => <Badge tone="gray">{v}</Badge> },
              { key: "spend", header: "Spend", align: "right", cell: (v) => INR.format(v), searchable: false },
              {
                key: "action",
                header: "",
                searchable: false,
                sortable: false,
                cell: (_v, r) => (
                  <button className="btn" onClick={() => setSelectedId(r.id)}>
                    View
                  </button>
                ),
              },
            ]}
            rows={filteredCustomers}
            rowKey={(r) => r.id}
            searchable={false}
            initialPageSize={10}
          />
        </div>

        <div className="card cus-detail">
          {!selected ? (
            <div className="cus-empty">
              <UserRound size={32} />
              <div>
                <div className="cus-empty-title">Select a customer</div>
                <div className="cus-empty-sub">Open a profile to see history and prescriptions.</div>
              </div>
            </div>
          ) : (
            <>
              <div className="cus-detail-head">
                <div>
                  <h3 className="cus-detail-title">
                    {selected.name}
                  </h3>
                  <p className="cus-detail-sub">
                    {selected.phone} • Balance: {INR.format(selected.remainingBalance || 0)}
                  </p>
                </div>
                <Badge tone="green">{purchaseHistory.length} visits</Badge>
              </div>

              <div className="cus-panels">
                <div className="panel">
                  <div className="panel-head">
                    <h4>
                      <History size={16} /> Purchase History
                    </h4>
                  </div>
                  <div className="panel-body">
                    {purchaseHistory.length === 0 ? (
                      <div className="panel-empty">No bills found yet for this customer.</div>
                    ) : (
                      <div className="mini-table">
                        {purchaseHistory.slice(0, 8).map((p) => (
                          <div className="mini-row" key={p.id}>
                            <div className="mini-main">
                              <div className="mini-title">{p.id}</div>
                              <div className="mini-sub">{p.date}</div>
                            </div>
                            <div className="mini-right">
                              <div className="mini-amt">{INR.format(p.amount)}</div>
                              <Badge tone={p.status === "Paid" ? "green" : "amber"}>{p.status}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-head">
                    <h4>Payment History</h4>
                  </div>
                  <div className="panel-body">
                    {paymentHistory.length === 0 ? (
                      <div className="panel-empty">No payments recorded.</div>
                    ) : (
                      paymentHistory.map((p) => (
                        <div className="mini-row" key={p.paymentId}>
                          <span>{p.invoiceNumber}</span>
                          <span>{INR.format(p.amountPaid)} — {p.paymentMethod}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-head">
                    <h4>
                      <FilePlus2 size={16} /> Prescriptions
                    </h4>
                  </div>
                  <div className="panel-body">
                    <div className="rx-add">
                      <FormField label="Add prescription note" hint="e.g., Fever + cold 5 days">
                        <TextInput value={rxTitle} onChange={(e) => setRxTitle(e.target.value)} placeholder="Prescription title / notes" />
                      </FormField>
                      <div className="dosage-instructions">
                        <label>Dosage Instructions:</label>
                        <div className="dosage-times">
                          <label><input type="checkbox" checked={dosageInstructions.morning} onChange={(e) => setDosageInstructions({...dosageInstructions, morning: e.target.checked})} /> Morning</label>
                          <label><input type="checkbox" checked={dosageInstructions.afternoon} onChange={(e) => setDosageInstructions({...dosageInstructions, afternoon: e.target.checked})} /> Afternoon</label>
                          <label><input type="checkbox" checked={dosageInstructions.evening} onChange={(e) => setDosageInstructions({...dosageInstructions, evening: e.target.checked})} /> Evening</label>
                          <label><input type="checkbox" checked={dosageInstructions.night} onChange={(e) => setDosageInstructions({...dosageInstructions, night: e.target.checked})} /> Night</label>
                        </div>
                        <div className="dosage-food">
                          <label><input type="checkbox" checked={dosageInstructions.beforeFood} onChange={(e) => setDosageInstructions({...dosageInstructions, beforeFood: e.target.checked})} /> Before Food</label>
                          <label><input type="checkbox" checked={dosageInstructions.afterFood} onChange={(e) => setDosageInstructions({...dosageInstructions, afterFood: e.target.checked})} /> After Food</label>
                        </div>
                        <FormField label="Duration">
                          <TextInput value={dosageInstructions.duration} onChange={(e) => setDosageInstructions({...dosageInstructions, duration: e.target.value})} placeholder="e.g., 5 days, 1 week" />
                        </FormField>
                      </div>
                      <button className="btn btn-primary" onClick={addPrescription}>
                        Add
                      </button>
                    </div>

                    {customerPrescriptions.length === 0 ? (
                      <div className="panel-empty">No prescriptions stored yet.</div>
                    ) : (
                      <div className="rx-list">
                        {customerPrescriptions.map((rx, idx) => (
                          <div className="rx-item" key={`${rx.createdAt}-${idx}`}>
                            <div className="rx-title">{rx.title}</div>
                            <div className="rx-sub">
                              Added: {new Date(rx.createdAt).toLocaleString("en-IN")}
                            </div>
                            {rx.dosageInstructions && (
                              <div className="rx-dosage">
                                {rx.dosageInstructions.morning && <span>Morning</span>}
                                {rx.dosageInstructions.afternoon && <span>Afternoon</span>}
                                {rx.dosageInstructions.evening && <span>Evening</span>}
                                {rx.dosageInstructions.night && <span>Night</span>}
                                {rx.dosageInstructions.beforeFood && <span>Before Food</span>}
                                {rx.dosageInstructions.afterFood && <span>After Food</span>}
                                {rx.dosageInstructions.duration && <span>Duration: {rx.dosageInstructions.duration}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Customers;

