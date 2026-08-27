import type { NextRequest } from "next/server";

import { ok } from "@/lib/api/response";
import { verifyAuthenticatedRequest } from "@/lib/auth/verify-request";
import { creatorUpdateInputSchema, projectIdSchema } from "@/lib/creator/contract";
import { creatorFailure, invalidCreatorInput, readCreatorJson } from "@/lib/creator/route";
import { createCreatorStore, type CreatorStore } from "@/lib/creator/store";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireProjectManager } from "@/lib/trust/authorization";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/trust/rate-limit";

type Dependencies = {
  verifyRequest?: typeof verifyAuthenticatedRequest;
  store?: CreatorStore;
  authorize?: typeof requireProjectManager;
  rateLimit?: typeof consumeRateLimit;
};

export async function handleCreatorUpdatePost(
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
    const parsed = creatorUpdateInputSchema.safeParse(await readCreatorJson(request));
    if (!parsed.success) {
      return invalidCreatorInput("invalid_creator_update", "Check the update fields.", parsed.error);
    }
    const database = getAdminFirestore();
    await (dependencies.authorize ?? requireProjectManager)(database, user.uid, validProjectId.data);
    await (dependencies.rateLimit ?? consumeRateLimit)(database, {
      uid: user.uid,
      policy: RATE_LIMITS.creatorUpdate,
    });
    const store = dependencies.store ?? createCreatorStore(database);
    return ok(await store.createUpdate(validProjectId.data, user.uid, parsed.data));
  } catch (error) {
    return creatorFailure(error, "creator_update_failed", "We could not publish that creator update.");
  }
}

export async function handleCreatorAccessGet(
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
    const assignment = await (dependencies.authorize ?? requireProjectManager)(
      getAdminFirestore(),
      user.uid,
      validProjectId.data,
    );
    return ok({
      projectId: validProjectId.data,
      authorized: true as const,
      demoOnly: assignment.demoOnly,
    });
  } catch (error) {
    return creatorFailure(error, "creator_access_failed", "We could not verify project access.");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  return handleCreatorUpdatePost(request, projectId);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  return handleCreatorAccessGet(request, projectId);
}
