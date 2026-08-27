import { z } from "zod";

import completeFixture from "../../../../contracts/fixtures/junichiro-card.json";
import fallbackFixture from "../../../../contracts/fixtures/junichiro-card-fallback.json";
import partialFixture from "../../../../contracts/fixtures/junichiro-card-partial.json";
import unavailableMediaFixture from "../../../../contracts/fixtures/junichiro-card-unavailable-media.json";
import { getAdminFirestore } from "../../lib/firebase/admin";
import type { ScoutCard } from "./types";

export const JUNICHIO_SLUG = "junichiro-jackson";
export const LIVE_REFRESH_FALLBACK_LABEL = "Previously generated — live refresh unavailable.";

const text = z.string().min(1);
const nullableText = z.string().nullable();
const dateTime = z.string().datetime();
const httpUrl = z.string().url().refine((value) => value.startsWith("https://") || value.startsWith("http://"));
const claimStatus = z.enum(["unclaimed", "pending", "approved", "rejected"]);
const stringList = z.array(text);

const nextExperimentSchema = z.object({ title: text, hypothesis: text, method: text, participantAction: text, signal: text, timebox: text });
const pathwaySchema = z.object({
  id: text, order: z.number().int().min(1).max(3), label: text, format: text, audience: text, rationale: text,
  supportingClaimIds: stringList.min(1), comparableSourceIds: stringList, strengths: stringList.min(1), risks: stringList.min(1),
  openQuestions: stringList.min(1), confidence: z.enum(["low", "medium", "high"]), nextExperiment: nextExperimentSchema,
});
const sourceLedgerSchema = z.object({
  id: text, origin: z.enum(["submitted", "parallel", "community_lead", "creator"]), title: text, url: httpUrl,
  publishedAt: dateTime.nullable(), retrievedAt: dateTime, availability: z.enum(["available", "unavailable", "restricted"]),
  verificationStatus: z.enum(["observed", "verified", "qualified", "conflicting", "unverified"]), supportsClaimIds: stringList,
  externalCommentary: z.boolean(),
});
const mediaSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("authorized_embed"), title: text, sourceUrl: httpUrl, embedUrl: httpUrl, attribution: text, accessibleFallback: text }),
  z.object({ state: z.literal("authorized_image"), title: text, sourceUrl: httpUrl, imageUrl: text, attribution: text, accessibleFallback: text }),
  z.object({ state: z.literal("editorial_fallback"), title: text, sourceUrl: httpUrl, attribution: text, accessibleFallback: text }),
  z.object({ state: z.literal("unavailable"), title: text, sourceUrl: httpUrl, attribution: text, accessibleFallback: text }),
]);
const scoutCardSchema = z.object({
  cardVersionId: text, runId: text, researchVersion: z.number().int().min(1), projectId: text,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), title: text, hook: text,
  projectType: z.enum(["series", "film", "short_film", "documentary", "creator_project"]), submissionLabel: text,
  claimStatus, completeness: z.enum(["complete", "partial"]), fallbackUsed: z.boolean(), fallbackLabel: z.string().optional(),
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

type DocumentSnapshotLike = { id: string; exists: boolean; data(): unknown };
type QuerySnapshotLike = { docs: DocumentSnapshotLike[] };
type QueryLike = { where(field: string, operator: "==", value: unknown): QueryLike; limit(count: number): QueryLike; get(): Promise<QuerySnapshotLike> };
type CollectionLike = QueryLike & { doc(id: string): { get(): Promise<DocumentSnapshotLike> } };
export type ScoutCardFirestore = { collection(name: string): CollectionLike };

function parsePublishedCard(value: unknown, expected: { cardVersionId: string; projectId: string; slug: string }): ScoutCard | null {
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
  return parsePublishedCard(cardSnapshot.data(), { cardVersionId: projectData.latestCardVersionId, projectId: projectSnapshot.id, slug });
}

export async function loadPublishedScoutCard(slug: string, database?: ScoutCardFirestore): Promise<ScoutCard | null> {
  try {
    return await readPublishedScoutCard(slug, database ?? getAdminFirestore() as unknown as ScoutCardFirestore);
  } catch {
    return slug === JUNICHIO_SLUG ? fixtures.fallback : null;
  }
}

/** Contract fixtures are explicit test/local-preview helpers and are never the route's live data source. */
export function getScoutCardFixture(state: ScoutCardFixtureState): ScoutCard {
  return fixtures[state];
}
