import { z } from "zod";

import { fail } from "@/lib/api/response";
import { AuthenticationError } from "@/lib/auth/verify-request";
import { AuthorizationError } from "@/lib/trust/authorization";
import { RateLimitError } from "@/lib/trust/rate-limit";

import { CreatorError } from "./store";

const MAX_JSON_BYTES = 16_384;

export async function readCreatorJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    throw new CreatorError("request_too_large", "That request is too large.", 413);
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
    throw new CreatorError("request_too_large", "That request is too large.", 413);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CreatorError("invalid_json", "Send valid JSON.", 400);
  }
}

export function invalidCreatorInput(code: string, message: string, error: z.ZodError) {
  return fail({ code, message, fields: z.flattenError(error).fieldErrors }, 400);
}

export function creatorFailure(error: unknown, fallbackCode: string, fallbackMessage: string) {
  if (error instanceof AuthenticationError) {
    return fail({ code: error.code, message: error.message }, 401);
  }
  if (error instanceof AuthorizationError) {
    return fail({ code: error.code, message: error.message }, 403);
  }
  if (error instanceof RateLimitError) {
    const response = fail({ code: error.code, message: error.message }, 429);
    response.headers.set("Retry-After", String(error.retryAfterSeconds));
    return response;
  }
  if (error instanceof CreatorError) {
    return fail({ code: error.code, message: error.message }, error.status);
  }
  return fail({ code: fallbackCode, message: fallbackMessage }, 500);
}
