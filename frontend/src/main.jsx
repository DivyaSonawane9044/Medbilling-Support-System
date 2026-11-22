import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
// Design tokens, base typography and shared components (.card, .btn) used by every page
import "./theme/theme.css";
import "./theme/typography.css";
import "./theme/global.css";
import "./theme/light.css";
import "./styles/loading.css";
import App from "./App.jsx";
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { LoadingProvider } from './context/LoadingContext.jsx';
import { ThemeProvider, useTheme, applyTheme, readTheme } from './context/ThemeContext.jsx';

// Publishable keys are public by design; the secret key must never be in the frontend.
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Wording for the first step of the Clerk cards; later steps keep Clerk's own titles.
const clerkLocalization = {
  signIn: { start: { title: "Welcome back", subtitle: "Sign in to your MedBilling account." } },
  signUp: { start: { title: "Create your account", subtitle: "Join MedBilling to manage your pharmacy." } },
};

// Clerk colours for each app theme (user menu popover, profile modal).
// The sign-in / sign-up cards add their own layout tweaks in pages/AuthLayout.jsx.
const clerkThemes = {
  dark: {
    variables: {
      colorPrimary: "#d4af37",
      colorTextOnPrimaryBackground: "#14110a",
      colorText: "#ffffff",
      colorTextSecondary: "#a1a1aa",
      colorBackground: "#181a20",
      colorInputBackground: "#1f2229",
      colorInputText: "#ffffff",
      colorNeutral: "#ffffff",
      colorDanger: "#f87171",
    },
  },
  light: {
    variables: {
      colorPrimary: "#0e7f78",
      colorTextOnPrimaryBackground: "#ffffff",
      colorText: "#111827",
      colorTextSecondary: "#5b6475",
      colorBackground: "#ffffff",
      colorInputBackground: "#f8fafc",
      colorInputText: "#111827",
      colorDanger: "#c62828",
    },
  },
};

// Apply the saved theme before the first paint (no dark/white flash)
applyTheme(readTheme());

function ThemedClerk({ children }) {
  const { theme } = useTheme();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      afterSignOutUrl="/sign-in"
      localization={clerkLocalization}
      appearance={clerkThemes[theme]}
    >
      {children}
    </ClerkProvider>
  );
}


const root = ReactDOM.createRoot(document.getElementById("root"));

if (!clerkPubKey) {
  root.render(
    <div style={{ padding: 32, fontFamily: "sans-serif" }}>
      <h2>Configuration needed</h2>
      <p>
        Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> in <code>frontend/.env</code> (see
        <code> frontend/.env.example</code>) and restart the dev server.
      </p>
    </div>
  );
} else {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <ThemedClerk>
            <LoadingProvider>
              <App />
            </LoadingProvider>
          </ThemedClerk>
        </ThemeProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
