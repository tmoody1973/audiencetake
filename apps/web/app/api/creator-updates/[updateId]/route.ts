import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/response";
import { verifyAuthenticatedRequest } from "@/lib/auth/verify-request";
import { creatorUpdateInputSchema } from "@/lib/creator/contract";
import { creatorFailure, invalidCreatorInput, readCreatorJson } from "@/lib/creator/route";
import { createCreatorStore, type CreatorStore } from "@/lib/creator/store";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/trust/rate-limit";

type Dependencies = {
  verifyRequest?: typeof verifyAuthenticatedRequest;
  store?: CreatorStore;
  rateLimit?: typeof consumeRateLimit;
};

function validUpdateId(updateId: string) {
  return updateId.length > 0 && updateId.length <= 160 && !updateId.includes("/");
}

export async function handleCreatorUpdatePatch(
  request: NextRequest,
  updateId: string,
  dependencies: Dependencies = {},
) {
  try {
    if (!validUpdateId(updateId)) {
      return fail(
        { code: "invalid_creator_update", message: "That creator update is not valid." },
        400,
      );
    }
    const { user } = await (dependencies.verifyRequest ?? verifyAuthenticatedRequest)(request);
    const parsed = creatorUpdateInputSchema.safeParse(await readCreatorJson(request));
    if (!parsed.success) {
      return invalidCreatorInput("invalid_creator_update", "Check the update fields.", parsed.error);
    }
    const database = getAdminFirestore();
    await (dependencies.rateLimit ?? consumeRateLimit)(database, {
      uid: user.uid,
      policy: RATE_LIMITS.creatorUpdate,
    });
    const store = dependencies.store ?? createCreatorStore(database);
    return ok(await store.editUpdate(updateId, user.uid, parsed.data));
  } catch (error) {
    return creatorFailure(error, "creator_update_failed", "We could not edit that creator update.");
  }
}

export async function handleCreatorUpdateDelete(
  request: NextRequest,
  updateId: string,
  dependencies: Dependencies = {},
) {
  try {
    if (!validUpdateId(updateId)) {
      return fail(
        { code: "invalid_creator_update", message: "That creator update is not valid." },
        400,
      );
    }
    const { user } = await (dependencies.verifyRequest ?? verifyAuthenticatedRequest)(request);
    const database = getAdminFirestore();
    await (dependencies.rateLimit ?? consumeRateLimit)(database, {
      uid: user.uid,
      policy: RATE_LIMITS.creatorUpdate,
      idempotencyKey: `withdraw:${updateId}`,
    });
    const store = dependencies.store ?? createCreatorStore(database);
    return ok(await store.withdrawUpdate(updateId, user.uid));
  } catch (error) {
    return creatorFailure(error, "creator_update_failed", "We could not withdraw that creator update.");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ updateId: string }> },
) {
  const { updateId } = await params;
  return handleCreatorUpdatePatch(request, updateId);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ updateId: string }> },
) {
  const { updateId } = await params;
  return handleCreatorUpdateDelete(request, updateId);
}
