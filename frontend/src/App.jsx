import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";

const MainLayout = lazy(() => import("./layout/MainLayout"));
const SignIn = lazy(() => import("./pages/SignIn"));
const SignUp = lazy(() => import("./pages/SignUp"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Billing = lazy(() => import("./pages/Billing"));
const ProductMaster = lazy(() => import("./pages/ProductMaster"));
const ExpiryTracking = lazy(() => import("./pages/ExpiryTracking"));
const MedicineSchedule = lazy(() => import("./pages/MedicineSchedule"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Customers = lazy(() => import("./pages/Customers"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Purchases = lazy(() => import("./pages/Purchases"));
const Reports = lazy(() => import("./pages/Reports"));
const Payments = lazy(() => import("./pages/Payments"));
const Accounting = lazy(() => import("./pages/Accounting"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Settings = lazy(() => import("./pages/Settings"));

const LoadingSpinner = () => (
  <div className="loading-container">
    <div className="loading-spinner"></div>
  </div>
);

// Signed-in users only; everyone else goes to sign-in and comes back afterwards.
function RequireAuth({ isSignedIn, children }) {
  const location = useLocation();
  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }
  return children;
}

// Page path -> component. Several sidebar entries intentionally share a page.
const protectedPages = [
  ["/dashboard", Dashboard],
  ["/sales", Billing],
  ["/billing", Billing],
  ["/medicines", ProductMaster],
  ["/add-medicine", ProductMaster],
  ["/product-master", ProductMaster],
  ["/expiry-alerts", ExpiryTracking],
  ["/expiry-tracking", ExpiryTracking],
  ["/stock-alerts", ExpiryTracking],
  ["/medicine-schedule", MedicineSchedule],
  ["/inventory", Inventory],
  ["/customers", Customers],
  ["/suppliers", Suppliers],
  ["/purchases", Purchases],
  ["/reports", Reports],
  ["/payments", Payments],
  ["/accounting", Accounting],
  ["/analytics", Analytics],
  ["/settings", Settings],
];

function App() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) {
    return <LoadingSpinner />;
  }

  const home = isSignedIn ? "/dashboard" : "/sign-in";

  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<Navigate to={home} replace />} />

          {/* Clerk moves through sub-paths (factor-one, verify-email-address, sso-callback) */}
          <Route path="/sign-in/*" element={isSignedIn ? <Navigate to="/dashboard" replace /> : <SignIn />} />
          <Route path="/sign-up/*" element={isSignedIn ? <Navigate to="/dashboard" replace /> : <SignUp />} />

          <Route
            element={
              <RequireAuth isSignedIn={isSignedIn}>
                <MainLayout />
              </RequireAuth>
            }
          >
            {protectedPages.map(([path, Page]) => (
              <Route key={path} path={path} element={<Page />} />
            ))}
          </Route>

          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
