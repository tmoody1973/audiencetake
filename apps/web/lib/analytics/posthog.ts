import posthog from "posthog-js";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

const missingKeyMessage =
  "NEXT_PUBLIC_POSTHOG_KEY variable required by PostHog is missing or un-configured, " +
  "this causes events to be silently missed. This error stops appearing once " +
  "NEXT_PUBLIC_POSTHOG_KEY is configured";

let started = false;

export function initAnalytics(): void {
  if (started || typeof window === "undefined") {
    return;
  }
  if (!posthogKey) {
    if (process.env.NODE_ENV !== "production") {
      console.error(missingKeyMessage);
    }
    return;
  }

  posthog.init(posthogKey, {
    api_host: posthogHost,
    defaults: "2026-05-30",
  });
  started = true;
}

export function captureEvent(event: string, properties?: Record<string, unknown>): void {
  if (!started) {
    return;
  }
  posthog.capture(event, properties);
}

export function identifyUser(distinctId: string): void {
  if (!started) {
    return;
  }
  posthog.identify(distinctId);
}

export function resetAnalytics(): void {
  if (!started) {
    return;
  }
  posthog.reset();
}
