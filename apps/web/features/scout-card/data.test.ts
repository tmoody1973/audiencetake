import { describe, expect, it, vi } from "vitest";

import canonicalCompleteFixture from "../../../../contracts/fixtures/junichiro-card.json";
import canonicalFallbackFixture from "../../../../contracts/fixtures/junichiro-card-fallback.json";
import canonicalPartialFixture from "../../../../contracts/fixtures/junichiro-card-partial.json";
import canonicalUnavailableFixture from "../../../../contracts/fixtures/junichiro-card-unavailable-media.json";
import {
  getScoutCardFixture,
  LIVE_REFRESH_FALLBACK_LABEL,
  loadPublishedScoutCard,
  type ScoutCardFirestore,
} from "./data";

type StoredDocument = { id: string; value: unknown; exists?: boolean };

function fakeDatabase({ projects = [], cards = [], fail = false }: { projects?: StoredDocument[]; cards?: StoredDocument[]; fail?: boolean | Error }): ScoutCardFirestore {
  function collection(name: string) {
    let slugFilter: unknown;
    const api = {
      where(field: string, _operator: "==", value: unknown) {
        if (fail) throw fail instanceof Error ? fail : new Error("Firestore unavailable");
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
  it("keeps the web-local build fixtures identical to the canonical contracts", () => {
    expect(getScoutCardFixture("complete")).toEqual(canonicalCompleteFixture);
    expect(getScoutCardFixture("fallback")).toEqual(canonicalFallbackFixture);
    expect(getScoutCardFixture("partial")).toEqual(canonicalPartialFixture);
    expect(getScoutCardFixture("unavailable")).toEqual(canonicalUnavailableFixture);
  });

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

  it("overlays the trusted project claim state instead of model-authored card state", async () => {
    const card = structuredClone(getScoutCardFixture("complete"));
    card.claimStatus = "approved";
    card.creatorContext.claimStatus = "approved";
    card.industryLens.creatorClaimStatus = "approved";
    const database = fakeDatabase({
      projects: [{ id: card.projectId, value: publishedProject({ claimStatus: "pending" }) }],
      cards: [{ id: card.cardVersionId, value: { ...card, visibility: "public" } }],
    });

    const result = await loadPublishedScoutCard("junichiro-jackson", database);
    expect(result?.claimStatus).toBe("pending");
    expect(result?.creatorContext.claimStatus).toBe("pending");
    expect(result?.industryLens.creatorClaimStatus).toBe("pending");
  });

  it("defaults an absent or invalid project claim state to unclaimed", async () => {
    const card = structuredClone(getScoutCardFixture("complete"));
    card.claimStatus = "approved";
    const database = fakeDatabase({
      projects: [{ id: card.projectId, value: publishedProject({ claimStatus: "verification_pending" }) }],
      cards: [{ id: card.cardVersionId, value: { ...card, visibility: "public" } }],
    });

    await expect(loadPublishedScoutCard("junichiro-jackson", database))
      .resolves.toEqual(expect.objectContaining({ claimStatus: "unclaimed" }));
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
    const diagnosticError = Object.assign(
      new Error("Firestore rejected Bearer secret-token and eyJabcdefgh.ijklmnop.qrstuvwx?access_token=also-secret"),
      { code: "invalid_grant", status: 401 },
    );
    const unavailable = fakeDatabase({ fail: diagnosticError });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const fallback = await loadPublishedScoutCard("junichiro-jackson", unavailable);
      expect(fallback?.fallbackUsed).toBe(true);
      expect(fallback?.fallbackLabel).toBe(LIVE_REFRESH_FALLBACK_LABEL);
      expect(await loadPublishedScoutCard("another-project", unavailable)).toBeNull();

      expect(consoleError).toHaveBeenCalledTimes(2);
      const diagnostic = JSON.parse(String(consoleError.mock.calls[0][0])) as Record<string, unknown>;
      expect(diagnostic).toEqual(expect.objectContaining({
        level: "error",
        event: "published_scout_card_load_failed",
        slug: "junichiro-jackson",
        errorName: "Error",
        errorCode: "invalid_grant",
        errorStatus: 401,
      }));
      expect(diagnostic.errorMessage).toContain("Bearer [REDACTED]");
      expect(diagnostic.errorMessage).not.toContain("secret-token");
      expect(diagnostic.errorMessage).not.toContain("also-secret");
      expect(diagnostic.errorMessage).not.toContain("eyJabcdefgh");
    } finally {
      consoleError.mockRestore();
    }
  });
});
