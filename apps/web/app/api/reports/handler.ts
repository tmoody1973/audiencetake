// Route implementation lives outside route.ts so Next.js sees only supported exports.
import type { Firestore } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { AuthenticationError, verifyAuthenticatedRequest } from "@/lib/auth/verify-request";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { reportInputSchema } from "@/lib/reports/contract";
import { readReportJson } from "@/lib/reports/route";
import { createFirestoreReportStore, reportEventIdFor, reportIdFor, ReportError, type ReportStore } from "@/lib/reports/store";
import { consumeRateLimit, RATE_LIMITS, RateLimitError } from "@/lib/trust/rate-limit";

type RouteDependencies = {
  verifyRequest?: typeof verifyAuthenticatedRequest;
  database?: Firestore;
  consumeLimit?: typeof consumeRateLimit;
  store?: ReportStore;
};

export async function handleReportPost(request: NextRequest, dependencies: RouteDependencies = {}) {
  try {
    const { user } = await (dependencies.verifyRequest ?? verifyAuthenticatedRequest)(request);
    const parsed = reportInputSchema.safeParse(await readReportJson(request));
    if (!parsed.success) {
      return fail(
        {
          code: "invalid_report",
          message: "Check the report fields and try again.",
          fields: z.flattenError(parsed.error).fieldErrors,
        },
        400,
      );
    }
    const database = dependencies.database ??
      (!dependencies.store || dependencies.consumeLimit ? getAdminFirestore() : null);
    if (dependencies.consumeLimit || !dependencies.store) {
      const reportId = reportIdFor(user.uid, parsed.data.target);
      await (dependencies.consumeLimit ?? consumeRateLimit)(database!, {
        uid: user.uid,
        policy: RATE_LIMITS.report,
        idempotencyKey: reportEventIdFor(reportId, parsed.data),
      });
    }
    const store = dependencies.store ?? createFirestoreReportStore(database!);
    return ok(await store.submit(parsed.data, user.uid));
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return fail({ code: error.code, message: error.message }, 401);
    }
    if (error instanceof ReportError) {
      return fail({ code: error.code, message: error.message }, error.status);
    }
    if (error instanceof RateLimitError) {
      const response = fail({ code: error.code, message: error.message }, 429);
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
      return response;
    }
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") {
      return fail({ code: "request_too_large", message: "That report is too large." }, 413);
    }
    if (error instanceof Error && error.message === "INVALID_JSON") {
      return fail({ code: "invalid_json", message: "Send a valid JSON report." }, 400);
    }
    return fail({ code: "report_failed", message: "We could not submit that report." }, 500);
  }
}

export async function POST(request: NextRequest) {
  return handleReportPost(request);
}
