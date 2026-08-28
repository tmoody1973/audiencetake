import { describe, expect, it, vi } from "vitest";

import { getScoutCardFixture, type ScoutCardFirestore } from "../scout-card/data";
import { loadScoutingWallEntries } from "./data";

type StoredDocument = { id: string; value: unknown; exists?: boolean };

function snapshot(document: StoredDocument) {
  return { id: document.id, exists: document.exists ?? true, data: () => document.value };
}

function fakeDatabase({ projects = [], cards = [], fail = false }: {
  projects?: StoredDocument[];
  cards?: StoredDocument[];
  fail?: boolean;
}): ScoutCardFirestore {
  return {
    collection(name: string) {
      let publicationStatus: unknown;
      const query = {
        where(field: string, _operator: "==", value: unknown) {
          if (fail) throw new Error("Firestore unavailable");
          if (field === "publicationStatus") publicationStatus = value;
          return query;
        },
        limit() { return query; },
        async get() {
          const records = name === "projects"
            ? projects.filter((document) => (document.value as { publicationStatus?: unknown }).publicationStatus === publicationStatus)
            : [];
          return { docs: records.map(snapshot) };
        },
        doc(id: string) {
          return {
            async get() {
              return snapshot(cards.find((document) => document.id === id) ?? { id, value: undefined, exists: false });
            },
          };
        },
      };
      return query;
    },
  };
}

function publishedRecord(card: ReturnType<typeof getScoutCardFixture>, overrides: Record<string, unknown> = {}) {
  return {
    slug: card.slug,
    publicationStatus: "published",
    moderationState: "clear",
    latestCardVersionId: card.cardVersionId,
    claimStatus: "pending",
    ...overrides,
  };
}

describe("loadScoutingWallEntries", () => {
  it("lists only validated, current, moderation-clear published cards newest first", async () => {
    const older = structuredClone(getScoutCardFixture("complete"));
    const newer = structuredClone(getScoutCardFixture("partial"));
    newer.projectId = "project-new";
    newer.cardVersionId = "card-new-v1";
    newer.slug = "new-project";
    newer.title = "New Project";
    newer.publishedAt = "2026-08-27T20:00:00.000Z";

    const database = fakeDatabase({
      projects: [
        { id: older.projectId, value: publishedRecord(older) },
        { id: newer.projectId, value: publishedRecord(newer, { claimStatus: "approved" }) },
        { id: "hidden", value: publishedRecord(older, { slug: "hidden", moderationState: "hidden" }) },
        { id: "pending", value: { ...publishedRecord(older), publicationStatus: "pending" } },
      ],
      cards: [
        { id: older.cardVersionId, value: { ...older, visibility: "public" } },
        { id: newer.cardVersionId, value: { ...newer, visibility: "public" } },
      ],
    });

    await expect(loadScoutingWallEntries(database)).resolves.toEqual([
      expect.objectContaining({ slug: "new-project", claimStatus: "approved", completeness: "partial" }),
      expect.objectContaining({ slug: older.slug, claimStatus: "pending", sourceCount: older.sourceLedger.length }),
    ]);
  });

  it("fails closed without exposing provider diagnostics", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(loadScoutingWallEntries(fakeDatabase({ fail: true }))).resolves.toEqual([]);
      expect(consoleError).toHaveBeenCalledWith(JSON.stringify({
        level: "error",
        event: "scouting_wall_load_failed",
        errorName: "Error",
      }));
    } finally {
      consoleError.mockRestore();
    }
  });
});
