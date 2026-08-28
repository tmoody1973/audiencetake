import { getAdminFirestore } from "../../lib/firebase/admin";
import {
  parsePublishedCard,
  type ScoutCardFirestore,
} from "../scout-card/data";
import type {
  ClaimStatus,
  Completeness,
  EvidenceStatus,
} from "../scout-card/types";

const MAX_PROJECTS = 48;
const MAX_WALL_ENTRIES = 24;
const claimStatuses = new Set<ClaimStatus>(["unclaimed", "pending", "approved", "rejected"]);

export type ScoutingWallEntry = {
  accessionId: string;
  projectId: string;
  slug: string;
  title: string;
  hook: string;
  projectType: "series" | "film" | "short_film" | "documentary" | "creator_project";
  submissionLabel: string;
  claimStatus: ClaimStatus;
  completeness: Completeness;
  evidenceStatus: EvidenceStatus;
  publishedAt: string;
  sourceCount: number;
  pathwayLabels: string[];
  audiencePulse: {
    follows: number;
    wouldWatch: number;
    wouldPay: number;
    bringToCity: number;
    backNextChapter: number;
  };
};

function trustedCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

function trustedCommitmentCounts(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function trustedClaimStatus(value: unknown): ClaimStatus {
  return typeof value === "string" && claimStatuses.has(value as ClaimStatus)
    ? value as ClaimStatus
    : "unclaimed";
}

export async function loadScoutingWallEntries(
  database: ScoutCardFirestore = getAdminFirestore() as unknown as ScoutCardFirestore,
): Promise<ScoutingWallEntry[]> {
  try {
    const projectSnapshot = await database
      .collection("projects")
      .where("publicationStatus", "==", "published")
      .limit(MAX_PROJECTS)
      .get();

    const entries = await Promise.all(projectSnapshot.docs.map(async (projectSnapshot) => {
      const project = projectSnapshot.data();
      if (!project || typeof project !== "object") return null;
      const projectData = project as Record<string, unknown>;
      if (
        (projectData.moderationState !== undefined && projectData.moderationState !== "clear") ||
        typeof projectData.slug !== "string" || !projectData.slug ||
        typeof projectData.latestCardVersionId !== "string" || !projectData.latestCardVersionId
      ) return null;

      const cardSnapshot = await database.collection("scoutCards").doc(projectData.latestCardVersionId).get();
      if (!cardSnapshot.exists) return null;
      const card = parsePublishedCard(cardSnapshot.data(), {
        cardVersionId: projectData.latestCardVersionId,
        projectId: projectSnapshot.id,
        slug: projectData.slug,
      });
      if (!card) return null;
      const commitmentCounts = trustedCommitmentCounts(projectData.commitmentCounts);

      return {
        accessionId: card.cardVersionId,
        projectId: card.projectId,
        slug: card.slug,
        title: card.title,
        hook: card.hook,
        projectType: card.projectType,
        submissionLabel: card.submissionLabel,
        claimStatus: trustedClaimStatus(projectData.claimStatus),
        completeness: card.completeness,
        evidenceStatus: card.evidenceStatus ?? "verification_in_progress",
        publishedAt: card.publishedAt,
        sourceCount: card.sourceLedger.length,
        pathwayLabels: card.pathways.map((pathway) => pathway.label),
        audiencePulse: {
          follows: trustedCount(projectData.followerCount),
          wouldWatch: trustedCount(commitmentCounts.would_watch),
          wouldPay: trustedCount(commitmentCounts.would_pay),
          bringToCity: trustedCount(commitmentCounts.bring_to_city),
          backNextChapter: trustedCount(commitmentCounts.back_next_chapter),
        },
      } satisfies ScoutingWallEntry;
    }));

    return entries
      .filter((entry): entry is ScoutingWallEntry => entry !== null)
      .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
      .slice(0, MAX_WALL_ENTRIES);
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "scouting_wall_load_failed",
      errorName: error instanceof Error ? error.name : "UnknownError",
    }));
    return [];
  }
}
