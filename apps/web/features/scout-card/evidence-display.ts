import type {
  EvidenceClaim,
  EvidenceDisplayState,
  EvidenceStatus,
  ScoutCard,
  SourceLedgerEntry,
  SourceRole,
  SourceTier,
} from "./types";

const evidenceStatusLabels: Record<EvidenceStatus, string> = {
  verified_core: "Core evidence verified",
  verification_in_progress: "Verification in progress",
  source_limited: "Source limited",
  conflicting: "Conflicting evidence",
};

const evidenceStateLabels: Record<EvidenceDisplayState, string> = {
  verified: "Verified",
  reported: "Reported",
  inferred: "Inferred",
  conflicting: "Conflicting",
  unknown: "Unknown",
};

const sourceRoleLabels: Record<SourceRole, string> = {
  primary_work: "Primary work",
  commentary: "Commentary",
  trade_reporting: "Trade reporting",
  community: "Community lead",
  creator_statement: "Creator statement",
  other: "Other source",
};

const sourceTierLabels: Record<SourceTier, string> = {
  primary: "Primary source",
  creator_authorized: "Creator-authorized",
  reputable_trade: "Reputable trade",
  platform_metadata: "Platform metadata",
  secondary: "Secondary source",
  community: "Community source",
};

export function claimEvidenceState(
  claim: EvidenceClaim,
  sources: SourceLedgerEntry[],
): EvidenceDisplayState {
  if (claim.status === "conflicting") return "conflicting";
  if (claim.status === "inference") return "inferred";
  if (claim.status === "unsupported") return "unknown";

  const usableSources = sources.filter(
    (source) => claim.sourceIds.includes(source.id) && source.availability === "available",
  );
  if (usableSources.length === 0) return "unknown";
  if (
    claim.status === "supported"
    && usableSources.some((source) => source.verificationStatus === "verified")
  ) return "verified";
  return "reported";
}

export function evidenceStateLabel(state: EvidenceDisplayState): string {
  return evidenceStateLabels[state];
}

export function cardEvidenceStatus(card: ScoutCard): EvidenceStatus {
  if (card.evidenceStatus) return card.evidenceStatus;
  const states = card.evidenceClaims.map((claim) => claimEvidenceState(claim, card.sourceLedger));
  if (states.includes("conflicting")) return "conflicting";
  if (states.length > 0 && states.every((state) => state === "verified")) return "verified_core";
  const availableSourceIds = new Set(
    card.sourceLedger.filter((source) => source.availability === "available").map((source) => source.id),
  );
  const citedAvailableSources = new Set(
    card.evidenceClaims.flatMap((claim) => claim.sourceIds).filter((id) => availableSourceIds.has(id)),
  );
  if (citedAvailableSources.size < 2 || states.every((state) => state === "unknown")) {
    return "source_limited";
  }
  return "verification_in_progress";
}

export function evidenceStatusLabel(card: ScoutCard): string {
  return evidenceStatusLabels[cardEvidenceStatus(card)];
}

export function structureStatus(card: ScoutCard): ScoutCard["completeness"] {
  return card.structureStatus ?? card.completeness;
}

export function sourcePresentation(source: SourceLedgerEntry): { role: string; tier: string } {
  const role = source.sourceRole
    ? sourceRoleLabels[source.sourceRole]
    : source.externalCommentary
      ? "Commentary"
      : source.origin === "creator"
        ? "Creator statement"
        : source.origin === "community_lead"
          ? "Community lead"
          : source.origin === "submitted"
            ? "Submitted source"
            : "Research source";
  const tier = source.sourceTier
    ? sourceTierLabels[source.sourceTier]
    : source.verificationStatus === "verified"
      ? "Verified source"
      : source.verificationStatus === "observed"
        ? "Observed source"
        : "Unverified source";
  return { role, tier };
}
