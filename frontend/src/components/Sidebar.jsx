import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useUser } from "@clerk/clerk-react";
import {
  HeartPulse,
  ReceiptText,
  Boxes,
  Truck,
  CalendarClock,
  Pill,
  ClipboardPlus,
  Users,
  Building2,
  CreditCard,
  Calculator,
  FileBarChart2,
  LineChart,
  Settings,
  X,
  ChevronsLeft,
  Cross,
  ShieldCheck,
} from "lucide-react";
import "./Sidebar.css";

// Labels are part of the UI contract (tests and users rely on them) — keep them stable.
export const NAV_GROUPS = [
  {
    title: "Overview",
    links: [["/dashboard", "Dashboard", HeartPulse]],
  },
  {
    title: "Operations",
    links: [
      ["/billing", "Billing", ReceiptText],
      ["/inventory", "Inventory", Boxes],
      ["/purchases", "Purchases", Truck],
      ["/expiry-tracking", "Expiry & Batch Tracking", CalendarClock],
      ["/product-master", "Medicine Catalog & Pricing", Pill],
      ["/medicine-schedule", "Medicine Schedule", ClipboardPlus],
    ],
  },
  {
    title: "Partners",
    links: [
      ["/customers", "Customers", Users],
      ["/suppliers", "Suppliers", Building2],
    ],
  },
  {
    title: "Finance & insights",
    links: [
      ["/payments", "Payments", CreditCard],
      ["/accounting", "Accounting", Calculator],
      ["/reports", "Reports", FileBarChart2],
      ["/analytics", "Analytics", LineChart],
    ],
  },
  {
    title: "System",
    links: [["/settings", "Settings", Settings]],
  },
];

// Routes that live under another menu entry (e.g. /stock-alerts is a tab of Expiry tracking)
const ALIASES = {
  "/sales": "/billing",
  "/medicines": "/product-master",
  "/add-medicine": "/product-master",
  "/expiry-alerts": "/expiry-tracking",
  "/stock-alerts": "/expiry-tracking",
};

function Sidebar({ open = false, onClose, collapsed = false, onToggleCollapse }) {
  const { pathname } = useLocation();
  const activePath = ALIASES[pathname] || pathname;
  const reduce = useReducedMotion();
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress || "";
  const displayName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || email || "Pharmacist";
  const initials = displayName
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");

  return (
    <aside id="app-sidebar" className={`sidebar ${open ? "open" : ""} ${collapsed ? "is-collapsed" : ""}`} aria-label="Main navigation">
      <div className="sidebar-inner">
        <div className="sidebar-header">
          <div className="sidebar-logo" aria-hidden="true">
            <Cross size={20} strokeWidth={2.4} />
          </div>
          <div className="sidebar-brand">
            <h2 className="sidebar-title">
              Med<span>Billing</span>
            </h2>
            <p className="sidebar-subtitle">Pharmacy &amp; Clinic Suite</p>
          </div>
          <button type="button" className="sidebar-close" onClick={onClose} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div className="sidebar-group" key={group.title}>
              <div className="sidebar-group-title">{group.title}</div>
              <ul className="sidebar-menu">
                {group.links.map(([to, label, Icon]) => {
                  const isActive = activePath === to;
                  return (
                    <li key={to}>
                      <NavLink
                        to={to}
                        className={`sidebar-link ${isActive ? "active" : ""}`}
                        aria-current={isActive ? "page" : undefined}
                        title={collapsed ? label : undefined}
                        onClick={onClose}
                      >
                        {isActive ? (
                          <motion.span
                            layoutId="sidebar-active"
                            className="sidebar-active-bg"
                            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                          />
                        ) : null}
                        <Icon className="sidebar-icon" size={19} strokeWidth={2} aria-hidden="true" />
                        <span className="sidebar-label">{label}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="sidebar-profile" title={collapsed ? displayName : undefined}>
          {user?.imageUrl ? (
            <img className="sidebar-profile__avatar" src={user.imageUrl} alt="" />
          ) : (
            <span className="sidebar-profile__avatar" aria-hidden="true">
              {initials || "MB"}
            </span>
          )}
          <div className="sidebar-profile__text">
            <span className="sidebar-profile__name">{displayName}</span>
            <span className="sidebar-profile__role">
              <ShieldCheck size={12} aria-hidden="true" /> Signed in
            </span>
          </div>
        </div>

        <button
          type="button"
          className="sidebar-collapse"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
        >
          <ChevronsLeft size={18} aria-hidden="true" />
          <span className="sidebar-label">Collapse</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
