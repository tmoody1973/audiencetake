import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";

import { createCreatorStore } from "./store";

type Row = Record<string, unknown>;

function fakeFirestore(seed: Record<string, Row>) {
  const rows = new Map(Object.entries(seed));
  let auto = 0;
  const reference = (path: string) => ({ path, id: path.split("/").at(-1)! });
  const snapshot = (path: string) => ({
    exists: rows.has(path),
    id: path.split("/").at(-1)!,
    data: () => rows.get(path),
  });
  const database = {
    collection(name: string) {
      return {
        doc(id?: string) {
          return reference(`${name}/${id ?? `auto-${++auto}`}`);
        },
      };
    },
    async runTransaction<T>(callback: (transaction: {
      get: (ref: { path: string }) => Promise<ReturnType<typeof snapshot>>;
      set: (ref: { path: string }, data: Row, options?: { merge?: boolean }) => void;
    }) => Promise<T>) {
      return callback({
        get: async (ref) => snapshot(ref.path),
        set: (ref, data, options) => {
          rows.set(ref.path, options?.merge ? { ...(rows.get(ref.path) ?? {}), ...data } : data);
        },
      });
    },
  } as unknown as Firestore;
  return { database, rows };
}

const publishedProject = {
  publicationStatus: "published",
  moderationState: "clear",
  claimStatus: "unclaimed",
};

describe("creator transactions", () => {
  it("creates one active claim per user/project and updates the public projection", async () => {
    const { database, rows } = fakeFirestore({ "projects/project-1": publishedProject });
    const store = createCreatorStore(database);
    const input = { role: "Director", projectConnectedEmail: "creator@example.com" };

    await expect(store.submitClaim("project-1", "creator-1", input)).resolves.toMatchObject({
      claimId: "project-1_creator-1",
      status: "pending",
    });
    await expect(store.submitClaim("project-1", "creator-1", input)).rejects.toMatchObject({
      code: "claim_already_active",
      status: 409,
    });
    expect(rows.get("claimRequests/project-1_creator-1")).toMatchObject({
      projectId: "project-1",
      requesterUid: "creator-1",
      status: "pending",
    });
    expect(rows.get("projects/project-1")).toMatchObject({ claimStatus: "pending", pendingClaimCount: 1 });
  });

  it("reviews approval atomically and grants only a project-scoped authoritative assignment", async () => {
    const { database, rows } = fakeFirestore({
      "projects/project-1": { ...publishedProject, claimStatus: "pending", pendingClaimCount: 1 },
      "claimRequests/project-1_creator-1": {
        projectId: "project-1",
        requesterUid: "creator-1",
        status: "pending",
      },
      "roleAssignments/admin-1": { roles: { admin: true } },
      "roleAssignments/creator-1": { roles: { fan: true }, creatorProjectIds: ["project-0"] },
    });
    const store = createCreatorStore(database);

    await expect(
      store.reviewClaim("project-1_creator-1", "admin-1", { status: "approved" }),
    ).resolves.toMatchObject({ status: "approved" });
    expect(rows.get("projects/project-1")).toMatchObject({
      claimStatus: "approved",
      pendingClaimCount: 0,
    });
    expect(rows.get("projects/project-1")).not.toHaveProperty("approvedCreatorUid");
    expect(rows.get("projectCreatorAssignments/project-1")).toMatchObject({
      projectId: "project-1",
      approvedCreatorUid: "creator-1",
      grantedByUid: "admin-1",
    });
    expect(rows.get("roleAssignments/creator-1")).toMatchObject({
      roles: { fan: true, approvedCreator: true },
      creatorProjectIds: ["project-0", "project-1"],
    });
  });

  it("does not accept an admin flag from anywhere except roleAssignments", async () => {
    const { database } = fakeFirestore({
      "projects/project-1": { ...publishedProject, claimStatus: "pending", pendingClaimCount: 1 },
      "claimRequests/project-1_creator-1": {
        projectId: "project-1",
        requesterUid: "creator-1",
        status: "pending",
      },
    });
    await expect(
      createCreatorStore(database).reviewClaim("project-1_creator-1", "custom-claim-admin", {
        status: "approved",
      }),
    ).rejects.toMatchObject({ code: "admin_required", status: 403 });
  });

  it("cannot downgrade an approved public claim when a second pending request is rejected", async () => {
    const { database, rows } = fakeFirestore({
      "projects/project-1": {
        ...publishedProject,
        claimStatus: "approved",
        pendingClaimCount: 1,
      },
      "projectCreatorAssignments/project-1": {
        projectId: "project-1",
        approvedCreatorUid: "creator-1",
      },
      "claimRequests/project-1_creator-2": {
        projectId: "project-1",
        requesterUid: "creator-2",
        status: "pending",
      },
      "roleAssignments/admin-1": { roles: { admin: true } },
    });
    await createCreatorStore(database).reviewClaim("project-1_creator-2", "admin-1", {
      status: "rejected",
    });
    expect(rows.get("projects/project-1")).toMatchObject({
      claimStatus: "approved",
      pendingClaimCount: 0,
    });
    expect(rows.get("projects/project-1")).not.toHaveProperty("approvedCreatorUid");
  });

  it("preserves creator update identity and content through edit and withdrawal audit events", async () => {
    const { database, rows } = fakeFirestore({
      "projects/project-1": publishedProject,
      "roleAssignments/creator-1": {
        roles: { approvedCreator: true },
        creatorProjectIds: ["project-1"],
      },
      "creatorMedia/media-1": {
        mediaId: "media-1",
        projectId: "project-1",
        creatorUid: "creator-1",
        status: "available",
        url: "https://example.com/media.png",
        mimeType: "image/png",
        sizeBytes: 9,
        sha256: "abc",
      },
    });
    const store = createCreatorStore(database);
    const created = await store.createUpdate("project-1", "creator-1", {
      title: "Festival date",
      body: "First version",
      mediaIds: ["media-1"],
    });
    await store.editUpdate(created.updateId, "creator-1", {
      title: "Festival date confirmed",
      body: "Second version",
      mediaIds: [],
    });
    await store.withdrawUpdate(created.updateId, "creator-1");

    expect(rows.get(`creatorUpdates/${created.updateId}`)).toMatchObject({
      projectId: "project-1",
      title: "Festival date confirmed",
      body: "Second version",
      status: "withdrawn",
      revision: 3,
    });
    expect(rows.get(`creatorUpdates/${created.updateId}`)).not.toHaveProperty("creatorUid");
    expect(rows.get(`creatorUpdateOwnership/${created.updateId}`)).toMatchObject({
      projectId: "project-1",
      creatorUid: "creator-1",
    });
    const events = [...rows.entries()].filter(([path]) => path.startsWith("creatorUpdateEvents/"));
    expect(events).toHaveLength(3);
    expect(events.map(([, event]) => event.action)).toEqual(["published", "edited", "withdrawn"]);
  });
});
