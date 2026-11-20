import React, { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { useTheme } from "../context/ThemeContext";
import "./layout.css";

const COLLAPSE_KEY = "mb.sidebar.collapsed";

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const location = useLocation();
  const reduce = useReducedMotion();
  const { theme } = useTheme();

  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* storage unavailable: keep in memory only */
      }
      return !c;
    });
  }, []);

  // Close the off-canvas menu after navigating.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Escape closes the menu on small screens.
  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  return (
    <div className={`app-shell ${sidebarOpen ? "sidebar-open" : ""}`}>
      <Sidebar open={sidebarOpen} onClose={closeSidebar} collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      {sidebarOpen && <div className="app-shell-overlay" onClick={closeSidebar} aria-hidden="true" />}
      <div className="app-shell-main">
        <Navbar onMenuClick={openSidebar} menuOpen={sidebarOpen} />
        <main className="app-shell-content">
          {/* Page transition: fade + slight rise on route change (no exit delay, so navigation stays instant) */}
          <motion.div
            key={`${location.pathname}:${theme}`}
            className="app-page"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
