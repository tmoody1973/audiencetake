export type AudienceTakeRole = "fan" | "approvedCreator" | "industry" | "admin";

export type UserRoleRecord = {
  roles?: Partial<Record<AudienceTakeRole, boolean>>;
  creatorProjectIds?: string[];
};

export function canManageProject(user: UserRoleRecord, projectId: string): boolean {
  return Boolean(
    user.roles?.admin ||
      (user.roles?.approvedCreator && user.creatorProjectIds?.includes(projectId)),
  );
}

export function isAdmin(user: UserRoleRecord): boolean {
  return user.roles?.admin === true;
}
