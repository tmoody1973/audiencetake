import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";

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
});
