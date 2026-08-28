import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";

import { getScoutCardFixture } from "@/features/scout-card/data";

import { correctionInputSchema, CorrectionError, recordProjectCorrection } from "./corrections";

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
});
