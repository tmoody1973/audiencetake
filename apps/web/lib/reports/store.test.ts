import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";

import type { ReportInput } from "./contract";
import { createFirestoreReportStore, reportEventIdFor, reportIdFor } from "./store";

type StoredDocument = Record<string, unknown>;

class FakeDocument {
  constructor(
    readonly path: string,
    private readonly documents: Map<string, StoredDocument>,
  ) {}

  async get() {
    const data = this.documents.get(this.path);
    return { exists: Boolean(data), data: () => data };
  }
}

function fakeFirestore(seed: Record<string, StoredDocument> = {}) {
  const documents = new Map(Object.entries(seed));
  let generated = 0;
  const database = {
    collection(name: string) {
      return {
        doc(id?: string) {
          return new FakeDocument(`${name}/${id ?? `generated-${++generated}`}`, documents);
        },
      };
    },
    async runTransaction<T>(callback: (transaction: unknown) => Promise<T>) {
      return callback({
        get: (reference: FakeDocument) => reference.get(),
        create: (reference: FakeDocument, data: StoredDocument) => {
          if (documents.has(reference.path)) throw new Error("already exists");
          documents.set(reference.path, data);
        },
        update: (reference: FakeDocument, data: StoredDocument) => {
          const current = documents.get(reference.path);
          if (!current) throw new Error("missing document");
          documents.set(reference.path, { ...current, ...data });
        },
      });
    },
  };
  return { database: database as unknown as Firestore, documents };
}

const input: ReportInput = {
  target: { type: "project", id: "project-1" },
  reason: "misleading",
  context: "The release date conflicts with the linked source.",
};

describe("Firestore report store", () => {
  it("derives stable reporter-target and context fingerprints", () => {
    const first = reportIdFor("fan-1", input.target);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(reportIdFor("fan-1", input.target)).toBe(first);
    expect(reportIdFor("fan-2", input.target)).not.toBe(first);
    expect(reportEventIdFor(first, input)).toBe(reportEventIdFor(first, input));
    expect(reportEventIdFor(first, { ...input, context: "Different context" })).not.toBe(
      reportEventIdFor(first, input),
    );
  });

  it("deduplicates retries and appends only genuinely new report context", async () => {
    const { database, documents } = fakeFirestore({
      "projects/project-1": { publicationStatus: "published", moderationState: "clear" },
    });
    const store = createFirestoreReportStore(database);

    await expect(store.submit(input, "fan-1")).resolves.toMatchObject({
      duplicate: false,
      status: "open",
      eventCount: 1,
    });
    await expect(store.submit(input, "fan-1")).resolves.toMatchObject({
      duplicate: true,
      eventCount: 1,
    });
    await expect(
      store.submit({ ...input, reason: "other", context: "A second concrete detail." }, "fan-1"),
    ).resolves.toMatchObject({ duplicate: false, eventCount: 2 });

    const reportId = reportIdFor("fan-1", input.target);
    const projection = documents.get(`reports/${reportId}`);
    expect(projection).toMatchObject({
      reporterUid: "fan-1",
      targetType: "project",
      targetId: "project-1",
      status: "open",
      eventCount: 2,
      reasons: ["misleading", "other"],
    });
    expect(projection).not.toHaveProperty("context");
    expect([...documents.keys()].filter((key) => key.startsWith("reportEvents/"))).toHaveLength(2);
  });

  it("keeps moderation notes private and never mutates the reported target", async () => {
    const project = { publicationStatus: "published", moderationState: "clear", title: "Scout card" };
    const { database, documents } = fakeFirestore({ "projects/project-1": project });
    const store = createFirestoreReportStore(database);
    const submitted = await store.submit(input, "fan-1");

    await expect(
      store.review(
        submitted.reportId,
        { status: "resolved", moderationNote: "Checked against the canonical source." },
        "admin-1",
      ),
    ).resolves.toEqual({ reportId: submitted.reportId, status: "resolved" });

    expect(documents.get(`reports/${submitted.reportId}`)).toMatchObject({ status: "resolved" });
    expect(documents.get(`reports/${submitted.reportId}`)).not.toHaveProperty("moderationNote");
    expect(documents.get("projects/project-1")).toEqual(project);
    expect([...documents.values()]).toContainEqual(
      expect.objectContaining({
        reportId: submitted.reportId,
        reviewerUid: "admin-1",
        moderationNote: "Checked against the canonical source.",
      }),
    );
  });

  it.each([
    ["take", "takes/take-1", { status: "published", active: true, projectId: "project-hidden" }],
    ["evidence_suggestion", "evidenceSuggestions/lead-1", { visibility: "public", projectId: "project-hidden" }],
    ["creator_update", "creatorUpdates/update-1", { status: "published", projectId: "project-hidden" }],
  ] as const)("rejects a public-looking %s whose parent project is not public", async (type, path, target) => {
    const { database } = fakeFirestore({
      "projects/project-hidden": { publicationStatus: "published", moderationState: "hidden" },
      [path]: target,
    });
    await expect(
      createFirestoreReportStore(database).submit(
        { target: { type, id: path.split("/")[1] }, reason: "other" },
        "fan-1",
      ),
    ).rejects.toMatchObject({ code: "target_not_reportable", status: 404 });
  });

  it("requires Takes and replies to be explicitly active and published", async () => {
    const { database } = fakeFirestore({
      "projects/project-1": { publicationStatus: "published", moderationState: "clear" },
      "takes/take-inactive": { status: "published", active: false, projectId: "project-1" },
      "replies/reply-inactive": {
        status: "published",
        active: false,
        projectId: "project-1",
        takeId: "take-live",
      },
      "takes/take-live": { status: "published", active: true, projectId: "project-1" },
    });
    const store = createFirestoreReportStore(database);
    await expect(
      store.submit({ target: { type: "take", id: "take-inactive" }, reason: "spam" }, "fan-1"),
    ).rejects.toMatchObject({ code: "target_not_reportable" });
    await expect(
      store.submit({ target: { type: "reply", id: "reply-inactive" }, reason: "spam" }, "fan-1"),
    ).rejects.toMatchObject({ code: "target_not_reportable" });
  });

  it.each([
    { status: "withdrawn", active: false, projectId: "project-1" },
    { status: "published", active: true, projectId: "another-project" },
  ])("rejects a reply when its parent Take is hidden or belongs to another project", async (take) => {
    const { database } = fakeFirestore({
      "projects/project-1": { publicationStatus: "published", moderationState: "clear" },
      "replies/reply-1": {
        status: "published",
        active: true,
        projectId: "project-1",
        takeId: "take-1",
      },
      "takes/take-1": take,
    });
    await expect(
      createFirestoreReportStore(database).submit(
        { target: { type: "reply", id: "reply-1" }, reason: "harassment" },
        "fan-1",
      ),
    ).rejects.toMatchObject({ code: "target_not_reportable", status: 404 });
  });
});
