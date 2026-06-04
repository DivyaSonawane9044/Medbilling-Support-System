import React from "react";
import { SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import { Heart, CheckCircle, XCircle } from "lucide-react";
import "./LoginTest.css";

export default function LoginTest() {
  const { user, isSignedIn } = useUser();

  return (
    <div className="login-test-container">
      <div className="login-test-card">
        <div className="test-header">
          <Heart className="logo" />
          <h1>Login Redirect Test</h1>
          <p>Testing authentication flow to dashboard</p>
        </div>

        <SignedIn>
          <div className="auth-success">
            <CheckCircle className="success-icon" />
            <h2>✅ Login Successful!</h2>
            <div className="user-info">
              <p><strong>User:</strong> {user?.firstName} {user?.lastName}</p>
              <p><strong>Email:</strong> {user?.emailAddresses[0]?.emailAddress}</p>
              <p><strong>Status:</strong> Authenticated</p>
            </div>
            
            <div className="test-actions">
              <button 
                onClick={() => window.location.href = '/dashboard'}
                className="test-btn primary"
              >
                Go to Dashboard →
              </button>
              <button 
                onClick={() => window.location.href = '/sign-in'}
                className="test-btn secondary"
              >
                Test Sign In Page
              </button>
            </div>
          </div>
        </SignedIn>

        <SignedOut>
          <div className="auth-error">
            <XCircle className="error-icon" />
            <h2>❌ Not Logged In</h2>
            <div className="user-info">
              <p><strong>Status:</strong> Not Authenticated</p>
              <p><strong>Action:</strong> Please sign in first</p>
            </div>
            
            <div className="test-actions">
              <button 
                onClick={() => window.location.href = '/sign-in'}
                className="test-btn primary"
              >
                Go to Sign In →
              </button>
              <button 
                onClick={() => window.location.href = '/sign-up'}
                className="test-btn secondary"
              >
                Create Account
              </button>
            </div>
          </div>
        </SignedOut>

        <div className="debug-info">
          <h3>Debug Information</h3>
          <div className="debug-grid">
            <div className="debug-item">
              <label>Current Path:</label>
              <span>{window.location.pathname}</span>
            </div>
            <div className="debug-item">
              <label>Is Signed In:</label>
              <span>{isSignedIn ? 'Yes' : 'No'}</span>
            </div>
            <div className="debug-item">
              <label>Redirect Target:</label>
              <span>/dashboard</span>
            </div>
            <div className="debug-item">
              <label>Time:</label>
              <span>{new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
