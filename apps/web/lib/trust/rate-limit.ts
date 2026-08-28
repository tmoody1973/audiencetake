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
  nominationIp: { name: "nomination_ip", burstLimit: 10, burstWindowSeconds: 60 * 60, dailyLimit: 25 },
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

export type RateLimitInput = {
  uid: string;
  policy: RateLimitPolicy;
  idempotencyKey?: string;
  now?: Date;
};

export type RateLimitResult = {
  remainingBurst: number;
  remainingDaily: number;
  reused: boolean;
};

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
  input: RateLimitInput,
): Promise<RateLimitResult> {
  return (await consumeRateLimits(database, [input]))[0];
}

export async function consumeRateLimits(
  database: Firestore,
  inputs: readonly RateLimitInput[],
): Promise<RateLimitResult[]> {
  if (inputs.length === 0) return [];

  const batchNow = new Date();
  const entries = inputs.map((input) => {
    const nowMs = (input.now ?? batchNow).getTime();
    const burstMs = input.policy.burstWindowSeconds * 1000;
    const burstStart = Math.floor(nowMs / burstMs) * burstMs;
    const now = new Date(nowMs);
    const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const principal = digest(`${input.policy.name}:${input.uid}`);
    return {
      input,
      nowMs,
      burstMs,
      burstStart,
      burstRef: database.collection("rateLimitCounters").doc(`${principal}_burst_${burstStart}`),
      dayRef: database.collection("rateLimitCounters").doc(`${principal}_day_${dayStart}`),
      actionRef: input.idempotencyKey
        ? database.collection("rateLimitActions").doc(
            digest(`${input.policy.name}:${input.uid}:${input.idempotencyKey}`),
          )
        : null,
    };
  });

  return database.runTransaction(async (transaction) => {
    const states = [];
    for (const entry of entries) {
      const burstSnapshot = await transaction.get(entry.burstRef);
      const daySnapshot = await transaction.get(entry.dayRef);
      const actionSnapshot = entry.actionRef ? await transaction.get(entry.actionRef) : null;
      states.push({
        ...entry,
        burstCount: countOf(burstSnapshot.data() as Counter | undefined),
        dayCount: countOf(daySnapshot.data() as Counter | undefined),
        reused: actionSnapshot?.exists === true,
      });
    }

    for (const state of states) {
      if (state.reused) continue;
      if (
        state.burstCount >= state.input.policy.burstLimit ||
        state.dayCount >= state.input.policy.dailyLimit
      ) {
        const retryAt = state.burstCount >= state.input.policy.burstLimit
          ? state.burstStart + state.burstMs
          : nextUtcDay(state.nowMs);
        throw new RateLimitError(Math.max(1, Math.ceil((retryAt - state.nowMs) / 1000)));
      }
    }

    return states.map((state) => {
      if (state.reused) {
        return {
          remainingBurst: Math.max(0, state.input.policy.burstLimit - state.burstCount),
          remainingDaily: Math.max(0, state.input.policy.dailyLimit - state.dayCount),
          reused: true,
        };
      }

      transaction.set(state.burstRef, {
        policy: state.input.policy.name,
        count: FieldValue.increment(1),
        window: "burst",
        expiresAt: Timestamp.fromMillis(state.burstStart + state.burstMs * 2),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(state.dayRef, {
        policy: state.input.policy.name,
        count: FieldValue.increment(1),
        window: "day",
        expiresAt: Timestamp.fromMillis(nextUtcDay(state.nowMs) + 24 * 60 * 60 * 1000),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      if (state.actionRef) {
        transaction.create(state.actionRef, {
          policy: state.input.policy.name,
          expiresAt: Timestamp.fromMillis(nextUtcDay(state.nowMs) + 24 * 60 * 60 * 1000),
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      return {
        remainingBurst: state.input.policy.burstLimit - state.burstCount - 1,
        remainingDaily: state.input.policy.dailyLimit - state.dayCount - 1,
        reused: false,
      };
    });
  });
}
