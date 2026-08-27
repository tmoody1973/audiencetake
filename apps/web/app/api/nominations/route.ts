import type { Firestore } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { AuthenticationError, verifyAuthenticatedRequest } from "@/lib/auth/verify-request";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { nominationInputSchema } from "@/lib/nomination/contract";
import { acceptNomination, type ResearchDispatcher } from "@/lib/nomination/service";
import { createFirestoreNominationStore, type NominationStore } from "@/lib/nomination/store";
import { UnsafeUrlError, type SafeUrlPolicy } from "@/lib/nomination/url-policy";
import { createCloudTasksResearchDispatcher } from "@/lib/tasks/cloud-tasks";
import { consumeRateLimit, RATE_LIMITS, RateLimitError } from "@/lib/trust/rate-limit";

const MAX_BODY_BYTES = 16_384;

type RouteDependencies = {
  verifyRequest?: typeof verifyAuthenticatedRequest;
  database?: Firestore;
  consumeLimit?: typeof consumeRateLimit;
  store?: NominationStore;
  dispatch?: ResearchDispatcher;
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

async function readBoundedJson(request: NextRequest): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new Error("BODY_TOO_LARGE");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new Error("BODY_TOO_LARGE");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("INVALID_JSON");
  }
}

export async function handleNominationPost(request: NextRequest, dependencies: RouteDependencies = {}) {
  try {
    const { user } = await (dependencies.verifyRequest ?? verifyAuthenticatedRequest)(request);
    const parsed = nominationInputSchema.safeParse(await readBoundedJson(request));
    if (!parsed.success) {
      return fail(
        {
          code: "invalid_nomination",
          message: "Check the nomination fields and try again.",
          fields: z.flattenError(parsed.error).fieldErrors,
        },
        400,
      );
    }

    const database = dependencies.database ??
      (!dependencies.store || dependencies.consumeLimit ? getAdminFirestore() : null);
    if (dependencies.consumeLimit || !dependencies.store) {
      await (dependencies.consumeLimit ?? consumeRateLimit)(database!, {
        uid: user.uid,
        policy: RATE_LIMITS.nomination,
        idempotencyKey: parsed.data.submittedUrl,
      });
    }
    const result = await acceptNomination(parsed.data, user.uid, {
      store: dependencies.store ?? createFirestoreNominationStore(database!),
      dispatch: dependencies.dispatch ?? ((job) => createCloudTasksResearchDispatcher()(job)),
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
    if (error instanceof RateLimitError) {
      const response = fail({ code: error.code, message: error.message }, 429);
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
      return response;
    }
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") {
      return fail({ code: "request_too_large", message: "That nomination is too large." }, 413);
    }
    if (error instanceof Error && error.message === "INVALID_JSON") {
      return fail({ code: "invalid_json", message: "Send a valid JSON nomination." }, 400);
    }
    return fail(
      { code: "nomination_failed", message: "We could not accept this nomination right now." },
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  return handleNominationPost(request);
}
