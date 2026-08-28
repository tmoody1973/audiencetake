import { describe, expect, it, vi } from "vitest";

import canonicalCompleteFixture from "../../../../contracts/fixtures/junichiro-card.json";
import canonicalFallbackFixture from "../../../../contracts/fixtures/junichiro-card-fallback.json";
import canonicalPartialFixture from "../../../../contracts/fixtures/junichiro-card-partial.json";
import canonicalUnavailableFixture from "../../../../contracts/fixtures/junichiro-card-unavailable-media.json";
import {
  getScoutCardFixture,
  JUNICHIO_LIVE_SLUG,
  LIVE_REFRESH_FALLBACK_LABEL,
  loadPublishedScoutCard,
  type ScoutCardFirestore,
} from "./data";

type StoredDocument = { id: string; value: unknown; exists?: boolean };

function fakeDatabase({ projects = [], cards = [], analyses = [], fail = false }: { projects?: StoredDocument[]; cards?: StoredDocument[]; analyses?: StoredDocument[]; fail?: boolean | Error }): ScoutCardFirestore {
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
        const documents = name === "videoAnalyses" ? analyses : cards;
        return { async get() { return snapshot(documents.find((document) => document.id === id) ?? { id, value: undefined, exists: false }); } };
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

  it("loads only a public pointed video analysis that matches the card source", async () => {
    const card = structuredClone(getScoutCardFixture("complete"));
    const artifactId = "video-analysis-1";
    const analysis = {
      artifactId, projectId: card.projectId, sourceId: "source-youtube-trailer",
      youtubeUrl: "https://www.youtube.com/watch?v=M2djoKmnOTY", youtubeVideoId: "M2djoKmnOTY",
      modelId: "gemini-3.7-flash", analysisVersion: 1, cardVersionId: card.cardVersionId,
      structuralNarrative: { genreSignaling: "Genre.", narrativeDelivery: "Delivery.", trailerType: "Proof of concept.", beats: [
        { label: "Hook", start: "00:00", end: "00:10", observation: "Opening.", modality: "audiovisual" },
        { label: "Turn", start: "00:11", end: "00:20", observation: "Turn.", modality: "visual" },
      ] },
      technicalCraft: { editingAndPace: "Pace.", cinematographyAndFraming: "Framing.", soundAndScore: "Sound.", graphicsAndTitles: "Titles." },
      marketingPersuasion: { uniqueSellingProposition: "USP.", targetAudienceHypothesis: "Hypothesis.", conceptVsStarEmphasis: "Concept.", representationCaveat: "Caveat." },
      emotionalRhetorical: { emotionalHook: "Hook.", toneAndMoodBalance: "Tone.", persuasiveArgument: "Argument." },
      matrix: ["genre", "narrative_stance", "usp", "target_audience", "sound_music", "camera_editing"].map((category) => ({ category, analysis: "Analysis." })),
      sourceIds: ["source-youtube-trailer"], limitations: ["Sampled analysis."],
      analyzedAt: "2026-08-28T12:00:00Z", visibility: "public",
    };
    const database = fakeDatabase({
      projects: [{ id: card.projectId, value: publishedProject({ latestVideoAnalysisIds: [artifactId] }) }],
      cards: [{ id: card.cardVersionId, value: { ...card, visibility: "public" } }],
      analyses: [{ id: artifactId, value: analysis }],
    });

    const result = await loadPublishedScoutCard("junichiro-jackson", database);
    expect(result?.trailerCritiques).toHaveLength(1);
    expect(result?.trailerCritiques?.[0].modelId).toBe("gemini-3.7-flash");
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
      expect((await loadPublishedScoutCard(JUNICHIO_LIVE_SLUG, unavailable))?.fallbackUsed)
        .toBe(true);
      expect(await loadPublishedScoutCard("another-project", unavailable)).toBeNull();

      expect(consoleError).toHaveBeenCalledTimes(3);
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
