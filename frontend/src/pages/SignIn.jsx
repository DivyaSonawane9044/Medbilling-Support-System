import React, { useEffect } from "react";
import { SignIn, useUser } from "@clerk/clerk-react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  HeartPulse,
  Package,
  ShieldCheck,
  Pill,
} from "lucide-react";
import "./SignIn.css";

export default function SignInPage() {
  const { isSignedIn, isLoaded } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate("/dashboard", { replace: true });
    }
  }, [isLoaded, isSignedIn, navigate]);

  if (!isLoaded) {
    return (
      <div className="signin-loading">
        <div className="loading-spinner" />
        <p>Loading MedBilling Support System...</p>
      </div>
    );
  }

  return (
    <div className="signin-container">
      <div className="signin-left">
        <div className="medical-branding">
          <div className="brand-header">
            <div className="brand-logo">
              <Pill className="brand-icon" />
              <HeartPulse className="brand-icon activity" />
            </div>
            <h1 className="brand-title">MEDBILLING</h1>
            <p className="brand-subtitle">Pharmacy Retail & Billing Support System</p>
          </div>

          <div className="medical-features">
            <div className="feature-card">
              <Package className="feature-icon" />
              <div className="feature-content">
                <h3>Inventory & Batch Control</h3>
                <p>Track stock, expiry, FEFO batches, and supplier receipts in one place.</p>
              </div>
            </div>
            <div className="feature-card">
              <Activity className="feature-icon" />
              <div className="feature-content">
                <h3>Fast GST Billing</h3>
                <p>Strip/tablet sales, dosage on bills, and instant invoice PDF export.</p>
              </div>
            </div>
            <div className="feature-card">
              <ShieldCheck className="feature-icon" />
              <div className="feature-content">
                <h3>Secure Pharmacy Operations</h3>
                <p>Role-based access, payment tracking, and compliance-ready reports.</p>
              </div>
            </div>
          </div>

          <div className="brand-footer">
            <p>Trusted by retail pharmacies for daily dispensing and accounts.</p>
            <div className="trust-badges">
              <span className="badge">GST Ready</span>
              <span className="badge">HIPAA-style Security</span>
              <span className="badge">24/7 Uptime</span>
            </div>
          </div>
        </div>
      </div>

      <div className="signin-right">
        <div className="signin-form-container">
          <div className="form-header">
            <div className="form-logo">
              <Pill className="form-icon" />
            </div>
            <h2 className="form-title">Welcome Back</h2>
            <p className="form-subtitle">
              Sign in to manage billing, inventory, purchases, and pharmacy reports.
            </p>
          </div>

          <div className="clerk-form-wrapper">
            <SignIn
              routing="path"
              path="/sign-in"
              signUpUrl="/sign-up"
              afterSignInUrl="/dashboard"
              appearance={{
                elements: {
                  rootBox: "clerk-root-box",
                  card: "clerk-card",
                  header: "clerk-header",
                  formButtonPrimary: "clerk-form-button",
                  formFieldInput: "clerk-form-input",
                  formFieldLabel: "clerk-form-label",
                  footerActionLink: "clerk-footer-link",
                  socialButtonsBlockButton: "clerk-social-button",
                },
              }}
            />
          </div>

          <div className="form-footer">
            <p className="footer-text">
              New pharmacy staff?{" "}
              <Link to="/sign-up" className="footer-link">
                Create an account
              </Link>
            </p>
            <div className="help-links">
              <a href="#" className="help-link" onClick={(e) => e.preventDefault()}>
                Forgot password?
              </a>
              <a href="#" className="help-link" onClick={(e) => e.preventDefault()}>
                Contact support
              </a>
            </div>
          </div>

          <div className="security-notice">
            <ShieldCheck className="security-icon" />
            <div className="security-content">
              <h4>Secure login</h4>
              <p>Your session is encrypted. Do not share credentials with unauthorized users.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
