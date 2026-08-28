import { createHash } from "node:crypto";

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { z } from "zod";

import { parsePublishedCard } from "@/features/scout-card/data";
import type { ScoutCard, SourceLedgerEntry } from "@/features/scout-card/types";
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

const versionedCorrectionSchema = correctionBaseSchema.extend({
  expectedCardVersionId: z.string().trim().min(1).max(500),
  replacement: youtubePrimaryWorkSchema,
}).strict();

const noteOnlyCorrectionSchema = correctionBaseSchema.strict();

export const correctionInputSchema = z.union([
  versionedCorrectionSchema,
  noteOnlyCorrectionSchema,
]);

export type CorrectionInput = z.infer<typeof correctionInputSchema>;
type VersionedCorrectionInput = z.infer<typeof versionedCorrectionSchema>;

export class CorrectionError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
    this.name = "CorrectionError";
  }
}

function digest(value: string, length = 20): string {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

function correctionIdentity(projectId: string, input: VersionedCorrectionInput) {
  const videoId = youtubeVideoId(input.replacement.sourceUrl);
  if (!videoId) throw new CorrectionError("invalid_source", "Use a supported YouTube video URL.", 400);
  const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const fingerprint = digest(JSON.stringify({
    projectId,
    expectedCardVersionId: input.expectedCardVersionId,
    section: input.section,
    summary: input.summary,
    priorBasis: input.priorBasis,
    replacement: { ...input.replacement, sourceUrl },
  }));
  return {
    sourceUrl,
    videoId,
    sourceId: `source-community-lead-${digest(sourceUrl, 16)}`,
    toCardVersionId: `${input.expectedCardVersionId}-correction-${fingerprint.slice(0, 12)}`,
    correctionId: `correction-${fingerprint}`,
  };
}

function cardSourceEntry(
  sourceId: string,
  input: VersionedCorrectionInput,
  sourceUrl: string,
  retrievedAt: string,
): SourceLedgerEntry {
  return {
    id: sourceId,
    origin: "community_lead",
    title: input.replacement.sourceTitle,
    url: sourceUrl,
    publishedAt: null,
    retrievedAt,
    availability: "available",
    verificationStatus: "observed",
    sourceRole: "primary_work",
    sourceTier: "platform_metadata",
    supportsClaimIds: [],
    externalCommentary: false,
  };
}

function correctedCard(
  fromCard: ScoutCard,
  input: VersionedCorrectionInput,
  identity: ReturnType<typeof correctionIdentity>,
  publishedAt: string,
): ScoutCard {
  const priorMediaUrl = fromCard.media.sourceUrl;
  const retainedLedger = fromCard.sourceLedger
    .filter((source) => source.id !== identity.sourceId)
    .map((source) => source.url === priorMediaUrl ? {
      ...source,
      sourceRole: "commentary" as const,
      sourceTier: "community" as const,
      externalCommentary: true,
    } : source);
  const sourceLedger = [
    ...retainedLedger,
    cardSourceEntry(identity.sourceId, input, identity.sourceUrl, publishedAt),
  ];
  const limitation = `${input.replacement.authorName}'s public YouTube upload establishes an embeddable primary-work lead, but creator ownership, rights, and the wider project relationship remain unconfirmed.`;

  return {
    ...fromCard,
    cardVersionId: identity.toCardVersionId,
    title: input.replacement.cardTitle,
    structureStatus: fromCard.completeness,
    evidenceStatus: "source_limited",
    identity: {
      relationshipStatus: "source_aligned",
      primarySourceId: identity.sourceId,
      lastVerifiedAt: publishedAt,
    },
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
  input: VersionedCorrectionInput,
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
  input: VersionedCorrectionInput,
) {
  const identity = correctionIdentity(projectId, input);
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
      `${projectId}_v${fromCard.researchVersion}_${identity.sourceId}`,
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
    if (sourceSnapshot.exists) {
      throw new CorrectionError("source_conflict", "The correction source identifier already exists.", 409);
    }
    const nextCard = correctedCard(fromCard, input, identity, publishedAt);
    if (!parsePublishedCard({ ...nextCard, visibility: "public" }, {
      cardVersionId: identity.toCardVersionId,
      projectId,
      slug,
    })) {
      throw new CorrectionError("invalid_correction", "The corrected card did not satisfy the Scout Card contract.", 409);
    }

    const now = FieldValue.serverTimestamp();
    transaction.create(sourceRef, {
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

export async function recordProjectCorrection(
  database: Firestore,
  projectId: string,
  actorUid: string,
  input: CorrectionInput,
) {
  return "replacement" in input
    ? publishVersionedCorrection(database, projectId, actorUid, input)
    : recordCorrectionNote(database, projectId, actorUid, input);
}
