import React, { useMemo, useState, useEffect } from "react";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import FormField from "../components/ui/FormField";
import TextInput from "../components/ui/TextInput";
import "./Suppliers.css";
import { Landmark, ReceiptIndianRupee } from "lucide-react";
import { suppliersAPI, handleApiError } from "../services/api";

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

function Suppliers() {
  const [selectedId, setSelectedId] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [suppliers, setSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newSupplier, setNewSupplier] = useState({ name: "", contactNumber: "", company: "" });
  const [formError, setFormError] = useState(null);
  const [supplierHistory, setSupplierHistory] = useState({});

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);
        const response = await suppliersAPI.getAll(searchTerm.trim());
        const data = response.data?.content ?? response.data ?? [];
        setSuppliers(data);
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
    if (!selectedId) {
      return;
    }
    const fetchHistory = async () => {
      try {
        const response = await suppliersAPI.getHistory(selectedId);
        setSupplierHistory((prev) => ({ ...prev, [selectedId]: response.data }));
      } catch (err) {
        console.error("Failed to fetch supplier history:", err);
      }
    };

    fetchHistory();
  }, [selectedId]);

  const rows = useMemo(
    () =>
      suppliers.map((s) => ({
        ...s,
        id: s.supplierId,
        balance: Math.round(s.ledgerBalance || 0),
        entries: (supplierHistory[s.supplierId] || []).length,
      })),
    [suppliers, supplierHistory]
  );

  const filteredSuppliers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return rows;
    }
    return rows.filter((row) => {
      return (
        String(row.name || "").toLowerCase().includes(query) ||
        String(row.contactNumber || "").toLowerCase().includes(query) ||
        String(row.company || "").toLowerCase().includes(query)
      );
    });
  }, [rows, searchTerm]);

  const selected = useMemo(() => suppliers.find((s) => s.supplierId === selectedId) || null, [suppliers, selectedId]);
  const selectedBalance = useMemo(() => selected?.ledgerBalance || 0, [selected]);
  const selectedHistory = useMemo(() => (selectedId ? supplierHistory[selectedId] || [] : []), [supplierHistory, selectedId]);

  const selectedLedger = useMemo(
    () =>
      selectedHistory.map((invoice) => ({
        invoiceNumber: invoice.invoiceNumber,
        sourceDate: invoice.purchaseDate,
        amount: invoice.totalAmount,
        status: invoice.status,
      })),
    [selectedHistory]
  );

  const recentSupplyItems = useMemo(
    () =>
      selectedHistory.flatMap((invoice) =>
        (invoice.items || []).map((item) => ({
          invoiceNumber: invoice.invoiceNumber,
          productName: item.productName,
          company: item.company,
          quantity: item.quantity,
          costPrice: item.costPrice,
          sellingPrice: item.sellingPrice,
        }))
      ),
    [selectedHistory]
  );

  async function handleCreateSupplier(event) {
    event.preventDefault();
    if (!newSupplier.name.trim()) {
      setFormError("Supplier name is required.");
      return;
    }

    try {
      setLoading(true);
      setFormError(null);
      const response = await suppliersAPI.create(newSupplier);
      setSuppliers((prev) => [response.data, ...prev]);
      setNewSupplier({ name: "", contactNumber: "", company: "" });
    } catch (err) {
      setFormError(handleApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  async function addSupplierPayment() {
    if (!selected) return;
    const amt = Number(paymentAmount || 0);
    if (amt <= 0) return;

    try {
      await suppliersAPI.processPayment(selected.supplierId, amt);
      const response = await suppliersAPI.getAll();
      const data = response.data?.content ?? response.data ?? [];
      setSuppliers(data);
      setPaymentAmount(0);
      alert("Payment processed successfully");
    } catch (err) {
      alert("Error processing payment: " + handleApiError(err).message);
    }
  }

  if (loading) {
    return (
      <div className="sup">
        <div className="sup-head">
          <div>
            <h2 className="sup-title">Suppliers</h2>
            <p className="sup-subtitle">Loading supplier data...</p>
          </div>
        </div>
        <div className="loading-spinner">Loading suppliers...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sup">
        <div className="sup-head">
          <div>
            <h2 className="sup-title">Suppliers</h2>
            <p className="sup-subtitle">Error loading data</p>
          </div>
        </div>
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="sup">
      <div className="sup-head">
        <div>
          <h2 className="sup-title">Suppliers</h2>
          <p className="sup-subtitle">Supplier directory, ledger, and payment tracking</p>
        </div>
      </div>

      <div className="sup-grid">
        <div className="sup-search-row">
          <TextInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search suppliers by name or company"
          />
        </div>

        <div className="sup-form card">
          <h3>Add Supplier</h3>
          <div className="form-row">
            <FormField label="Supplier Name" required>
              <TextInput
                value={newSupplier.name}
                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                placeholder="Supplier name"
              />
            </FormField>
            <FormField label="Contact">
              <TextInput
                value={newSupplier.contactNumber}
                onChange={(e) => setNewSupplier({ ...newSupplier, contactNumber: e.target.value })}
                placeholder="Phone or email"
              />
            </FormField>
          </div>
          <div className="form-row">
            <FormField label="Company">
              <TextInput
                value={newSupplier.company}
                onChange={(e) => setNewSupplier({ ...newSupplier, company: e.target.value })}
                placeholder="Company name"
              />
            </FormField>
          </div>
          {formError && <div className="error-message">{formError}</div>}
          <button className="btn btn-primary" onClick={handleCreateSupplier}>
            Add Supplier
          </button>
        </div>

        <DataTable
          title="Supplier List"
          subtitle="Search suppliers by name, company, or contact"
          columns={[
            {
              key: "name",
              header: "Supplier",
              cell: (v, r) => (
                <div className="sup-name">
                  <div className="sup-name-main">{v}</div>
                  <div className="sup-name-sub">
                    {r.company || "N/A"} • {r.contactNumber || "No phone"}
                  </div>
                </div>
              ),
            },
            { key: "entries", header: "History", align: "right", searchable: false, cell: (v) => <Badge tone="gray">{v}</Badge> },
            { key: "balance", header: "Balance", align: "right", searchable: false, cell: (v) => INR.format(v) },
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
          rows={filteredSuppliers}
          rowKey={(r) => r.id}
          searchable={false}
          initialPageSize={10}
        />

        <div className="card sup-detail">
          {!selected ? (
            <div className="sup-empty">
              <Landmark size={32} />
              <div>
                <div className="sup-empty-title">Select a supplier</div>
                <div className="sup-empty-sub">Open a supplier to see ledger and recent supplies.</div>
              </div>
            </div>
          ) : (
            <>
              <div className="sup-detail-head">
                <div>
                  <h3 className="sup-detail-title">{selected.name}</h3>
                  <p className="sup-detail-sub">
                    {selected.contactNumber} • {selected.company}
                  </p>
                </div>
                <Badge tone={selectedBalance > 0 ? "amber" : "green"}>{INR.format(Math.abs(selectedBalance))}</Badge>
              </div>

              <div className="sup-pay">
                <FormField label="Add supplier payment" hint="Record money paid toward the supplier balance.">
                  <TextInput
                    type="number"
                    min="0"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    placeholder="Amount"
                  />
                </FormField>
                <button className="btn btn-primary" onClick={addSupplierPayment}>
                  <ReceiptIndianRupee size={16} /> Add Payment
                </button>
              </div>

              <div className="sup-ledger">
                <div className="sup-ledger-title">Purchase History</div>
                {selectedLedger.length === 0 ? (
                  <div className="sup-ledger-empty">No purchase history found for this supplier.</div>
                ) : (
                  <div className="sup-ledger-list">
                    {selectedLedger.slice(0, 10).map((e, idx) => (
                      <div className="sup-ledger-row" key={`${e.invoiceNumber}-${idx}`}>
                        <div>
                          <div className="sup-ledger-main">{e.invoiceNumber}</div>
                          <div className="sup-ledger-sub">{new Date(e.sourceDate).toLocaleDateString("en-IN")}</div>
                        </div>
                        <div className="sup-ledger-amt">
                          <Badge tone={e.status === "RECEIVED" ? "green" : "amber"}>{e.status}</Badge>
                          <div>{INR.format(e.amount)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="sup-supplies">
                <div className="sup-supplies-title">Recent supplies</div>
                {recentSupplyItems.length === 0 ? (
                  <div className="sup-supplies-empty">No recorded product deliveries for this supplier yet.</div>
                ) : (
                  <div className="sup-supplies-list">
                    {recentSupplyItems.slice(0, 6).map((item, idx) => (
                      <div className="sup-supplies-row" key={`${item.productName}-${idx}`}>
                        <div className="sup-supplies-main">
                          <div>{item.productName}</div>
                          <div className="sup-supplies-sub">{item.company}</div>
                        </div>
                        <div className="sup-supplies-meta">
                          <div>{item.quantity} strips</div>
                          <div>{INR.format(item.costPrice)} cost</div>
                          <div>{INR.format(item.sellingPrice)} sell</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Suppliers;

