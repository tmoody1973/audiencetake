import { describe, expect, it, vi } from "vitest";

import {
  canonicalizeUrl,
  intakePublicUrl,
  isPublicIpAddress,
  sourceFingerprint,
} from "./url-policy";

const PUBLIC_IP = "93.184.216.34";

describe("nomination URL policy", () => {
  it("canonicalizes trackers, fragments, query order, ports, and trailing slashes", () => {
    expect(
      canonicalizeUrl("https://EXAMPLE.com:443/watch/?utm_source=x&v=abc&b=2&a=1#scene"),
    ).toBe("https://example.com/watch?a=1&b=2&v=abc");
  });

  it("preserves content identifiers", () => {
    expect(canonicalizeUrl("https://www.youtube.com/watch?utm_medium=social&v=M2djoKmnOTY"))
      .toBe("https://www.youtube.com/watch?v=M2djoKmnOTY");
  });

  it.each([
    "127.0.0.1",
    "10.0.1.2",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "fd00::1",
    "fe80::1",
  ])("rejects non-public address %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(false);
  });

  it("rechecks DNS safety after each redirect", async () => {
    const probe = vi.fn()
      .mockResolvedValueOnce({ status: 302, location: "https://private.example/target" })
      .mockResolvedValueOnce({ status: 200, contentType: "text/html" });
    const resolve = vi.fn(async (hostname: string) =>
      hostname === "private.example" ? ["10.0.0.8"] : [PUBLIC_IP],
    );

    await expect(
      intakePublicUrl("https://public.example/source", { resolve, probe }),
    ).rejects.toMatchObject({ code: "non_public_host" });
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("accepts a finite public redirect chain longer than three hops", async () => {
    const redirects = new Map([
      ["/source", "/hop-1"],
      ["/hop-1", "/hop-2"],
      ["/hop-2", "/hop-3"],
      ["/hop-3", "/hop-4"],
    ]);
    const probe = vi.fn(async (url: URL) => {
      const location = redirects.get(url.pathname);
      return location
        ? { status: 302, location }
        : { status: 200, contentType: "text/html" };
    });

    await expect(intakePublicUrl("https://public.example/source", {
      resolve: async () => [PUBLIC_IP],
      probe,
    })).resolves.toBe("https://public.example/hop-4");
    expect(probe).toHaveBeenCalledTimes(5);
  });

  it("preserves a required trailing slash while probing and canonicalizes only the accepted result", async () => {
    const probe = vi.fn(async (url: URL) => url.pathname.endsWith("/")
      ? { status: 200, contentType: "text/html" }
      : { status: 308, location: `${url.pathname}/` });

    await expect(intakePublicUrl("https://public.example/article/", {
      resolve: async () => [PUBLIC_IP],
      probe,
    })).resolves.toBe("https://public.example/article");
    expect(probe).toHaveBeenCalledOnce();
    expect(probe.mock.calls[0]?.[0].pathname).toBe("/article/");
  });

  it("stops a redirect loop before exhausting the bounded hop allowance", async () => {
    const probe = vi.fn(async (url: URL) => ({
      status: 302,
      location: url.pathname === "/source" ? "/again" : "/source",
    }));

    await expect(intakePublicUrl("https://public.example/source", {
      resolve: async () => [PUBLIC_IP],
      probe,
    })).rejects.toMatchObject({ code: "too_many_redirects", message: "The source redirected in a loop." });
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it("rejects credentials, HTTP by default, large responses, and too many redirects", async () => {
    const safe = { resolve: async () => [PUBLIC_IP], probe: async () => ({ status: 200 }) };
    await expect(intakePublicUrl("https://user:pass@example.com", safe)).rejects.toMatchObject({ code: "credentials_not_allowed" });
    await expect(intakePublicUrl("http://example.com", safe)).rejects.toMatchObject({ code: "unsafe_protocol" });
    await expect(intakePublicUrl("https://example.com", { ...safe, probe: async () => ({ status: 200, contentLength: 10 }), maxResponseBytes: 5 })).rejects.toMatchObject({ code: "response_too_large" });
    await expect(intakePublicUrl("https://example.com", { ...safe, probe: async () => ({ status: 302, location: "/again" }), maxRedirects: 1 })).rejects.toMatchObject({ code: "too_many_redirects" });
  });

  it("allows explicitly configured HTTP hosts and creates deterministic SHA-256 fingerprints", async () => {
    const url = await intakePublicUrl("http://archive.example/item/?utm_source=x&id=7", {
      allowedHttpHosts: new Set(["archive.example"]),
      resolve: async () => [PUBLIC_IP],
      probe: async () => ({ status: 200, contentType: "text/html" }),
    });
    expect(url).toBe("http://archive.example/item?id=7");
    expect(sourceFingerprint(url)).toMatch(/^[a-f0-9]{64}$/);
    expect(sourceFingerprint(url)).toBe(sourceFingerprint(url));
  });
});
