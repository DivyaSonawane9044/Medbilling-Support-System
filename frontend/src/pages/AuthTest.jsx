import React from "react";
import { SignedIn, SignedOut, RedirectToSignIn, useUser } from "@clerk/clerk-react";
import { Heart, Shield, CheckCircle, AlertCircle } from "lucide-react";
import "./AuthTest.css";

export default function AuthTest() {
  const { user, isSignedIn } = useUser();

  return (
    <div className="auth-test-container">
      <div className="auth-test-card">
        <div className="auth-header">
          <Heart className="auth-logo" />
          <h1>MEDBILLING AUTHENTICATION TEST</h1>
          <p>Testing Clerk Authentication Flow</p>
        </div>

        <SignedIn>
          <div className="auth-success">
            <CheckCircle className="success-icon" />
            <h2>✅ Authentication Successful!</h2>
            <div className="user-info">
              <p><strong>User:</strong> {user?.firstName} {user?.lastName}</p>
              <p><strong>Email:</strong> {user?.emailAddresses[0]?.emailAddress}</p>
              <p><strong>User ID:</strong> {user?.id}</p>
              <p><strong>Status:</strong> Signed In</p>
            </div>
            
            <div className="auth-actions">
              <button 
                onClick={() => window.location.href = '/dashboard'}
                className="dashboard-btn"
              >
                Go to Dashboard →
              </button>
              <button 
                onClick={() => window.location.href = '/sign-in'}
                className="signout-btn"
              >
                Sign Out
              </button>
            </div>
          </div>
        </SignedIn>

        <SignedOut>
          <div className="auth-required">
            <AlertCircle className="alert-icon" />
            <h2>🔒 Authentication Required</h2>
            <p>You need to sign in to access this content.</p>
            
            <div className="auth-actions">
              <RedirectToSignIn>
                <button className="signin-btn">
                  Sign In Now
                </button>
              </RedirectToSignIn>
              <button 
                onClick={() => window.location.href = '/sign-up'}
                className="signup-btn"
              >
                Create Account
              </button>
            </div>
          </div>
        </SignedOut>

        <div className="auth-debug">
          <h3>Debug Information</h3>
          <div className="debug-info">
            <p><strong>Authentication State:</strong> {isSignedIn ? 'Signed In' : 'Signed Out'}</p>
            <p><strong>Current Path:</strong> {window.location.pathname}</p>
            <p><strong>Time:</strong> {new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
