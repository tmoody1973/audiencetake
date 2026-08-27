import { describe, expect, it } from "vitest";

import { reportInputSchema, reportReviewSchema } from "./contract";

describe("report contracts", () => {
  it.each([
    "spam",
    "impersonation",
    "copyright_privacy",
    "harassment",
    "misleading",
    "other",
  ])("accepts the supported reason %s", (reason) => {
    expect(
      reportInputSchema.safeParse({
        target: { type: "project", id: "project-1" },
        reason,
      }).success,
    ).toBe(true);
  });

  it("rejects unknown targets, reasons, fields, and oversized context", () => {
    expect(
      reportInputSchema.safeParse({
        target: { type: "user", id: "user-1" },
        reason: "spam",
      }).success,
    ).toBe(false);
    expect(
      reportInputSchema.safeParse({
        target: { type: "project", id: "project-1" },
        reason: "dislike",
      }).success,
    ).toBe(false);
    expect(
      reportInputSchema.safeParse({
        target: { type: "project", id: "project-1", projectId: "trusted-by-client" },
        reason: "spam",
      }).success,
    ).toBe(false);
    expect(
      reportInputSchema.safeParse({
        target: { type: "project", id: "project-1" },
        reason: "spam",
        context: "x".repeat(1_001),
      }).success,
    ).toBe(false);
  });

  it("limits moderator changes to a known status and optional private note", () => {
    expect(reportReviewSchema.safeParse({ status: "reviewing" }).success).toBe(true);
    expect(reportReviewSchema.safeParse({ status: "removed" }).success).toBe(false);
    expect(reportReviewSchema.safeParse({ status: "resolved", hideTarget: true }).success).toBe(
      false,
    );
  });
});
