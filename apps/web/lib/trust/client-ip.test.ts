import { afterEach, describe, expect, it, vi } from "vitest";

import { trustedVercelClientIp } from "./client-ip";

afterEach(() => vi.unstubAllEnvs());

describe("trustedVercelClientIp", () => {
  it("accepts the Vercel-overwritten client address in a Vercel runtime", () => {
    vi.stubEnv("VERCEL", "1");
    const request = new Request("https://example.test", {
      headers: { "x-forwarded-for": "203.0.113.8" },
    });
    expect(trustedVercelClientIp(request)).toBe("203.0.113.8");
  });

  it("accepts IPv6 addresses", () => {
    vi.stubEnv("VERCEL", "1");
    const request = new Request("https://example.test", {
      headers: { "x-forwarded-for": "2001:db8::8" },
    });
    expect(trustedVercelClientIp(request)).toBe("2001:db8::8");
  });

  it("ignores caller-controlled, ambiguous, and invalid values", () => {
    const untrusted = new Request("https://example.test", {
      headers: { "x-forwarded-for": "203.0.113.8" },
    });
    expect(trustedVercelClientIp(untrusted)).toBeNull();

    vi.stubEnv("VERCEL", "1");
    const chain = new Request("https://example.test", {
      headers: { "x-forwarded-for": "203.0.113.8, 198.51.100.4" },
    });
    const invalid = new Request("https://example.test", {
      headers: { "x-forwarded-for": "not-an-ip" },
    });
    expect(trustedVercelClientIp(chain)).toBeNull();
    expect(trustedVercelClientIp(invalid)).toBeNull();
  });
});
