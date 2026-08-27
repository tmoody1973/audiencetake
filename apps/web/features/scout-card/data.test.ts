import { describe, expect, it } from "vitest";

import {
  getScoutCardFixture,
  LIVE_REFRESH_FALLBACK_LABEL,
  loadPublishedScoutCard,
  type ScoutCardFirestore,
} from "./data";

type StoredDocument = { id: string; value: unknown; exists?: boolean };

function fakeDatabase({ projects = [], cards = [], fail = false }: { projects?: StoredDocument[]; cards?: StoredDocument[]; fail?: boolean }): ScoutCardFirestore {
  function collection(name: string) {
    let slugFilter: unknown;
    const api = {
      where(field: string, _operator: "==", value: unknown) {
        if (fail) throw new Error("Firestore unavailable");
        if (field === "slug") slugFilter = value;
        return api;
      },
      limit() { return api; },
      async get() {
        const source = name === "projects" ? projects.filter((document) => (document.value as { slug?: unknown }).slug === slugFilter) : [];
        return { docs: source.map(snapshot) };
      },
      doc(id: string) {
        return { async get() { return snapshot(cards.find((document) => document.id === id) ?? { id, value: undefined, exists: false }); } };
      },
    };
    return api;
  }
  return { collection };
}

function snapshot(document: StoredDocument) {
  return { id: document.id, exists: document.exists ?? true, data: () => document.value };
}

function publishedProject(overrides: Record<string, unknown> = {}) {
  return { slug: "junichiro-jackson", publicationStatus: "published", moderationState: "clear", latestCardVersionId: "card-junichiro-v1", ...overrides };
}

describe("loadPublishedScoutCard", () => {
  it("selects the project pointer, validates the public card, and strips the visibility marker", async () => {
    const card = structuredClone(getScoutCardFixture("complete"));
    const database = fakeDatabase({
      projects: [{ id: "junichiro-jackson", value: publishedProject() }],
      cards: [{ id: card.cardVersionId, value: { ...card, visibility: "public" } }],
    });
    const result = await loadPublishedScoutCard("junichiro-jackson", database);
    expect(result?.cardVersionId).toBe("card-junichiro-v1");
    expect(result).not.toHaveProperty("visibility");
  });

  it("does not render unpublished, moderated, missing, or pointer-mismatched data", async () => {
    const card = structuredClone(getScoutCardFixture("complete"));
    const cases = [
      fakeDatabase({ projects: [{ id: card.projectId, value: publishedProject({ publicationStatus: "draft" }) }] }),
      fakeDatabase({ projects: [{ id: card.projectId, value: publishedProject({ moderationState: "blocked" }) }] }),
      fakeDatabase({ projects: [{ id: card.projectId, value: publishedProject() }] }),
      fakeDatabase({ projects: [{ id: card.projectId, value: publishedProject({ latestCardVersionId: "other-card" }) }], cards: [{ id: "other-card", value: { ...card, visibility: "public" } }] }),
    ];
    for (const database of cases) expect(await loadPublishedScoutCard("junichiro-jackson", database)).toBeNull();
  });

  it("uses only the exact labeled Junichiro fallback when the provider is unavailable", async () => {
    const unavailable = fakeDatabase({ fail: true });
    const fallback = await loadPublishedScoutCard("junichiro-jackson", unavailable);
    expect(fallback?.fallbackUsed).toBe(true);
    expect(fallback?.fallbackLabel).toBe(LIVE_REFRESH_FALLBACK_LABEL);
    expect(await loadPublishedScoutCard("another-project", unavailable)).toBeNull();
  });
});
