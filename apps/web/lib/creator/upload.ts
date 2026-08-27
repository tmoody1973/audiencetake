import { createHash } from "node:crypto";

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { Storage } from "firebase-admin/storage";

import { CreatorError } from "./store";

// Vercel Functions cap request bodies at 4.5 MB. Leave room for multipart
// framing while retaining the server-side magic-byte and checksum boundary.
export const MAX_CREATOR_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export const ALLOWED_RASTER_IMAGES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type AllowedRasterMime = keyof typeof ALLOWED_RASTER_IMAGES;
type MediaData = Record<string, unknown>;

function prefixMatches(bytes: Uint8Array, prefix: number[]) {
  return prefix.every((value, index) => bytes[index] === value);
}

export function detectRasterMime(bytes: Uint8Array): AllowedRasterMime | null {
  if (bytes.length >= 3 && prefixMatches(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    prefixMatches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    prefixMatches(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    prefixMatches(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])
  ) {
    return "image/webp";
  }
  return null;
}

export function validateRasterUpload(file: Pick<File, "type" | "size">, bytes: Uint8Array) {
  if (!(file.type in ALLOWED_RASTER_IMAGES)) {
    throw new CreatorError("unsupported_media_type", "Upload a JPEG, PNG, or WebP image.", 415);
  }
  if (file.size < 1 || file.size > MAX_CREATOR_UPLOAD_BYTES || bytes.byteLength !== file.size) {
    throw new CreatorError(
      "upload_too_large",
      `Images must be no larger than ${MAX_CREATOR_UPLOAD_BYTES / 1024 / 1024} MB.`,
      413,
    );
  }
  const detected = detectRasterMime(bytes);
  if (detected !== file.type) {
    throw new CreatorError("media_signature_mismatch", "The image contents do not match its media type.", 415);
  }
  return detected;
}

export function creatorMediaId(creatorUid: string, projectId: string, requestId: string) {
  return createHash("sha256")
    .update(`creator-upload:v1\0${creatorUid}\0${projectId}\0${requestId}`)
    .digest("hex");
}

export function publicStorageUrl(bucketName: string, storagePath: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(storagePath)}?alt=media`;
}

type UploadDependencies = {
  database: Firestore;
  storage: Storage;
};

type ValidatedUpload = {
  mediaId: string;
  projectId: string;
  creatorUid: string;
  requestId: string;
  storagePath: string;
  url: string;
  mimeType: AllowedRasterMime;
  sizeBytes: number;
  sha256: string;
};

function matchingUpload(existing: MediaData, upload: ValidatedUpload) {
  return (
    existing.mediaId === upload.mediaId &&
    existing.projectId === upload.projectId &&
    existing.creatorUid === upload.creatorUid &&
    existing.requestId === upload.requestId &&
    existing.storagePath === upload.storagePath &&
    existing.mimeType === upload.mimeType &&
    existing.sizeBytes === upload.sizeBytes &&
    existing.sha256 === upload.sha256
  );
}

function uploadResult(upload: ValidatedUpload, reused: boolean) {
  return {
    mediaId: upload.mediaId,
    projectId: upload.projectId,
    url: upload.url,
    mimeType: upload.mimeType,
    sizeBytes: upload.sizeBytes,
    sha256: upload.sha256,
    reused,
  };
}

export async function saveCreatorUpload(
  input: {
    projectId: string;
    creatorUid: string;
    requestId: string;
    file: Pick<File, "type" | "size" | "arrayBuffer">;
  },
  dependencies: UploadDependencies,
) {
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const mimeType = validateRasterUpload(input.file, bytes);
  const extension = ALLOWED_RASTER_IMAGES[mimeType];
  const mediaId = creatorMediaId(input.creatorUid, input.projectId, input.requestId);
  const storagePath = `public/projects/${input.projectId}/creator-media/${mediaId}.${extension}`;
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const bucket = dependencies.storage.bucket();
  const upload: ValidatedUpload = {
    mediaId,
    projectId: input.projectId,
    creatorUid: input.creatorUid,
    requestId: input.requestId,
    storagePath,
    url: publicStorageUrl(bucket.name, storagePath),
    mimeType,
    sizeBytes: bytes.byteLength,
    sha256: checksum,
  };
  const mediaRef = dependencies.database.collection("creatorMedia").doc(mediaId);

  const alreadyAvailable = await dependencies.database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(mediaRef);
    if (snapshot.exists) {
      const existing = (snapshot.data() ?? {}) as MediaData;
      if (!matchingUpload(existing, upload)) {
        throw new CreatorError(
          "upload_idempotency_conflict",
          "That upload request ID was already used for different content.",
          409,
        );
      }
      if (existing.status === "available") return true;
      if (existing.status === "uploading") return false;
      throw new CreatorError("media_unavailable", "That upload cannot be resumed.", 409);
    }
    transaction.create(mediaRef, {
      ...upload,
      status: "uploading",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return false;
  });

  if (alreadyAvailable) return uploadResult(upload, true);

  const object = bucket.file(storagePath);
  await object.save(Buffer.from(bytes), {
    resumable: false,
    validation: "crc32c",
    contentType: mimeType,
    metadata: {
      cacheControl: "public,max-age=31536000,immutable",
      metadata: {
        projectId: input.projectId,
        sha256: checksum,
      },
    },
  });

  await dependencies.database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(mediaRef);
    const existing = (snapshot.data() ?? {}) as MediaData;
    if (!snapshot.exists || !matchingUpload(existing, upload)) {
      throw new CreatorError(
        "upload_idempotency_conflict",
        "That upload request ID no longer matches this content.",
        409,
      );
    }
    transaction.set(
      mediaRef,
      {
        status: "available",
        availableAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  return uploadResult(upload, false);
}
