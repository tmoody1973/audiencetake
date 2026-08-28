import { describe, expect, it } from "vitest";

import { getScoutCardFixture } from "./data";
import {
  cardEvidenceStatus,
  claimEvidenceState,
  evidenceStateLabel,
  sourcePresentation,
  structureStatus,
} from "./evidence-display";
import type { EvidenceClaim, SourceLedgerEntry } from "./types";

const baseSource: SourceLedgerEntry = {
  id: "source-1",
  origin: "submitted",
  title: "Submitted source",
  url: "https://example.com/source",
  publishedAt: null,
  retrievedAt: "2026-08-27T12:00:00Z",
  availability: "available",
  verificationStatus: "qualified",
  supportsClaimIds: ["claim-1"],
  externalCommentary: false,
};

function claim(status: EvidenceClaim["status"]): EvidenceClaim {
  return {
    id: "claim-1",
    statement: "Bounded test claim.",
    status,
    sourceIds: ["source-1"],
    qualification: status === "supported" ? null : "The public evidence remains bounded.",
  };
}

describe("Scout Card evidence presentation", () => {
  it.each([
    ["supported", "verified", "Verified", "verified"],
    ["qualified", "reported", "Reported", "qualified"],
    ["inference", "inferred", "Inferred", "qualified"],
    ["conflicting", "conflicting", "Conflicting", "conflicting"],
    ["unsupported", "unknown", "Unknown", "unverified"],
  ] as const)(
    "maps %s into the reader-facing %s state",
    (claimStatus, expectedState, expectedLabel, verificationStatus) => {
      const source = { ...baseSource, verificationStatus };
      const state = claimEvidenceState(claim(claimStatus), [source]);
      expect(state).toBe(expectedState);
      expect(evidenceStateLabel(state)).toBe(expectedLabel);
    },
  );

  it("does not upgrade an observed source to Verified", () => {
    const source = { ...baseSource, verificationStatus: "observed" as const };
    expect(claimEvidenceState(claim("supported"), [source])).toBe("reported");
  });

  it("derives conservative status defaults for immutable older cards", () => {
    const oldCard = getScoutCardFixture("complete");
    expect(oldCard.evidenceStatus).toBeUndefined();
    expect(cardEvidenceStatus(oldCard)).toBe("source_limited");
    expect(structureStatus(oldCard)).toBe("complete");
  });

  it("prefers explicit source role and tier without inventing missing metadata", () => {
    expect(sourcePresentation({
      ...baseSource,
      sourceRole: "primary_work",
      sourceTier: "creator_authorized",
    })).toEqual({ role: "Primary work", tier: "Creator-authorized" });
    expect(sourcePresentation(baseSource)).toEqual({
      role: "Submitted source",
      tier: "Unverified source",
    });
  });
});
