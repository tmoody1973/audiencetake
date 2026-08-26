import { describe, expect, it, vi } from "vitest";

import type { NominationInput } from "./contract";
import { acceptNomination } from "./service";
import type { AcceptedNomination, NominationStore, PreparedNomination } from "./store";

const input: NominationInput = {
  submittedUrl: "https://example.com/project?utm_source=fan&id=7",
  whyItShouldGrow: "A distinctive independent project that deserves a wider audience.",
  submissionType: "fan",
  suggestedFormat: "Feature film",
  audienceFit: "Independent genre audiences",
  supportingUrls: ["https://example.com/about?id=7&utm_medium=social"],
};

const urlPolicy = {
  resolve: async () => ["93.184.216.34"],
  probe: async () => ({ status: 200, contentType: "text/html" }),
};

class ContendedMemoryStore implements NominationStore {
  accepted?: PreparedNomination;
  dispatched: string[] = [];
  failures: string[] = [];
  private pending?: Promise<AcceptedNomination>;

  accept(nomination: PreparedNomination): Promise<AcceptedNomination> {
    this.accepted = nomination;
    if (!this.pending) {
      this.pending = Promise.resolve({
        kind: "created",
        projectId: "project-1",
        nominationId: "nomination-1",
        runId: "run-1",
        researchUrl: "/research/run-1",
        canonicalUrl: "/projects/project-1",
      });
      return this.pending;
    }
    return this.pending.then(() => ({
      kind: "duplicate",
      projectId: "project-1",
      canonicalUrl: "/projects/project-1",
    }));
  }

  async markDispatched(runId: string) { this.dispatched.push(runId); }
  async markDispatchFailed(runId: string) { this.failures.push(runId); }
}

describe("acceptNomination", () => {
  it("normalizes canonical fields and dispatches only the newly created run", async () => {
    const store = new ContendedMemoryStore();
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const first = await acceptNomination(input, "user-1", { store, dispatch, urlPolicy });
    const second = await acceptNomination(input, "user-2", { store, dispatch, urlPolicy });

    expect(first).toMatchObject({ duplicate: false, runId: "run-1", dispatchState: "dispatched" });
    expect(second).toEqual({ duplicate: true, projectId: "project-1", canonicalUrl: "/projects/project-1" });
    expect(store.accepted).toMatchObject({
      canonicalUrl: "https://example.com/project?id=7",
      canonicalSupportingUrls: ["https://example.com/about?id=7"],
      nominatorUid: "user-2",
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(store.dispatched).toEqual(["run-1"]);
  });

  it("keeps the accepted run and records durable retry state when dispatch fails", async () => {
    const store = new ContendedMemoryStore();
    const result = await acceptNomination(input, "user-1", {
      store,
      dispatch: vi.fn().mockRejectedValue(new Error("provider details must not leak")),
      urlPolicy,
    });

    expect(result).toMatchObject({ duplicate: false, runId: "run-1", dispatchState: "retryable_failed" });
    expect(store.failures).toEqual(["run-1"]);
    expect(JSON.stringify(result)).not.toContain("provider details");
  });
});

