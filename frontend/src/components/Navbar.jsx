import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUser, UserButton } from "@clerk/clerk-react";
import { Bell, Search, Menu, Sun, Moon } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { NAV_GROUPS } from "./Sidebar";
import { notificationsAPI } from "../services/api";
import "./Navbar.css";

const ALERT_REFRESH_MS = 5 * 60 * 1000;

// Page name shown in the top bar, derived from the sidebar menu (plus routes that live under another entry)
const PAGE_TITLES = Object.fromEntries(NAV_GROUPS.flatMap((g) => g.links.map(([to, label]) => [to, label])));
Object.assign(PAGE_TITLES, { "/sales": "Billing", "/medicines": "Medicine Catalog & Pricing", "/add-medicine": "Add Medicine", "/expiry-alerts": "Expiry Alerts", "/stock-alerts": "Stock Alerts" });
const todayLabel = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export default function Navbar({ onMenuClick, menuOpen = false }) {
  const { user } = useUser();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] || "MedBilling";
  // null = unknown / failed -> badge hidden
  const [alerts, setAlerts] = useState(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const alertsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await notificationsAPI.getAlerts();
        const d = res.data || {};
        if (!cancelled) {
          setAlerts({
            lowStock: d.lowStock?.length || 0,
            nearExpiry: d.nearExpiry?.length || 0,
            expired: d.expired?.length || 0,
            pendingPurchases: d.pendingPurchases?.length || 0,
          });
        }
      } catch {
        if (!cancelled) setAlerts(null);
      }
    };
    load();
    const timer = setInterval(load, ALERT_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // Close the alerts panel on navigation, outside click and Escape.
  useEffect(() => setAlertsOpen(false), [location.pathname]);
  useEffect(() => {
    if (!alertsOpen) return undefined;
    const onDown = (e) => {
      if (alertsRef.current && !alertsRef.current.contains(e.target)) setAlertsOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setAlertsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [alertsOpen]);

  const alertCount = alerts ? alerts.lowStock + alerts.nearExpiry + alerts.expired : null;
  const alertRows = alerts
    ? [
        { label: "Low stock medicines", count: alerts.lowStock, to: "/stock-alerts" },
        { label: "Batches expiring within 3 months", count: alerts.nearExpiry, to: "/expiry-alerts" },
        { label: "Expired batches", count: alerts.expired, to: "/expiry-tracking" },
        { label: "Purchase orders awaiting stock", count: alerts.pendingPurchases, to: "/purchases" },
      ]
    : [];

  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/product-master?search=${encodeURIComponent(q)}` : "/product-master");
  };

  const email = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || "";
  const displayName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || email || "User";

  return (
    <header className="top-nav">
      <div className="top-nav-left">
        <button
          type="button"
          className="top-nav-icon-btn top-nav-menu-btn"
          onClick={onMenuClick}
          aria-label="Open menu"
          aria-controls="app-sidebar"
          aria-expanded={menuOpen}
        >
          <Menu />
        </button>
        <div className="top-nav-page">
          <span className="top-nav-page-title">{pageTitle}</span>
          <span className="top-nav-page-date">{todayLabel}</span>
        </div>
      </div>

      <form className="top-nav-center" onSubmit={handleSearch} role="search">
        <div className="search-container">
          <Search className="search-icon" />
          <input
            type="search"
            className="top-nav-search"
            placeholder="Search medicines…"
            aria-label="Search medicines"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </form>

      <div className="top-nav-right">
        <button
          type="button"
          className="top-nav-icon-btn top-nav-theme-btn"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to white medical theme" : "Switch to dark premium theme"}
          title={theme === "dark" ? "White medical theme" : "Dark premium theme"}
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </button>
        <div className="top-nav-alerts" ref={alertsRef}>
          <button
            type="button"
            className="top-nav-icon-btn"
            aria-label={alertCount ? `${alertCount} stock and expiry alerts` : "Stock and expiry alerts"}
            title={alertCount ? `${alertCount} stock and expiry alerts` : "Stock and expiry alerts"}
            aria-haspopup="true"
            aria-expanded={alertsOpen}
            aria-controls="top-nav-alerts-panel"
            onClick={() => setAlertsOpen((v) => !v)}
          >
            <Bell />
            {alertCount > 0 && (
              <span className="notification-badge" aria-hidden="true">{alertCount > 99 ? "99+" : alertCount}</span>
            )}
          </button>
          {alertsOpen && (
            <div id="top-nav-alerts-panel" className="top-nav-alerts-panel" role="region" aria-label="Alerts">
              <div className="top-nav-alerts-head">Alerts</div>
              {alerts ? (
                <ul className="top-nav-alerts-list">
                  {alertRows.map((r) => (
                    <li key={r.to}>
                      <button
                        type="button"
                        className="top-nav-alerts-item"
                        onClick={() => {
                          setAlertsOpen(false);
                          navigate(r.to);
                        }}
                      >
                        <span>{r.label}</span>
                        <span className={`top-nav-alerts-count ${r.count ? "has" : ""}`}>
                          {r.count.toLocaleString("en-IN")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="top-nav-alerts-empty">Alerts could not be loaded.</p>
              )}
            </div>
          )}
        </div>

        <div className="top-nav-user">
          <div className="user-info">
            <div className="user-details">
              <div className="user-name">{displayName}</div>
              {email && email !== displayName && <div className="user-role">{email}</div>}
            </div>
          </div>

          {/* Clerk UserButton: profile management and sign-out */}
          <div className="user-button-container">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "clerk-avatar-box",
                  userButtonPopoverCard: "clerk-popover-card",
                  userButtonBox: "clerk-user-button-box",
                },
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
