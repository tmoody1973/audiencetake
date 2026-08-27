import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/response";
import { verifyAuthenticatedRequest } from "@/lib/auth/verify-request";
import { claimReviewSchema } from "@/lib/creator/contract";
import { creatorFailure, invalidCreatorInput, readCreatorJson } from "@/lib/creator/route";
import { createCreatorStore, type CreatorStore } from "@/lib/creator/store";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/trust/authorization";

type Dependencies = {
  verifyRequest?: typeof verifyAuthenticatedRequest;
  store?: CreatorStore;
  authorize?: typeof requireAdmin;
};

export async function handleClaimReviewPatch(
  request: NextRequest,
  claimId: string,
  dependencies: Dependencies = {},
) {
  try {
    const { user } = await (dependencies.verifyRequest ?? verifyAuthenticatedRequest)(request);
    const parsed = claimReviewSchema.safeParse(await readCreatorJson(request));
    if (!parsed.success) {
      return invalidCreatorInput("invalid_claim_review", "Check the review fields.", parsed.error);
    }
    if (!claimId || claimId.length > 320 || claimId.includes("/")) {
      return fail({ code: "invalid_claim", message: "That claim request is not valid." }, 400);
    }
    const database = getAdminFirestore();
    await (dependencies.authorize ?? requireAdmin)(database, user.uid);
    const store = dependencies.store ?? createCreatorStore(database);
    return ok(await store.reviewClaim(claimId, user.uid, parsed.data));
  } catch (error) {
    return creatorFailure(error, "claim_review_failed", "We could not review that claim request.");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ claimId: string }> },
) {
  const { claimId } = await params;
  return handleClaimReviewPatch(request, claimId);
}
