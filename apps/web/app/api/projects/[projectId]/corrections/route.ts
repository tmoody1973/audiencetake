import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { AuthenticationError, verifyAuthenticatedRequest } from "@/lib/auth/verify-request";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { AuthorizationError, requireAdmin } from "@/lib/trust/authorization";
import { correctionInputSchema, CorrectionError, recordProjectCorrection } from "@/lib/trust/corrections";

const projectIdSchema = z.string().trim().min(1).max(180).regex(/^[A-Za-z0-9_-]+$/);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { user } = await verifyAuthenticatedRequest(request);
    const { projectId: rawProjectId } = await params;
    const projectId = projectIdSchema.safeParse(rawProjectId);
    let body: unknown;
    try { body = JSON.parse(await request.text()); } catch { return fail({ code: "invalid_json", message: "Send valid JSON." }, 400); }
    const input = correctionInputSchema.safeParse(body);
    if (!projectId.success || !input.success) {
      return fail({ code: "invalid_correction", message: "Check the correction fields.", ...(input.success ? {} : { fields: z.flattenError(input.error).fieldErrors }) }, 400);
    }
    const database = getAdminFirestore();
    await requireAdmin(database, user.uid);
    return ok(await recordProjectCorrection(database, projectId.data, user.uid, input.data));
  } catch (error) {
    if (error instanceof AuthenticationError) return fail({ code: error.code, message: error.message }, 401);
    if (error instanceof AuthorizationError) return fail({ code: error.code, message: error.message }, 403);
    if (error instanceof CorrectionError) return fail({ code: error.code, message: error.message }, error.status);
    return fail({ code: "correction_failed", message: "We could not record that correction." }, 500);
  }
}
