import { describe, expect, it } from "vitest";

import { evidenceReviewOutcomes } from "./contract";
import { canReviewEvidence, isTerminalEvidenceStatus } from "./state";

describe("evidence review state machine", () => {
  it.each(evidenceReviewOutcomes)("allows Community Lead to reach %s", (outcome) => {
    expect(canReviewEvidence("community_lead", outcome)).toBe("transition");
    expect(isTerminalEvidenceStatus(outcome)).toBe(true);
  });

  it("makes an exact terminal replay idempotent", () => {
    expect(canReviewEvidence("conflicts", "conflicts")).toBe("idempotent");
  });

  it("refuses rewriting one terminal outcome as another", () => {
    expect(canReviewEvidence("rejected", "verified_incorporated")).toBe("conflict");
  });
});
