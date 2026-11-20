import React, { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { Avatar, FormField, PageHeader, StatusBadge, TextInput } from "../components/ui";
import {
  Bell,
  Building2,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Lock,
  Percent,
  ReceiptText,
  Save,
  Settings as SettingsIcon,
  Upload,
  UserRound,
} from "lucide-react";
import { paymentsAPI, handleApiError } from "../services/api";
import "./Settings.css";

const STORAGE_KEY = "pharmacy_settings";

// Keys are read by Billing for the printed invoice header.
const DEFAULT_SETTINGS = {
  pharmacyName: "",
  address: "",
  phone: "",
  email: "",
  gstNumber: "",
  licenseNumber: "",
};

const FIELDS = Object.keys(DEFAULT_SETTINGS);
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Keep only known string fields so a bad/old file can't break the page. */
function sanitize(raw) {
  const clean = { ...DEFAULT_SETTINGS };
  if (raw && typeof raw === "object") {
    FIELDS.forEach((k) => {
      if (raw[k] !== undefined && raw[k] !== null) clean[k] = String(raw[k]);
    });
  }
  return clean;
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Show only the key mode and last 4 characters of the public Razorpay key id. */
function maskKeyId(keyId) {
  if (!keyId) return null;
  const m = /^(rzp_(?:test|live)_)/.exec(keyId);
  const prefix = m ? m[1] : "";
  return `${prefix}••••${keyId.slice(-4)}`;
}

function SectionHead({ icon: Icon, tone = "teal", title, subtitle, right }) {
  return (
    <div className="set-head">
      <span className={`set-head__icon set-head__icon--${tone}`} aria-hidden="true">
        <Icon size={20} />
      </span>
      <div className="set-head__text">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {right ? <div className="set-head__right">{right}</div> : null}
    </div>
  );
}

function Settings() {
  const { user, isLoaded } = useUser();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState(null); // {type: 'success'|'error', text}
  const importRef = useRef(null);
  const [payConfig, setPayConfig] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    setSettings(loadSaved());
  }, []);

  useEffect(() => {
    let alive = true;
    paymentsAPI
      .getConfig()
      .then((res) => alive && setPayConfig({ loading: false, data: res.data || {}, error: null }))
      .catch((err) => alive && setPayConfig({ loading: false, data: null, error: handleApiError(err).message }));
    return () => {
      alive = false;
    };
  }, []);

  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setDirty(false);
      flash("success", "Settings saved in this browser.");
    } catch {
      flash("error", "Could not save settings: browser storage is unavailable.");
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const url = URL.createObjectURL(new Blob([dataStr], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "pharmacy_settings.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("bad");
        setSettings(sanitize(parsed));
        setDirty(true);
        flash("success", "Settings imported. Click “Save Settings” to keep them.");
      } catch {
        flash("error", "That file is not a valid settings file.");
      }
    };
    reader.onerror = () => flash("error", "Could not read the file.");
    reader.readAsText(file);
  };

  const email = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || "";
  const displayName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || email || "Signed-in user";

  const gst = settings.gstNumber.trim();
  const gstHint = !gst ? "15 characters" : GSTIN_RE.test(gst) ? "Format OK" : `${gst.length}/15 · check format`;
  const filled = ["pharmacyName", "address", "phone", "gstNumber", "licenseNumber"].filter((k) => settings[k].trim()).length;

  const cfg = payConfig.data;
  const keyMode = cfg?.keyId?.startsWith("rzp_live_") ? "Live mode" : cfg?.keyId?.startsWith("rzp_test_") ? "Test mode" : null;

  return (
    <div className="mb-page settings-container">
      <PageHeader
        icon={SettingsIcon}
        eyebrow="Workspace"
        title="Settings"
        subtitle="Business details for your invoices, plus an honest overview of how billing, tax, alerts, sign-in and payments are set up."
        actions={
          <>
            <button type="button" onClick={handleExport} className="btn">
              <Download size={16} />
              Export
            </button>
            {/* A real button (keyboard reachable) that opens the hidden file picker */}
            <button type="button" className="btn" onClick={() => importRef.current?.click()}>
              <Upload size={16} />
              Import
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImport}
              aria-label="Import settings file"
              data-testid="settings-import-input"
              hidden
            />
            <button type="button" onClick={handleSave} className={`btn btn-primary ${dirty ? "set-save--dirty" : ""}`}>
              <Save size={16} />
              {dirty ? "Save Settings*" : "Save Settings"}
            </button>
          </>
        }
      />

      {message && (
        <div
          className={`set-flash set-flash--${message.type} mb-animate-in`}
          role={message.type === "success" ? "status" : "alert"}
        >
          {message.text}
        </div>
      )}

      <div className="set-layout">
        {/* ---------- Business details ---------- */}
        <section className="card set-card set-business" aria-labelledby="set-business-title">
          <SectionHead
            icon={Building2}
            title={<span id="set-business-title">Business details</span>}
            subtitle="Saved in this browser and printed in the header of invoice PDFs from Billing on this device."
            right={<span className="set-pill">{filled}/5 invoice fields filled</span>}
          />
          <div className="settings-grid">
            <FormField label="Pharmacy Name">
              <TextInput
                value={settings.pharmacyName}
                onChange={(e) => handleChange("pharmacyName", e.target.value)}
                placeholder="Enter pharmacy name"
              />
            </FormField>
            <FormField label="Phone Number">
              <TextInput value={settings.phone} onChange={(e) => handleChange("phone", e.target.value)} placeholder="Enter phone number" type="tel" />
            </FormField>
            <div className="full-width">
              <FormField label="Address">
                <TextInput value={settings.address} onChange={(e) => handleChange("address", e.target.value)} placeholder="Enter address" />
              </FormField>
            </div>
            <FormField label="GSTIN" hint={gstHint}>
              <TextInput
                value={settings.gstNumber}
                onChange={(e) => handleChange("gstNumber", e.target.value.toUpperCase())}
                placeholder="15-character GSTIN"
                maxLength={15}
                className="ti set-mono"
              />
            </FormField>
            <FormField label="Drug Licence Number">
              <TextInput
                value={settings.licenseNumber}
                onChange={(e) => handleChange("licenseNumber", e.target.value)}
                placeholder="Enter licence number"
              />
            </FormField>
            <div className="full-width">
              <FormField label="Email Address" hint="For your records; not printed on invoices">
                <TextInput value={settings.email} onChange={(e) => handleChange("email", e.target.value)} placeholder="Enter email address" type="email" />
              </FormField>
            </div>
          </div>

          <div className="set-preview" aria-label="Invoice header preview">
            <div className="set-preview__label">
              <FileText size={14} aria-hidden="true" /> Invoice header preview
            </div>
            <div className="set-preview__paper">
              <div className="set-preview__name">{settings.pharmacyName.trim() || "Pharmacy"}</div>
              {settings.address.trim() ? <div>{settings.address}</div> : null}
              <div className="set-preview__meta">
                {[
                  settings.phone.trim() && `Ph: ${settings.phone.trim()}`,
                  gst && `GSTIN: ${gst}`,
                  settings.licenseNumber.trim() && `DL No: ${settings.licenseNumber.trim()}`,
                ]
                  .filter(Boolean)
                  .join(" • ") || "Phone, GSTIN and licence appear here once filled in."}
              </div>
            </div>
            <p className="set-note">
              Other computers keep their own copy; use Export and Import to copy these details between browsers.
            </p>
          </div>
        </section>

        <div className="set-side">
          {/* ---------- Profile ---------- */}
          <section className="card set-card" aria-label="Profile">
            <SectionHead icon={UserRound} tone="navy" title="Profile" subtitle="The account you are signed in with." />
            {!isLoaded ? (
              <div className="set-muted">Loading account…</div>
            ) : user ? (
              <div className="settings-user-card">
                <Avatar name={displayName} size={48} />
                <div className="settings-user-info">
                  <div className="settings-user-name">{displayName}</div>
                  {email && <div className="settings-user-email">{email}</div>}
                  {user.lastSignInAt && (
                    <div className="settings-user-email">
                      Last sign-in: {new Date(user.lastSignInAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                  )}
                </div>
                <StatusBadge status="SUCCESS" label="Signed in" size="sm" />
              </div>
            ) : (
              <div className="set-flash set-flash--error">No signed-in user.</div>
            )}
            <p className="set-note">
              Users are managed in Clerk: invite, remove or change staff accounts from your Clerk dashboard. Profile details are read-only here.
            </p>
          </section>

          {/* ---------- Payment configuration ---------- */}
          <section className="card set-card" aria-label="Payment configuration">
            <SectionHead
              icon={CreditCard}
              tone="purple"
              title="Payment configuration"
              subtitle="Online payments through Razorpay."
              right={
                payConfig.loading ? null : payConfig.error ? (
                  <StatusBadge status="FAILED" label="Unavailable" size="sm" />
                ) : cfg?.configured ? (
                  <StatusBadge status="SUCCESS" label="Configured" size="sm" />
                ) : (
                  <StatusBadge status="INFO" label="Not configured" tone="neutral" size="sm" />
                )
              }
            />
            {payConfig.loading ? (
              <div className="set-muted">Checking the server configuration…</div>
            ) : payConfig.error ? (
              <p className="set-text">Could not check the payment configuration: {payConfig.error}</p>
            ) : cfg?.configured ? (
              <>
                <dl className="set-dl">
                  <div>
                    <dt>Provider</dt>
                    <dd>Razorpay{keyMode ? ` · ${keyMode}` : ""}</dd>
                  </div>
                  {cfg.keyId ? (
                    <div>
                      <dt>Key ID</dt>
                      <dd className="set-mono">{maskKeyId(cfg.keyId)}</dd>
                    </div>
                  ) : null}
                </dl>
                <p className="set-note">Keys are set on the server; the secret is never sent to the browser.</p>
              </>
            ) : (
              <p className="set-text">
                Razorpay keys are not set on the server, so online payments are switched off. Cash, UPI and card payments
                are still recorded at billing. The server administrator enables it by adding the Razorpay keys to the backend environment.
              </p>
            )}
            <Link className="set-link" to="/payments">
              Open Payments
            </Link>
          </section>
        </div>
      </div>

      {/* ---------- How the rest is configured ---------- */}
      <div className="set-info mb-stagger">
        <section className="card set-card" aria-label="Billing settings">
          <SectionHead icon={ReceiptText} tone="teal" title="Billing settings" subtitle="What shapes a bill today." />
          <ul className="settings-list">
            <li>Invoice header: the Business details above (name, address, phone, GSTIN, licence).</li>
            <li>Discounts are entered per bill at checkout; invoice numbers are assigned by the server.</li>
            <li>Stock is sold first-expiry-first-out (FEFO) from the batches received in Purchases.</li>
          </ul>
          <p className="set-note">There are no other billing preferences (such as footer text or paper size) to configure yet.</p>
          <Link className="set-link" to="/billing">
            Open Billing
          </Link>
        </section>

        <section className="card set-card" aria-label="Tax settings">
          <SectionHead icon={Percent} tone="warning" title="Tax settings" subtitle="GST is set per medicine, not globally." />
          <p className="set-text">
            Choose each medicine's GST rate (0, 5, 12, 18 or 28%) and HSN code in{" "}
            <Link to="/product-master">Medicine Catalog &amp; Pricing</Link>. Bills split GST equally into CGST and SGST, and
            all tax amounts are calculated by the server.
          </p>
          <ul className="settings-list">
            <li>MRP and cost price are recorded per batch when stock is received in Purchases.</li>
            <li>Selling price can never exceed the batch MRP.</li>
          </ul>
        </section>

        <section className="card set-card" aria-label="Notifications">
          <SectionHead icon={Bell} tone="info" title="Notifications" subtitle="In-app alerts only." />
          <p className="set-text">
            Alerts are worked out from your live stock data: low stock, batches expiring within 3 months, expired batches and
            pending purchase orders. They appear under the bell in the top bar.
          </p>
          <p className="set-note">No SMS, WhatsApp or email provider is configured, so no messages are sent to customers or staff.</p>
          <Link className="set-link" to="/expiry-tracking">
            Open Expiry Tracking
          </Link>
        </section>

        <section className="card set-card" aria-label="Security">
          <SectionHead icon={Lock} tone="navy" title="Security" subtitle="Sign-in is handled by Clerk." />
          <p className="set-text">
            Passwords, two-factor authentication and active sessions are managed by Clerk. Every request to the server carries
            your Clerk session token, and the server rejects requests without a valid one.
          </p>
          <a className="set-link" href="https://dashboard.clerk.com" target="_blank" rel="noopener noreferrer">
            Clerk dashboard <ExternalLink size={13} aria-hidden="true" />
          </a>
        </section>
      </div>
    </div>
  );
}

export default Settings;
