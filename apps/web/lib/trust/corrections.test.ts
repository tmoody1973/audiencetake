import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";

import { getScoutCardFixture } from "@/features/scout-card/data";

import {
  correctionInputSchema,
  CorrectionError,
  promoteReviewedYouTubeLead,
  recordProjectCorrection,
} from "./corrections";

describe("project corrections", () => {
  it("requires a concise public explanation of both the correction and prior basis", () => {
    expect(correctionInputSchema.safeParse({ section: "claim", summary: "too short", priorBasis: "also short" }).success).toBe(false);
    expect(correctionInputSchema.safeParse({ section: "claim", summary: "Corrected the project release date.", priorBasis: "The prior date came from an outdated campaign page." }).success).toBe(true);
    expect(correctionInputSchema.safeParse({ section: "claim", summary: "Corrected the project release date.", priorBasis: "The prior date came from an outdated campaign page.", replacementCardVersionId: "card-v2" }).success).toBe(false);
  });

  it("keeps the public correction separate from the private actor audit", async () => {
    const writes: Array<{ id: string; value: Record<string, unknown> }> = [];
    const refs = new Map<string, { exists: boolean; data: Record<string, unknown> }>([
      ["projects/project-1", { exists: true, data: { publicationStatus: "published", latestCardVersionId: "card-v1" } }],
    ]);
    let sequence = 0;
    const database = {
      collection: (name: string) => ({ doc: (id?: string) => ({ id: id ?? `auto-${++sequence}`, path: `${name}/${id ?? `auto-${sequence}`}` }) }),
      runTransaction: async (callback: (transaction: { get(ref: { path: string }): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>; create(ref: { path: string }, value: Record<string, unknown>): void; set(ref: { path: string }, value: Record<string, unknown>): void }) => Promise<unknown>) => callback({
        get: async (ref) => { const found = refs.get(ref.path); return { exists: found?.exists ?? false, data: () => found?.data }; },
        create: (ref, value) => writes.push({ id: ref.path, value }),
        set: (ref, value) => writes.push({ id: ref.path, value }),
      }),
    } as unknown as Firestore;

    await recordProjectCorrection(database, "project-1", "admin-secret", {
      section: "source",
      summary: "Corrected the source availability label.",
      priorBasis: "The earlier label reflected a temporary access failure.",
    });
    const publicWrite = writes.find((write) => write.id.startsWith("projectCorrections/"));
    const auditWrite = writes.find((write) => write.id.startsWith("projectCorrectionAudits/"));
    expect(publicWrite?.value).not.toHaveProperty("actorUid");
    expect(publicWrite?.value).toMatchObject({ cardVersionId: "card-v1" });
    expect(publicWrite?.value).not.toHaveProperty("toCardVersionId");
    expect(auditWrite?.value).toMatchObject({ actorUid: "admin-secret" });
  });

  it("rejects corrections when there is no published card basis", async () => {
    const database = {
      collection: (name: string) => ({ doc: (id = "auto") => ({ id, path: `${name}/${id}` }) }),
      runTransaction: async (callback: (transaction: { get(): Promise<{ exists: boolean; data(): Record<string, unknown> }> }) => Promise<unknown>) => callback({ get: async () => ({ exists: true, data: () => ({ publicationStatus: "published" }) }) }),
    } as unknown as Firestore;
    await expect(recordProjectCorrection(database, "project-1", "admin", { section: "other", summary: "Corrected a material project detail.", priorBasis: "The prior basis was incomplete and no longer current." }))
      .rejects.toEqual(expect.objectContaining<Partial<CorrectionError>>({ code: "card_not_found" }));
  });

  it("publishes a create-only primary-work revision without advancing research", async () => {
    const fixture = getScoutCardFixture("complete");
    const fromCard = {
      ...fixture,
      cardVersionId: "card-v1",
      projectId: "project-1",
      slug: "junichiro-jackson",
      visibility: "public",
    };
    const records = new Map<string, Record<string, unknown>>([
      ["projects/project-1", {
        publicationStatus: "published",
        slug: "junichiro-jackson",
        latestCardVersionId: "card-v1",
        publishedResearchVersion: 1,
      }],
      ["scoutCards/card-v1", fromCard],
    ]);
    const writes: Array<{ operation: string; path: string; value: Record<string, unknown> }> = [];
    const snapshot = (path: string) => ({
      exists: records.has(path),
      data: () => records.get(path),
    });
    const database = {
      collection: (name: string) => ({
        doc: (id = "auto") => ({ id, path: `${name}/${id}` }),
      }),
      runTransaction: async (callback: (transaction: {
        getAll(...refs: Array<{ path: string }>): Promise<Array<ReturnType<typeof snapshot>>>;
        get(ref: { path: string }): Promise<ReturnType<typeof snapshot>>;
        create(ref: { path: string }, value: Record<string, unknown>): void;
        update(ref: { path: string }, value: Record<string, unknown>): void;
        set(ref: { path: string }, value: Record<string, unknown>): void;
      }) => Promise<unknown>) => callback({
        getAll: async (...refs) => refs.map((ref) => snapshot(ref.path)),
        get: async (ref) => snapshot(ref.path),
        create: (ref, value) => {
          writes.push({ operation: "create", path: ref.path, value });
          records.set(ref.path, value);
        },
        update: (ref, value) => {
          writes.push({ operation: "update", path: ref.path, value });
          records.set(ref.path, { ...(records.get(ref.path) ?? {}), ...value });
        },
        set: (ref, value) => {
          writes.push({ operation: "set", path: ref.path, value });
          records.set(ref.path, { ...(records.get(ref.path) ?? {}), ...value });
        },
      }),
    } as unknown as Firestore;

    const input = {
      section: "media",
      summary: "Replaced commentary-led media with TeamTO's primary-work proof of concept.",
      priorBasis: "The original nomination URL was public commentary and did not show the primary work.",
      expectedCardVersionId: "card-v1",
      replacement: {
        kind: "youtube_primary_work",
        sourceUrl: "https://www.youtube.com/watch?v=s8G7425lfKs&list=ignored",
        sourceTitle: "Junichiro Jackson (JJ) - Proof of Concept",
        authorName: "TeamTO",
        cardTitle: "Junichiro Jackson (JJ)",
      },
    } as const;
    const result = await recordProjectCorrection(database, "project-1", "admin-secret", input);

    expect(result).toMatchObject({ changed: true, previousCardVersionId: "card-v1" });
    const cardWrite = writes.find((write) => write.path.startsWith("scoutCards/card-v1-correction-"));
    expect(cardWrite?.operation).toBe("create");
    expect(cardWrite?.value).toMatchObject({
      researchVersion: 1,
      title: "Junichiro Jackson (JJ)",
      evidenceStatus: "source_limited",
      primaryWorkSourceId: expect.stringMatching(/^source-community-lead-/),
      media: {
        state: "authorized_embed",
        sourceUrl: "https://www.youtube.com/watch?v=s8G7425lfKs",
        embedUrl: "https://www.youtube-nocookie.com/embed/s8G7425lfKs",
      },
    });
    const nextCard = cardWrite?.value as unknown as typeof fixture;
    expect(nextCard.sourceLedger.find((source) => source.url === fixture.media.sourceUrl)).toMatchObject({
      sourceRole: "commentary",
      sourceTier: "community",
      externalCommentary: true,
    });
    expect(nextCard.sourceLedger.at(-1)).toMatchObject({
      sourceRole: "primary_work",
      sourceTier: "platform_metadata",
      verificationStatus: "observed",
      supportsClaimIds: [],
    });
    expect(writes.find((write) => write.path.startsWith("sources/project-1_v1_"))?.operation).toBe("create");
    expect(writes.find((write) => write.path.startsWith("projectCorrections/"))?.value).not.toHaveProperty("actorUid");
    expect(writes.find((write) => write.path.startsWith("projectCorrectionAudits/"))?.value).toMatchObject({ actorUid: "admin-secret" });
    expect(writes.find((write) => write.path === "projects/project-1")?.value).toMatchObject({
      title: "Junichiro Jackson (JJ)",
      latestCardVersionId: expect.stringMatching(/^card-v1-correction-/),
    });
    expect(writes.some((write) => write.path === "scoutCards/card-v1")).toBe(false);
    const writeCount = writes.length;
    await expect(recordProjectCorrection(database, "project-1", "admin-secret", input)).resolves.toMatchObject({
      changed: false,
      cardVersionId: result.cardVersionId,
    });
    expect(writes).toHaveLength(writeCount);
  });

  it("requires compare-and-set input for a versioned correction", () => {
    expect(correctionInputSchema.safeParse({
      section: "media",
      summary: "Use the reviewed primary-work source.",
      priorBasis: "The old media was commentary rather than the underlying work.",
      replacement: {
        kind: "youtube_primary_work",
        sourceUrl: "https://www.youtube.com/watch?v=s8G7425lfKs",
        sourceTitle: "Junichiro Jackson (JJ) - Proof of Concept",
        authorName: "TeamTO",
        cardTitle: "Junichiro Jackson (JJ)",
      },
    }).success).toBe(false);
  });

  it("reuses a verified evidence source when publishing the reviewed video", async () => {
    const fixture = getScoutCardFixture("complete");
    const sourceId = "community-reviewed-video";
    const sourceUrl = "https://www.youtube.com/watch?v=s8G7425lfKs";
    const records = new Map<string, Record<string, unknown>>([
      ["projects/project-1", {
        publicationStatus: "published",
        slug: "junichiro-jackson",
        latestCardVersionId: "card-v1",
      }],
      ["scoutCards/card-v1", {
        ...fixture,
        cardVersionId: "card-v1",
        projectId: "project-1",
        slug: "junichiro-jackson",
        visibility: "public",
      }],
      [`sources/${sourceId}`, {
        id: sourceId,
        projectId: "project-1",
        canonicalUrl: sourceUrl,
        url: sourceUrl,
        title: "Junichiro Jackson proof of concept",
        author: "TeamTO",
        verificationStatus: "verified",
      }],
    ]);
    const writes: Array<{ operation: string; path: string; value: Record<string, unknown> }> = [];
    const snapshot = (path: string) => ({
      exists: records.has(path),
      data: () => records.get(path),
    });
    const database = {
      collection: (name: string) => ({
        doc: (id = "auto") => {
          const path = `${name}/${id}`;
          return { id, path, get: async () => snapshot(path) };
        },
      }),
      runTransaction: async (callback: (transaction: {
        getAll(...refs: Array<{ path: string }>): Promise<Array<ReturnType<typeof snapshot>>>;
        get(ref: { path: string }): Promise<ReturnType<typeof snapshot>>;
        create(ref: { path: string }, value: Record<string, unknown>): void;
        update(ref: { path: string }, value: Record<string, unknown>): void;
      }) => Promise<unknown>) => callback({
        getAll: async (...refs) => refs.map((ref) => snapshot(ref.path)),
        get: async (ref) => snapshot(ref.path),
        create: (ref, value) => {
          writes.push({ operation: "create", path: ref.path, value });
          records.set(ref.path, value);
        },
        update: (ref, value) => {
          writes.push({ operation: "update", path: ref.path, value });
          records.set(ref.path, { ...(records.get(ref.path) ?? {}), ...value });
        },
      }),
    } as unknown as Firestore;

    const result = await promoteReviewedYouTubeLead(database, {
      projectId: "project-1",
      reviewerUid: "admin-1",
      incorporatedSourceId: sourceId,
      canonicalUrl: sourceUrl,
    });

    expect(result).toMatchObject({ changed: true, previousCardVersionId: "card-v1" });
    expect(writes.some((write) => write.path.startsWith("sources/"))).toBe(false);
    const cardWrite = writes.find((write) => write.path.startsWith("scoutCards/card-v1-correction-"));
    expect(cardWrite?.value).toMatchObject({
      primaryWorkSourceId: sourceId,
      identity: fixture.identity,
      media: {
        sourceUrl,
        embedUrl: "https://www.youtube-nocookie.com/embed/s8G7425lfKs",
      },
    });
    const sourceEntry = (cardWrite?.value.sourceLedger as Array<Record<string, unknown>>)
      .find((source) => source.id === sourceId);
    expect(sourceEntry).toMatchObject({
      verificationStatus: "verified",
      sourceRole: "primary_work",
    });
  });

  it("publishes three project-native pathways as an immutable documentary correction", async () => {
    const fixture = getScoutCardFixture("complete");
    const fromCard = {
      ...fixture,
      cardVersionId: "card-documentary-v1",
      projectId: "documentary-1",
      slug: "american-pachuco",
      projectType: "documentary",
      storyContext: { ...fixture.storyContext, currentFormat: "Feature documentary" },
      visibility: "public",
    } as const;
    const records = new Map<string, Record<string, unknown>>([
      ["projects/documentary-1", {
        publicationStatus: "published",
        slug: "american-pachuco",
        latestCardVersionId: "card-documentary-v1",
        publishedResearchVersion: 1,
      }],
      ["scoutCards/card-documentary-v1", fromCard],
    ]);
    const writes: Array<{ operation: string; path: string; value: Record<string, unknown> }> = [];
    const snapshot = (path: string) => ({
      exists: records.has(path),
      data: () => records.get(path),
    });
    const database = {
      collection: (name: string) => ({
        doc: (id = "auto") => ({ id, path: `${name}/${id}` }),
      }),
      runTransaction: async (callback: (transaction: {
        getAll(...refs: Array<{ path: string }>): Promise<Array<ReturnType<typeof snapshot>>>;
        create(ref: { path: string }, value: Record<string, unknown>): void;
        update(ref: { path: string }, value: Record<string, unknown>): void;
      }) => Promise<unknown>) => callback({
        getAll: async (...refs) => refs.map((ref) => snapshot(ref.path)),
        create: (ref, value) => {
          writes.push({ operation: "create", path: ref.path, value });
          records.set(ref.path, value);
        },
        update: (ref, value) => {
          writes.push({ operation: "update", path: ref.path, value });
          records.set(ref.path, { ...(records.get(ref.path) ?? {}), ...value });
        },
      }),
    } as unknown as Firestore;
    const base = {
      proposedMedium: "documentary",
      crossFormat: false,
      crossFormatClaimIds: [],
      audience: "Documentary viewers and cultural-history audiences.",
      rationale: "Test a bounded route using the card's qualified public evidence.",
      supportingClaimIds: [fixture.claimIds[0]],
      comparableSourceIds: [],
      strengths: ["The existing documentary can be evaluated in its current medium."],
      risks: ["Audience response remains unverified."],
      openQuestions: ["Which route best fits the current rights and release status?"],
      confidence: "low",
      nextExperiment: {
        title: "Run a bounded documentary route test",
        hypothesis: "One route will produce clearer qualified interest.",
        method: "Present one existing-format package to a bounded participant group.",
        participantAction: "Review the package and explain the preferred route.",
        signal: "Qualified preference and recurring reasons.",
        timebox: "Three weeks",
      },
    } as const;
    const input = {
      section: "pathway",
      summary: "Replaced animation-only pathways with project-native documentary routes.",
      priorBasis: "The original reusable pathway template incorrectly injected animation directions.",
      expectedCardVersionId: "card-documentary-v1",
      replacement: {
        kind: "project_native_pathways",
        projectProfile: {
          medium: "documentary",
          form: "feature",
          lifecycle: "released",
          sourceIds: [fixture.sourceIds[0]],
          qualification: "The immutable card identifies the project as a documentary.",
        },
        pathways: [
          {
            ...base,
            id: "pathway-01",
            order: 1,
            label: "Festival and theatrical expansion",
            format: "Feature documentary exhibition",
            strategyKind: "distribution",
          },
          {
            ...base,
            id: "pathway-02",
            order: 2,
            label: "Public media and streaming distribution",
            format: "Feature documentary distribution",
            strategyKind: "audience",
          },
          {
            ...base,
            id: "pathway-03",
            order: 3,
            label: "Educational and community licensing",
            format: "Documentary educational exhibition",
            strategyKind: "education",
          },
        ],
      },
    } as const;

    const result = await recordProjectCorrection(database, "documentary-1", "admin-secret", input);
    expect(result).toMatchObject({ changed: true, previousCardVersionId: "card-documentary-v1" });
    const cardWrite = writes.find((write) =>
      write.path.startsWith("scoutCards/card-documentary-v1-correction-"),
    );
    expect(cardWrite?.value.pathways).toEqual(input.replacement.pathways);
    expect((cardWrite?.value.industryLens as Record<string, unknown>).pathwayIds).toEqual([
      "pathway-01", "pathway-02", "pathway-03",
    ]);
    expect(JSON.stringify(cardWrite?.value).toLocaleLowerCase()).not.toContain("animated");
    expect(writes.filter((write) => write.path.startsWith("pathways/"))).toHaveLength(3);
    expect(writes.some((write) => write.path === "scoutCards/card-documentary-v1")).toBe(false);
    expect(writes.find((write) => write.path.startsWith("projectCorrections/"))?.value)
      .not.toHaveProperty("actorUid");
    expect(writes.find((write) => write.path.startsWith("projectCorrectionAudits/"))?.value)
      .toMatchObject({ actorUid: "admin-secret" });
    const writeCount = writes.length;
    await expect(recordProjectCorrection(database, "documentary-1", "admin-secret", input))
      .resolves.toMatchObject({ changed: false, cardVersionId: result.cardVersionId });
    expect(writes).toHaveLength(writeCount);
  });
});
