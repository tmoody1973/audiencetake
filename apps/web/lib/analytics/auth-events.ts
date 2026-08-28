import { captureEvent, identifyUser, resetAnalytics } from "./posthog";

export type SignInMethod =
  | "google_popup"
  | "google_one_tap"
  | "email_password"
  | "email_link";

export type SignInIntent = "sign_in" | "create_account";

function failureReason(error: unknown): string {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  return typeof code === "string" ? code : "unknown";
}

export function trackSignInStarted(method: SignInMethod, intent: SignInIntent): void {
  captureEvent("auth_sign_in_started", { method, intent });
}

export function trackSignInCompleted(
  method: SignInMethod,
  intent: SignInIntent,
  uid: string,
): void {
  identifyUser(uid);
  captureEvent("auth_sign_in_completed", { method, intent });
}

export function trackSignInFailed(
  method: SignInMethod,
  intent: SignInIntent,
  error: unknown,
): void {
  captureEvent("auth_sign_in_failed", { method, intent, reason: failureReason(error) });
}

export function trackSignedOut(): void {
  captureEvent("auth_signed_out");
  resetAnalytics();
}

// Bracket a sign-in attempt with start/completed/failed events, identify the
// user on success, and rethrow so the caller can surface the error and navigate.
export async function trackSignIn<T extends { user: { uid: string } }>(
  method: SignInMethod,
  intent: SignInIntent,
  work: () => Promise<T>,
): Promise<T> {
  trackSignInStarted(method, intent);
  try {
    const credential = await work();
    trackSignInCompleted(method, intent, credential.user.uid);
    return credential;
  } catch (error) {
    trackSignInFailed(method, intent, error);
    throw error;
  }
}
