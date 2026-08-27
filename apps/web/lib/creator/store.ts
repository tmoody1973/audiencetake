import { FieldValue, type Firestore } from "firebase-admin/firestore";

import { canManageProject, isAdmin, type UserRoleRecord } from "@/lib/auth/roles";

import {
  claimRequestId,
  type ClaimRequestInput,
  type ClaimReviewInput,
  type CreatorUpdateInput,
} from "./contract";

type Transaction = FirebaseFirestore.Transaction;
type Data = Record<string, unknown>;

export class CreatorError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "CreatorError";
  }
}

function availableProject(data: Data | undefined): data is Data {
  return Boolean(
    data &&
      data.publicationStatus === "published" &&
      (data.moderationState === undefined || data.moderationState === "clear"),
  );
}

function roleRecord(data: Data | undefined): UserRoleRecord {
  if (!data) return {};
  return {
    roles: typeof data.roles === "object" && data.roles ? (data.roles as UserRoleRecord["roles"]) : {},
    creatorProjectIds: Array.isArray(data.creatorProjectIds)
      ? data.creatorProjectIds.filter((value): value is string => typeof value === "string")
      : [],
  };
}

function nonnegative(value: unknown, delta: number) {
  return Math.max(0, (typeof value === "number" ? value : 0) + delta);
}

function requireManagerInTransaction(role: UserRoleRecord, projectId: string) {
  if (!canManageProject(role, projectId)) {
    throw new CreatorError("project_permission_denied", "You cannot manage this project.", 403);
  }
}

function publicMedia(data: Data) {
  return {
    id: String(data.mediaId),
    url: String(data.url),
    mimeType: String(data.mimeType),
    sizeBytes: Number(data.sizeBytes),
    sha256: String(data.sha256),
  };
}

async function loadAttachedMedia(
  transaction: Transaction,
  database: Firestore,
  mediaIds: string[],
  projectId: string,
  actorUid: string,
  actorRole: UserRoleRecord,
) {
  const snapshots = await Promise.all(
    mediaIds.map((mediaId) => transaction.get(database.collection("creatorMedia").doc(mediaId))),
  );
  return snapshots.map((snapshot) => {
    const data = snapshot.data() as Data | undefined;
    if (
      !snapshot.exists ||
      !data ||
      data.status !== "available" ||
      data.projectId !== projectId ||
      (!isAdmin(actorRole) && data.creatorUid !== actorUid)
    ) {
      throw new CreatorError("media_unavailable", "One or more uploaded media items are unavailable.", 400);
    }
    return publicMedia(data);
  });
}

export function createCreatorStore(database: Firestore) {
  return {
    submitClaim(projectId: string, requesterUid: string, input: ClaimRequestInput) {
      const requestId = claimRequestId(projectId, requesterUid);
      const requestRef = database.collection("claimRequests").doc(requestId);
      const projectRef = database.collection("projects").doc(projectId);
      const roleRef = database.collection("roleAssignments").doc(requesterUid);

      return database.runTransaction(async (transaction) => {
        const [projectSnapshot, requestSnapshot, roleSnapshot] = await Promise.all([
          transaction.get(projectRef),
          transaction.get(requestRef),
          transaction.get(roleRef),
        ]);
        const project = projectSnapshot.data() as Data | undefined;
        const prior = requestSnapshot.data() as Data | undefined;
        const requesterRole = roleRecord(roleSnapshot.data() as Data | undefined);

        if (!projectSnapshot.exists || !availableProject(project)) {
          throw new CreatorError("project_not_found", "Project was not found.", 404);
        }
        if (project.claimStatus === "approved" || canManageProject(requesterRole, projectId)) {
          throw new CreatorError("project_already_claimed", "This project already has an approved creator.", 409);
        }
        if (prior?.status === "pending" || prior?.status === "approved") {
          throw new CreatorError("claim_already_active", "You already have an active claim for this project.", 409);
        }

        transaction.set(
          requestRef,
          {
            projectId,
            requesterUid,
            role: input.role,
            ...(input.projectConnectedEmail
              ? { projectConnectedEmail: input.projectConnectedEmail }
              : { projectConnectedEmail: FieldValue.delete() }),
            ...(input.publicProofUrl
              ? { publicProofUrl: input.publicProofUrl }
              : { publicProofUrl: FieldValue.delete() }),
            ...(input.context ? { context: input.context } : { context: FieldValue.delete() }),
            status: "pending",
            attempt: nonnegative(prior?.attempt, 1),
            reviewedByUid: FieldValue.delete(),
            reviewNote: FieldValue.delete(),
            reviewedAt: FieldValue.delete(),
            submittedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            createdAt: prior?.createdAt ?? FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        transaction.set(
          projectRef,
          {
            claimStatus: "pending",
            pendingClaimCount: nonnegative(project.pendingClaimCount, 1),
            claimUpdatedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        transaction.set(database.collection("claimRequestEvents").doc(), {
          claimId: requestId,
          projectId,
          requesterUid,
          actorUid: requesterUid,
          action: "submitted",
          attempt: nonnegative(prior?.attempt, 1),
          occurredAt: FieldValue.serverTimestamp(),
        });

        return { claimId: requestId, projectId, status: "pending" as const };
      });
    },

    reviewClaim(claimId: string, reviewerUid: string, input: ClaimReviewInput) {
      const requestRef = database.collection("claimRequests").doc(claimId);
      const reviewerRoleRef = database.collection("roleAssignments").doc(reviewerUid);

      return database.runTransaction(async (transaction) => {
        const [requestSnapshot, reviewerRoleSnapshot] = await Promise.all([
          transaction.get(requestRef),
          transaction.get(reviewerRoleRef),
        ]);
        const claim = requestSnapshot.data() as Data | undefined;
        const reviewerRole = roleRecord(reviewerRoleSnapshot.data() as Data | undefined);
        if (!isAdmin(reviewerRole)) {
          throw new CreatorError("admin_required", "Administrator access is required.", 403);
        }
        if (!requestSnapshot.exists || !claim) {
          throw new CreatorError("claim_not_found", "Claim request was not found.", 404);
        }
        if (claim.status !== "pending") {
          throw new CreatorError("claim_not_pending", "Only a pending claim can be reviewed.", 409);
        }

        const projectId = String(claim.projectId);
        const requesterUid = String(claim.requesterUid);
        const projectRef = database.collection("projects").doc(projectId);
        const creatorAssignmentRef = database.collection("projectCreatorAssignments").doc(projectId);
        const requesterRoleRef = database.collection("roleAssignments").doc(requesterUid);
        const [projectSnapshot, requesterRoleSnapshot, creatorAssignmentSnapshot] = await Promise.all([
          transaction.get(projectRef),
          transaction.get(requesterRoleRef),
          transaction.get(creatorAssignmentRef),
        ]);
        const project = projectSnapshot.data() as Data | undefined;
        const requesterRoleData = (requesterRoleSnapshot.data() ?? {}) as Data;
        const creatorAssignment = creatorAssignmentSnapshot.data() as Data | undefined;
        if (!projectSnapshot.exists || !project) {
          throw new CreatorError("project_not_found", "Project was not found.", 404);
        }
        if (
          input.status === "approved" &&
          project.claimStatus === "approved" &&
          creatorAssignment?.approvedCreatorUid !== requesterUid
        ) {
          throw new CreatorError("project_already_claimed", "This project already has an approved creator.", 409);
        }

        const remainingPending = nonnegative(project.pendingClaimCount, -1);
        transaction.set(
          requestRef,
          {
            status: input.status,
            reviewedByUid: reviewerUid,
            ...(input.reviewNote
              ? { reviewNote: input.reviewNote }
              : { reviewNote: FieldValue.delete() }),
            reviewedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        transaction.set(
          projectRef,
          {
            claimStatus:
              input.status === "approved" || project.claimStatus === "approved"
                ? "approved"
                : remainingPending > 0
                  ? "pending"
                  : "rejected",
            pendingClaimCount: remainingPending,
            claimUpdatedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        if (input.status === "approved") {
          const currentRole = roleRecord(requesterRoleData);
          transaction.set(
            creatorAssignmentRef,
            {
              projectId,
              approvedCreatorUid: requesterUid,
              grantedByUid: reviewerUid,
              grantedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
              createdAt: creatorAssignment?.createdAt ?? FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          transaction.set(
            requesterRoleRef,
            {
              roles: { ...(requesterRoleData.roles as Data | undefined), approvedCreator: true },
              creatorProjectIds: [...new Set([...(currentRole.creatorProjectIds ?? []), projectId])],
              updatedAt: FieldValue.serverTimestamp(),
              createdAt: requesterRoleData.createdAt ?? FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }

        transaction.set(database.collection("claimRequestEvents").doc(), {
          claimId,
          projectId,
          requesterUid,
          actorUid: reviewerUid,
          action: input.status,
          reviewNote: input.reviewNote ?? null,
          occurredAt: FieldValue.serverTimestamp(),
        });

        return { claimId, projectId, status: input.status };
      });
    },

    createUpdate(projectId: string, actorUid: string, input: CreatorUpdateInput) {
      const updateRef = database.collection("creatorUpdates").doc();
      const eventRef = database.collection("creatorUpdateEvents").doc();
      return database.runTransaction(async (transaction) => {
        const [projectSnapshot, roleSnapshot] = await Promise.all([
          transaction.get(database.collection("projects").doc(projectId)),
          transaction.get(database.collection("roleAssignments").doc(actorUid)),
        ]);
        const project = projectSnapshot.data() as Data | undefined;
        const roleData = (roleSnapshot.data() ?? {}) as Data;
        const actorRole = roleRecord(roleData);
        if (!projectSnapshot.exists || !availableProject(project)) {
          throw new CreatorError("project_not_found", "Project was not found.", 404);
        }
        requireManagerInTransaction(actorRole, projectId);
        const media = await loadAttachedMedia(
          transaction,
          database,
          input.mediaIds,
          projectId,
          actorUid,
          actorRole,
        );
        const creatorUid = actorUid;
        const demoLabel = roleData.demoOnly === true ? "Demo activity" : undefined;
        transaction.set(updateRef, {
          projectId,
          title: input.title,
          body: input.body,
          media,
          status: "published",
          visibility: "public",
          revision: 1,
          ...(demoLabel ? { demoLabel } : {}),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.set(database.collection("creatorUpdateOwnership").doc(updateRef.id), {
          updateId: updateRef.id,
          projectId,
          creatorUid,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.set(eventRef, {
          updateId: updateRef.id,
          projectId,
          creatorUid,
          actorUid,
          action: "published",
          revision: 1,
          snapshot: { title: input.title, body: input.body, media },
          occurredAt: FieldValue.serverTimestamp(),
        });
        return { updateId: updateRef.id, projectId, status: "published" as const };
      });
    },

    editUpdate(updateId: string, actorUid: string, input: CreatorUpdateInput) {
      return database.runTransaction(async (transaction) => {
        const updateRef = database.collection("creatorUpdates").doc(updateId);
        const ownershipRef = database.collection("creatorUpdateOwnership").doc(updateId);
        const [updateSnapshot, ownershipSnapshot] = await Promise.all([
          transaction.get(updateRef),
          transaction.get(ownershipRef),
        ]);
        const prior = updateSnapshot.data() as Data | undefined;
        const ownership = ownershipSnapshot.data() as Data | undefined;
        if (!updateSnapshot.exists || !prior || !ownershipSnapshot.exists || !ownership) {
          throw new CreatorError("creator_update_not_found", "Creator update was not found.", 404);
        }
        if (prior.status !== "published") {
          throw new CreatorError("creator_update_withdrawn", "A withdrawn update cannot be edited.", 409);
        }
        const projectId = String(prior.projectId);
        const creatorUid = String(ownership.creatorUid);
        if (ownership.projectId !== projectId) {
          throw new CreatorError("creator_update_not_found", "Creator update was not found.", 404);
        }
        const roleSnapshot = await transaction.get(database.collection("roleAssignments").doc(actorUid));
        const actorRole = roleRecord(roleSnapshot.data() as Data | undefined);
        requireManagerInTransaction(actorRole, projectId);
        if (!isAdmin(actorRole) && creatorUid !== actorUid) {
          throw new CreatorError("creator_update_owner_required", "You can edit only your own update.", 403);
        }
        const media = await loadAttachedMedia(
          transaction,
          database,
          input.mediaIds,
          projectId,
          actorUid,
          actorRole,
        );
        const revision = nonnegative(prior.revision, 1);
        transaction.set(
          updateRef,
          {
            title: input.title,
            body: input.body,
            media,
            revision,
            edited: true,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        transaction.set(database.collection("creatorUpdateEvents").doc(), {
          updateId,
          projectId,
          creatorUid,
          actorUid,
          action: "edited",
          revision,
          previousSnapshot: {
            title: prior.title,
            body: prior.body,
            media: prior.media ?? [],
          },
          snapshot: { title: input.title, body: input.body, media },
          occurredAt: FieldValue.serverTimestamp(),
        });
        return { updateId, projectId, status: "published" as const };
      });
    },

    withdrawUpdate(updateId: string, actorUid: string) {
      return database.runTransaction(async (transaction) => {
        const updateRef = database.collection("creatorUpdates").doc(updateId);
        const ownershipRef = database.collection("creatorUpdateOwnership").doc(updateId);
        const [updateSnapshot, ownershipSnapshot] = await Promise.all([
          transaction.get(updateRef),
          transaction.get(ownershipRef),
        ]);
        const prior = updateSnapshot.data() as Data | undefined;
        const ownership = ownershipSnapshot.data() as Data | undefined;
        if (!updateSnapshot.exists || !prior || !ownershipSnapshot.exists || !ownership) {
          throw new CreatorError("creator_update_not_found", "Creator update was not found.", 404);
        }
        const projectId = String(prior.projectId);
        const creatorUid = String(ownership.creatorUid);
        if (ownership.projectId !== projectId) {
          throw new CreatorError("creator_update_not_found", "Creator update was not found.", 404);
        }
        const roleSnapshot = await transaction.get(database.collection("roleAssignments").doc(actorUid));
        const actorRole = roleRecord(roleSnapshot.data() as Data | undefined);
        requireManagerInTransaction(actorRole, projectId);
        if (!isAdmin(actorRole) && creatorUid !== actorUid) {
          throw new CreatorError("creator_update_owner_required", "You can withdraw only your own update.", 403);
        }
        if (prior.status === "withdrawn") {
          return { updateId, projectId, status: "withdrawn" as const };
        }
        const revision = nonnegative(prior.revision, 1);
        transaction.set(
          updateRef,
          {
            status: "withdrawn",
            revision,
            withdrawnAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        transaction.set(database.collection("creatorUpdateEvents").doc(), {
          updateId,
          projectId,
          creatorUid,
          actorUid,
          action: "withdrawn",
          revision,
          snapshot: {
            title: prior.title,
            body: prior.body,
            media: prior.media ?? [],
          },
          occurredAt: FieldValue.serverTimestamp(),
        });
        return { updateId, projectId, status: "withdrawn" as const };
      });
    },
  };
}

export type CreatorStore = ReturnType<typeof createCreatorStore>;
