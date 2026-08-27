import { Suspense } from "react";

import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <Suspense fallback={<main className="sign-in-page"><p>Loading secure sign-in…</p></main>}>
      <SignInForm />
    </Suspense>
  );
}
