import React from "react";
import { useAuth } from "@clerk/clerk-react";
import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const { isSignedIn, isLoaded } = useAuth();
  const location = useLocation();

  // Show loading spinner while auth state is loading
  if (!isLoaded) {
    return (
      <div className="auth-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Redirect to sign-in if not authenticated
  if (!isSignedIn) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  // Render children if authenticated
  return children;
}
