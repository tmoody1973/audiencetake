import { createHash } from "node:crypto";

import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";

export type RateLimitPolicy = {
  name: string;
  burstLimit: number;
  burstWindowSeconds: number;
  dailyLimit: number;
};

export const RATE_LIMITS = {
  nomination: { name: "nomination", burstLimit: 2, burstWindowSeconds: 60 * 60, dailyLimit: 5 },
  evidenceSuggestion: { name: "evidence_suggestion", burstLimit: 3, burstWindowSeconds: 10 * 60, dailyLimit: 20 },
  claimRequest: { name: "claim_request", burstLimit: 2, burstWindowSeconds: 60 * 60, dailyLimit: 5 },
  creatorUpdate: { name: "creator_update", burstLimit: 8, burstWindowSeconds: 10 * 60, dailyLimit: 50 },
  report: { name: "report", burstLimit: 5, burstWindowSeconds: 10 * 60, dailyLimit: 30 },
  take: { name: "take", burstLimit: 6, burstWindowSeconds: 10 * 60, dailyLimit: 40 },
  reply: { name: "reply", burstLimit: 10, burstWindowSeconds: 10 * 60, dailyLimit: 80 },
  upload: { name: "upload", burstLimit: 5, burstWindowSeconds: 10 * 60, dailyLimit: 30 },
} as const satisfies Record<string, RateLimitPolicy>;

export class RateLimitError extends Error {
  readonly code = "rate_limited";

  constructor(readonly retryAfterSeconds: number) {
    super("Too many requests. Please wait before trying again.");
    this.name = "RateLimitError";
  }
}

type Counter = { count?: unknown };

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function nextUtcDay(nowMs: number): number {
  const now = new Date(nowMs);
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
}

function countOf(value: Counter | undefined): number {
  return typeof value?.count === "number" && Number.isFinite(value.count)
    ? Math.max(0, Math.floor(value.count))
    : 0;
}

export async function consumeRateLimit(
  database: Firestore,
  input: {
    uid: string;
    policy: RateLimitPolicy;
    idempotencyKey?: string;
    now?: Date;
  },
): Promise<{ remainingBurst: number; remainingDaily: number; reused: boolean }> {
  const nowMs = (input.now ?? new Date()).getTime();
  const burstMs = input.policy.burstWindowSeconds * 1000;
  const burstStart = Math.floor(nowMs / burstMs) * burstMs;
  const dayStart = Date.UTC(
    new Date(nowMs).getUTCFullYear(),
    new Date(nowMs).getUTCMonth(),
    new Date(nowMs).getUTCDate(),
  );
  const principal = digest(`${input.policy.name}:${input.uid}`);
  const burstRef = database.collection("rateLimitCounters").doc(`${principal}_burst_${burstStart}`);
  const dayRef = database.collection("rateLimitCounters").doc(`${principal}_day_${dayStart}`);
  const actionRef = input.idempotencyKey
    ? database.collection("rateLimitActions").doc(digest(`${input.policy.name}:${input.uid}:${input.idempotencyKey}`))
    : null;

  return database.runTransaction(async (transaction) => {
    const burstSnapshot = await transaction.get(burstRef);
    const daySnapshot = await transaction.get(dayRef);
    const actionSnapshot = actionRef ? await transaction.get(actionRef) : null;
    const burstCount = countOf(burstSnapshot.data() as Counter | undefined);
    const dayCount = countOf(daySnapshot.data() as Counter | undefined);

    if (actionSnapshot?.exists) {
      return {
        remainingBurst: Math.max(0, input.policy.burstLimit - burstCount),
        remainingDaily: Math.max(0, input.policy.dailyLimit - dayCount),
        reused: true,
      };
    }

    if (burstCount >= input.policy.burstLimit || dayCount >= input.policy.dailyLimit) {
      const retryAt = burstCount >= input.policy.burstLimit ? burstStart + burstMs : nextUtcDay(nowMs);
      throw new RateLimitError(Math.max(1, Math.ceil((retryAt - nowMs) / 1000)));
    }

    transaction.set(burstRef, {
      policy: input.policy.name,
      count: FieldValue.increment(1),
      window: "burst",
      expiresAt: Timestamp.fromMillis(burstStart + burstMs * 2),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(dayRef, {
      policy: input.policy.name,
      count: FieldValue.increment(1),
      window: "day",
      expiresAt: Timestamp.fromMillis(nextUtcDay(nowMs) + 24 * 60 * 60 * 1000),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    if (actionRef) {
      transaction.create(actionRef, {
        policy: input.policy.name,
        expiresAt: Timestamp.fromMillis(nextUtcDay(nowMs) + 24 * 60 * 60 * 1000),
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      remainingBurst: input.policy.burstLimit - burstCount - 1,
      remainingDaily: input.policy.dailyLimit - dayCount - 1,
      reused: false,
    };
  });
}
