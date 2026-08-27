import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminFirestore = vi.fn();
vi.mock("@/lib/firebase/admin", () => ({ getAdminFirestore }));

type Row = { id: string; data: Record<string, unknown> };
function fakeDb(rows: Record<string, Row[]>) {
  const collection = (name: string) => {
    const values = rows[name] ?? [];
    const chain = { where: () => chain, orderBy: () => chain, get: async () => ({ docs: values.map((row) => ({ id: row.id, exists: true, data: () => row.data })) }), doc: (id: string) => ({ get: async () => { const row = values.find((entry) => entry.id === id); return row ? { id, exists: true, data: () => row.data } : { id, exists: false, data: () => undefined }; } }) };
    return chain;
  };
  return { collection };
}

describe("public scout profiles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects malformed handles before touching Firestore", async () => {
    const { loadPublicScoutProfile } = await import("./profile");
    expect(await loadPublicScoutProfile("bad handle")).toBeNull();
    expect(getAdminFirestore).not.toHaveBeenCalled();
  });

  it("loads and enriches picks, orders activity, and groups commitments by project", async () => {
    getAdminFirestore.mockReturnValue(fakeDb({
      handles: [{ id: "scout", data: { uid: "u1" } }],
      users: [{ id: "u1", data: { visibility: "public", publicActivity: true, displayName: "Scout", demoLabel: "Demo" } }],
      nominations: [{ id: "n1", data: { projectId: "p1", createdAt: "2026-01-01", visibility: "public" } }],
      follows: [{ id: "f1", data: { projectId: "p1", uid: "u1", active: true, createdAt: "2026-01-02" } }],
      commitments: [{ id: "c1", data: { projectId: "p1", uid: "u1", active: true, type: "would_pay", createdAt: "2026-01-03" } }],
      takes: [{ id: "t1", data: { projectId: "p1", uid: "u1", status: "published", createdAt: "2026-01-04", title: "Take" } }],
      projects: [{ id: "p1", data: { title: "Trusted title", slug: "trusted-slug" } }],
    }));
    const { loadPublicScoutProfile } = await import("./profile");
    const profile = await loadPublicScoutProfile("Scout");
    expect(profile?.demoLabel).toBe("Demo");
    expect(profile?.following).toHaveLength(1);
    expect(profile?.following[0]).toMatchObject({ projectTitle: "Trusted title", projectSlug: "trusted-slug", commitmentTypes: ["would_pay"] });
    expect(profile?.counts).toEqual({ picks: 1, following: 1, takes: 1 });
  });

  it("keeps picks and takes while hiding following when activity is private", async () => {
    getAdminFirestore.mockReturnValue(fakeDb({
      handles: [{ id: "scout", data: { uid: "u1" } }],
      users: [{ id: "u1", data: { visibility: "public", publicActivity: false, displayName: "Scout" } }],
      nominations: [{ id: "n1", data: { projectId: "p1", visibility: "public" } }], follows: [{ id: "f1", data: { projectId: "p1", active: true } }], commitments: [], takes: [{ id: "t1", data: { status: "published" } }], projects: [],
    }));
    const { loadPublicScoutProfile } = await import("./profile");
    const profile = await loadPublicScoutProfile("scout");
    expect(profile?.following).toEqual([]);
    expect(profile?.picks).toHaveLength(1);
    expect(profile?.takes).toHaveLength(1);
  });
});
