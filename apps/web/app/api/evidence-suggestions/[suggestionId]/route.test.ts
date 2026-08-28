import { describe, expect, it, vi } from "vitest";

import type { EvidenceStore } from "@/lib/evidence/store";
import { AuthorizationError } from "@/lib/trust/authorization";

import { handleEvidenceReviewPatch } from "./handler";

const suggestionId = "b".repeat(64);
const validReview = {
  outcome: "verified_incorporated",
  reason: "The public source was manually checked.",
  source: {
    title: "Public interview",
    excerpt: "The creator describes the project in this public interview.",
    sourceType: "interview",
    supportsClaimIds: ["claim-story"],
    conflictsWithClaimIds: [],
    externalCommentary: false,
  },
};

function request(body: unknown) {
  return new Request(`http://localhost/api/evidence-suggestions/${suggestionId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function store(): EvidenceStore {
  return {
    submit: vi.fn(),
    review: vi.fn().mockResolvedValue({
      suggestionId,
      projectId: "project-1",
      status: "verified_incorporated",
      incorporatedSourceId: `community-${suggestionId}`,
      canonicalUrl: "https://www.youtube.com/watch?v=s8G7425lfKs",
      suggestedUse: null,
      changed: true,
    }),
  };
}

describe("PATCH evidence review", () => {
  it("requires the authoritative server-side admin assignment", async () => {
    const response = await handleEvidenceReviewPatch(request(validReview), suggestionId, {
      verifyRequest: vi.fn().mockResolvedValue({ user: { uid: "fan-1" } }),
      authorizeAdmin: vi
        .fn()
        .mockRejectedValue(new AuthorizationError("Administrator access is required.", "admin_required")),
      store: store(),
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "admin_required" } });
  });

  it("persists a strict reviewed source without exposing private review metadata", async () => {
    const evidenceStore = store();
    const response = await handleEvidenceReviewPatch(request(validReview), suggestionId, {
      verifyRequest: vi.fn().mockResolvedValue({ user: { uid: "admin-1" } }),
      authorizeAdmin: vi.fn().mockResolvedValue(undefined),
      store: evidenceStore,
    });
    expect(response.status).toBe(200);
    expect(evidenceStore.review).toHaveBeenCalledWith(
      suggestionId,
      "admin-1",
      expect.objectContaining({ outcome: "verified_incorporated" }),
    );
    const body = await response.json();
    expect(body.data).toMatchObject({
      status: "verified_incorporated",
      incorporatedSourceId: `community-${suggestionId}`,
    });
    expect(body.data.reviewReason).toBeUndefined();
    expect(body.data.reviewerUid).toBeUndefined();
  });

  it("does not accept source data for a non-incorporating outcome", async () => {
    const response = await handleEvidenceReviewPatch(
      request({ ...validReview, outcome: "rejected" }),
      suggestionId,
      {
        verifyRequest: vi.fn().mockResolvedValue({ user: { uid: "admin-1" } }),
        authorizeAdmin: vi.fn().mockResolvedValue(undefined),
        store: store(),
      },
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_evidence_review" },
    });
  });

  it("publishes a new card version when a verified lead was proposed as its video", async () => {
    const evidenceStore = store();
    vi.mocked(evidenceStore.review).mockResolvedValue({
      suggestionId,
      projectId: "project-1",
      status: "verified_incorporated",
      incorporatedSourceId: `community-${suggestionId}`,
      canonicalUrl: "https://www.youtube.com/watch?v=s8G7425lfKs",
      suggestedUse: "scout_card_video",
      changed: true,
    });
    const promoteMedia = vi.fn().mockResolvedValue({
      cardVersionId: "card-v2",
      changed: true,
    });

    const response = await handleEvidenceReviewPatch(request(validReview), suggestionId, {
      verifyRequest: vi.fn().mockResolvedValue({ user: { uid: "admin-1" } }),
      authorizeAdmin: vi.fn().mockResolvedValue(undefined),
      store: evidenceStore,
      promoteMedia,
    });

    expect(response.status).toBe(200);
    expect(promoteMedia).toHaveBeenCalledWith({
      projectId: "project-1",
      reviewerUid: "admin-1",
      incorporatedSourceId: `community-${suggestionId}`,
      canonicalUrl: "https://www.youtube.com/watch?v=s8G7425lfKs",
    });
    await expect(response.json()).resolves.toMatchObject({
      data: { mediaPromotion: { cardVersionId: "card-v2", changed: true } },
    });
  });
});
