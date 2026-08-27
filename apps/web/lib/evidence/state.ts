import type { EvidenceReviewOutcome } from "./contract";

export type EvidenceSuggestionStatus = "community_lead" | EvidenceReviewOutcome;

const terminalStatuses = new Set<EvidenceSuggestionStatus>([
  "verified_incorporated",
  "relevant_support",
  "conflicts",
  "could_not_verify",
  "rejected",
]);

export function isTerminalEvidenceStatus(
  status: EvidenceSuggestionStatus,
): status is EvidenceReviewOutcome {
  return terminalStatuses.has(status);
}

export function canReviewEvidence(
  current: EvidenceSuggestionStatus,
  outcome: EvidenceReviewOutcome,
): "transition" | "idempotent" | "conflict" {
  if (current === "community_lead") return "transition";
  return current === outcome ? "idempotent" : "conflict";
}
