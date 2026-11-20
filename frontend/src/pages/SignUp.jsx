import React from "react";
import { SignUp, useUser } from "@clerk/clerk-react";
import AuthLayout, { AuthLoading, useClerkAppearance } from "./AuthLayout";

export default function SignUpPage() {
  const { isLoaded } = useUser();
  const appearance = useClerkAppearance();
  if (!isLoaded) return <AuthLoading />;

  return (
    <AuthLayout footer={<p>Use your official pharmacy email address so your account can be verified.</p>}>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/dashboard"
        appearance={appearance}
      />
    </AuthLayout>
  );
}
