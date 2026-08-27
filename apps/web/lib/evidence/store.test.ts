import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";

import { createFirestoreEvidenceStore, evidenceFingerprint } from "./store";

type Data = Record<string, unknown>;
type FakeRef = { kind: "doc"; collection: string; id: string };
type FakeQuery = {
  kind: "query";
  collection: string;
  filters: Array<[string, unknown]>;
  max: number;
  where(field: string, operator: string, value: unknown): FakeQuery;
  limit(max: number): FakeQuery;
};

function query(collection: string, filters: Array<[string, unknown]> = [], max = Infinity): FakeQuery {
  return {
    kind: "query",
    collection,
    filters,
    max,
    where(field, operator, value) {
      expect(operator).toBe("==");
      return query(collection, [...filters, [field, value]], max);
    },
    limit(nextMax) {
      return query(collection, filters, nextMax);
    },
  };
}

function fakeFirestore(seed: Record<string, Record<string, Data>>) {
  const documents = new Map<string, Data>();
  for (const [collection, records] of Object.entries(seed)) {
    for (const [id, data] of Object.entries(records)) documents.set(`${collection}/${id}`, { ...data });
  }
  const creates: Array<{ ref: FakeRef; data: Data }> = [];
  const updates: Array<{ ref: FakeRef; data: Data }> = [];
  let generated = 0;
  const collection = (name: string) => ({
    doc(id = `generated-${++generated}`): FakeRef {
      return { kind: "doc", collection: name, id };
    },
    where(field: string, operator: string, value: unknown) {
      return query(name).where(field, operator, value);
    },
  });
  const transaction = {
    async get(target: FakeRef | FakeQuery) {
      if (target.kind === "doc") {
        const data = documents.get(`${target.collection}/${target.id}`);
        return { id: target.id, exists: Boolean(data), data: () => data };
      }
      const docs = [...documents.entries()]
        .filter(([path, data]) => {
          if (!path.startsWith(`${target.collection}/`)) return false;
          return target.filters.every(([field, value]) => data[field] === value);
        })
        .slice(0, target.max)
        .map(([path, data]) => ({
          id: path.slice(target.collection.length + 1),
          exists: true,
          data: () => data,
        }));
      return { empty: docs.length === 0, docs };
    },
    create(ref: FakeRef, data: Data) {
      creates.push({ ref, data });
      documents.set(`${ref.collection}/${ref.id}`, data);
    },
    update(ref: FakeRef, data: Data) {
      updates.push({ ref, data });
      documents.set(`${ref.collection}/${ref.id}`, {
        ...documents.get(`${ref.collection}/${ref.id}`),
        ...data,
      });
    },
  };
  const database = {
    collection,
    runTransaction: async <T>(operation: (value: typeof transaction) => Promise<T>) =>
      operation(transaction),
  } as unknown as Firestore;
  return { database, documents, creates, updates };
}

const project = {
  publicationStatus: "published",
  latestRunId: "run-1",
  researchVersion: 3,
};

describe("Firestore evidence store", () => {
  it("creates one deterministic public-safe Community Lead and detects a repeat", async () => {
    const fake = fakeFirestore({ projects: { "project-1": project }, sources: {} });
    const store = createFirestoreEvidenceStore(fake.database);
    const canonicalUrl = "https://example.com/report";
    const fingerprint = evidenceFingerprint("project-1", canonicalUrl);
    const prepared = {
      projectId: "project-1",
      submittedByUid: "fan-1",
      canonicalUrl,
      note: "A potentially useful public report.",
      fingerprint,
    };

    await expect(store.submit(prepared)).resolves.toMatchObject({
      suggestionId: fingerprint,
      status: "community_lead",
      duplicate: false,
    });
    await expect(store.submit(prepared)).resolves.toMatchObject({
      suggestionId: fingerprint,
      duplicate: true,
      duplicateOf: "suggestion",
    });
    const suggestion = fake.documents.get(`evidenceSuggestions/${fingerprint}`)!;
    expect(suggestion).toMatchObject({
      projectId: "project-1",
      canonicalUrl,
      status: "community_lead",
      submitterLabel: "Community member",
      visibility: "public",
    });
    expect(suggestion.submittedByUid).toBeUndefined();
    expect(suggestion.reviewReason).toBeUndefined();
    expect(suggestion.reviewedByUid).toBeUndefined();
    expect(fake.documents.get(`evidenceSuggestionOwnership/${fingerprint}`)).toMatchObject({
      suggestionId: fingerprint,
      projectId: "project-1",
      submittedByUid: "fan-1",
      submissionOrigin: "post_card",
    });
  });

  it("rejects an already normalized project source without creating a suggestion", async () => {
    const canonicalUrl = "https://example.com/already-cited";
    const fake = fakeFirestore({
      projects: { "project-1": project },
      sources: { existing: { projectId: "project-1", canonicalUrl } },
    });
    const store = createFirestoreEvidenceStore(fake.database);
    await expect(
      store.submit({
        projectId: "project-1",
        submittedByUid: "fan-1",
        canonicalUrl,
        fingerprint: evidenceFingerprint("project-1", canonicalUrl),
      }),
    ).resolves.toMatchObject({ duplicate: true, duplicateOf: "source", status: "already_sourced" });
    expect(fake.creates).toHaveLength(0);
  });

  it("incorporates a normalized Community Lead source while keeping reviewer details private", async () => {
    const canonicalUrl = "https://example.com/interview";
    const fingerprint = evidenceFingerprint("project-1", canonicalUrl);
    const fake = fakeFirestore({
      projects: { "project-1": project },
      evidenceSuggestions: {
        [fingerprint]: {
          projectId: "project-1",
          submittedByUid: "fan-1",
          canonicalUrl,
          sourceFingerprint: fingerprint,
          status: "community_lead",
        },
      },
      sources: {},
    });
    const store = createFirestoreEvidenceStore(fake.database);
    const result = await store.review(fingerprint, "admin-1", {
      outcome: "verified_incorporated",
      reason: "The interview and project identity were manually checked.",
      source: {
        title: "Public interview",
        excerpt: "A public interview describing the project.",
        sourceType: "interview",
        supportsClaimIds: ["claim-story"],
        conflictsWithClaimIds: [],
        externalCommentary: false,
      },
    });

    expect(result).toMatchObject({ status: "verified_incorporated", changed: true });
    const source = fake.creates.find(({ ref }) => ref.collection === "sources")?.data;
    expect(source).toMatchObject({
      origin: "community_lead",
      canonicalUrl,
      verificationStatus: "verified",
      incorporationProvenance: { kind: "community_lead", suggestionId: fingerprint },
    });
    expect(source?.reviewerUid).toBeUndefined();
    const audit = fake.creates.find(
      ({ ref }) => ref.collection === "evidenceSuggestionReviews",
    )?.data;
    expect(audit).toMatchObject({
      reviewerUid: "admin-1",
      reviewReason: "The interview and project identity were manually checked.",
      incorporationAction: "created",
    });
    expect(fake.creates.some(({ ref }) => ["scoutCards", "pathways", "claims"].includes(ref.collection))).toBe(false);
  });

  it("records a non-incorporating outcome without writing any source", async () => {
    const canonicalUrl = "https://example.com/unverified";
    const fingerprint = evidenceFingerprint("project-1", canonicalUrl);
    const fake = fakeFirestore({
      projects: { "project-1": project },
      evidenceSuggestions: {
        [fingerprint]: {
          projectId: "project-1",
          canonicalUrl,
          sourceFingerprint: fingerprint,
          status: "community_lead",
        },
      },
      sources: {},
    });
    const store = createFirestoreEvidenceStore(fake.database);
    await expect(
      store.review(fingerprint, "admin-1", {
        outcome: "could_not_verify",
        reason: "The public page did not provide enough evidence.",
      }),
    ).resolves.toMatchObject({ status: "could_not_verify", incorporatedSourceId: null });
    expect(fake.creates.some(({ ref }) => ref.collection === "sources")).toBe(false);
  });
});
