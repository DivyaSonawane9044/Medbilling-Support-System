import React from "react";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { Heart, Activity, Shield, Users, TrendingUp, Package } from "lucide-react";
import "./ProtectedDashboard.css";

export default function ProtectedDashboard() {
  return (
    <div className="dashboard-container">
      {/* Header with User Info */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo">
            <Heart className="logo-icon" />
            <h1>MEDBILLING SUPPORT SYSTEM</h1>
          </div>
        </div>
        
        <div className="header-right">
          <SignedIn>
            <div className="user-info">
              <UserButton />
            </div>
          </SignedIn>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="dashboard-main">
        <SignedIn>
          <div className="dashboard-content">
            <div className="welcome-section">
              <h2>Welcome to Your Dashboard</h2>
              <p>Manage your pharmacy operations efficiently</p>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">
                  <Package />
                </div>
                <div className="stat-content">
                  <h3>Inventory</h3>
                  <p className="stat-number">1,234</p>
                  <p className="stat-label">Total Items</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">
                  <TrendingUp />
                </div>
                <div className="stat-content">
                  <h3>Revenue</h3>
                  <p className="stat-number">$45,678</p>
                  <p className="stat-label">This Month</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">
                  <Users />
                </div>
                <div className="stat-content">
                  <h3>Customers</h3>
                  <p className="stat-number">892</p>
                  <p className="stat-label">Active</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">
                  <Shield />
                </div>
                <div className="stat-content">
                  <h3>Security</h3>
                  <p className="stat-number">100%</p>
                  <p className="stat-label">Protected</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="quick-actions">
              <h3>Quick Actions</h3>
              <div className="actions-grid">
                <button className="action-btn">
                  <Activity />
                  New Sale
                </button>
                <button className="action-btn">
                  <Package />
                  Add Medicine
                </button>
                <button className="action-btn">
                  <Users />
                  Add Customer
                </button>
                <button className="action-btn">
                  <TrendingUp />
                  View Reports
                </button>
              </div>
            </div>
          </div>
        </SignedIn>

        <SignedOut>
          <div className="auth-required">
            <div className="auth-message">
              <Shield className="auth-icon" />
              <h2>Authentication Required</h2>
              <p>Please sign in to access your dashboard</p>
              <button 
                onClick={() => window.location.href = '/sign-in'}
                className="signin-btn"
              >
                Go to Sign In
              </button>
            </div>
          </div>
        </SignedOut>
      </main>
    </div>
  );
}
