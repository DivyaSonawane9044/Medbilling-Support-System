import React from "react";
import { useNavigate } from "react-router-dom";
import { Heart, FileText, CirclePlus, Bell } from "lucide-react";
import "./DashboardSimple.css";

export default function DashboardSimple() {
  const navigate = useNavigate();

  return (
    <div className="dashboard-simple">
      <div className="dashboard-header">
        <div className="header-left">
          <div className="logo">
            <Heart className="logo-icon" />
            <div>
              <h1>MEDBILLING SUPPORT SYSTEM</h1>
              <p>Pharmacy Management Dashboard</p>
            </div>
          </div>
        </div>
        
        <div className="header-right">
          <button 
            onClick={() => navigate("/add-medicine")}
            className="btn btn-primary"
          >
            <CirclePlus size={16} /> Add Medicine
          </button>
          <button 
            onClick={() => navigate("/sales")}
            className="btn btn-success"
          >
            <FileText size={16} /> New Bill
          </button>
          <button className="btn btn-icon">
            <Bell size={16} />
          </button>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="welcome-section">
          <h2>Welcome to Your Dashboard</h2>
          <p>Manage your pharmacy operations efficiently</p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <Heart />
            </div>
            <div className="stat-content">
              <h3>Total Medicines</h3>
              <p className="stat-number">1,248</p>
              <p className="stat-label">All stocked medicines</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <FileText />
            </div>
            <div className="stat-content">
              <h3>Today's Sales</h3>
              <p className="stat-number">₹34,250</p>
              <p className="stat-label">Daily revenue</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <CirclePlus />
            </div>
            <div className="stat-content">
              <h3>Low Stock</h3>
              <p className="stat-number">23</p>
              <p className="stat-label">Below reorder level</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Bell />
            </div>
            <div className="stat-content">
              <h3>Expiring Soon</h3>
              <p className="stat-number">17</p>
              <p className="stat-label">Expiry within 60 days</p>
            </div>
          </div>
        </div>

        <div className="quick-actions">
          <h3>Quick Actions</h3>
          <div className="actions-grid">
            <button 
              onClick={() => navigate("/sales")}
              className="action-btn"
            >
              <FileText />
              <span>Create New Bill</span>
            </button>
            <button 
              onClick={() => navigate("/add-medicine")}
              className="action-btn"
            >
              <CirclePlus />
              <span>Add Medicine</span>
            </button>
            <button 
              onClick={() => navigate("/inventory")}
              className="action-btn"
            >
              <Heart />
              <span>View Inventory</span>
            </button>
            <button 
              onClick={() => navigate("/reports")}
              className="action-btn"
            >
              <FileText />
              <span>View Reports</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
