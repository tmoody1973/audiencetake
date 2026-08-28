export type ClaimStatus = "unclaimed" | "pending" | "approved" | "rejected";
export type Completeness = "complete" | "partial";
export type Confidence = "low" | "medium" | "high";
export type EvidenceStatus = "verified_core" | "verification_in_progress" | "source_limited" | "conflicting";
export type EvidenceDisplayState = "verified" | "reported" | "inferred" | "conflicting" | "unknown";
export type SourceRole = "primary_work" | "commentary" | "trade_reporting" | "community" | "creator_statement" | "other";
export type SourceTier = "primary" | "creator_authorized" | "reputable_trade" | "platform_metadata" | "secondary" | "community";

export type NextExperiment = {
  title: string;
  hypothesis: string;
  method: string;
  participantAction: string;
  signal: string;
  timebox: string;
  owner?: string;
  prerequisite?: string;
  costClass?: "low" | "medium" | "high" | "unknown";
  requiredPermission?: string;
  successCriterion?: string;
  audienceTakeRole?: string;
};

export type ScoutPathway = {
  id: string;
  order: number;
  label: string;
  format: string;
  strategyKind?: "development" | "distribution" | "audience" | "financing" | "education" | "adaptation";
  proposedMedium?: "documentary" | "live_action" | "animation" | "hybrid" | "unknown";
  crossFormat?: boolean;
  crossFormatClaimIds?: string[];
  audience: string;
  rationale: string;
  supportingClaimIds: string[];
  comparableSourceIds: string[];
  strengths: string[];
  risks: string[];
  openQuestions: string[];
  confidence: Confidence;
  nextExperiment: NextExperiment;
};

export type EvidenceClaim = {
  id: string;
  statement: string;
  status: "supported" | "qualified" | "conflicting" | "unsupported" | "inference";
  sourceIds: string[];
  qualification: string | null;
};

export type SourceLedgerEntry = {
  id: string;
  origin: "submitted" | "parallel" | "community_lead" | "creator";
  title: string;
  url: string;
  publishedAt: string | null;
  retrievedAt: string;
  availability: "available" | "unavailable" | "restricted";
  verificationStatus: "observed" | "verified" | "qualified" | "conflicting" | "unverified";
  sourceRole?: SourceRole;
  sourceTier?: SourceTier;
  supportsClaimIds: string[];
  externalCommentary: boolean;
};

export type ScoutCard = {
  cardVersionId: string;
  runId: string;
  researchVersion: number;
  projectId: string;
  slug: string;
  title: string;
  hook: string;
  projectType: "series" | "film" | "short_film" | "documentary" | "creator_project";
  submissionLabel: string;
  claimStatus: ClaimStatus;
  completeness: Completeness;
  structureStatus?: Completeness;
  evidenceStatus?: EvidenceStatus;
  identity?: {
    relationshipStatus: "unresolved" | "source_aligned" | "creator_confirmed" | "disputed";
    primarySourceId?: string;
    lastVerifiedAt?: string;
  };
  primaryWorkSourceId?: string;
  fallbackUsed: boolean;
  fallbackLabel?: string;
  provenance: {
    submissionType: "fan" | "creator";
    submittedSourceUrl: string;
    nominationLabel: string;
    nominatedByLabel: string;
    researchedAt: string;
  };
  media: {
    state: "authorized_embed" | "authorized_image" | "editorial_fallback" | "unavailable";
    title: string;
    sourceUrl: string;
    embedUrl?: string;
    imageUrl?: string;
    attribution: string;
    accessibleFallback: string;
  };
  storyContext: {
    summary: string;
    storyworld: string;
    themes: string[];
    currentFormat: string;
    audienceHooks: string[];
    claimIds: string[];
  };
  creatorContext: {
    displayName: string | null;
    claimStatus: ClaimStatus;
    summary: string;
    sourceIds: string[];
    limitations: string[];
  };
  sourceIds: string[];
  claimIds: string[];
  evidenceClaims: EvidenceClaim[];
  externalSignals: Array<{
    label: string;
    analysis: string;
    sourceIds: string[];
    limitations: string[];
    nativeAudienceCount: false;
  }>;
  pathwayIds: string[];
  pathways: ScoutPathway[];
  sourceLedger: SourceLedgerEntry[];
  missingSections: string[];
  limitations: string[];
  industryLens: {
    pathwayIds: string[];
    comparables: Array<{
      title: string;
      relevance: string;
      sourceIds: string[];
      limitations: string[];
    }>;
    risks: string[];
    unresolvedQuestions: string[];
    signalLimitations: string[];
    creatorClaimStatus: ClaimStatus;
    recommendedNextExperiment: NextExperiment;
  };
  publishedAt: string;
};
