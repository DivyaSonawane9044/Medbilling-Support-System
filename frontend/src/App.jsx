import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SignedIn, SignedOut, useUser } from "@clerk/clerk-react";

// Lazy load components to prevent resource loading issues
const MainLayout = lazy(() => import("./layout/MainLayout"));
const SignIn = lazy(() => import("./pages/SignIn"));
const SignUp = lazy(() => import("./pages/SignUp"));
const AuthTest = lazy(() => import("./pages/AuthTest"));
const DebugAuth = lazy(() => import("./pages/DebugAuth"));
const LoginTest = lazy(() => import("./pages/LoginTest"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Billing = lazy(() => import("./pages/Billing"));
const Medicines = lazy(() => import("./pages/ProductMaster"));
const AddMedicine = lazy(() => import("./pages/ProductMaster"));
const ExpiryAlerts = lazy(() => import("./pages/ExpiryTracking"));
const ExpiryTracking = lazy(() => import("./pages/ExpiryTracking"));
const StockAlerts = lazy(() => import("./pages/ExpiryTracking"));
const MedicineSchedule = lazy(() => import("./pages/MedicineSchedule"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Customers = lazy(() => import("./pages/Customers"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Purchases = lazy(() => import("./pages/Purchases"));
const Reports = lazy(() => import("./pages/Reports"));
const Payments = lazy(() => import("./pages/Payments"));
const Accounting = lazy(() => import("./pages/Accounting"));
const Analytics = lazy(() => import("./pages/Analytics"));
const ProductMaster = lazy(() => import("./pages/ProductMaster"));
const Settings = lazy(() => import("./pages/Settings"));

// Loading component for lazy loading
const LoadingSpinner = () => (
  <div className="loading-container">
    <div className="loading-spinner"></div>
  </div>
);

function App() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) {
    return <LoadingSpinner />;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Root route - Conditional redirect based on auth state */}
        <Route 
          path="/" 
          element={
            isSignedIn ? <Navigate to="/dashboard" replace /> : <Navigate to="/sign-in" replace />
          } 
        />

        {/* Public Authentication Routes */}
        <Route 
          path="/sign-in" 
          element={
            isSignedIn ? <Navigate to="/dashboard" replace /> : (
              <Suspense fallback={<LoadingSpinner />}>
                <SignIn />
              </Suspense>
            )
          } 
        />
        
        <Route 
          path="/sign-up" 
          element={
            isSignedIn ? <Navigate to="/dashboard" replace /> : (
              <Suspense fallback={<LoadingSpinner />}>
                <SignUp />
              </Suspense>
            )
          } 
        />

        {/* Debug Routes - For testing authentication flow */}
        <Route 
          path="/auth-test" 
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <AuthTest />
            </Suspense>
          } 
        />
        
        <Route 
          path="/debug-auth" 
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <DebugAuth />
            </Suspense>
          } 
        />

        <Route 
          path="/login-test" 
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <LoginTest />
            </Suspense>
          } 
        />

        {/* Protected Dashboard Route */}
        <Route 
          path="/dashboard" 
          element={
            isSignedIn ? (
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout />
              </Suspense>
            ) : <Navigate to="/sign-in" replace />
          }
        >
          <Route index element={
            <Suspense fallback={<LoadingSpinner />}>
              <Dashboard />
            </Suspense>
          } />
        </Route>

        {/* Protected Billing Routes */}
        <Route 
          path="/sales" 
          element={
            isSignedIn ? (
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout />
              </Suspense>
            ) : <Navigate to="/sign-in" replace />
          }
        >
          <Route index element={
            <Suspense fallback={<LoadingSpinner />}>
              <Billing />
            </Suspense>
          } />
        </Route>

        <Route 
          path="/billing" 
          element={
            isSignedIn ? (
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout />
              </Suspense>
            ) : <Navigate to="/sign-in" replace />
          }
        >
          <Route index element={
            <Suspense fallback={<LoadingSpinner />}>
              <Billing />
            </Suspense>
          } />
        </Route>

        {/* Protected Medicine Routes */}
        <Route 
          path="/medicines" 
          element={
            isSignedIn ? (
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout />
              </Suspense>
            ) : <Navigate to="/sign-in" replace />
          }
        >
          <Route index element={
            <Suspense fallback={<LoadingSpinner />}>
              <Medicines />
            </Suspense>
          } />
        </Route>

        <Route 
          path="/add-medicine" 
          element={
            isSignedIn ? (
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout />
              </Suspense>
            ) : <Navigate to="/sign-in" replace />
          }
        >
          <Route index element={
            <Suspense fallback={<LoadingSpinner />}>
              <AddMedicine />
            </Suspense>
          } />
        </Route>

        <Route 
          path="/expiry-alerts" 
          element={
            isSignedIn ? (
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout />
              </Suspense>
            ) : <Navigate to="/sign-in" replace />
          }
        >
          <Route index element={
            <Suspense fallback={<LoadingSpinner />}>
              <ExpiryAlerts />
            </Suspense>
          } />
        </Route>

        <Route 
          path="/expiry-tracking" 
          element={
            isSignedIn ? (
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout />
              </Suspense>
            ) : <Navigate to="/sign-in" replace />
          }
        >
          <Route index element={
            <Suspense fallback={<LoadingSpinner />}>
              <ExpiryTracking />
            </Suspense>
          } />
        </Route>

        <Route 
          path="/stock-alerts" 
          element={
            isSignedIn ? (
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout />
              </Suspense>
            ) : <Navigate to="/sign-in" replace />
          }
        >
          <Route index element={
            <Suspense fallback={<LoadingSpinner />}>
              <StockAlerts />
            </Suspense>
          } />
        </Route>

        <Route 
          path="/medicine-schedule" 
          element={
            isSignedIn ? (
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout />
              </Suspense>
            ) : <Navigate to="/sign-in" replace />
          }
        >
          <Route index element={
            <Suspense fallback={<LoadingSpinner />}>
              <MedicineSchedule />
            </Suspense>
          } />
        </Route>

        {/* Protected Inventory Route */}
        <Route 
          path="/inventory" 
          element={
            isSignedIn ? (
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout />
              </Suspense>
            ) : <Navigate to="/sign-in" replace />
          }
        >
          <Route index element={
            <Suspense fallback={<LoadingSpinner />}>
              <Inventory />
            </Suspense>
          } />
        </Route>

        {/* Protected Customer Routes */}
        <Route 
          path="/customers" 
          element={
            isSignedIn ? (
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout />
              </Suspense>
            ) : <Navigate to="/sign-in" replace />
          }
        >
          <Route index element={
            <Suspense fallback={<LoadingSpinner />}>
              <Customers />
            </Suspense>
          } />
        </Route>

        {/* Protected Supplier Routes */}
        <Route 
          path="/suppliers" 
          element={
            isSignedIn ? (
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout />
              </Suspense>
            ) : <Navigate to="/sign-in" replace />
          }
        >
          <Route index element={
            <Suspense fallback={<LoadingSpinner />}>
              <Suppliers />
            </Suspense>
          } />
        </Route>

        {/* Protected Purchase Routes */}
        <Route 
          path="/purchases" 
          element={
            isSignedIn ? (
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout />
              </Suspense>
            ) : <Navigate to="/sign-in" replace />
          }
        >
          <Route index element={
            <Suspense fallback={<LoadingSpinner />}>
              <Purchases />
            </Suspense>
          } />
        </Route>

        {/* Protected Report Routes */}
        <Route 
          path="/reports" 
          element={
            isSignedIn ? (
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout />
              </Suspense>
            ) : <Navigate to="/sign-in" replace />
          }
        >
          <Route index element={
            <Suspense fallback={<LoadingSpinner />}>
              <Reports />
            </Suspense>
          } />
        </Route>

        {/* Protected Payment Routes */}
        <Route 
          path="/payments" 
          element={
            isSignedIn ? (
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout />
              </Suspense>
            ) : <Navigate to="/sign-in" replace />
          }
        >
          <Route index element={
            <Suspense fallback={<LoadingSpinner />}>
              <Payments />
            </Suspense>
          } />
        </Route>

        {/* Protected Accounting Routes */}
        <Route 
          path="/accounting" 
          element={
            isSignedIn ? (
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout />
              </Suspense>
            ) : <Navigate to="/sign-in" replace />
          }
        >
          <Route index element={
            <Suspense fallback={<LoadingSpinner />}>
              <Accounting />
            </Suspense>
          } />
        </Route>

        {/* Protected Analytics Routes */}
        <Route 
          path="/analytics" 
          element={
            isSignedIn ? (
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout />
              </Suspense>
            ) : <Navigate to="/sign-in" replace />
          }
        >
          <Route index element={
            <Suspense fallback={<LoadingSpinner />}>
              <Analytics />
            </Suspense>
          } />
        </Route>

        {/* Protected Product Master Routes */}
        <Route 
          path="/product-master" 
          element={
            isSignedIn ? (
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout />
              </Suspense>
            ) : <Navigate to="/sign-in" replace />
          }
        >
          <Route index element={
            <Suspense fallback={<LoadingSpinner />}>
              <ProductMaster />
            </Suspense>
          } />
        </Route>

        {/* Protected Settings Routes */}
        <Route 
          path="/settings" 
          element={
            isSignedIn ? (
              <Suspense fallback={<LoadingSpinner />}>
                <MainLayout />
              </Suspense>
            ) : <Navigate to="/sign-in" replace />
          }
        >
          <Route index element={
            <Suspense fallback={<LoadingSpinner />}>
              <Settings />
            </Suspense>
          } />
        </Route>

        {/* Catch all route - Redirect based on auth state */}
        <Route 
          path="*" 
          element={
            isSignedIn ? <Navigate to="/dashboard" replace /> : <Navigate to="/sign-in" replace />
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;