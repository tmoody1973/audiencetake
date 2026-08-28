import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./posthog", () => ({
  captureEvent: vi.fn(),
  identifyUser: vi.fn(),
  resetAnalytics: vi.fn(),
}));

import { captureEvent, identifyUser, resetAnalytics } from "./posthog";
import {
  trackSignedOut,
  trackSignIn,
  trackSignInCompleted,
  trackSignInFailed,
  trackSignInStarted,
} from "./auth-events";

afterEach(() => vi.clearAllMocks());

describe("auth analytics", () => {
  it("records the start of a sign-in attempt", () => {
    trackSignInStarted("google_popup", "sign_in");
    expect(captureEvent).toHaveBeenCalledWith("auth_sign_in_started", {
      method: "google_popup",
      intent: "sign_in",
    });
  });

  it("identifies the user on a completed sign-in", () => {
    trackSignInCompleted("email_password", "create_account", "user-1");
    expect(identifyUser).toHaveBeenCalledWith("user-1");
    expect(captureEvent).toHaveBeenCalledWith("auth_sign_in_completed", {
      method: "email_password",
      intent: "create_account",
    });
  });

  it("records the firebase error code and never the message", () => {
    trackSignInFailed("email_link", "sign_in", { code: "auth/expired-action-code", message: "fan@x" });
    expect(captureEvent).toHaveBeenCalledWith("auth_sign_in_failed", {
      method: "email_link",
      intent: "sign_in",
      reason: "auth/expired-action-code",
    });
  });

  it("falls back to an unknown reason for opaque errors", () => {
    trackSignInFailed("google_one_tap", "sign_in", new Error("boom"));
    expect(captureEvent).toHaveBeenCalledWith(
      "auth_sign_in_failed",
      expect.objectContaining({ reason: "unknown" }),
    );
  });

  it("resets analytics identity on sign-out", () => {
    trackSignedOut();
    expect(captureEvent).toHaveBeenCalledWith("auth_signed_out");
    expect(resetAnalytics).toHaveBeenCalled();
  });

  it("brackets successful work with start and completed events", async () => {
    const result = await trackSignIn("google_popup", "sign_in", () =>
      Promise.resolve({ user: { uid: "user-1" } }),
    );
    expect(result.user.uid).toBe("user-1");
    expect(captureEvent).toHaveBeenCalledWith("auth_sign_in_started", {
      method: "google_popup",
      intent: "sign_in",
    });
    expect(identifyUser).toHaveBeenCalledWith("user-1");
    expect(captureEvent).toHaveBeenCalledWith("auth_sign_in_completed", {
      method: "google_popup",
      intent: "sign_in",
    });
  });

  it("tracks a failure and rethrows when work rejects", async () => {
    const boom = { code: "auth/popup-closed-by-user" };
    await expect(
      trackSignIn("google_popup", "sign_in", () => Promise.reject(boom)),
    ).rejects.toBe(boom);
    expect(captureEvent).toHaveBeenCalledWith("auth_sign_in_failed", {
      method: "google_popup",
      intent: "sign_in",
      reason: "auth/popup-closed-by-user",
    });
    expect(identifyUser).not.toHaveBeenCalled();
  });
});
