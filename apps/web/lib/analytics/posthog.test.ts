import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("posthog-js", () => ({
  default: { init: vi.fn(), capture: vi.fn(), identify: vi.fn(), reset: vi.fn() },
}));

import posthog from "posthog-js";

import { captureEvent, initAnalytics } from "./posthog";

afterEach(() => vi.clearAllMocks());

describe("analytics guard", () => {
  it("stays a loud no-op when the project key is missing", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    initAnalytics();
    captureEvent("auth_sign_in_started", { method: "email_password" });

    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.stringContaining("NEXT_PUBLIC_POSTHOG_KEY"));
    error.mockRestore();
  });
});
