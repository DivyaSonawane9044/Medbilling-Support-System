// Sidebar.jsx
import React from "react";
import { NavLink } from "react-router-dom";
import "./Sidebar.css";

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">MS</div>
        <div>
          <h2 className="sidebar-title">MEDBILLING</h2>
          <p className="sidebar-subtitle">Support System</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        <ul className="sidebar-menu">
          <li>
            <NavLink to="/dashboard" className="sidebar-link">
              <span>Dashboard</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/inventory" className="sidebar-link">
              <span>Inventory</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/purchases" className="sidebar-link">
              <span>Purchases</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/expiry-tracking" className="sidebar-link">
              <span>Expiry & Batch Tracking</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/sales" className="sidebar-link">
              <span>Sales</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/billing" className="sidebar-link">
              <span>Billing</span>
            </NavLink>
          </li>

          <li>
            <NavLink to="/customers" className="sidebar-link">
              <span>Customers</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/suppliers" className="sidebar-link">
              <span>Suppliers</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/payments" className="sidebar-link">
              <span>Payments</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/accounting" className="sidebar-link">
              <span>Accounting</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/reports" className="sidebar-link">
              <span>Reports</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/analytics" className="sidebar-link">
              <span>Analytics</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/product-master" className="sidebar-link">
              <span>Medicine Catalog &amp; Pricing</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/settings" className="sidebar-link">
              <span>Settings</span>
            </NavLink>
          </li>
        </ul>
      </nav>
    </aside>
  );
}

export default Sidebar;

