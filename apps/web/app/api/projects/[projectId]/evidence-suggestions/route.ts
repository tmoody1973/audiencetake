import type { Firestore } from "firebase-admin/firestore";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { AuthenticationError, verifyAuthenticatedRequest } from "@/lib/auth/verify-request";
import { evidenceSuggestionInputSchema } from "@/lib/evidence/contract";
import { EvidenceError } from "@/lib/evidence/errors";
import { readEvidenceJson } from "@/lib/evidence/http";
import { suggestEvidence } from "@/lib/evidence/service";
import { createFirestoreEvidenceStore, type EvidenceStore } from "@/lib/evidence/store";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { UnsafeUrlError, type SafeUrlPolicy } from "@/lib/nomination/url-policy";
import { consumeRateLimit, RATE_LIMITS, RateLimitError } from "@/lib/trust/rate-limit";

const projectIdSchema = z.string().trim().min(1).max(180).regex(/^[A-Za-z0-9_-]+$/);

type RouteDependencies = {
  verifyRequest?: typeof verifyAuthenticatedRequest;
  database?: Firestore;
  consumeLimit?: typeof consumeRateLimit;
  store?: EvidenceStore;
  urlPolicy?: SafeUrlPolicy;
};

function allowedHttpHosts(): ReadonlySet<string> {
  return new Set(
    (process.env.NOMINATION_ALLOWED_HTTP_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function handleEvidenceSuggestionPost(
  request: Request,
  projectIdValue: string,
  dependencies: RouteDependencies = {},
) {
  try {
    const { user } = await (dependencies.verifyRequest ?? verifyAuthenticatedRequest)(request);
    const projectId = projectIdSchema.safeParse(projectIdValue);
    const input = evidenceSuggestionInputSchema.safeParse(await readEvidenceJson(request));
    if (!projectId.success || !input.success) {
      return fail(
        {
          code: "invalid_evidence_suggestion",
          message: "Check the evidence URL and note, then try again.",
          ...(input.success ? {} : { fields: z.flattenError(input.error).fieldErrors }),
        },
        400,
      );
    }
    const database = dependencies.database ??
      (!dependencies.store || dependencies.consumeLimit ? getAdminFirestore() : null);
    if (dependencies.consumeLimit || !dependencies.store) {
      await (dependencies.consumeLimit ?? consumeRateLimit)(database!, {
        uid: user.uid,
        policy: RATE_LIMITS.evidenceSuggestion,
        idempotencyKey: `${projectId.data}:${input.data.url}`,
      });
    }
    const result = await suggestEvidence(projectId.data, user.uid, input.data, {
      store: dependencies.store ?? createFirestoreEvidenceStore(database!),
      urlPolicy: dependencies.urlPolicy ?? { allowedHttpHosts: allowedHttpHosts() },
    });
    return ok(result);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return fail({ code: error.code, message: error.message }, 401);
    }
    if (error instanceof UnsafeUrlError) {
      return fail({ code: error.code, message: error.message }, 400);
    }
    if (error instanceof EvidenceError) {
      return fail({ code: error.code, message: error.message }, error.status);
    }
    if (error instanceof RateLimitError) {
      const response = fail({ code: error.code, message: error.message }, 429);
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
      return response;
    }
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") {
      return fail({ code: "request_too_large", message: "That evidence suggestion is too large." }, 413);
    }
    if (error instanceof Error && error.message === "INVALID_JSON") {
      return fail({ code: "invalid_json", message: "Send valid JSON." }, 400);
    }
    return fail(
      { code: "evidence_suggestion_failed", message: "We could not save that evidence lead right now." },
      500,
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  return handleEvidenceSuggestionPost(request, projectId);
}
