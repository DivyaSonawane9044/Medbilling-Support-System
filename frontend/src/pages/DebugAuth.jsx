import React from "react";
import { SignedIn, SignedOut, useUser, useAuth } from "@clerk/clerk-react";
import { Heart, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import "./DebugAuth.css";

export default function DebugAuth() {
  const { user, isSignedIn } = useUser();
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <div className="debug-container">
        <div className="debug-card">
          <RefreshCw className="loading-icon" />
          <h2>Loading Authentication...</h2>
          <p>Please wait while we check your authentication status.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="debug-container">
      <div className="debug-card">
        <div className="debug-header">
          <Heart className="logo" />
          <h1>MEDBILLING AUTH DEBUG</h1>
          <p>Authentication Status Checker</p>
        </div>

        <SignedIn>
          <div className="auth-success">
            <CheckCircle className="success-icon" />
            <h2>✅ AUTHENTICATION SUCCESSFUL</h2>
            
            <div className="user-details">
              <h3>User Information:</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Name:</label>
                  <span>{user?.firstName} {user?.lastName}</span>
                </div>
                <div className="detail-item">
                  <label>Email:</label>
                  <span>{user?.emailAddresses[0]?.emailAddress}</span>
                </div>
                <div className="detail-item">
                  <label>User ID:</label>
                  <span className="mono">{user?.id}</span>
                </div>
                <div className="detail-item">
                  <label>Status:</label>
                  <span className="status-success">Signed In</span>
                </div>
              </div>
            </div>

            <div className="test-section">
              <h3>Navigation Test:</h3>
              <div className="button-grid">
                <button 
                  onClick={() => window.location.href = '/dashboard'}
                  className="test-btn primary"
                >
                  Go to Dashboard
                </button>
                <button 
                  onClick={() => window.location.href = '/billing'}
                  className="test-btn"
                >
                  Go to Billing
                </button>
                <button 
                  onClick={() => window.location.href = '/inventory'}
                  className="test-btn"
                >
                  Go to Inventory
                </button>
                <button 
                  onClick={() => window.location.href = '/sign-in'}
                  className="test-btn secondary"
                >
                  Test Sign In Page
                </button>
              </div>
            </div>
          </div>
        </SignedIn>

        <SignedOut>
          <div className="auth-error">
            <XCircle className="error-icon" />
            <h2>❌ NOT AUTHENTICATED</h2>
            
            <div className="user-details">
              <h3>Authentication Status:</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Status:</label>
                  <span className="status-error">Signed Out</span>
                </div>
                <div className="detail-item">
                  <label>User:</label>
                  <span>Not Available</span>
                </div>
                <div className="detail-item">
                  <label>Session:</label>
                  <span>No Active Session</span>
                </div>
              </div>
            </div>

            <div className="test-section">
              <h3>Authentication Test:</h3>
              <div className="button-grid">
                <button 
                  onClick={() => window.location.href = '/sign-in'}
                  className="test-btn primary"
                >
                  Go to Sign In
                </button>
                <button 
                  onClick={() => window.location.href = '/sign-up'}
                  className="test-btn"
                >
                  Go to Sign Up
                </button>
                <button 
                  onClick={() => window.location.href = '/dashboard'}
                  className="test-btn secondary"
                >
                  Test Dashboard Redirect
                </button>
              </div>
            </div>
          </div>
        </SignedOut>

        <div className="debug-info">
          <h3>Debug Information</h3>
          <div className="debug-grid">
            <div className="debug-item">
              <label>Auth Loaded:</label>
              <span>{isLoaded ? 'Yes' : 'No'}</span>
            </div>
            <div className="debug-item">
              <label>Is Signed In:</label>
              <span>{isSignedIn ? 'Yes' : 'No'}</span>
            </div>
            <div className="debug-item">
              <label>Current Path:</label>
              <span className="mono">{window.location.pathname}</span>
            </div>
            <div className="debug-item">
              <label>Timestamp:</label>
              <span>{new Date().toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
