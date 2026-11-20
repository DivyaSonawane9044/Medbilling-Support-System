import React from "react";
import { Boxes, ReceiptText, LineChart, ShieldCheck, Cross } from "lucide-react";
import "./SignIn.css";
import { useTheme } from "../context/ThemeContext";

/**
 * Shared shell for the Clerk sign-in / sign-up pages: brand panel on the left
 * (hidden on small screens) and the Clerk card on the right. No fixed heights:
 * the page grows and scrolls naturally so the Clerk card is never clipped.
 */

const FEATURES = [
  { icon: Boxes, title: "Smart Inventory Management", text: "Batch-wise stock, FEFO and expiry alerts." },
  { icon: ReceiptText, title: "Fast & Accurate Billing", text: "GST-inclusive MRP billing with printable invoices." },
  { icon: LineChart, title: "Real-Time Business Analytics", text: "Sales, profit and stock value at a glance." },
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
    colorPrimary: "#b08a22",
    colorTextOnPrimaryBackground: "#1c1606",
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
      border: "1px solid rgba(176, 138, 34, 0.25)",
      boxShadow: "0 1px 2px rgba(16, 24, 40, 0.05), 0 30px 60px -30px rgba(176, 138, 34, 0.45)",
    },
    footer: { background: "#fafbfc" },
    formButtonPrimary: { ...darkAppearance.elements.formButtonPrimary, color: "#1c1606", boxShadow: "0 10px 22px -12px rgba(176, 138, 34, 0.7)" },
    socialButtonsBlockButton: { borderColor: "#e3e8ef", transition: "background-color 150ms ease" },
    formFieldInput: { borderColor: "#dfe4ec" },
    footerActionLink: { fontWeight: 600, color: "#8f6f17" },
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

function PreviewIllustration() {
  // Decorative product preview (no data) built from shapes, so it stays crisp at any size.
  return (
    <svg className="auth-visual__art" viewBox="0 0 420 220" role="img" aria-label="Illustration of the pharmacy dashboard">
      <defs>
        <linearGradient id="authBar" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f4d675" />
          <stop offset="1" stopColor="#8e6f1c" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="418" height="218" rx="18" fill="#16181d" stroke="rgba(212,175,55,0.35)" />
      <rect x="20" y="20" width="120" height="10" rx="5" fill="#d4af37" opacity="0.8" />
      <rect x="20" y="38" width="76" height="8" rx="4" fill="#3a3c44" />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${20 + i * 132} 62)`}>
          <rect width="118" height="50" rx="12" fill="#1f2229" stroke="rgba(255,255,255,0.06)" />
          <circle cx="22" cy="25" r="11" fill={["#d4af37", "#34d399", "#7cb7ff"][i]} opacity="0.85" />
          <rect x="40" y="16" width="56" height="7" rx="3.5" fill="#3a3c44" />
          <rect x="40" y="29" width="38" height="7" rx="3.5" fill="#f4d675" opacity="0.7" />
        </g>
      ))}
      {[46, 70, 58, 92, 80, 110, 98].map((h, i) => (
        <rect key={i} x={28 + i * 30} y={200 - h * 0.66} width="18" height={h * 0.66} rx="5" fill="url(#authBar)" opacity={0.55 + i * 0.06} />
      ))}
      <rect x="250" y="128" width="150" height="72" rx="12" fill="#1b1d23" stroke="rgba(255,255,255,0.08)" />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(264 ${142 + i * 18})`}>
          <rect width="10" height="10" rx="3" fill={["#d4af37", "#34d399", "#fbbf24"][i]} />
          <rect x="18" y="1" width={[90, 70, 80][i]} height="8" rx="4" fill="#3a3c44" />
        </g>
      ))}
    </svg>
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
          <PreviewIllustration />
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
