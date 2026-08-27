import { describe, expect, it } from "vitest";

import { localJunichiroDemo, parsePublicEvent, parsePublicRun, stageState } from "./public-research";

describe("public research projection", () => {
  it("selects only the safe public projection fields", () => {
    const parsed = parsePublicRun({
      status: "partial",
      currentStage: "checking-evidence",
      completedStages: [1, "mapping-story"],
      missingStages: [5],
      publicFailureMessage: "One source was unavailable.",
      projectSlug: "junichiro-jackson",
      cardUrl: "/projects/junichiro-jackson",
      retryEligible: false,
      fallbackUsed: false,
      updatedAt: "2026-08-26T12:00:00Z",
      leaseOwner: "must-not-cross-client-boundary",
      privatePrompt: "must-not-cross-client-boundary",
    });
    expect(parsed).toEqual({
      runId: null,
      projectId: null,
      attempt: 1,
      researchVersion: 1,
      status: "partial",
      currentStage: 4,
      completedStages: [1, 2],
      missingStages: [5],
      publicFailureMessage: "One source was unavailable.",
      projectSlug: "junichiro-jackson",
      cardUrl: "/projects/junichiro-jackson",
      retryEligible: false,
      fallbackUsed: false,
      updatedAt: "2026-08-26T12:00:00Z",
    });
  });

  it("rejects non-public events and renders partial stages honestly", () => {
    expect(parsePublicEvent("private", { publicVisibility: "private" })).toBeNull();
    const demo = localJunichiroDemo();
    expect(demo.mode).toBe("demo");
    expect(stageState({ ...demo.run, status: "partial", missingStages: [4] }, 4)).toBe("incomplete");
    expect(JSON.stringify(demo)).toContain("no provider result or count is being claimed");
  });
});
