import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";

import {
  AuthorizationError,
  loadRoleAssignment,
  requireAdmin,
  requireProjectManager,
} from "./authorization";

function databaseWith(value: unknown, exists = true): Firestore {
  return {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists, data: () => value }),
      }),
    }),
  } as unknown as Firestore;
}

describe("authoritative role assignments", () => {
  it("loads only known roles and normalized project IDs", async () => {
    const assignment = await loadRoleAssignment(databaseWith({
      roles: { admin: true, invented: true },
      creatorProjectIds: ["project-a", "project-a", 42],
      demoOnly: true,
    }), "user-1");

    expect(assignment).toEqual({
      roles: { fan: false, approvedCreator: false, industry: false, admin: true },
      creatorProjectIds: ["project-a"],
      demoOnly: true,
    });
  });

  it("requires the private admin assignment", async () => {
    await expect(requireAdmin(databaseWith({ roles: { admin: false } }), "user-1"))
      .rejects.toEqual(expect.objectContaining<Partial<AuthorizationError>>({ code: "admin_required" }));
  });

  it("limits creators to assigned projects while allowing admins", async () => {
    const creatorDb = databaseWith({ roles: { approvedCreator: true }, creatorProjectIds: ["project-a"] });
    await expect(requireProjectManager(creatorDb, "creator", "project-a")).resolves.toBeTruthy();
    await expect(requireProjectManager(creatorDb, "creator", "project-b"))
      .rejects.toEqual(expect.objectContaining<Partial<AuthorizationError>>({ code: "project_permission_required" }));
    await expect(requireProjectManager(databaseWith({ roles: { admin: true } }), "admin", "project-b"))
      .resolves.toBeTruthy();
  });
});
