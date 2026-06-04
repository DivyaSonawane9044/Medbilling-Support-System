import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App.jsx";
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { LoadingProvider } from './context/LoadingContext.jsx';

const clerkPubKey = "pk_test_cmVmaW5lZC1hbGJhY29yZS04NC5jbGVyay5hY2NvdW50cy5kZXYk";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ClerkProvider 
        publishableKey={clerkPubKey}
        afterSignInUrl="/dashboard"   
        afterSignUpUrl="/dashboard"   
      >
        <LoadingProvider>
          <App />
        </LoadingProvider>
      </ClerkProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
