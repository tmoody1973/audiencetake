import type { NextRequest } from "next/server";

import { ok } from "@/lib/api/response";
import { verifyAuthenticatedRequest } from "@/lib/auth/verify-request";
import { claimRequestInputSchema, projectIdSchema } from "@/lib/creator/contract";
import { creatorFailure, invalidCreatorInput, readCreatorJson } from "@/lib/creator/route";
import { createCreatorStore, type CreatorStore } from "@/lib/creator/store";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/trust/rate-limit";

type Dependencies = {
  verifyRequest?: typeof verifyAuthenticatedRequest;
  store?: CreatorStore;
  rateLimit?: typeof consumeRateLimit;
};

export async function handleClaimRequestPost(
  request: NextRequest,
  projectId: string,
  dependencies: Dependencies = {},
) {
  try {
    const validProjectId = projectIdSchema.safeParse(projectId);
    if (!validProjectId.success) {
      return invalidCreatorInput("invalid_project", "That project is not valid.", validProjectId.error);
    }
    const { user } = await (dependencies.verifyRequest ?? verifyAuthenticatedRequest)(request);
    const parsed = claimRequestInputSchema.safeParse(await readCreatorJson(request));
    if (!parsed.success) {
      return invalidCreatorInput("invalid_claim_request", "Check the claim fields.", parsed.error);
    }
    const database = getAdminFirestore();
    await (dependencies.rateLimit ?? consumeRateLimit)(database, {
      uid: user.uid,
      policy: RATE_LIMITS.claimRequest,
      idempotencyKey: validProjectId.data,
    });
    const store = dependencies.store ?? createCreatorStore(database);
    return ok(await store.submitClaim(validProjectId.data, user.uid, parsed.data));
  } catch (error) {
    return creatorFailure(error, "claim_request_failed", "We could not submit that claim request.");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  return handleClaimRequestPost(request, projectId);
}
