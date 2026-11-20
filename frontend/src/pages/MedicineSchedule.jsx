import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarPlus, ClipboardList, Pill, UserRound } from "lucide-react";
import { Avatar, EmptyState, LoadingSkeleton, PageHeader } from "../components/ui";
import { prescriptionAPI, customersAPI, handleApiError } from "../services/api";
import { DoseChips, DoseToggles, doseCode } from "./people/Dosage";
import "./people/people.css";
import "./MedicineSchedule.css";

const EMPTY_FORM = {
  customerId: "",
  medicineName: "",
  morning: false,
  afternoon: false,
  evening: false,
  night: false,
  instructions: "",
};

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

/** Groups schedules by customer, keeping the API's newest-first order for groups and items. */
function groupByCustomer(rows) {
  const groups = new Map();
  rows.forEach((s) => {
    const key = s.customerId ?? "none";
    if (!groups.has(key)) groups.set(key, { key, name: s.customerName || null, items: [] });
    groups.get(key).items.push(s);
  });
  return [...groups.values()];
}

const MedicineSchedule = () => {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  const [customers, setCustomers] = useState([]);
  const [customersError, setCustomersError] = useState(null);

  const [schedules, setSchedules] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [filterCustomer, setFilterCustomer] = useState("");

  const loadSchedules = useCallback(async (customerId) => {
    try {
      setListLoading(true);
      setListError(null);
      const res = await prescriptionAPI.getAll(customerId || undefined);
      setSchedules(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setListError(handleApiError(err).message);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedules(filterCustomer);
  }, [filterCustomer, loadSchedules]);

  useEffect(() => {
    customersAPI
      .getAll()
      .then((res) => setCustomers(Array.isArray(res.data) ? res.data : []))
      .catch((err) => setCustomersError(handleApiError(err).message));
  }, []);

  const groups = useMemo(() => groupByCustomer(schedules), [schedules]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.medicineName.trim()) {
      setFormError("Medicine name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const body = {
        medicineName: formData.medicineName.trim(),
        morning: formData.morning,
        afternoon: formData.afternoon,
        evening: formData.evening,
        night: formData.night,
        instructions: formData.instructions.trim() || null,
      };
      if (formData.customerId) body.customerId = Number(formData.customerId);
      await prescriptionAPI.save(body);
      setFormData(EMPTY_FORM);
      setSuccessMsg(`Schedule for ${body.medicineName} saved.`);
      setTimeout(() => setSuccessMsg(""), 4000);
      await loadSchedules(filterCustomer);
    } catch (err) {
      setFormError(handleApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const doses = ["morning", "afternoon", "evening", "night"].filter((k) => formData[k]).length;

  return (
    <div className="mb-page schedule-container">
      <PageHeader
        icon={CalendarClock}
        eyebrow="People"
        title="Medicine Schedule"
        subtitle="Build simple dosage timetables for customers: when to take each medicine and any special instructions."
      />

      <div className="schedule-layout">
        <div className="card schedule-box">
          <div className="pp-card-head">
            <span className="pp-card-head__icon" aria-hidden="true">
              <CalendarPlus size={18} />
            </span>
            <div className="pp-card-head__text">
              <h2>Medicine Timetable</h2>
              <p>Pick the times of day; the schedule is saved as a prescription.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="schedule-form">
            {formError && (
              <div className="pp-msg pp-msg--error" role="alert">
                {formError}
              </div>
            )}
            {successMsg && (
              <div className="pp-msg pp-msg--success" role="status">
                {successMsg}
              </div>
            )}

            <div className="schedule-field">
              <label htmlFor="ms-customer">Customer (optional)</label>
              <select id="ms-customer" name="customerId" value={formData.customerId} onChange={handleChange}>
                <option value="">— No customer —</option>
                {customers.map((c) => (
                  <option key={c.customerId} value={c.customerId}>
                    {c.name}
                    {c.contactNumber ? ` (${c.contactNumber})` : ""}
                  </option>
                ))}
              </select>
              {customersError && <div className="schedule-hint">Customers could not be loaded: {customersError}</div>}
            </div>

            <div className="schedule-field">
              <label htmlFor="ms-medicine">Medicine Name</label>
              <input
                id="ms-medicine"
                type="text"
                name="medicineName"
                placeholder="Enter medicine name"
                value={formData.medicineName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="schedule-field">
              <div className="schedule-field__row">
                <span className="schedule-label">Dosage Timings</span>
                <span className="pp-dose-code" title="Morning-Afternoon-Evening-Night">
                  {doseCode(formData)}
                </span>
              </div>
              <DoseToggles named value={formData} onToggle={(key, on) => setFormData((prev) => ({ ...prev, [key]: on }))} />
              <div className="schedule-hint">
                {doses ? `${doses} dose${doses === 1 ? "" : "s"} a day` : "Tap the times of day this medicine is taken."}
              </div>
            </div>

            <div className="schedule-field">
              <label htmlFor="ms-instructions">Special Instructions</label>
              <textarea
                id="ms-instructions"
                name="instructions"
                placeholder="Before food / After food / Duration / With water etc."
                value={formData.instructions}
                onChange={handleChange}
              ></textarea>
            </div>

            <button type="submit" className="btn btn-primary save-btn" disabled={saving}>
              <CalendarPlus size={16} aria-hidden="true" /> {saving ? "Saving..." : "Save Schedule"}
            </button>
          </form>
        </div>

        <div className="card schedule-box schedule-list-box">
          <div className="schedule-list-head">
            <div className="pp-card-head">
              <span className="pp-card-head__icon pp-card-head__icon--purple" aria-hidden="true">
                <ClipboardList size={18} />
              </span>
              <div className="pp-card-head__text">
                <h2>Saved Schedules</h2>
                <p>
                  {listLoading
                    ? "Loading…"
                    : `${schedules.length} schedule${schedules.length === 1 ? "" : "s"} • ${groups.length} group${groups.length === 1 ? "" : "s"}`}
                </p>
              </div>
            </div>
            <select aria-label="Filter by customer" value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)}>
              <option value="">All customers</option>
              {customers.map((c) => (
                <option key={c.customerId} value={c.customerId}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {listLoading ? (
            <LoadingSkeleton variant="lines" rows={5} label="Loading schedules" />
          ) : listError ? (
            <div className="pp-msg pp-msg--error" role="alert">
              {listError}{" "}
              <button type="button" className="schedule-link-btn" onClick={() => loadSchedules(filterCustomer)}>
                Retry
              </button>
            </div>
          ) : schedules.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No schedules saved yet."
              message={filterCustomer ? "This customer has no saved schedules." : "Create one with the timetable form; it will appear here grouped by customer."}
            />
          ) : (
            <div className="schedule-groups mb-stagger">
              {groups.map((g) => (
                <section className="schedule-group" key={g.key}>
                  <header className="schedule-group__head">
                    {g.name ? (
                      <Avatar name={g.name} size={34} />
                    ) : (
                      <span className="schedule-group__anon" aria-hidden="true">
                        <UserRound size={16} />
                      </span>
                    )}
                    <span className="schedule-group-name">{g.name || "No customer"}</span>
                    <span className="pp-chip">
                      <Pill size={12} aria-hidden="true" /> {g.items.length}
                    </span>
                  </header>
                  <ul className="schedule-list">
                    {g.items.map((s) => (
                      <li key={s.prescriptionId} className="schedule-item">
                        <div className="schedule-item-top">
                          <strong>{s.medicineName}</strong>
                          <span className="pp-dose-code" title="Morning-Afternoon-Evening-Night">
                            {doseCode(s)}
                          </span>
                        </div>
                        <div className="schedule-chips">
                          <DoseChips row={s} chipClass="schedule-chip" />
                        </div>
                        {s.instructions && <div className="schedule-item-notes">{s.instructions}</div>}
                        <div className="schedule-item-date">{formatDateTime(s.createdAt)}</div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicineSchedule;
