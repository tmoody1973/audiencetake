import type { Firestore } from "firebase-admin/firestore";

import {
  canManageProject,
  isAdmin,
  type AudienceTakeRole,
  type UserRoleRecord,
} from "@/lib/auth/roles";

export class AuthorizationError extends Error {
  constructor(
    message: string,
    readonly code: "admin_required" | "project_permission_required",
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export type RoleAssignment = UserRoleRecord & {
  demoOnly: boolean;
};

function parseRoleAssignment(value: unknown): RoleAssignment {
  if (!value || typeof value !== "object") {
    return { roles: {}, creatorProjectIds: [], demoOnly: false };
  }

  const record = value as Record<string, unknown>;
  const rawRoles = record.roles && typeof record.roles === "object"
    ? record.roles as Record<string, unknown>
    : {};
  const knownRoles: AudienceTakeRole[] = ["fan", "approvedCreator", "industry", "admin"];
  const roles = Object.fromEntries(
    knownRoles.map((role) => [role, rawRoles[role] === true]),
  ) as Partial<Record<AudienceTakeRole, boolean>>;
  const creatorProjectIds = Array.isArray(record.creatorProjectIds)
    ? [...new Set(record.creatorProjectIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
    : [];

  return { roles, creatorProjectIds, demoOnly: record.demoOnly === true };
}

export async function loadRoleAssignment(
  database: Firestore,
  uid: string,
): Promise<RoleAssignment> {
  const snapshot = await database.collection("roleAssignments").doc(uid).get();
  return snapshot.exists
    ? parseRoleAssignment(snapshot.data())
    : { roles: {}, creatorProjectIds: [], demoOnly: false };
}

export async function requireAdmin(database: Firestore, uid: string): Promise<RoleAssignment> {
  const assignment = await loadRoleAssignment(database, uid);
  if (!isAdmin(assignment)) {
    throw new AuthorizationError("Administrator access is required.", "admin_required");
  }
  return assignment;
}

export async function requireProjectManager(
  database: Firestore,
  uid: string,
  projectId: string,
): Promise<RoleAssignment> {
  const assignment = await loadRoleAssignment(database, uid);
  if (!canManageProject(assignment, projectId)) {
    throw new AuthorizationError(
      "You are not approved to manage this project.",
      "project_permission_required",
    );
  }
  return assignment;
}
