import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok } from "@/lib/api/response";
import { verifyAuthenticatedRequest } from "@/lib/auth/verify-request";
import { projectIdSchema } from "@/lib/creator/contract";
import { creatorFailure } from "@/lib/creator/route";
import { CreatorError } from "@/lib/creator/store";
import {
  MAX_CREATOR_UPLOAD_BYTES,
  MAX_MULTIPART_OVERHEAD_BYTES,
  saveCreatorUpload,
} from "@/lib/creator/upload";
import { getAdminFirestore, getAdminStorage } from "@/lib/firebase/admin";
import { requireProjectManager } from "@/lib/trust/authorization";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/trust/rate-limit";

type UploadSaver = typeof saveCreatorUpload;

type Dependencies = {
  verifyRequest?: typeof verifyAuthenticatedRequest;
  authorize?: typeof requireProjectManager;
  rateLimit?: typeof consumeRateLimit;
  save?: UploadSaver;
};

function isFile(value: FormDataEntryValue | null): value is File {
  return Boolean(
    value &&
      typeof value === "object" &&
      "arrayBuffer" in value &&
      typeof value.arrayBuffer === "function" &&
      "size" in value &&
      "type" in value,
  );
}

function readUploadEnvelope(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    throw new CreatorError("invalid_upload", "Send the image as multipart form data.", 415);
  }
  const declaredLength = Number(request.headers.get("content-length"));
  const maximumLength = MAX_CREATOR_UPLOAD_BYTES + MAX_MULTIPART_OVERHEAD_BYTES;
  if (!Number.isFinite(declaredLength) || declaredLength <= 0) {
    throw new CreatorError("upload_length_required", "A bounded upload length is required.", 411);
  }
  if (declaredLength > maximumLength) {
    throw new CreatorError("upload_too_large", "That upload is too large.", 413);
  }

  const url = new URL(request.url);
  const rawProjectId =
    request.headers.get("x-audience-take-project-id") ?? url.searchParams.get("projectId");
  const rawRequestId =
    request.headers.get("x-idempotency-key") ?? url.searchParams.get("requestId");
  const validProjectId = projectIdSchema.safeParse(rawProjectId);
  const validRequestId = z.uuid().safeParse(rawRequestId);
  if (!validProjectId.success) {
    throw new CreatorError("invalid_project", "That project is not valid.", 400);
  }
  if (!validRequestId.success) {
    throw new CreatorError("invalid_upload_request_id", "A UUID upload request ID is required.", 400);
  }
  return { projectId: validProjectId.data, requestId: validRequestId.data };
}

async function readUploadFile(
  request: NextRequest,
  envelope: { projectId: string; requestId: string },
) {
  const form = await request.formData();
  if (
    [...form.keys()].some(
      (key) => key !== "projectId" && key !== "requestId" && key !== "file",
    )
  ) {
    throw new CreatorError("invalid_upload", "The upload contains unsupported fields.", 400);
  }
  const file = form.get("file");
  if (!isFile(file)) {
    throw new CreatorError("invalid_upload", "Choose an image to upload.", 400);
  }
  const bodyProjectId = form.get("projectId");
  const bodyRequestId = form.get("requestId");
  if (typeof bodyProjectId === "string" && bodyProjectId !== envelope.projectId) {
    throw new CreatorError("upload_metadata_mismatch", "The upload project does not match.", 400);
  }
  if (typeof bodyRequestId === "string" && bodyRequestId !== envelope.requestId) {
    throw new CreatorError("upload_metadata_mismatch", "The upload request ID does not match.", 400);
  }
  return file;
}

export async function handleUploadPost(request: NextRequest, dependencies: Dependencies = {}) {
  try {
    const { user } = await (dependencies.verifyRequest ?? verifyAuthenticatedRequest)(request);
    const envelope = readUploadEnvelope(request);
    const database = getAdminFirestore();
    await (dependencies.authorize ?? requireProjectManager)(database, user.uid, envelope.projectId);
    await (dependencies.rateLimit ?? consumeRateLimit)(database, {
      uid: user.uid,
      policy: RATE_LIMITS.upload,
      idempotencyKey: `${envelope.projectId}:${envelope.requestId}`,
    });
    const file = await readUploadFile(request, envelope);
    const save = dependencies.save ?? saveCreatorUpload;
    return ok(
      await save(
        { ...envelope, creatorUid: user.uid, file },
        { database, storage: getAdminStorage() },
      ),
    );
  } catch (error) {
    return creatorFailure(error, "upload_failed", "We could not upload that image.");
  }
}

export async function POST(request: NextRequest) {
  return handleUploadPost(request);
}
