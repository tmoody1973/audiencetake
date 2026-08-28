import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";

import type { AudienceTakeRole } from "@/lib/auth/roles";

import { loadRoleAssignment, type RoleAssignment } from "./authorization";

export type RoleClaims = {
  roles: Partial<Record<AudienceTakeRole, boolean>>;
  creatorProjectIds: string[];
};

export function roleClaims(assignment: RoleAssignment): RoleClaims {
  const roles = Object.fromEntries(
    Object.entries(assignment.roles ?? {}).filter(([, granted]) => granted === true),
  ) as Partial<Record<AudienceTakeRole, boolean>>;
  return { roles, creatorProjectIds: assignment.creatorProjectIds ?? [] };
}

// Mirror the server-only roleAssignments record into the user's custom claims so
// clients can read their own roles from the ID token. Server authorization still
// reads roleAssignments directly and never trusts these claims.
export async function syncRoleClaims(
  auth: Auth,
  database: Firestore,
  uid: string,
): Promise<RoleClaims> {
  const claims = roleClaims(await loadRoleAssignment(database, uid));
  await auth.setCustomUserClaims(uid, claims);
  return claims;
}
