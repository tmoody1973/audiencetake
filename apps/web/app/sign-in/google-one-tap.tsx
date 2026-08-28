"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { trackSignIn } from "../../lib/analytics/auth-events";
import { signInWithGoogleCredential } from "../../lib/auth/sign-in";

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const scriptId = "google-identity-services";
const scriptSrc = "https://accounts.google.com/gsi/client";

type OneTapResponse = { credential?: string };

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (response: OneTapResponse) => void }) => void;
      prompt: () => void;
    };
  };
};

export function GoogleOneTap({ returnTo }: { returnTo: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!clientId || typeof window === "undefined") {
      return;
    }

    const prompt = () => {
      const google = (window as unknown as { google?: GoogleIdentity }).google;
      if (!google) {
        return;
      }
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          const idToken = response.credential;
          if (!idToken) {
            return;
          }
          trackSignIn("google_one_tap", "sign_in", () => signInWithGoogleCredential(idToken))
            .then(() => router.replace(returnTo))
            .catch(() => undefined);
        },
      });
      google.accounts.id.prompt();
    };

    if (document.getElementById(scriptId)) {
      prompt();
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = scriptSrc;
    script.async = true;
    script.onload = prompt;
    document.head.appendChild(script);
  }, [router, returnTo]);

  return null;
}
