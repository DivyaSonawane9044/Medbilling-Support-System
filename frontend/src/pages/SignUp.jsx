import React, { useEffect } from "react";
import { SignUp, useUser } from "@clerk/clerk-react";
import { Link, useNavigate } from "react-router-dom";
import { Pill, ShieldCheck } from "lucide-react";
import "./SignIn.css";

export default function SignUpPage() {
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
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="signin-container">
      <div className="signin-left">
        <div className="medical-branding">
          <div className="brand-header">
            <Pill className="brand-icon" style={{ width: 56, height: 56, margin: "0 auto 1rem" }} />
            <h1 className="brand-title">Join MEDBILLING</h1>
            <p className="brand-subtitle">Register your pharmacy team account</p>
          </div>
        </div>
      </div>
      <div className="signin-right">
        <div className="signin-form-container">
          <div className="form-header">
            <h2 className="form-title">Create Account</h2>
            <p className="form-subtitle">Set up access for billing, inventory, and reports.</p>
          </div>
          <div className="clerk-form-wrapper">
            <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" afterSignUpUrl="/dashboard" />
          </div>
          <div className="form-footer">
            <p className="footer-text">
              Already registered? <Link to="/sign-in" className="footer-link">Sign in</Link>
            </p>
          </div>
          <div className="security-notice">
            <ShieldCheck className="security-icon" />
            <div className="security-content">
              <h4>Pharmacy staff only</h4>
              <p>Use your official pharmacy email for account verification.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
