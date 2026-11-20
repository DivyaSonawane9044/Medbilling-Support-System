import React from "react";
import { SignIn, useUser } from "@clerk/clerk-react";
import AuthLayout, { AuthLoading, useClerkAppearance } from "./AuthLayout";

export default function SignInPage() {
  const { isLoaded } = useUser();
  const appearance = useClerkAppearance();
  if (!isLoaded) return <AuthLoading />;

  return (
    <AuthLayout
      footer={
        <p>
          Forgot your password? Enter your email and choose <strong>Continue</strong>, then select{" "}
          <strong>Forgot password?</strong> on the next step.
        </p>
      }
    >
      {/* Clerk handles sign-in, password reset, MFA and CAPTCHA; signed-in users are redirected by App.jsx */}
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard"
        appearance={appearance}
      />
    </AuthLayout>
  );
}
