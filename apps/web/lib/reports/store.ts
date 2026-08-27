import { createHash } from "node:crypto";

import { FieldValue, type DocumentData, type Firestore } from "firebase-admin/firestore";

import type { ReportInput, ReportReview, ReportTarget } from "./contract";

export class ReportError extends Error {
  constructor(
    readonly code: "target_not_reportable" | "report_not_found" | "report_conflict",
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ReportError";
  }
}

export type ReportSubmission = {
  reportId: string;
  duplicate: boolean;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  eventCount: number;
};

export type ReportReviewResult = {
  reportId: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
};

export interface ReportStore {
  submit(input: ReportInput, reporterUid: string): Promise<ReportSubmission>;
  review(reportId: string, review: ReportReview, reviewerUid: string): Promise<ReportReviewResult>;
}

const targetCollections: Record<Exclude<ReportTarget["type"], "project">, string> = {
  take: "takes",
  reply: "replies",
  evidence_suggestion: "evidenceSuggestions",
  creator_update: "creatorUpdates",
};

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function reportIdFor(reporterUid: string, target: ReportTarget): string {
  return digest(`${reporterUid}\n${target.type}\n${target.id}`);
}

export function reportEventIdFor(reportId: string, input: ReportInput): string {
  return `${reportId}_${digest(`${input.reason}\n${input.context ?? ""}`)}`;
}

function isPublishedProject(data: DocumentData | undefined): boolean {
  return Boolean(
    data &&
      data.publicationStatus === "published" &&
      (data.moderationState === undefined || data.moderationState === "clear"),
  );
}

function isReportableTarget(target: ReportTarget, data: DocumentData): boolean {
  if (target.type === "project") return isPublishedProject(data);
  if (target.type === "take" || target.type === "reply") {
    return data.status === "published" && data.active === true;
  }
  if (target.type === "evidence_suggestion") {
    return data.visibility === "public";
  }
  return data.status === "published";
}

async function resolveProjectId(database: Firestore, target: ReportTarget): Promise<string> {
  const collection = target.type === "project" ? "projects" : targetCollections[target.type];
  const snapshot = await database.collection(collection).doc(target.id).get();
  const data = snapshot.data();
  if (!snapshot.exists || !data || !isReportableTarget(target, data)) {
    throw new ReportError(
      "target_not_reportable",
      "That content is not available to report.",
      404,
    );
  }
  const projectId = target.type === "project" ? target.id : data.projectId;
  if (typeof projectId !== "string" || projectId.length === 0) {
    throw new ReportError(
      "target_not_reportable",
      "That content is not available to report.",
      404,
    );
  }

  if (target.type === "project") return projectId;

  const projectPromise = database.collection("projects").doc(projectId).get();
  const parentTakeId = target.type === "reply" ? data.takeId : null;
  const parentTakePromise = typeof parentTakeId === "string" && parentTakeId.length > 0
    ? database.collection("takes").doc(parentTakeId).get()
    : null;
  const [projectSnapshot, parentTakeSnapshot] = await Promise.all([
    projectPromise,
    parentTakePromise,
  ]);
  const project = projectSnapshot.data();
  const parentTake = parentTakeSnapshot?.data();
  const validParentTake = target.type !== "reply" || Boolean(
    parentTakeSnapshot?.exists &&
      parentTake?.status === "published" &&
      parentTake.active === true &&
      parentTake.projectId === projectId,
  );
  if (!projectSnapshot.exists || !isPublishedProject(project) || !validParentTake) {
    throw new ReportError(
      "target_not_reportable",
      "That content is not available to report.",
      404,
    );
  }
  return projectId;
}

export function createFirestoreReportStore(database: Firestore): ReportStore {
  return {
    async submit(input, reporterUid) {
      const projectId = await resolveProjectId(database, input.target);
      const reportId = reportIdFor(reporterUid, input.target);
      const reportRef = database.collection("reports").doc(reportId);
      const eventRef = database.collection("reportEvents").doc(reportEventIdFor(reportId, input));

      return database.runTransaction(async (transaction): Promise<ReportSubmission> => {
        const [reportSnapshot, eventSnapshot] = await Promise.all([
          transaction.get(reportRef),
          transaction.get(eventRef),
        ]);
        const existing = reportSnapshot.data();
        const status = (existing?.status ?? "open") as ReportSubmission["status"];
        const eventCount = typeof existing?.eventCount === "number" ? existing.eventCount : 0;

        if (eventSnapshot.exists) {
          return { reportId, duplicate: true, status, eventCount };
        }
        if (
          reportSnapshot.exists &&
          (existing?.reporterUid !== reporterUid ||
            existing?.targetType !== input.target.type ||
            existing?.targetId !== input.target.id)
        ) {
          throw new ReportError("report_conflict", "That report could not be updated.", 409);
        }

        const now = FieldValue.serverTimestamp();
        const reasons = Array.isArray(existing?.reasons)
          ? Array.from(new Set([...existing.reasons.filter((reason): reason is string => typeof reason === "string"), input.reason]))
          : [input.reason];

        if (reportSnapshot.exists) {
          transaction.update(reportRef, {
            latestReason: input.reason,
            reasons,
            eventCount: eventCount + 1,
            lastSubmittedAt: now,
            updatedAt: now,
          });
        } else {
          // This is the complete reporter-readable projection. Raw context and
          // moderation notes deliberately never enter this document.
          transaction.create(reportRef, {
            reportId,
            reporterUid,
            projectId,
            targetType: input.target.type,
            targetId: input.target.id,
            latestReason: input.reason,
            reasons,
            status: "open",
            eventCount: 1,
            createdAt: now,
            lastSubmittedAt: now,
            updatedAt: now,
          });
        }
        transaction.create(eventRef, {
          reportId,
          reporterUid,
          projectId,
          targetType: input.target.type,
          targetId: input.target.id,
          reason: input.reason,
          ...(input.context ? { context: input.context } : {}),
          kind: reportSnapshot.exists ? "context_submitted" : "report_created",
          createdAt: now,
        });

        return { reportId, duplicate: false, status, eventCount: eventCount + 1 };
      });
    },

    async review(reportId, review, reviewerUid) {
      const reportRef = database.collection("reports").doc(reportId);
      const reviewRef = database.collection("reportReviews").doc();

      return database.runTransaction(async (transaction): Promise<ReportReviewResult> => {
        const reportSnapshot = await transaction.get(reportRef);
        if (!reportSnapshot.exists) {
          throw new ReportError("report_not_found", "That report does not exist.", 404);
        }
        const now = FieldValue.serverTimestamp();
        // Only status crosses back into the reporter-readable projection.
        transaction.update(reportRef, { status: review.status, updatedAt: now });
        transaction.create(reviewRef, {
          reportId,
          reviewerUid,
          fromStatus: reportSnapshot.data()?.status ?? "open",
          toStatus: review.status,
          ...(review.moderationNote ? { moderationNote: review.moderationNote } : {}),
          createdAt: now,
        });
        return { reportId, status: review.status };
      });
    },
  };
}
