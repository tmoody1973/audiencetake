import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { AuthenticationError, verifyAuthenticatedRequest } from "@/lib/auth/verify-request";
import { evidenceReviewInputSchema } from "@/lib/evidence/contract";
import { EvidenceError } from "@/lib/evidence/errors";
import { readEvidenceJson } from "@/lib/evidence/http";
import { createFirestoreEvidenceStore, type EvidenceStore } from "@/lib/evidence/store";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { AuthorizationError, requireAdmin } from "@/lib/trust/authorization";

const suggestionIdSchema = z.string().regex(/^[a-f0-9]{64}$/);

type RouteDependencies = {
  verifyRequest?: typeof verifyAuthenticatedRequest;
  authorizeAdmin?: (uid: string) => Promise<void>;
  store?: EvidenceStore;
};

export async function handleEvidenceReviewPatch(
  request: Request,
  suggestionIdValue: string,
  dependencies: RouteDependencies = {},
) {
  try {
    const { user } = await (dependencies.verifyRequest ?? verifyAuthenticatedRequest)(request);
    const database =
      !dependencies.authorizeAdmin || !dependencies.store ? getAdminFirestore() : null;
    await (
      dependencies.authorizeAdmin ??
      ((uid) => requireAdmin(database!, uid).then(() => undefined))
    )(user.uid);
    const suggestionId = suggestionIdSchema.safeParse(suggestionIdValue);
    const review = evidenceReviewInputSchema.safeParse(await readEvidenceJson(request));
    if (!suggestionId.success || !review.success) {
      return fail(
        {
          code: "invalid_evidence_review",
          message: "Check the review outcome and source details.",
          ...(review.success ? {} : { fields: z.flattenError(review.error).fieldErrors }),
        },
        400,
      );
    }
    const store = dependencies.store ?? createFirestoreEvidenceStore(database!);
    return ok(await store.review(suggestionId.data, user.uid, review.data));
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return fail({ code: error.code, message: error.message }, 401);
    }
    if (error instanceof AuthorizationError) {
      return fail({ code: error.code, message: error.message }, 403);
    }
    if (error instanceof EvidenceError) {
      return fail({ code: error.code, message: error.message }, error.status);
    }
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") {
      return fail({ code: "request_too_large", message: "That evidence review is too large." }, 413);
    }
    if (error instanceof Error && error.message === "INVALID_JSON") {
      return fail({ code: "invalid_json", message: "Send valid JSON." }, 400);
    }
    return fail(
      { code: "evidence_review_failed", message: "We could not save that evidence review right now." },
      500,
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ suggestionId: string }> },
) {
  const { suggestionId } = await params;
  return handleEvidenceReviewPatch(request, suggestionId);
}
