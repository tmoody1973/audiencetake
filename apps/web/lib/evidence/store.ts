import { createHash } from "node:crypto";

import { FieldValue, type Firestore } from "firebase-admin/firestore";

import type {
  EvidenceReviewInput,
  EvidenceReviewOutcome,
  IncorporatedSourceInput,
} from "./contract";
import { EvidenceError } from "./errors";
import { canReviewEvidence, type EvidenceSuggestionStatus } from "./state";

export type PreparedEvidenceSuggestion = {
  projectId: string;
  submittedByUid: string;
  canonicalUrl: string;
  note?: string;
  fingerprint: string;
};

export type EvidenceSuggestionResult = {
  suggestionId: string | null;
  projectId: string;
  canonicalUrl: string;
  status: EvidenceSuggestionStatus | "already_sourced";
  duplicate: boolean;
  duplicateOf: "suggestion" | "source" | null;
};

export type EvidenceReviewResult = {
  suggestionId: string;
  projectId: string;
  status: EvidenceReviewOutcome;
  incorporatedSourceId: string | null;
  changed: boolean;
};

export interface EvidenceStore {
  submit(suggestion: PreparedEvidenceSuggestion): Promise<EvidenceSuggestionResult>;
  review(
    suggestionId: string,
    reviewerUid: string,
    review: EvidenceReviewInput,
  ): Promise<EvidenceReviewResult>;
}

export function evidenceFingerprint(projectId: string, canonicalUrl: string): string {
  return createHash("sha256")
    .update(`${projectId}\u0000${canonicalUrl}`, "utf8")
    .digest("hex");
}

function publicSuggestion(
  suggestion: PreparedEvidenceSuggestion,
  now: FirebaseFirestore.FieldValue,
) {
  return {
    projectId: suggestion.projectId,
    submitterLabel: "Community member" as const,
    url: suggestion.canonicalUrl,
    canonicalUrl: suggestion.canonicalUrl,
    sourceFingerprint: suggestion.fingerprint,
    ...(suggestion.note ? { note: suggestion.note } : {}),
    status: "community_lead" as const,
    visibility: "public" as const,
    createdAt: now,
    updatedAt: now,
  };
}

function privateSuggestionOwnership(
  suggestionId: string,
  suggestion: PreparedEvidenceSuggestion,
  now: FirebaseFirestore.FieldValue,
) {
  return {
    suggestionId,
    projectId: suggestion.projectId,
    submittedByUid: suggestion.submittedByUid,
    submissionOrigin: "post_card" as const,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizedCommunitySource(input: {
  id: string;
  projectId: string;
  runId: string;
  researchVersion: number;
  canonicalUrl: string;
  fingerprint: string;
  suggestionId: string;
  reviewedAt: string;
  source: IncorporatedSourceInput;
}) {
  return {
    id: input.id,
    projectId: input.projectId,
    runId: input.runId,
    researchVersion: input.researchVersion,
    origin: "community_lead" as const,
    url: input.canonicalUrl,
    canonicalUrl: input.canonicalUrl,
    domain: new URL(input.canonicalUrl).hostname,
    title: input.source.title,
    excerpt: input.source.excerpt,
    author: input.source.author ?? null,
    publishedAt: input.source.publishedAt ?? null,
    retrievedAt: input.reviewedAt,
    sourceType: input.source.sourceType,
    availability: "available" as const,
    verificationStatus: "verified" as const,
    supportsClaimIds: input.source.supportsClaimIds,
    conflictsWithClaimIds: input.source.conflictsWithClaimIds,
    externalCommentary: input.source.externalCommentary,
    queryProvenance: null,
    sourceFingerprint: input.fingerprint,
    incorporationProvenance: {
      kind: "community_lead" as const,
      suggestionId: input.suggestionId,
    },
    visibility: "public" as const,
  };
}

export function createFirestoreEvidenceStore(database: Firestore): EvidenceStore {
  return {
    async submit(suggestion) {
      const projectRef = database.collection("projects").doc(suggestion.projectId);
      const suggestionRef = database.collection("evidenceSuggestions").doc(suggestion.fingerprint);
      const ownershipRef = database
        .collection("evidenceSuggestionOwnership")
        .doc(suggestion.fingerprint);
      const matchingSources = database
        .collection("sources")
        .where("projectId", "==", suggestion.projectId)
        .where("canonicalUrl", "==", suggestion.canonicalUrl)
        .limit(1);

      return database.runTransaction(async (transaction): Promise<EvidenceSuggestionResult> => {
        const [projectSnapshot, suggestionSnapshot, sourceSnapshot] = await Promise.all([
          transaction.get(projectRef),
          transaction.get(suggestionRef),
          transaction.get(matchingSources),
        ]);
        if (!projectSnapshot.exists) {
          throw new EvidenceError("project_not_found", "That project does not exist.", 404);
        }
        if (projectSnapshot.data()?.publicationStatus !== "published") {
          throw new EvidenceError(
            "project_not_published",
            "Evidence can be suggested after the Scout Card is published.",
            409,
          );
        }
        if (suggestionSnapshot.exists) {
          const current = suggestionSnapshot.data();
          return {
            suggestionId: suggestionSnapshot.id,
            projectId: suggestion.projectId,
            canonicalUrl: suggestion.canonicalUrl,
            status: current?.status as EvidenceSuggestionStatus,
            duplicate: true,
            duplicateOf: "suggestion",
          };
        }
        if (!sourceSnapshot.empty) {
          return {
            suggestionId: null,
            projectId: suggestion.projectId,
            canonicalUrl: suggestion.canonicalUrl,
            status: "already_sourced",
            duplicate: true,
            duplicateOf: "source",
          };
        }

        const now = FieldValue.serverTimestamp();
        transaction.create(suggestionRef, publicSuggestion(suggestion, now));
        transaction.create(
          ownershipRef,
          privateSuggestionOwnership(suggestionRef.id, suggestion, now),
        );
        return {
          suggestionId: suggestionRef.id,
          projectId: suggestion.projectId,
          canonicalUrl: suggestion.canonicalUrl,
          status: "community_lead",
          duplicate: false,
          duplicateOf: null,
        };
      });
    },

    async review(suggestionId, reviewerUid, review) {
      const suggestionRef = database.collection("evidenceSuggestions").doc(suggestionId);
      const reviewEventRef = database.collection("evidenceSuggestionReviews").doc();

      return database.runTransaction(async (transaction): Promise<EvidenceReviewResult> => {
        const suggestionSnapshot = await transaction.get(suggestionRef);
        if (!suggestionSnapshot.exists) {
          throw new EvidenceError("suggestion_not_found", "That evidence lead does not exist.", 404);
        }
        const suggestion = suggestionSnapshot.data()!;
        const current = suggestion.status as EvidenceSuggestionStatus;
        const transition = canReviewEvidence(current, review.outcome);
        const currentSourceId =
          typeof suggestion.incorporatedSourceId === "string"
            ? suggestion.incorporatedSourceId
            : null;
        if (transition === "idempotent") {
          return {
            suggestionId,
            projectId: String(suggestion.projectId),
            status: review.outcome,
            incorporatedSourceId: currentSourceId,
            changed: false,
          };
        }
        if (transition === "conflict") {
          throw new EvidenceError(
            "review_conflict",
            "This lead already has a different final review outcome.",
            409,
          );
        }

        const reviewedAt = new Date().toISOString();
        let incorporatedSourceId: string | null = null;
        let incorporationAction: "created" | "linked_existing" | null = null;
        if (review.outcome === "verified_incorporated") {
          if (!review.source) {
            throw new EvidenceError(
              "source_context_missing",
              "Verified incorporation requires normalized source details.",
              409,
            );
          }
          const projectRef = database.collection("projects").doc(String(suggestion.projectId));
          const matchingSources = database
            .collection("sources")
            .where("projectId", "==", String(suggestion.projectId))
            .where("canonicalUrl", "==", String(suggestion.canonicalUrl))
            .limit(1);
          const normalizedSourceId = `community-${suggestion.sourceFingerprint}`;
          const normalizedSourceRef = database.collection("sources").doc(normalizedSourceId);
          const [projectSnapshot, matchingSourceSnapshot, normalizedSourceSnapshot] =
            await Promise.all([
              transaction.get(projectRef),
              transaction.get(matchingSources),
              transaction.get(normalizedSourceRef),
            ]);
          const project = projectSnapshot.data();
          const runId = typeof project?.latestRunId === "string" ? project.latestRunId : null;
          const researchVersion = Number(project?.researchVersion);
          if (!runId || !Number.isInteger(researchVersion) || researchVersion < 1) {
            throw new EvidenceError(
              "source_context_missing",
              "The project is missing publication context for this source.",
              409,
            );
          }
          const existingSource = matchingSourceSnapshot.docs[0];
          if (existingSource) {
            incorporatedSourceId = existingSource.id;
            incorporationAction = "linked_existing";
          } else if (!normalizedSourceSnapshot.exists) {
            incorporatedSourceId = normalizedSourceId;
            incorporationAction = "created";
            transaction.create(
              normalizedSourceRef,
              normalizedCommunitySource({
                id: incorporatedSourceId,
                projectId: String(suggestion.projectId),
                runId,
                researchVersion,
                canonicalUrl: String(suggestion.canonicalUrl),
                fingerprint: String(suggestion.sourceFingerprint),
                suggestionId,
                reviewedAt,
                source: review.source,
              }),
            );
          } else if (
            normalizedSourceSnapshot.data()?.projectId !== suggestion.projectId ||
            normalizedSourceSnapshot.data()?.canonicalUrl !== suggestion.canonicalUrl
          ) {
            throw new EvidenceError(
              "review_conflict",
              "The normalized source identity conflicts with an existing record.",
              409,
            );
          } else {
            incorporatedSourceId = normalizedSourceId;
            incorporationAction = "linked_existing";
          }
        }

        const now = FieldValue.serverTimestamp();
        transaction.update(suggestionRef, {
          status: review.outcome,
          reviewedAt: now,
          updatedAt: now,
          ...(incorporatedSourceId ? { incorporatedSourceId } : {}),
        });
        transaction.create(reviewEventRef, {
          suggestionId,
          projectId: String(suggestion.projectId),
          fromStatus: current,
          outcome: review.outcome,
          reviewerUid,
          reviewReason: review.reason,
          incorporatedSourceId,
          incorporationAction,
          occurredAt: now,
        });

        return {
          suggestionId,
          projectId: String(suggestion.projectId),
          status: review.outcome,
          incorporatedSourceId,
          changed: true,
        };
      });
    },
  };
}
