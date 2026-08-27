import { describe, expect, it } from "vitest";

import {
  evidenceReviewInputSchema,
  evidenceReviewOutcomes,
  evidenceSuggestionInputSchema,
} from "./contract";

const source = {
  title: "A reviewed public source",
  excerpt: "The relevant public passage was reviewed by a human.",
  sourceType: "editorial_coverage" as const,
  supportsClaimIds: ["claim-1"],
  conflictsWithClaimIds: [],
  externalCommentary: true,
};

describe("evidence contracts", () => {
  it("keeps the five terminal outcomes distinct from the initial Community Lead state", () => {
    expect(evidenceReviewOutcomes).toEqual([
      "verified_incorporated",
      "relevant_support",
      "conflicts",
      "could_not_verify",
      "rejected",
    ]);
    expect(evidenceReviewOutcomes).not.toContain("community_lead");
  });

  it("requires normalized source details only for verified incorporation", () => {
    expect(
      evidenceReviewInputSchema.safeParse({
        outcome: "verified_incorporated",
        reason: "The source was checked against the public page.",
      }).success,
    ).toBe(false);
    expect(
      evidenceReviewInputSchema.safeParse({
        outcome: "verified_incorporated",
        reason: "The source was checked against the public page.",
        source,
      }).success,
    ).toBe(true);
    expect(
      evidenceReviewInputSchema.safeParse({
        outcome: "rejected",
        reason: "This does not concern the project.",
        source,
      }).success,
    ).toBe(false);
  });

  it("rejects contract drift and oversized notes", () => {
    expect(
      evidenceSuggestionInputSchema.safeParse({
        url: "https://example.com/source",
        note: "Useful context",
        reviewer: "admin",
      }).success,
    ).toBe(false);
    expect(
      evidenceSuggestionInputSchema.safeParse({
        url: "https://example.com/source",
        note: "x".repeat(1_001),
      }).success,
    ).toBe(false);
  });
});
