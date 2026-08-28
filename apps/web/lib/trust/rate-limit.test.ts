import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";

import {
  consumeRateLimit,
  consumeRateLimits,
  RateLimitError,
  type RateLimitPolicy,
} from "./rate-limit";

const policy: RateLimitPolicy = {
  name: "test_action",
  burstLimit: 2,
  burstWindowSeconds: 60,
  dailyLimit: 3,
};

type Stored = Record<string, unknown>;

function memoryDatabase(seed: Record<string, Stored> = {}) {
  const values = new Map(Object.entries(seed));
  const writes: Array<{ kind: string; id: string }> = [];
  const database = {
    collection: (name: string) => ({ doc: (id: string) => ({ id: `${name}/${id}` }) }),
    runTransaction: async (callback: (transaction: {
      get(ref: { id: string }): Promise<{ exists: boolean; data(): Stored | undefined }>;
      set(ref: { id: string }, value: Stored): void;
      create(ref: { id: string }, value: Stored): void;
    }) => Promise<unknown>) => callback({
      get: async (ref) => ({ exists: values.has(ref.id), data: () => values.get(ref.id) }),
      set: (ref, value) => { writes.push({ kind: "set", id: ref.id }); values.set(ref.id, value); },
      create: (ref, value) => { writes.push({ kind: "create", id: ref.id }); values.set(ref.id, value); },
    }),
  } as unknown as Firestore;
  return { database, values, writes };
}

describe("account rate limits", () => {
  it("writes private burst/day counters and an idempotency receipt", async () => {
    const memory = memoryDatabase();
    const result = await consumeRateLimit(memory.database, {
      uid: "user@example.com",
      policy,
      idempotencyKey: "project-1",
      now: new Date("2026-08-27T12:00:30.000Z"),
    });

    expect(result).toEqual({ remainingBurst: 1, remainingDaily: 2, reused: false });
    expect(memory.writes.map((write) => write.kind)).toEqual(["set", "set", "create"]);
    expect(memory.writes.some((write) => write.id.includes("user@example.com"))).toBe(false);
  });

  it("does not consume quota twice for the same action receipt", async () => {
    const first = memoryDatabase();
    const input = {
      uid: "user-1",
      policy,
      idempotencyKey: "same-action",
      now: new Date("2026-08-27T12:00:30.000Z"),
    };
    await consumeRateLimit(first.database, input);
    const writesAfterFirst = first.writes.length;
    const repeated = await consumeRateLimit(first.database, input);
    expect(repeated.reused).toBe(true);
    expect(first.writes).toHaveLength(writesAfterFirst);
  });

  it("returns a bounded retry time once the burst is exhausted", async () => {
    const now = new Date("2026-08-27T12:00:30.000Z");
    const burstStart = Date.parse("2026-08-27T12:00:00.000Z");
    const principal = await import("node:crypto").then(({ createHash }) =>
      createHash("sha256").update(`${policy.name}:user-1`).digest("hex"));
    const memory = memoryDatabase({
      [`rateLimitCounters/${principal}_burst_${burstStart}`]: { count: 2 },
    });

    await expect(consumeRateLimit(memory.database, { uid: "user-1", policy, now }))
      .rejects.toEqual(expect.objectContaining<Partial<RateLimitError>>({
        code: "rate_limited",
        retryAfterSeconds: 30,
      }));
    expect(memory.writes).toHaveLength(0);
  });

  it("checks all principals before writing any counter", async () => {
    const now = new Date("2026-08-27T12:00:30.000Z");
    const burstStart = Date.parse("2026-08-27T12:00:00.000Z");
    const ipPolicy = { ...policy, name: "test_action_ip" };
    const ipPrincipal = await import("node:crypto").then(({ createHash }) =>
      createHash("sha256").update(`${ipPolicy.name}:203.0.113.8`).digest("hex"));
    const memory = memoryDatabase({
      [`rateLimitCounters/${ipPrincipal}_burst_${burstStart}`]: { count: 2 },
    });

    await expect(consumeRateLimits(memory.database, [
      { uid: "user-1", policy, now },
      { uid: "203.0.113.8", policy: ipPolicy, now },
    ])).rejects.toBeInstanceOf(RateLimitError);
    expect(memory.writes).toHaveLength(0);
  });

  it("persists only digests when consuming account and IP limits together", async () => {
    const memory = memoryDatabase();
    const results = await consumeRateLimits(memory.database, [
      { uid: "user-1", policy, now: new Date("2026-08-27T12:00:30.000Z") },
      {
        uid: "203.0.113.8",
        policy: { ...policy, name: "test_action_ip" },
        now: new Date("2026-08-27T12:00:30.000Z"),
      },
    ]);

    expect(results).toHaveLength(2);
    expect([...memory.values.keys()].join(" ")).not.toContain("user-1");
    expect([...memory.values.keys()].join(" ")).not.toContain("203.0.113.8");
  });
});
