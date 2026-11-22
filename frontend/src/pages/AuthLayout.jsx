import React from "react";
import { Pill, ReceiptText, HeartPulse, ShieldCheck, Cross } from "lucide-react";
import MedicalIllustration from "../components/ui/MedicalIllustration";
import "./SignIn.css";
import { useTheme } from "../context/ThemeContext";

/**
 * Shared shell for the Clerk sign-in / sign-up pages: brand panel on the left
 * (hidden on small screens) and the Clerk card on the right. No fixed heights:
 * the page grows and scrolls naturally so the Clerk card is never clipped.
 */

const FEATURES = [
  { icon: Pill, title: "Smart Inventory Management", text: "Batch-wise stock, FEFO and expiry alerts." },
  { icon: ReceiptText, title: "Fast & Accurate Billing", text: "GST-inclusive MRP billing with printable invoices." },
  { icon: HeartPulse, title: "Real-Time Business Analytics", text: "Sales, profit and stock value at a glance." },
];

// Black + Gold appearance for Clerk components (supported `appearance` API only).
const darkAppearance = {
  variables: {
    colorPrimary: "#d4af37",
    colorTextOnPrimaryBackground: "#14110a",
    colorText: "#ffffff",
    colorTextSecondary: "#a1a1aa",
    colorBackground: "#181a20",
    colorInputBackground: "#1f2229",
    colorInputText: "#ffffff",
    colorNeutral: "#ffffff",
    colorDanger: "#f87171",
    colorSuccess: "#34d399",
    borderRadius: "10px",
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
    fontSize: "15px",
  },
  elements: {
    rootBox: { width: "100%" },
    cardBox: {
      width: "100%",
      maxWidth: "100%",
      borderRadius: "18px",
      border: "1px solid rgba(212, 175, 55, 0.25)",
      boxShadow: "0 40px 80px -30px rgba(0, 0, 0, 0.95), 0 0 60px -30px rgba(212, 175, 55, 0.45)",
    },
    card: { boxShadow: "none", padding: "28px 28px 24px" },
    footer: { background: "#14161b" },
    headerTitle: { fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.01em" },
    headerSubtitle: { fontSize: "0.9rem" },
    formButtonPrimary: {
      fontSize: "0.95rem",
      fontWeight: 700,
      textTransform: "none",
      color: "#14110a",
      backgroundImage: "linear-gradient(135deg, #f4d675 0%, #d4af37 48%, #b8932a 100%)",
      boxShadow: "0 10px 24px -12px rgba(212, 175, 55, 0.8)",
      transition: "filter 150ms ease, transform 150ms ease",
      "&:hover": { transform: "translateY(-1px)", filter: "brightness(1.06)" },
    },
    socialButtonsBlockButton: { borderColor: "rgba(255, 255, 255, 0.1)", transition: "background-color 150ms ease" },
    formFieldInput: { borderColor: "rgba(255, 255, 255, 0.12)" },
    footerActionLink: { fontWeight: 600, color: "#f4d675" },
  },
};

// White Medical appearance (default theme): white card, deep-gold accents.
const lightAppearance = {
  variables: {
    ...darkAppearance.variables,
    colorPrimary: "#0e7f78",
    colorTextOnPrimaryBackground: "#ffffff",
    colorText: "#111827",
    colorTextSecondary: "#5b6475",
    colorBackground: "#ffffff",
    colorInputBackground: "#f8fafc",
    colorInputText: "#111827",
    colorNeutral: "#111827",
    colorDanger: "#c62828",
    colorSuccess: "#047857",
  },
  elements: {
    ...darkAppearance.elements,
    cardBox: {
      ...darkAppearance.elements.cardBox,
      border: "1px solid rgba(14, 127, 120, 0.25)",
      boxShadow: "0 1px 2px rgba(16, 24, 40, 0.05), 0 30px 60px -30px rgba(14, 127, 120, 0.45)",
    },
    footer: { background: "#fafbfc" },
    formButtonPrimary: {
      ...darkAppearance.elements.formButtonPrimary,
      color: "#ffffff",
      backgroundImage: "linear-gradient(135deg, #0e8a82 0%, #0e7f78 45%, #0b6b85 100%)",
      boxShadow: "0 10px 22px -12px rgba(14, 127, 120, 0.7)",
    },
    socialButtonsBlockButton: { borderColor: "#e3e8ef", transition: "background-color 150ms ease" },
    formFieldInput: { borderColor: "#dfe4ec" },
    footerActionLink: { fontWeight: 600, color: "#0b5f5a" },
  },
};

/** Clerk card appearance matching the active app theme. */
export function useClerkAppearance() {
  const { theme } = useTheme();
  return theme === "dark" ? darkAppearance : lightAppearance;
}


function BrandMark({ compact = false }) {
  return (
    <div className={`auth-brand ${compact ? "auth-brand--compact" : ""}`}>
      <span className="auth-brand__mark" aria-hidden="true">
        <Cross size={20} strokeWidth={2.4} />
      </span>
      <span className="auth-brand__name">
        MedBilling <span>Support System</span>
      </span>
    </div>
  );
}

export default function AuthLayout({ children, footer }) {
  return (
    <div className="auth-page">
      <section className="auth-visual" aria-label="About MedBilling">
        <div className="auth-visual__inner">
          <BrandMark />
          <h1 className="auth-visual__title">
            Manage Your Pharmacy <em>Smarter</em>
          </h1>
          <p className="auth-visual__subtitle">
            A smarter way to manage medicines, inventory, billing and business operations.
          </p>
          <MedicalIllustration className="auth-visual__art" title="Doctor's clipboard with stethoscope and medicines" />
          <ul className="auth-features">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="auth-feature">
                <span className="auth-feature__icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={2} />
                </span>
                <span>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <main className="auth-panel">
        <div className="auth-panel__inner">
          <BrandMark compact />
          {children}
          {footer ? <div className="auth-panel__footer">{footer}</div> : null}
          <p className="auth-secure">
            <ShieldCheck size={16} aria-hidden="true" />
            Protected sign-in. Never share your password.
          </p>
        </div>
      </main>
    </div>
  );
}

export function AuthLoading() {
  return (
    <div className="auth-page auth-page--loading" role="status" aria-live="polite">
      <div className="auth-spinner" aria-hidden="true" />
      <p>Loading MedBilling…</p>
    </div>
  );
}
