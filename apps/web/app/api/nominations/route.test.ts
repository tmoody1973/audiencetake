import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { AuthenticationError } from "@/lib/auth/verify-request";
import type { NominationStore } from "@/lib/nomination/store";
import { RateLimitError } from "@/lib/trust/rate-limit";

import { handleNominationPost } from "./handler";

const validBody = {
  submittedUrl: "https://example.com/project",
  whyItShouldGrow: "This independent project has a singular voice worth discovering.",
  submissionType: "creator",
  supportingUrls: [],
};

function request(body: unknown) {
  return new NextRequest("http://localhost/api/nominations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function store(): NominationStore {
  return {
    accept: vi.fn().mockResolvedValue({
      kind: "created",
      projectId: "project-1",
      nominationId: "nomination-1",
      runId: "run-1",
      researchUrl: "/research/run-1",
      canonicalUrl: "/projects/project-1",
    }),
    markDispatched: vi.fn().mockResolvedValue(undefined),
    markDispatchFailed: vi.fn().mockResolvedValue(undefined),
  };
}

const urlPolicy = {
  resolve: async () => ["93.184.216.34"],
  probe: async () => ({ status: 200, contentType: "text/html" }),
};

describe("POST /api/nominations", () => {
  it("requires authentication and returns a stable safe envelope", async () => {
    const response = await handleNominationPost(request(validBody), {
      verifyRequest: vi.fn().mockRejectedValue(new AuthenticationError("Sign in is required.", "missing_token")),
      store: store(),
      dispatch: vi.fn(),
      urlPolicy,
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      data: null,
      error: { code: "missing_token", message: "Sign in is required." },
      requestId: expect.any(String),
    });
  });

  it("rejects contract drift and unsafe URLs", async () => {
    const verifyRequest = vi.fn().mockResolvedValue({ user: { uid: "user-1" } });
    const invalid = await handleNominationPost(request({ ...validBody, mode: "fan" }), {
      verifyRequest,
      store: store(),
      dispatch: vi.fn(),
      urlPolicy,
    });
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({ error: { code: "invalid_nomination" } });

    const unsafe = await handleNominationPost(request({ ...validBody, submittedUrl: "https://127.0.0.1/project" }), {
      verifyRequest,
      store: store(),
      dispatch: vi.fn(),
      urlPolicy,
    });
    expect(unsafe.status).toBe(400);
    await expect(unsafe.json()).resolves.toMatchObject({ error: { code: "non_public_host" } });
  });

  it("returns canonical API data without leaking store implementation fields", async () => {
    const response = await handleNominationPost(request(validBody), {
      verifyRequest: vi.fn().mockResolvedValue({ user: { uid: "creator-1" } }),
      store: store(),
      dispatch: vi.fn().mockResolvedValue(undefined),
      urlPolicy,
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      error: null,
      data: {
        duplicate: false,
        projectId: "project-1",
        runId: "run-1",
        researchUrl: "/research/run-1",
        dispatchState: "dispatched",
      },
    });
    expect(body.data.kind).toBeUndefined();
  });

  it("returns a bounded retry signal when the account limit is exhausted", async () => {
    const response = await handleNominationPost(request(validBody), {
      verifyRequest: vi.fn().mockResolvedValue({ user: { uid: "creator-1" } }),
      store: store(),
      dispatch: vi.fn(),
      urlPolicy,
      database: {} as never,
      consumeLimits: vi.fn().mockRejectedValue(new RateLimitError(120)),
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("120");
    await expect(response.json()).resolves.toMatchObject({ error: { code: "rate_limited" } });
  });

  it("checks the account and trusted Vercel IP in one limiter transaction", async () => {
    const consumeLimits = vi.fn().mockResolvedValue([]);
    const response = await handleNominationPost(request(validBody), {
      verifyRequest: vi.fn().mockResolvedValue({ user: { uid: "creator-1" } }),
      store: store(),
      dispatch: vi.fn().mockResolvedValue(undefined),
      urlPolicy,
      database: {} as never,
      consumeLimits,
      resolveClientIp: vi.fn().mockReturnValue("203.0.113.8"),
    });

    expect(response.status).toBe(200);
    expect(consumeLimits).toHaveBeenCalledWith({}, [
      expect.objectContaining({
        uid: "creator-1",
        policy: expect.objectContaining({ name: "nomination" }),
      }),
      expect.objectContaining({
        uid: "203.0.113.8",
        policy: expect.objectContaining({ name: "nomination_ip" }),
      }),
    ]);
  });

  it("does not create an IP principal when the runtime cannot establish one", async () => {
    const consumeLimits = vi.fn().mockResolvedValue([]);
    const response = await handleNominationPost(request(validBody), {
      verifyRequest: vi.fn().mockResolvedValue({ user: { uid: "creator-1" } }),
      store: store(),
      dispatch: vi.fn().mockResolvedValue(undefined),
      urlPolicy,
      database: {} as never,
      consumeLimits,
      resolveClientIp: vi.fn().mockReturnValue(null),
    });

    expect(response.status).toBe(200);
    expect(consumeLimits.mock.calls[0]?.[1]).toHaveLength(1);
  });
});
