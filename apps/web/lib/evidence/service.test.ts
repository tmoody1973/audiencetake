import { describe, expect, it, vi } from "vitest";

import type { EvidenceStore } from "./store";
import { evidenceFingerprint } from "./store";
import { suggestEvidence } from "./service";

const urlPolicy = {
  resolve: async () => ["93.184.216.34"],
  probe: async () => ({ status: 200, contentType: "text/html" }),
};

function evidenceStore(): EvidenceStore {
  return {
    submit: vi.fn(async (input) => ({
      suggestionId: input.fingerprint,
      projectId: input.projectId,
      canonicalUrl: input.canonicalUrl,
      status: "community_lead" as const,
      duplicate: false,
      duplicateOf: null,
    })),
    review: vi.fn(),
  };
}

describe("suggestEvidence", () => {
  it("canonicalizes before deriving a project-scoped deterministic fingerprint", async () => {
    const store = evidenceStore();
    const result = await suggestEvidence(
      "project-a",
      "fan-1",
      {
        url: "https://EXAMPLE.com/report/?utm_source=social#details",
        note: "This adds current public context.",
      },
      { store, urlPolicy },
    );
    expect(store.submit).toHaveBeenCalledWith({
      projectId: "project-a",
      submittedByUid: "fan-1",
      canonicalUrl: "https://example.com/report",
      fingerprint: evidenceFingerprint("project-a", "https://example.com/report"),
      note: "This adds current public context.",
    });
    expect(result.status).toBe("community_lead");
    expect(evidenceFingerprint("project-a", result.canonicalUrl)).not.toBe(
      evidenceFingerprint("project-b", result.canonicalUrl),
    );
  });
});
