import { FieldValue, type Firestore } from "firebase-admin/firestore";

import type { NominationInput } from "./contract";

export type PreparedNomination = NominationInput & {
  canonicalUrl: string;
  canonicalSupportingUrls: string[];
  fingerprint: string;
  nominatorUid: string;
};

export type AcceptedNomination =
  | { kind: "duplicate"; projectId: string; canonicalUrl: string }
  | {
      kind: "created";
      projectId: string;
      nominationId: string;
      runId: string;
      researchUrl: string;
      canonicalUrl: string;
    };

export interface NominationStore {
  accept(nomination: PreparedNomination): Promise<AcceptedNomination>;
  markDispatched(runId: string): Promise<void>;
  markDispatchFailed(runId: string, safeReason: string): Promise<void>;
}

export function createFirestoreNominationStore(database: Firestore): NominationStore {
  return {
    async accept(nomination) {
      const fingerprintRef = database.collection("sourceFingerprints").doc(nomination.fingerprint);
      const projectRef = database.collection("projects").doc();
      const nominationRef = database.collection("nominations").doc();
      const runRef = database.collection("researchRuns").doc();
      const eventRef = database.collection("events").doc();
      const slug = `project-${projectRef.id.slice(0, 10)}`;
      const cardUrl = `/projects/${slug}`;
      const researchUrl = `/research/${runRef.id}`;

      return database.runTransaction(async (transaction): Promise<AcceptedNomination> => {
        // The fingerprint document is the single contention point. Keep this
        // callback free of network calls because Firestore may retry it.
        const fingerprintSnapshot = await transaction.get(fingerprintRef);
        if (fingerprintSnapshot.exists) {
          const existing = fingerprintSnapshot.data();
          return {
            kind: "duplicate",
            projectId: String(existing?.projectId),
            canonicalUrl: String(existing?.canonicalCardUrl),
          };
        }

        const now = FieldValue.serverTimestamp();
        transaction.create(fingerprintRef, {
          projectId: projectRef.id,
          nominationId: nominationRef.id,
          runId: runRef.id,
          sourceFingerprint: nomination.fingerprint,
          canonicalSourceUrl: nomination.canonicalUrl,
          canonicalCardUrl: cardUrl,
          createdAt: now,
          updatedAt: now,
        });
        transaction.create(projectRef, {
          slug,
          title: "Project under research",
          canonicalSourceUrl: nomination.canonicalUrl,
          sourceFingerprint: nomination.fingerprint,
          projectType: "unknown",
          submissionType: nomination.submissionType,
          claimStatus: nomination.submissionType === "creator" ? "verification_pending" : "unclaimed",
          publicationStatus: "pending",
          cardCompleteness: "pending",
          latestRunId: runRef.id,
          researchVersion: 1,
          missingSections: [],
          followerCount: 0,
          takeCount: 0,
          replyCount: 0,
          commitmentCounts: {},
          pathwayVoteCounts: {},
          isSelected: false,
          sourceAvailability: "available",
          moderationState: "clear",
          createdAt: now,
          updatedAt: now,
        });
        transaction.create(nominationRef, {
          projectId: projectRef.id,
          nominatorUid: nomination.nominatorUid,
          submissionType: nomination.submissionType,
          submittedUrl: nomination.submittedUrl,
          canonicalUrl: nomination.canonicalUrl,
          whyItShouldGrow: nomination.whyItShouldGrow,
          ...(nomination.suggestedFormat ? { suggestedFormat: nomination.suggestedFormat } : {}),
          ...(nomination.audienceFit ? { audienceFit: nomination.audienceFit } : {}),
          supportingUrls: nomination.canonicalSupportingUrls,
          status: "accepted",
          visibility: "public",
          createdAt: now,
          updatedAt: now,
        });
        transaction.create(runRef, {
          projectId: projectRef.id,
          nominationId: nominationRef.id,
          requestedByUid: nomination.nominatorUid,
          status: "queued",
          currentStage: 1,
          completedStages: [],
          missingStages: [],
          attemptCount: 1,
          researchVersion: 1,
          taskName: `research-${runRef.id}-attempt-1`,
          dispatch: { state: "pending", attempt: 1 },
          parallelRequestCount: 0,
          sourceCount: 0,
          fallbackUsed: false,
          createdAt: now,
          updatedAt: now,
        });
        transaction.create(eventRef, {
          runId: runRef.id,
          projectId: projectRef.id,
          sequence: 1,
          stage: 1,
          status: "waiting",
          kind: "stage",
          publicTitle: "Nomination accepted",
          publicSummary: "The research desk is ready to inspect the submitted public source.",
          attempt: 1,
          publicVisibility: false,
          occurredAt: new Date().toISOString(),
          createdAt: now,
        });

        return {
          kind: "created",
          projectId: projectRef.id,
          nominationId: nominationRef.id,
          runId: runRef.id,
          researchUrl,
          canonicalUrl: cardUrl,
        };
      });
    },

    async markDispatched(runId) {
      await database.collection("researchRuns").doc(runId).update({
        "dispatch.state": "dispatched",
        "dispatch.dispatchedAt": FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    },

    async markDispatchFailed(runId, safeReason) {
      await database.collection("researchRuns").doc(runId).update({
        "dispatch.state": "retryable_failed",
        "dispatch.failureCode": "queue_dispatch_failed",
        "dispatch.publicMessage": safeReason,
        "dispatch.failedAt": FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    },
  };
}

