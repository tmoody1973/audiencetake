import { createHash } from "node:crypto";

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { z } from "zod";

import { parsePublishedCard } from "@/features/scout-card/data";
import type { ScoutCard, ScoutPathway, SourceLedgerEntry } from "@/features/scout-card/types";
import { privacyEnhancedYouTubeEmbed, youtubeVideoId } from "@/lib/media/youtube";

const correctionBaseSchema = z.object({
  section: z.enum(["source", "claim", "pathway", "creator", "media", "other"]),
  summary: z.string().trim().min(10).max(500),
  priorBasis: z.string().trim().min(10).max(1_000),
});

const youtubePrimaryWorkSchema = z.object({
  kind: z.literal("youtube_primary_work"),
  sourceUrl: z.url().refine((value) => youtubeVideoId(value) !== null, "Use a supported YouTube video URL."),
  sourceTitle: z.string().trim().min(1).max(240),
  authorName: z.string().trim().min(1).max(240),
  cardTitle: z.string().trim().min(1).max(240),
}).strict();

const mediumSchema = z.enum(["documentary", "live_action", "animation", "hybrid", "unknown"]);
const strategySchema = z.enum([
  "development", "distribution", "audience", "financing", "education", "adaptation",
]);
const nextExperimentReplacementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  hypothesis: z.string().trim().min(1).max(800),
  method: z.string().trim().min(1).max(800),
  participantAction: z.string().trim().min(1).max(500),
  signal: z.string().trim().min(1).max(500),
  timebox: z.string().trim().min(1).max(120),
}).strict();
const correctedPathwaySchema = z.object({
  id: z.string().trim().regex(/^pathway-0[1-3]$/),
  order: z.number().int().min(1).max(3),
  label: z.string().trim().min(1).max(160),
  format: z.string().trim().min(1).max(160),
  strategyKind: strategySchema,
  proposedMedium: mediumSchema,
  crossFormat: z.literal(false),
  crossFormatClaimIds: z.array(z.string().trim().min(1)).max(0),
  audience: z.string().trim().min(1).max(500),
  rationale: z.string().trim().min(1).max(1_200),
  supportingClaimIds: z.array(z.string().trim().min(1)).min(1).max(3),
  comparableSourceIds: z.array(z.string().trim().min(1)).max(2),
  strengths: z.array(z.string().trim().min(1).max(300)).min(1).max(2),
  risks: z.array(z.string().trim().min(1).max(300)).min(1).max(2),
  openQuestions: z.array(z.string().trim().min(1).max(300)).min(1).max(2),
  confidence: z.enum(["low", "medium", "high"]),
  nextExperiment: nextExperimentReplacementSchema,
}).strict();
const projectNativePathwaysSchema = z.object({
  kind: z.literal("project_native_pathways"),
  projectProfile: z.object({
    medium: mediumSchema,
    form: z.enum(["feature", "short", "series", "proof_of_concept", "campaign", "unknown"]),
    lifecycle: z.enum(["development", "production", "released", "campaigning", "unknown"]),
    sourceIds: z.array(z.string().trim().min(1)).min(1),
    qualification: z.string().trim().min(1).max(500),
  }).strict(),
  pathways: z.array(correctedPathwaySchema).length(3),
}).strict();

const versionedCorrectionSchema = correctionBaseSchema.extend({
  expectedCardVersionId: z.string().trim().min(1).max(500),
  replacement: z.discriminatedUnion("kind", [
    youtubePrimaryWorkSchema,
    projectNativePathwaysSchema,
  ]),
}).strict();

const noteOnlyCorrectionSchema = correctionBaseSchema.strict();

export const correctionInputSchema = z.union([
  versionedCorrectionSchema,
  noteOnlyCorrectionSchema,
]);

export type CorrectionInput = z.infer<typeof correctionInputSchema>;
type VersionedCorrectionInput = z.infer<typeof versionedCorrectionSchema>;
type MediaCorrectionInput = VersionedCorrectionInput & {
  replacement: z.infer<typeof youtubePrimaryWorkSchema>;
};
type PathwayCorrectionInput = VersionedCorrectionInput & {
  replacement: z.infer<typeof projectNativePathwaysSchema>;
};

export class CorrectionError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
    this.name = "CorrectionError";
  }
}

function digest(value: string, length = 20): string {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

function correctionIdentity(
  projectId: string,
  input: MediaCorrectionInput,
  sourceIdOverride?: string,
) {
  const videoId = youtubeVideoId(input.replacement.sourceUrl);
  if (!videoId) throw new CorrectionError("invalid_source", "Use a supported YouTube video URL.", 400);
  const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const fingerprint = digest(JSON.stringify({
    projectId,
    expectedCardVersionId: input.expectedCardVersionId,
    section: input.section,
    summary: input.summary,
    priorBasis: input.priorBasis,
    sourceIdOverride: sourceIdOverride ?? null,
    replacement: { ...input.replacement, sourceUrl },
  }));
  return {
    sourceUrl,
    videoId,
    sourceId: sourceIdOverride ?? `source-community-lead-${digest(sourceUrl, 16)}`,
    toCardVersionId: `${input.expectedCardVersionId}-correction-${fingerprint.slice(0, 12)}`,
    correctionId: `correction-${fingerprint}`,
  };
}

function cardSourceEntry(
  sourceId: string,
  input: MediaCorrectionInput,
  sourceUrl: string,
  retrievedAt: string,
  verificationStatus: "observed" | "verified",
): SourceLedgerEntry {
  return {
    id: sourceId,
    origin: "community_lead",
    title: input.replacement.sourceTitle,
    url: sourceUrl,
    publishedAt: null,
    retrievedAt,
    availability: "available",
    verificationStatus,
    sourceRole: "primary_work",
    sourceTier: "platform_metadata",
    supportsClaimIds: [],
    externalCommentary: false,
  };
}

function correctedCard(
  fromCard: ScoutCard,
  input: MediaCorrectionInput,
  identity: ReturnType<typeof correctionIdentity>,
  publishedAt: string,
  verificationStatus: "observed" | "verified",
  alignIdentity: boolean,
  demotePriorMedia: boolean,
): ScoutCard {
  const priorMediaUrl = fromCard.media.sourceUrl;
  const retainedLedger = fromCard.sourceLedger
    .filter((source) => source.id !== identity.sourceId)
    .map((source) => demotePriorMedia && source.url === priorMediaUrl ? {
      ...source,
      sourceRole: "commentary" as const,
      sourceTier: "community" as const,
      externalCommentary: true,
    } : source);
  const sourceLedger = [
    ...retainedLedger,
    cardSourceEntry(
      identity.sourceId,
      input,
      identity.sourceUrl,
      publishedAt,
      verificationStatus,
    ),
  ];
  const limitation = `${input.replacement.authorName}'s public YouTube upload establishes an embeddable primary-work lead, but creator ownership, rights, and the wider project relationship remain unconfirmed.`;

  return {
    ...fromCard,
    cardVersionId: identity.toCardVersionId,
    title: input.replacement.cardTitle,
    structureStatus: fromCard.completeness,
    evidenceStatus: "source_limited",
    identity: alignIdentity
      ? {
          relationshipStatus: "source_aligned",
          primarySourceId: identity.sourceId,
          lastVerifiedAt: publishedAt,
        }
      : fromCard.identity,
    primaryWorkSourceId: identity.sourceId,
    media: {
      state: "authorized_embed",
      title: input.replacement.sourceTitle,
      sourceUrl: identity.sourceUrl,
      embedUrl: privacyEnhancedYouTubeEmbed(identity.sourceUrl)!,
      attribution: `${input.replacement.sourceTitle} by ${input.replacement.authorName}, embedded from the public YouTube source. Audience Take does not rehost it.`,
      accessibleFallback: `Open ${input.replacement.sourceTitle} on YouTube if the embedded player is unavailable.`,
    },
    sourceIds: sourceLedger.map((source) => source.id),
    sourceLedger,
    limitations: Array.from(new Set([...fromCard.limitations, limitation])),
    publishedAt,
  };
}

function versionedResultMatches(
  value: Record<string, unknown> | undefined,
  input: MediaCorrectionInput,
  identity: ReturnType<typeof correctionIdentity>,
) {
  return value?.cardVersionId === input.expectedCardVersionId
    && value?.fromCardVersionId === input.expectedCardVersionId
    && value?.toCardVersionId === identity.toCardVersionId
    && value?.correctedSourceId === identity.sourceId
    && value?.summary === input.summary
    && value?.priorBasis === input.priorBasis;
}

async function publishVersionedCorrection(
  database: Firestore,
  projectId: string,
  actorUid: string,
  input: MediaCorrectionInput,
  options: {
    existingSourceId?: string;
    sourceVerificationStatus?: "observed" | "verified";
    alignIdentity?: boolean;
    demotePriorMedia?: boolean;
  } = {},
) {
  const identity = correctionIdentity(projectId, input, options.existingSourceId);
  const projectRef = database.collection("projects").doc(projectId);
  const fromCardRef = database.collection("scoutCards").doc(input.expectedCardVersionId);
  const toCardRef = database.collection("scoutCards").doc(identity.toCardVersionId);
  const correctionRef = database.collection("projectCorrections").doc(identity.correctionId);
  const auditRef = database.collection("projectCorrectionAudits").doc(identity.correctionId);
  const publishedAt = new Date().toISOString();

  return database.runTransaction(async (transaction) => {
    const [projectSnapshot, fromCardSnapshot, toCardSnapshot, correctionSnapshot, auditSnapshot] = await transaction.getAll(
      projectRef,
      fromCardRef,
      toCardRef,
      correctionRef,
      auditRef,
    );
    const project = projectSnapshot.data();
    if (!projectSnapshot.exists || project?.publicationStatus !== "published") {
      throw new CorrectionError("project_not_found", "Project was not found.", 404);
    }
    if (!fromCardSnapshot.exists) {
      throw new CorrectionError("card_not_found", "The published card could not be read.", 409);
    }
    const slug = typeof project.slug === "string" ? project.slug : "";
    const fromCard = parsePublishedCard(fromCardSnapshot.data(), {
      cardVersionId: input.expectedCardVersionId,
      projectId,
      slug,
    });
    if (!fromCard) {
      throw new CorrectionError("invalid_card", "The published card does not satisfy the current Scout Card contract.", 409);
    }
    const sourceRef = database.collection("sources").doc(
      options.existingSourceId
        ?? `${projectId}_v${fromCard.researchVersion}_${identity.sourceId}`,
    );
    const sourceSnapshot = await transaction.get(sourceRef);

    if (project.latestCardVersionId === identity.toCardVersionId) {
      if (
        toCardSnapshot.exists
        && correctionSnapshot.exists
        && auditSnapshot.exists
        && sourceSnapshot.exists
        && sourceSnapshot.data()?.url === identity.sourceUrl
        && versionedResultMatches(correctionSnapshot.data(), input, identity)
      ) {
        return {
          correctionId: identity.correctionId,
          projectId,
          cardVersionId: identity.toCardVersionId,
          previousCardVersionId: input.expectedCardVersionId,
          changed: false,
        };
      }
      throw new CorrectionError("correction_conflict", "The correction pointer is incomplete or inconsistent.", 409);
    }
    if (project.latestCardVersionId !== input.expectedCardVersionId) {
      throw new CorrectionError("card_changed", "The published card changed before this correction could be applied.", 409);
    }
    if (toCardSnapshot.exists || correctionSnapshot.exists || auditSnapshot.exists) {
      throw new CorrectionError("correction_conflict", "A different correction already uses this immutable identifier.", 409);
    }
    if (options.existingSourceId && !sourceSnapshot.exists) {
      throw new CorrectionError("source_not_found", "The verified source could not be read.", 409);
    }
    if (
      options.existingSourceId
      && (
        sourceSnapshot.data()?.projectId !== projectId
        || ![sourceSnapshot.data()?.url, sourceSnapshot.data()?.canonicalUrl].includes(identity.sourceUrl)
      )
    ) {
      throw new CorrectionError("source_conflict", "The verified source does not match this project and video.", 409);
    }
    if (!options.existingSourceId && sourceSnapshot.exists) {
      throw new CorrectionError("source_conflict", "The correction source identifier already exists.", 409);
    }
    const nextCard = correctedCard(
      fromCard,
      input,
      identity,
      publishedAt,
      options.sourceVerificationStatus ?? "observed",
      options.alignIdentity ?? true,
      options.demotePriorMedia ?? true,
    );
    if (!parsePublishedCard({ ...nextCard, visibility: "public" }, {
      cardVersionId: identity.toCardVersionId,
      projectId,
      slug,
    })) {
      throw new CorrectionError("invalid_correction", "The corrected card did not satisfy the Scout Card contract.", 409);
    }

    const now = FieldValue.serverTimestamp();
    if (!options.existingSourceId) transaction.create(sourceRef, {
      id: identity.sourceId,
      projectId,
      runId: fromCard.runId,
      researchVersion: fromCard.researchVersion,
      origin: "community_lead",
      url: identity.sourceUrl,
      canonicalUrl: identity.sourceUrl,
      domain: "youtube.com",
      title: input.replacement.sourceTitle,
      excerpt: `YouTube oEmbed identifies this public video as ${input.replacement.sourceTitle} by ${input.replacement.authorName}.`,
      author: input.replacement.authorName,
      publishedAt: null,
      retrievedAt: publishedAt,
      sourceType: "submitted_video",
      availability: "available",
      verificationStatus: "observed",
      sourceRole: "primary_work",
      sourceTier: "platform_metadata",
      supportsClaimIds: [],
      conflictsWithClaimIds: [],
      externalCommentary: false,
      queryProvenance: null,
      visibility: "public",
    });
    transaction.create(toCardRef, { ...nextCard, visibility: "public" });
    transaction.create(correctionRef, {
      correctionId: identity.correctionId,
      projectId,
      section: input.section,
      correctionType: input.replacement.kind,
      summary: input.summary,
      priorBasis: input.priorBasis,
      cardVersionId: input.expectedCardVersionId,
      fromCardVersionId: input.expectedCardVersionId,
      toCardVersionId: identity.toCardVersionId,
      correctedSourceId: identity.sourceId,
      visibility: "public",
      createdAt: now,
      updatedAt: now,
    });
    transaction.create(auditRef, {
      correctionId: identity.correctionId,
      projectId,
      actorUid,
      action: "correction_version_published",
      fromCardVersionId: input.expectedCardVersionId,
      toCardVersionId: identity.toCardVersionId,
      correctedSourceId: identity.sourceId,
      createdAt: now,
    });
    transaction.update(projectRef, {
      title: input.replacement.cardTitle,
      latestCardVersionId: identity.toCardVersionId,
      correctionNotice: input.summary,
      correctionUpdatedAt: now,
      updatedAt: now,
    });
    return {
      correctionId: identity.correctionId,
      projectId,
      cardVersionId: identity.toCardVersionId,
      previousCardVersionId: input.expectedCardVersionId,
      changed: true,
    };
  });
}

function projectMedium(card: ScoutCard): z.infer<typeof mediumSchema> {
  if (card.projectType === "documentary") return "documentary";
  const declared = new Set(
    card.pathways
      .map((pathway) => pathway.proposedMedium)
      .filter((value): value is NonNullable<typeof value> => Boolean(value)),
  );
  if (declared.size === 1) return [...declared][0];
  const text = card.storyContext.currentFormat.toLocaleLowerCase();
  const animation = /\b(?:animat(?:ed|ion)|anime)\b/.test(text);
  const liveAction = /\blive[ -]?action\b/.test(text);
  if (/\bhybrid\b/.test(text) || (animation && liveAction)) return "hybrid";
  if (animation) return "animation";
  if (liveAction) return "live_action";
  return "unknown";
}

function mentionedMedia(value: string): Set<"documentary" | "live_action" | "animation"> {
  const text = value.toLocaleLowerCase();
  const result = new Set<"documentary" | "live_action" | "animation">();
  if (/\b(?:documentary|non[ -]?fiction)\b/.test(text)) result.add("documentary");
  if (/\b(?:animat(?:ed|ion)|anime)\b/.test(text)) result.add("animation");
  if (/\b(?:live[ -]?action|scripted)\b/.test(text)) result.add("live_action");
  return result;
}

function validatePathwayCorrection(card: ScoutCard, input: PathwayCorrectionInput): ScoutPathway[] {
  const { projectProfile, pathways } = input.replacement;
  const nativeMedium = projectMedium(card);
  if (projectProfile.medium !== nativeMedium) {
    throw new CorrectionError(
      "profile_conflict",
      "The correction profile contradicts the published project identity.",
      409,
    );
  }
  const cardSourceIds = new Set(card.sourceIds);
  if (projectProfile.sourceIds.some((sourceId) => !cardSourceIds.has(sourceId))) {
    throw new CorrectionError(
      "profile_source_missing",
      "The correction profile must cite existing immutable card sources.",
      409,
    );
  }
  if (new Set(pathways.map((pathway) => pathway.id)).size !== 3
    || new Set(pathways.map((pathway) => pathway.order)).size !== 3
    || !pathways.every((pathway) => pathway.id === `pathway-0${pathway.order}`)) {
    throw new CorrectionError("invalid_pathways", "Pathway IDs and order must be 1, 2, and 3.", 409);
  }
  for (const field of ["label", "format", "strategyKind"] as const) {
    if (new Set(pathways.map((pathway) => pathway[field].trim().toLocaleLowerCase())).size !== 3) {
      throw new CorrectionError(
        "duplicate_pathways",
        `All three pathway ${field} values must be distinct.`,
        409,
      );
    }
  }
  const claims = new Map(card.evidenceClaims.map((claim) => [claim.id, claim]));
  for (const pathway of pathways) {
    if (pathway.proposedMedium !== projectProfile.medium) {
      throw new CorrectionError(
        "pathway_medium_conflict",
        "A corrected pathway contradicts the project profile medium.",
        409,
      );
    }
    const citedClaims = pathway.supportingClaimIds.map((claimId) => claims.get(claimId));
    if (citedClaims.some((claim) => !claim || claim.status === "unsupported")) {
      throw new CorrectionError(
        "pathway_claim_missing",
        "Corrected pathways must cite existing usable card claims.",
        409,
      );
    }
    if (pathway.comparableSourceIds.some((sourceId) => !cardSourceIds.has(sourceId))) {
      throw new CorrectionError(
        "pathway_source_missing",
        "Corrected pathways must cite existing immutable card sources.",
        409,
      );
    }
    const mentioned = mentionedMedia(`${pathway.label} ${pathway.format}`);
    const allowed = projectProfile.medium === "hybrid"
      ? new Set(["documentary", "live_action", "animation"])
      : new Set([projectProfile.medium]);
    if ([...mentioned].some((medium) => !allowed.has(medium))) {
      throw new CorrectionError(
        "pathway_medium_conflict",
        "A corrected pathway label or format contradicts its proposed medium.",
        409,
      );
    }
  }
  return pathways;
}

export function validateProjectNativePathwayCorrection(
  card: ScoutCard,
  input: CorrectionInput,
): ScoutPathway[] {
  if (!("replacement" in input) || input.replacement.kind !== "project_native_pathways") {
    throw new CorrectionError(
      "invalid_correction",
      "Use a project-native pathway replacement.",
      400,
    );
  }
  return validatePathwayCorrection(card, input as PathwayCorrectionInput);
}

function correctedPathwayCard(
  fromCard: ScoutCard,
  pathways: ScoutPathway[],
  toCardVersionId: string,
  publishedAt: string,
): ScoutCard {
  const confidenceRank = { low: 0, medium: 1, high: 2 } as const;
  const recommended = [...pathways].sort((left, right) =>
    confidenceRank[right.confidence] - confidenceRank[left.confidence]
      || left.order - right.order,
  )[0];
  return {
    ...fromCard,
    cardVersionId: toCardVersionId,
    pathwayIds: pathways.map((pathway) => pathway.id),
    pathways,
    industryLens: {
      ...fromCard.industryLens,
      pathwayIds: pathways.map((pathway) => pathway.id),
      risks: Array.from(new Set(pathways.flatMap((pathway) => pathway.risks))),
      unresolvedQuestions: Array.from(
        new Set(pathways.flatMap((pathway) => pathway.openQuestions)),
      ),
      recommendedNextExperiment: recommended.nextExperiment,
    },
    publishedAt,
  };
}

async function publishPathwayCorrection(
  database: Firestore,
  projectId: string,
  actorUid: string,
  input: PathwayCorrectionInput,
) {
  const fingerprint = digest(JSON.stringify({ projectId, ...input }));
  const correctionId = `correction-${fingerprint}`;
  const toCardVersionId = `${input.expectedCardVersionId}-correction-${fingerprint.slice(0, 12)}`;
  const projectRef = database.collection("projects").doc(projectId);
  const fromCardRef = database.collection("scoutCards").doc(input.expectedCardVersionId);
  const toCardRef = database.collection("scoutCards").doc(toCardVersionId);
  const correctionRef = database.collection("projectCorrections").doc(correctionId);
  const auditRef = database.collection("projectCorrectionAudits").doc(correctionId);
  const pathwayRefs = input.replacement.pathways.map((pathway) =>
    database.collection("pathways").doc(
      `${projectId}_${toCardVersionId}_${pathway.id}`,
    ),
  );
  const publishedAt = new Date().toISOString();

  return database.runTransaction(async (transaction) => {
    const snapshots = await transaction.getAll(
      projectRef,
      fromCardRef,
      toCardRef,
      correctionRef,
      auditRef,
      ...pathwayRefs,
    );
    const [projectSnapshot, fromCardSnapshot, toCardSnapshot, correctionSnapshot, auditSnapshot] = snapshots;
    const pathwaySnapshots = snapshots.slice(5);
    const project = projectSnapshot.data();
    if (!projectSnapshot.exists || project?.publicationStatus !== "published") {
      throw new CorrectionError("project_not_found", "Project was not found.", 404);
    }
    if (!fromCardSnapshot.exists) {
      throw new CorrectionError("card_not_found", "The published card could not be read.", 409);
    }
    const slug = typeof project.slug === "string" ? project.slug : "";
    const fromCard = parsePublishedCard(fromCardSnapshot.data(), {
      cardVersionId: input.expectedCardVersionId,
      projectId,
      slug,
    });
    if (!fromCard) {
      throw new CorrectionError(
        "invalid_card",
        "The published card does not satisfy the current Scout Card contract.",
        409,
      );
    }
    if (project.latestCardVersionId === toCardVersionId) {
      if (
        toCardSnapshot.exists
        && correctionSnapshot.exists
        && auditSnapshot.exists
        && pathwaySnapshots.every((snapshot) => snapshot.exists)
        && correctionSnapshot.data()?.fromCardVersionId === input.expectedCardVersionId
        && correctionSnapshot.data()?.toCardVersionId === toCardVersionId
      ) {
        return {
          correctionId,
          projectId,
          cardVersionId: toCardVersionId,
          previousCardVersionId: input.expectedCardVersionId,
          changed: false,
        };
      }
      throw new CorrectionError(
        "correction_conflict",
        "The correction pointer is incomplete or inconsistent.",
        409,
      );
    }
    if (project.latestCardVersionId !== input.expectedCardVersionId) {
      throw new CorrectionError(
        "card_changed",
        "The published card changed before this correction could be applied.",
        409,
      );
    }
    if (
      toCardSnapshot.exists
      || correctionSnapshot.exists
      || auditSnapshot.exists
      || pathwaySnapshots.some((snapshot) => snapshot.exists)
    ) {
      throw new CorrectionError(
        "correction_conflict",
        "A different correction already uses this immutable identifier.",
        409,
      );
    }
    const pathways = validatePathwayCorrection(fromCard, input);
    const nextCard = correctedPathwayCard(fromCard, pathways, toCardVersionId, publishedAt);
    if (!parsePublishedCard({ ...nextCard, visibility: "public" }, {
      cardVersionId: toCardVersionId,
      projectId,
      slug,
    })) {
      throw new CorrectionError(
        "invalid_correction",
        "The corrected card did not satisfy the Scout Card contract.",
        409,
      );
    }

    const now = FieldValue.serverTimestamp();
    pathwayRefs.forEach((ref, index) => transaction.create(ref, {
      ...pathways[index],
      projectId,
      runId: fromCard.runId,
      researchVersion: fromCard.researchVersion,
      correctionCardVersionId: toCardVersionId,
      visibility: "public",
    }));
    transaction.create(toCardRef, { ...nextCard, visibility: "public" });
    transaction.create(correctionRef, {
      correctionId,
      projectId,
      section: input.section,
      correctionType: input.replacement.kind,
      summary: input.summary,
      priorBasis: input.priorBasis,
      cardVersionId: input.expectedCardVersionId,
      fromCardVersionId: input.expectedCardVersionId,
      toCardVersionId,
      correctedPathwayIds: pathways.map((pathway) => pathway.id),
      projectProfile: input.replacement.projectProfile,
      visibility: "public",
      createdAt: now,
      updatedAt: now,
    });
    transaction.create(auditRef, {
      correctionId,
      projectId,
      actorUid,
      action: "pathway_correction_version_published",
      fromCardVersionId: input.expectedCardVersionId,
      toCardVersionId,
      createdAt: now,
    });
    transaction.update(projectRef, {
      latestCardVersionId: toCardVersionId,
      correctionNotice: input.summary,
      correctionUpdatedAt: now,
      updatedAt: now,
    });
    return {
      correctionId,
      projectId,
      cardVersionId: toCardVersionId,
      previousCardVersionId: input.expectedCardVersionId,
      changed: true,
    };
  });
}

async function recordCorrectionNote(
  database: Firestore,
  projectId: string,
  actorUid: string,
  input: z.infer<typeof noteOnlyCorrectionSchema>,
) {
  const projectRef = database.collection("projects").doc(projectId);
  const correctionRef = database.collection("projectCorrections").doc();
  const auditRef = database.collection("projectCorrectionAudits").doc(correctionRef.id);

  return database.runTransaction(async (transaction) => {
    const projectSnapshot = await transaction.get(projectRef);
    const project = projectSnapshot.data();
    if (!projectSnapshot.exists || project?.publicationStatus !== "published") {
      throw new CorrectionError("project_not_found", "Project was not found.", 404);
    }
    const fromCardVersionId = typeof project.latestCardVersionId === "string"
      ? project.latestCardVersionId
      : null;
    if (!fromCardVersionId) {
      throw new CorrectionError("card_not_found", "The project has no published card to correct.", 409);
    }

    const now = FieldValue.serverTimestamp();
    transaction.create(correctionRef, {
      correctionId: correctionRef.id,
      projectId,
      section: input.section,
      summary: input.summary,
      priorBasis: input.priorBasis,
      cardVersionId: fromCardVersionId,
      visibility: "public",
      createdAt: now,
      updatedAt: now,
    });
    transaction.create(auditRef, {
      correctionId: correctionRef.id,
      projectId,
      actorUid,
      action: "correction_recorded",
      cardVersionId: fromCardVersionId,
      createdAt: now,
    });
    transaction.set(projectRef, {
      correctionNotice: input.summary,
      correctionUpdatedAt: now,
      updatedAt: now,
    }, { merge: true });
    return { correctionId: correctionRef.id, projectId, cardVersionId: fromCardVersionId };
  });
}

export async function promoteReviewedYouTubeLead(
  database: Firestore,
  input: {
    projectId: string;
    reviewerUid: string;
    incorporatedSourceId: string;
    canonicalUrl: string;
  },
) {
  const projectRef = database.collection("projects").doc(input.projectId);
  const sourceRef = database.collection("sources").doc(input.incorporatedSourceId);
  const [projectSnapshot, sourceSnapshot] = await Promise.all([
    projectRef.get(),
    sourceRef.get(),
  ]);
  const project = projectSnapshot.data();
  const source = sourceSnapshot.data();
  if (!projectSnapshot.exists || project?.publicationStatus !== "published") {
    throw new CorrectionError("project_not_found", "Project was not found.", 404);
  }
  if (
    !sourceSnapshot.exists
    || source?.projectId !== input.projectId
    || source?.verificationStatus !== "verified"
  ) {
    throw new CorrectionError("source_not_verified", "The reviewed video source is unavailable.", 409);
  }
  const sourceUrl = String(source.canonicalUrl ?? source.url ?? input.canonicalUrl);
  const videoId = youtubeVideoId(sourceUrl);
  if (!videoId) {
    throw new CorrectionError("invalid_source", "Use a supported YouTube video URL.", 400);
  }
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  if (canonicalUrl !== input.canonicalUrl) {
    throw new CorrectionError("source_conflict", "The reviewed video URL does not match its source.", 409);
  }
  const latestCardVersionId = typeof project.latestCardVersionId === "string"
    ? project.latestCardVersionId
    : null;
  if (!latestCardVersionId) {
    throw new CorrectionError("card_not_found", "The project has no published Scout Card.", 409);
  }
  const cardSnapshot = await database.collection("scoutCards").doc(latestCardVersionId).get();
  const slug = typeof project.slug === "string" ? project.slug : "";
  const card = cardSnapshot.exists
    ? parsePublishedCard(cardSnapshot.data(), {
        cardVersionId: latestCardVersionId,
        projectId: input.projectId,
        slug,
      })
    : null;
  if (!card) {
    throw new CorrectionError("invalid_card", "The published card could not be read.", 409);
  }
  if (youtubeVideoId(card.media.sourceUrl) === videoId) {
    return {
      projectId: input.projectId,
      cardVersionId: latestCardVersionId,
      previousCardVersionId: latestCardVersionId,
      changed: false,
    };
  }
  const sourceTitle = typeof source.title === "string" && source.title.trim()
    ? source.title.trim()
    : "Community-submitted YouTube video";
  const authorName = typeof source.author === "string" && source.author.trim()
    ? source.author.trim()
    : "Public source uploader";
  return publishVersionedCorrection(
    database,
    input.projectId,
    input.reviewerUid,
    {
      section: "media",
      summary: "A verified community lead is now the Scout Card video.",
      priorBasis: "The previous card retained its earlier submitted media selection.",
      expectedCardVersionId: latestCardVersionId,
      replacement: {
        kind: "youtube_primary_work",
        sourceUrl: canonicalUrl,
        sourceTitle,
        authorName,
        cardTitle: card.title,
      },
    },
    {
      existingSourceId: input.incorporatedSourceId,
      sourceVerificationStatus: "verified",
      alignIdentity: false,
      demotePriorMedia: false,
    },
  );
}

export async function recordProjectCorrection(
  database: Firestore,
  projectId: string,
  actorUid: string,
  input: CorrectionInput,
) {
  if (!("replacement" in input)) {
    return recordCorrectionNote(database, projectId, actorUid, input);
  }
  return input.replacement.kind === "project_native_pathways"
    ? publishPathwayCorrection(database, projectId, actorUid, input as PathwayCorrectionInput)
    : publishVersionedCorrection(database, projectId, actorUid, input as MediaCorrectionInput);
}
