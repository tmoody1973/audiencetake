import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";

import { roleClaims, syncRoleClaims } from "./claims";

function databaseWith(value: unknown, exists = true): Firestore {
  return {
    collection: () => ({ doc: () => ({ get: async () => ({ exists, data: () => value }) }) }),
  } as unknown as Firestore;
}

describe("role claims", () => {
  it("keeps only granted roles", () => {
    expect(
      roleClaims({
        roles: { fan: false, approvedCreator: true, industry: false, admin: false },
        creatorProjectIds: ["project-a"],
        demoOnly: false,
      }),
    ).toEqual({ roles: { approvedCreator: true }, creatorProjectIds: ["project-a"] });
  });

  it("mirrors the stored assignment into custom claims", async () => {
    const setCustomUserClaims = vi.fn().mockResolvedValue(undefined);
    const auth = { setCustomUserClaims } as unknown as Auth;
    const database = databaseWith({
      roles: { admin: true },
      creatorProjectIds: ["project-a", "project-a"],
    });

    const claims = await syncRoleClaims(auth, database, "creator-1");

    expect(setCustomUserClaims).toHaveBeenCalledWith("creator-1", {
      roles: { admin: true },
      creatorProjectIds: ["project-a"],
    });
    expect(claims.roles).toEqual({ admin: true });
  });
});
