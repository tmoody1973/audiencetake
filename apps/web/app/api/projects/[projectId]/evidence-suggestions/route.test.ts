import { describe, expect, it, vi } from "vitest";

import { AuthenticationError } from "@/lib/auth/verify-request";
import type { EvidenceStore } from "@/lib/evidence/store";

import { handleEvidenceSuggestionPost } from "./route";

const urlPolicy = {
  resolve: async () => ["93.184.216.34"],
  probe: async () => ({ status: 200, contentType: "text/html" }),
};

function request(body: unknown) {
  return new Request("http://localhost/api/projects/project-1/evidence-suggestions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function store(): EvidenceStore {
  return {
    submit: vi.fn().mockResolvedValue({
      suggestionId: "a".repeat(64),
      projectId: "project-1",
      canonicalUrl: "https://example.com/report",
      status: "community_lead",
      duplicate: false,
      duplicateOf: null,
    }),
    review: vi.fn(),
  };
}

describe("POST project evidence suggestion", () => {
  it("requires an authenticated, App-Check-compatible request boundary", async () => {
    const response = await handleEvidenceSuggestionPost(
      request({ url: "https://example.com/report" }),
      "project-1",
      {
        verifyRequest: vi
          .fn()
          .mockRejectedValue(new AuthenticationError("Sign in is required.", "missing_token")),
        store: store(),
        urlPolicy,
      },
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "missing_token" },
    });
  });

  it("returns the public-safe Community Lead projection", async () => {
    const response = await handleEvidenceSuggestionPost(
      request({ url: "https://example.com/report", note: "Worth checking." }),
      "project-1",
      {
        verifyRequest: vi.fn().mockResolvedValue({ user: { uid: "fan-1" } }),
        store: store(),
        urlPolicy,
      },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject({
      status: "community_lead",
      duplicate: false,
      projectId: "project-1",
    });
    expect(body.data.reviewReason).toBeUndefined();
    expect(body.data.reviewedByUid).toBeUndefined();
  });

  it("rejects unsafe URLs and unknown fields", async () => {
    const verifyRequest = vi.fn().mockResolvedValue({ user: { uid: "fan-1" } });
    const unsafe = await handleEvidenceSuggestionPost(
      request({ url: "https://127.0.0.1/private" }),
      "project-1",
      { verifyRequest, store: store(), urlPolicy },
    );
    expect(unsafe.status).toBe(400);
    await expect(unsafe.json()).resolves.toMatchObject({ error: { code: "non_public_host" } });

    const drift = await handleEvidenceSuggestionPost(
      request({ url: "https://example.com/report", status: "verified_incorporated" }),
      "project-1",
      { verifyRequest, store: store(), urlPolicy },
    );
    expect(drift.status).toBe(400);
    await expect(drift.json()).resolves.toMatchObject({
      error: { code: "invalid_evidence_suggestion" },
    });
  });
});
