import type { DecodedIdToken } from "firebase-admin/auth";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AuthenticationError,
  type RequestVerificationServices,
  verifyAuthenticatedRequest,
} from "./verify-request";

const decodedUser = { uid: "fan-one", aud: "audience-take-demo" } as DecodedIdToken;

function request(headers: Record<string, string> = {}) {
  return { headers: new Headers(headers) };
}

function services(overrides: Partial<RequestVerificationServices> = {}) {
  return {
    verifyIdToken: vi.fn().mockResolvedValue(decodedUser),
    verifyAppCheckToken: vi.fn().mockResolvedValue({ appId: "web-app-id" }),
    ...overrides,
  } satisfies RequestVerificationServices;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("verifyAuthenticatedRequest", () => {
  it("rejects a missing identity token", async () => {
    await expect(verifyAuthenticatedRequest(request(), services())).rejects.toMatchObject({
      code: "missing_token",
    } satisfies Partial<AuthenticationError>);
  });

  it("rejects an invalid or revoked identity token", async () => {
    const verifier = services({ verifyIdToken: vi.fn().mockRejectedValue(new Error("invalid")) });
    await expect(
      verifyAuthenticatedRequest(request({ authorization: "Bearer invalid" }), verifier),
    ).rejects.toMatchObject({ code: "invalid_token" } satisfies Partial<AuthenticationError>);
    expect(verifier.verifyIdToken).toHaveBeenCalledWith("invalid", true);
  });

  it("requires App Check when enforcement is enabled", async () => {
    vi.stubEnv("APP_CHECK_ENFORCEMENT_ENABLED", "true");
    await expect(
      verifyAuthenticatedRequest(request({ authorization: "Bearer valid" }), services()),
    ).rejects.toMatchObject({ code: "missing_app_check" } satisfies Partial<AuthenticationError>);
  });

  it("cannot disable App Check in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_CHECK_ENFORCEMENT_ENABLED", "false");
    await expect(
      verifyAuthenticatedRequest(request({ authorization: "Bearer valid" }), services()),
    ).rejects.toMatchObject({ code: "missing_app_check" } satisfies Partial<AuthenticationError>);
  });

  it("rejects an invalid App Check token", async () => {
    const verifier = services({
      verifyAppCheckToken: vi.fn().mockRejectedValue(new Error("invalid")),
    });
    await expect(
      verifyAuthenticatedRequest(
        request({ authorization: "Bearer valid", "x-firebase-appcheck": "invalid" }),
        verifier,
      ),
    ).rejects.toMatchObject({ code: "invalid_app_check" } satisfies Partial<AuthenticationError>);
  });

  it("returns verified identity and app claims", async () => {
    vi.stubEnv("APP_CHECK_ENFORCEMENT_ENABLED", "true");
    await expect(
      verifyAuthenticatedRequest(
        request({ authorization: "Bearer valid", "x-firebase-appcheck": "app-token" }),
        services(),
      ),
    ).resolves.toEqual({ user: decodedUser, appId: "web-app-id" });
  });

  it("documents the local App Check bypass without bypassing identity", async () => {
    vi.stubEnv("APP_CHECK_ENFORCEMENT_ENABLED", "false");
    await expect(
      verifyAuthenticatedRequest(request({ authorization: "Bearer valid" }), services()),
    ).resolves.toEqual({ user: decodedUser });
  });
});
