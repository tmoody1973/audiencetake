import { describe, expect, it } from "vitest";

import { canManageProject, isAdmin } from "./roles";

describe("project roles", () => {
  it("limits creator access to approved projects", () => {
    const creator = { roles: { approvedCreator: true }, creatorProjectIds: ["junichiro"] };
    expect(canManageProject(creator, "junichiro")).toBe(true);
    expect(canManageProject(creator, "another-project")).toBe(false);
  });

  it("does not trust a project list without the approved creator role", () => {
    expect(canManageProject({ creatorProjectIds: ["junichiro"] }, "junichiro")).toBe(false);
  });

  it("allows admins to manage any project", () => {
    const admin = { roles: { admin: true } };
    expect(isAdmin(admin)).toBe(true);
    expect(canManageProject(admin, "any-project")).toBe(true);
  });
});
