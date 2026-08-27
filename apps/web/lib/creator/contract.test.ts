import { describe, expect, it } from "vitest";

import {
  claimRequestId,
  claimRequestInputSchema,
  claimReviewSchema,
  creatorUpdateInputSchema,
} from "./contract";

describe("creator command contracts", () => {
  it("requires a project connection and rejects contract drift", () => {
    expect(
      claimRequestInputSchema.safeParse({ role: "Director", context: "I made this." }).success,
    ).toBe(false);
    expect(
      claimRequestInputSchema.safeParse({
        role: "Director",
        projectConnectedEmail: "Creator@Example.com",
      }),
    ).toMatchObject({ success: true, data: { projectConnectedEmail: "creator@example.com" } });
    expect(
      claimRequestInputSchema.safeParse({
        role: "Director",
        publicProofUrl: "https://example.com/about",
        unexpected: true,
      }).success,
    ).toBe(false);
    expect(
      claimRequestInputSchema.safeParse({ role: "Director", publicProofUrl: "file:///etc/passwd" }).success,
    ).toBe(false);
    expect(
      claimRequestInputSchema.safeParse({ role: "Director", publicProofUrl: "https://localhost/proof" }).success,
    ).toBe(false);
    expect(
      claimRequestInputSchema.safeParse({ role: "Director", publicProofUrl: "https://me:secret@example.com" }).success,
    ).toBe(false);
  });

  it("allows only final admin review outcomes", () => {
    expect(claimReviewSchema.safeParse({ status: "approved" }).success).toBe(true);
    expect(claimReviewSchema.safeParse({ status: "pending" }).success).toBe(false);
  });

  it("bounds creator content and forbids duplicate media attachments", () => {
    expect(
      creatorUpdateInputSchema.safeParse({ title: "Festival date", body: "Tickets are live." }).success,
    ).toBe(true);
    expect(
      creatorUpdateInputSchema.safeParse({
        title: "Festival date",
        body: "Tickets are live.",
        mediaIds: ["media-1", "media-1"],
      }).success,
    ).toBe(false);
    expect(
      creatorUpdateInputSchema.safeParse({ title: "x", body: "x".repeat(4_001) }).success,
    ).toBe(false);
  });

  it("uses one deterministic claim document per user and project", () => {
    expect(claimRequestId("project-1", "creator-1")).toBe("project-1_creator-1");
  });
});
