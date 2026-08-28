import { z } from "zod";

import completeFixture from "./fixtures/junichiro-card.json";
import fallbackFixture from "./fixtures/junichiro-card-fallback.json";
import partialFixture from "./fixtures/junichiro-card-partial.json";
import unavailableMediaFixture from "./fixtures/junichiro-card-unavailable-media.json";
import { getAdminFirestore } from "../../lib/firebase/admin";
import { youtubeVideoId } from "../../lib/media/youtube";
import type { ScoutCard } from "./types";

export const JUNICHIO_SLUG = "junichiro-jackson";
export const JUNICHIO_LIVE_SLUG = "junichiro-live-project";
export const LIVE_REFRESH_FALLBACK_LABEL = "Previously generated — live refresh unavailable.";

const text = z.string().min(1);
const nullableText = z.string().nullable();
const dateTime = z.string().datetime();
const httpUrl = z.string().url().refine((value) => value.startsWith("https://") || value.startsWith("http://"));
const claimStatus = z.enum(["unclaimed", "pending", "approved", "rejected"]);
const completeness = z.enum(["complete", "partial"]);
const evidenceStatus = z.enum(["verified_core", "verification_in_progress", "source_limited", "conflicting"]);
const stringList = z.array(text);

const nextExperimentSchema = z.object({
  title: text, hypothesis: text, method: text, participantAction: text, signal: text, timebox: text,
  owner: text.optional(), prerequisite: text.optional(), costClass: z.enum(["low", "medium", "high", "unknown"]).optional(),
  requiredPermission: text.optional(), successCriterion: text.optional(), audienceTakeRole: text.optional(),
});
const pathwaySchema = z.object({
  id: text, order: z.number().int().min(1).max(3), label: text, format: text, audience: text, rationale: text,
  strategyKind: z.enum(["development", "distribution", "audience", "financing", "education", "adaptation"]).optional(),
  proposedMedium: z.enum(["documentary", "live_action", "animation", "hybrid", "unknown"]).optional(),
  crossFormat: z.boolean().optional(), crossFormatClaimIds: stringList.optional(),
  supportingClaimIds: stringList.min(1), comparableSourceIds: stringList, strengths: stringList.min(1), risks: stringList.min(1),
  openQuestions: stringList.min(1), confidence: z.enum(["low", "medium", "high"]), nextExperiment: nextExperimentSchema,
});
const sourceLedgerSchema = z.object({
  id: text, origin: z.enum(["submitted", "parallel", "community_lead", "creator"]), title: text, url: httpUrl,
  publishedAt: dateTime.nullable(), retrievedAt: dateTime, availability: z.enum(["available", "unavailable", "restricted"]),
  verificationStatus: z.enum(["observed", "verified", "qualified", "conflicting", "unverified"]), supportsClaimIds: stringList,
  sourceRole: z.enum(["primary_work", "commentary", "trade_reporting", "community", "creator_statement", "other"]).optional(),
  sourceTier: z.enum(["primary", "creator_authorized", "reputable_trade", "platform_metadata", "secondary", "community"]).optional(),
  externalCommentary: z.boolean(),
});
const mediaSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("authorized_embed"), title: text, sourceUrl: httpUrl, embedUrl: httpUrl, attribution: text, accessibleFallback: text }),
  z.object({ state: z.literal("authorized_image"), title: text, sourceUrl: httpUrl, imageUrl: text, attribution: text, accessibleFallback: text }),
  z.object({ state: z.literal("editorial_fallback"), title: text, sourceUrl: httpUrl, attribution: text, accessibleFallback: text }),
  z.object({ state: z.literal("unavailable"), title: text, sourceUrl: httpUrl, attribution: text, accessibleFallback: text }),
]);
const timestamp = z.string().regex(/^\d{2}:\d{2}$/);
function timestampSeconds(value: string): number {
  const [minutes, seconds] = value.split(":").map(Number);
  return minutes * 60 + seconds;
}
export const trailerCriticSchema = z.object({
  artifactId: text, projectId: text, sourceId: text, youtubeUrl: httpUrl,
  youtubeVideoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/), modelId: text,
  analysisVersion: z.number().int().min(1), cardVersionId: text,
  structuralNarrative: z.object({
    genreSignaling: text, narrativeDelivery: text, trailerType: text,
    beats: z.array(z.object({
      label: text, start: timestamp, end: timestamp, observation: text,
      modality: z.enum(["visual", "audio", "audiovisual"]),
    }).strict()).min(2).max(6),
  }).strict(),
  technicalCraft: z.object({
    editingAndPace: text, cinematographyAndFraming: text,
    soundAndScore: text, graphicsAndTitles: text,
  }).strict(),
  marketingPersuasion: z.object({
    uniqueSellingProposition: text, targetAudienceHypothesis: text,
    conceptVsStarEmphasis: text, representationCaveat: text,
  }).strict(),
  emotionalRhetorical: z.object({
    emotionalHook: text, toneAndMoodBalance: text, persuasiveArgument: text,
  }).strict(),
  matrix: z.array(z.object({
    category: z.enum(["genre", "narrative_stance", "usp", "target_audience", "sound_music", "camera_editing"]),
    analysis: text,
  }).strict()).length(6),
  sourceIds: stringList, limitations: stringList.min(1), analyzedAt: dateTime,
  visibility: z.literal("public"),
}).strict().superRefine((value, context) => {
  const categories = value.matrix.map((row) => row.category);
  const expected = ["genre", "narrative_stance", "usp", "target_audience", "sound_music", "camera_editing"];
  if (categories.some((category, index) => category !== expected[index])) {
    context.addIssue({ code: "custom", path: ["matrix"], message: "Critic matrix order is invalid." });
  }
  const starts = value.structuralNarrative.beats.map((beat) => timestampSeconds(beat.start));
  value.structuralNarrative.beats.forEach((beat, index) => {
    if (timestampSeconds(beat.end) < timestampSeconds(beat.start)) {
      context.addIssue({ code: "custom", path: ["structuralNarrative", "beats", index], message: "Beat timestamps are invalid." });
    }
    if (index > 0 && starts[index] < starts[index - 1]) {
      context.addIssue({ code: "custom", path: ["structuralNarrative", "beats", index], message: "Beats must be chronological." });
    }
  });
  if (new Set(value.sourceIds).size !== value.sourceIds.length) {
    context.addIssue({ code: "custom", path: ["sourceIds"], message: "Source IDs must be unique." });
  }
});
const scoutCardSchema = z.object({
  cardVersionId: text, runId: text, researchVersion: z.number().int().min(1), projectId: text,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), title: text, hook: text,
  projectType: z.enum(["series", "film", "short_film", "documentary", "creator_project"]), submissionLabel: text,
  claimStatus, completeness, structureStatus: completeness.optional(), evidenceStatus: evidenceStatus.optional(),
  identity: z.object({
    relationshipStatus: z.enum(["unresolved", "source_aligned", "creator_confirmed", "disputed"]),
    primarySourceId: text.optional(), lastVerifiedAt: dateTime.optional(),
  }).optional(),
  primaryWorkSourceId: text.optional(), fallbackUsed: z.boolean(), fallbackLabel: z.string().optional(),
  provenance: z.object({ submissionType: z.enum(["fan", "creator"]), submittedSourceUrl: httpUrl, nominationLabel: text, nominatedByLabel: text, researchedAt: dateTime }),
  media: mediaSchema,
  storyContext: z.object({ summary: text, storyworld: text, themes: stringList, currentFormat: text, audienceHooks: stringList, claimIds: stringList.min(1) }),
  creatorContext: z.object({ displayName: nullableText, claimStatus, summary: text, sourceIds: stringList, limitations: stringList }),
  sourceIds: stringList.min(1), claimIds: stringList.min(1),
  evidenceClaims: z.array(z.object({ id: text, statement: text, status: z.enum(["supported", "qualified", "conflicting", "unsupported", "inference"]), sourceIds: stringList, qualification: nullableText })).min(1),
  externalSignals: z.array(z.object({ label: text, analysis: text, sourceIds: stringList.min(1), limitations: stringList.min(1), nativeAudienceCount: z.literal(false) })),
  pathwayIds: stringList.length(3), pathways: z.array(pathwaySchema).length(3), sourceLedger: z.array(sourceLedgerSchema).min(1),
  missingSections: stringList, limitations: stringList.min(1),
  industryLens: z.object({ pathwayIds: stringList.length(3), comparables: z.array(z.object({ title: text, relevance: text, sourceIds: stringList.min(1), limitations: stringList.min(1) })), risks: stringList.min(1), unresolvedQuestions: stringList.min(1), signalLimitations: stringList.min(1), creatorClaimStatus: claimStatus, recommendedNextExperiment: nextExperimentSchema }),
  publishedAt: dateTime,
});

const fixtures = {
  complete: scoutCardSchema.parse(completeFixture) as ScoutCard,
  partial: scoutCardSchema.parse(partialFixture) as ScoutCard,
  unavailable: scoutCardSchema.parse(unavailableMediaFixture) as ScoutCard,
  fallback: scoutCardSchema.parse(fallbackFixture) as ScoutCard,
} as const;

export type ScoutCardFixtureState = keyof typeof fixtures;

const MAX_ERROR_MESSAGE_LENGTH = 500;

function redactDiagnosticMessage(message: string): string {
  return message
    .replace(/\b(Bearer|Basic)\s+[^\s"',]+/gi, "$1 [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_JWT]")
    .replace(/([?&](?:access_token|id_token|token|key)=)[^&\s]+/gi, "$1[REDACTED]")
    .slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

function boundedDiagnosticScalar(value: unknown, maxLength: number): string | number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value.length === 0) return undefined;
  return redactDiagnosticMessage(value).slice(0, maxLength);
}

function logPublishedCardLoadFailure(slug: string, error: unknown): void {
  const details = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const errorName = error instanceof Error ? error.name : boundedDiagnosticScalar(details.name, 80);
  const errorMessage = error instanceof Error
    ? redactDiagnosticMessage(error.message)
    : boundedDiagnosticScalar(details.message, MAX_ERROR_MESSAGE_LENGTH);

  console.error(JSON.stringify({
    level: "error",
    event: "published_scout_card_load_failed",
    slug,
    errorName,
    errorCode: boundedDiagnosticScalar(details.code, 120),
    errorStatus: boundedDiagnosticScalar(details.status, 40),
    errorMessage,
  }));
}

type DocumentSnapshotLike = { id: string; exists: boolean; data(): unknown };
type QuerySnapshotLike = { docs: DocumentSnapshotLike[] };
type QueryLike = { where(field: string, operator: "==", value: unknown): QueryLike; limit(count: number): QueryLike; get(): Promise<QuerySnapshotLike> };
type CollectionLike = QueryLike & { doc(id: string): { get(): Promise<DocumentSnapshotLike> } };
export type ScoutCardFirestore = { collection(name: string): CollectionLike };

export function parsePublishedCard(value: unknown, expected: { cardVersionId: string; projectId: string; slug: string }): ScoutCard | null {
  if (!value || typeof value !== "object" || (value as { visibility?: unknown }).visibility !== "public") return null;
  const { visibility: _visibility, ...publicValue } = value as Record<string, unknown>;
  void _visibility;
  const result = scoutCardSchema.safeParse(publicValue);
  if (!result.success) return null;
  const card = result.data as ScoutCard;
  const pathwayIds = card.pathways.map((pathway) => pathway.id);
  if (
    card.cardVersionId !== expected.cardVersionId || card.projectId !== expected.projectId || card.slug !== expected.slug ||
    new Set(card.pathwayIds).size !== 3 || pathwayIds.some((id, index) => id !== card.pathwayIds[index]) ||
    card.pathways.some((pathway, index) => pathway.order !== index + 1) ||
    (card.completeness === "complete" && card.missingSections.length > 0) ||
    (card.completeness === "partial" && card.missingSections.length === 0) ||
    (card.fallbackUsed && card.fallbackLabel !== LIVE_REFRESH_FALLBACK_LABEL)
  ) return null;
  return card;
}

async function readPublishedScoutCard(slug: string, database: ScoutCardFirestore): Promise<ScoutCard | null> {
  const projects = await database.collection("projects").where("slug", "==", slug).limit(2).get();
  if (projects.docs.length !== 1) return null;
  const projectSnapshot = projects.docs[0];
  const project = projectSnapshot.data();
  if (!project || typeof project !== "object") return null;
  const projectData = project as Record<string, unknown>;
  if (
    projectData.publicationStatus !== "published" ||
    (projectData.moderationState !== undefined && projectData.moderationState !== "clear") ||
    typeof projectData.latestCardVersionId !== "string" || !projectData.latestCardVersionId
  ) return null;

  const cardSnapshot = await database.collection("scoutCards").doc(projectData.latestCardVersionId).get();
  if (!cardSnapshot.exists) return null;
  const card = parsePublishedCard(cardSnapshot.data(), { cardVersionId: projectData.latestCardVersionId, projectId: projectSnapshot.id, slug });
  if (!card) return null;

  // Claim status is a mutable authorization fact owned by trusted project and
  // role records. Model-authored card text must never grant or imply access.
  const trustedClaimStatus = claimStatus.safeParse(projectData.claimStatus).success
    ? claimStatus.parse(projectData.claimStatus)
    : "unclaimed";
  const analysisIds = Array.isArray(projectData.latestVideoAnalysisIds)
    ? [...new Set(projectData.latestVideoAnalysisIds.filter((value): value is string => typeof value === "string" && value.length > 0))].slice(0, 5)
    : [];
  const analysisSnapshots = await Promise.all(
    analysisIds.map((analysisId) => database.collection("videoAnalyses").doc(analysisId).get()),
  );
  const trailerCritiques = analysisSnapshots.flatMap((snapshot) => {
    if (!snapshot.exists) return [];
    const parsed = trailerCriticSchema.safeParse(snapshot.data());
    if (!parsed.success || parsed.data.artifactId !== snapshot.id || parsed.data.projectId !== card.projectId) return [];
    const source = card.sourceLedger.find((entry) => entry.id === parsed.data.sourceId);
    if (!source || youtubeVideoId(source.url) !== parsed.data.youtubeVideoId || youtubeVideoId(parsed.data.youtubeUrl) !== parsed.data.youtubeVideoId) return [];
    return [parsed.data];
  });
  return {
    ...card,
    claimStatus: trustedClaimStatus,
    creatorContext: { ...card.creatorContext, claimStatus: trustedClaimStatus },
    industryLens: { ...card.industryLens, creatorClaimStatus: trustedClaimStatus },
    trailerCritiques,
  };
}

export async function loadPublishedScoutCard(slug: string, database?: ScoutCardFirestore): Promise<ScoutCard | null> {
  try {
    return await readPublishedScoutCard(slug, database ?? getAdminFirestore() as unknown as ScoutCardFirestore);
  } catch (error) {
    logPublishedCardLoadFailure(slug, error);
    return slug === JUNICHIO_SLUG || slug === JUNICHIO_LIVE_SLUG
      ? fixtures.fallback
      : null;
  }
}

/** Contract fixtures are explicit test/local-preview helpers and are never the route's live data source. */
export function getScoutCardFixture(state: ScoutCardFixtureState): ScoutCard {
  return fixtures[state];
}
