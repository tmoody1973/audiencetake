// Route implementation lives outside route.ts so Next.js sees only supported exports.
import type { Firestore } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { AuthenticationError, verifyAuthenticatedRequest } from "@/lib/auth/verify-request";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { reportReviewSchema } from "@/lib/reports/contract";
import { readReportJson } from "@/lib/reports/route";
import { createFirestoreReportStore, ReportError, type ReportStore } from "@/lib/reports/store";
import { AuthorizationError, requireAdmin } from "@/lib/trust/authorization";

type RouteDependencies = {
  verifyRequest?: typeof verifyAuthenticatedRequest;
  database?: Firestore;
  authorizeAdmin?: typeof requireAdmin;
  store?: ReportStore;
};

type RouteContext = { params: Promise<{ reportId: string }> };

export async function handleReportReviewPatch(
  request: NextRequest,
  context: RouteContext,
  dependencies: RouteDependencies = {},
) {
  try {
    const { user } = await (dependencies.verifyRequest ?? verifyAuthenticatedRequest)(request);
    const database = dependencies.database ?? getAdminFirestore();
    await (dependencies.authorizeAdmin ?? requireAdmin)(database, user.uid);
    const { reportId } = await context.params;
    if (!/^[a-f0-9]{64}$/.test(reportId)) {
      return fail({ code: "invalid_report_id", message: "Use a valid report identifier." }, 400);
    }
    const parsed = reportReviewSchema.safeParse(await readReportJson(request));
    if (!parsed.success) {
      return fail(
        {
          code: "invalid_report_review",
          message: "Check the review fields and try again.",
          fields: z.flattenError(parsed.error).fieldErrors,
        },
        400,
      );
    }
    const store = dependencies.store ?? createFirestoreReportStore(database);
    return ok(await store.review(reportId, parsed.data, user.uid));
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return fail({ code: error.code, message: error.message }, 401);
    }
    if (error instanceof AuthorizationError) {
      return fail({ code: error.code, message: error.message }, 403);
    }
    if (error instanceof ReportError) {
      return fail({ code: error.code, message: error.message }, error.status);
    }
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") {
      return fail({ code: "request_too_large", message: "That review is too large." }, 413);
    }
    if (error instanceof Error && error.message === "INVALID_JSON") {
      return fail({ code: "invalid_json", message: "Send a valid JSON review." }, 400);
    }
    return fail({ code: "report_review_failed", message: "We could not review that report." }, 500);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleReportReviewPatch(request, context);
}
