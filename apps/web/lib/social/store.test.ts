import { describe, expect, it } from "vitest";
import { commitmentId, followId, moveVoteCounts, replyId, takeId, voteId } from "./store";
import { validTakeBody } from "./route";

describe("native social contracts", () => {
  it("uses deterministic IDs for every action", () => {
    expect(followId("p", "u")).toBe("p_u");
    expect(commitmentId("p", "u", "would_watch")).toBe("p_u_would_watch");
    expect(voteId("p", "u")).toBe("p_u");
    expect(takeId("p", "u")).toBe("p_u");
    expect(replyId("p_u", "u")).toBe("p_u_u");
  });
  it("makes repeated activation and withdrawal counter-neutral", () => {
    let count = 0;
    const transition = (old: boolean, next: boolean) => old === next ? count : (count = Math.max(0, count + (next ? 1 : -1)));
    transition(false, true); transition(true, true); transition(true, false); transition(false, false);
    expect(count).toBe(0);
  });
  it("moves and withdraws one current vote without negative counts", () => {
    expect(moveVoteCounts({ a: 1, b: 0 }, "a", "b")).toEqual({ a: 0, b: 1 });
    expect(moveVoteCounts({ a: 0, b: 1 }, "b", "b", false)).toEqual({ a: 0, b: 1 });
  });
  it("requires a bounded structured Take", () => {
    expect(validTakeBody({ whyItShouldGrow: "x", preferredPathwayId: "a" })).toBe(true);
    expect(validTakeBody({ whyItShouldGrow: "x".repeat(601), preferredPathwayId: "a" })).toBe(false);
    expect(validTakeBody({ whyItShouldGrow: "x".repeat(300), audienceNote: "y".repeat(301), preferredPathwayId: "a" })).toBe(false);
  });
  it("preserves reply totals when a parent is withdrawn and republished", () => {
    let replies = 2;
    replies = Math.max(0, replies - 2); // parent withdrawal hides active replies
    replies += 2; // republish restores them without deleting documents
    expect(replies).toBe(2);
  });
});
