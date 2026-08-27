import type { Firestore } from "firebase-admin/firestore";
import type { Storage } from "firebase-admin/storage";
import { describe, expect, it, vi } from "vitest";

import {
  creatorMediaId,
  detectRasterMime,
  MAX_CREATOR_UPLOAD_BYTES,
  publicStorageUrl,
  saveCreatorUpload,
  validateRasterUpload,
} from "./upload";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);

describe("creator upload validation", () => {
  it("recognizes only allowlisted raster signatures", () => {
    expect(detectRasterMime(jpeg)).toBe("image/jpeg");
    expect(detectRasterMime(png)).toBe("image/png");
    expect(detectRasterMime(webp)).toBe("image/webp");
    expect(detectRasterMime(new TextEncoder().encode("<svg></svg>"))).toBeNull();
  });

  it("rejects MIME spoofing, active formats, and oversized payloads", () => {
    expect(() => validateRasterUpload({ type: "image/jpeg", size: png.length }, png)).toThrowError(
      expect.objectContaining({ code: "media_signature_mismatch" }),
    );
    expect(() => validateRasterUpload({ type: "image/svg+xml", size: 8 }, png)).toThrowError(
      expect.objectContaining({ code: "unsupported_media_type" }),
    );
    expect(() =>
      validateRasterUpload(
        { type: "image/png", size: MAX_CREATOR_UPLOAD_BYTES + 1 },
        new Uint8Array(1),
      ),
    ).toThrowError(expect.objectContaining({ code: "upload_too_large" }));
  });

  it("uses a server-generated path and stores checksum metadata", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const fileAt = vi.fn((path: string) => ({ save, path }));
    const bucket = { name: "audience-take.appspot.com", file: fileAt };
    const storage = { bucket: () => bucket } as unknown as Storage;
    const rows = new Map<string, Record<string, unknown>>();
    const database = {
      collection: (collection: string) => ({
        doc: (id: string) => ({ path: `${collection}/${id}` }),
      }),
      runTransaction: async (work: (transaction: {
        get: (ref: { path: string }) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
        create: (ref: { path: string }, data: Record<string, unknown>) => void;
        set: (ref: { path: string }, data: Record<string, unknown>, options?: { merge?: boolean }) => void;
      }) => Promise<unknown>) => work({
        get: async (ref) => ({ exists: rows.has(ref.path), data: () => rows.get(ref.path) }),
        create: (ref, data) => rows.set(ref.path, data),
        set: (ref, data, options) => rows.set(
          ref.path,
          options?.merge ? { ...(rows.get(ref.path) ?? {}), ...data } : data,
        ),
      }),
    } as unknown as Firestore;
    const maliciousFile = {
      name: "../../admin.svg",
      type: "image/png",
      size: png.length,
      arrayBuffer: async () => png.buffer,
    };

    const requestId = "5c043f46-e690-4d4e-9f3e-9f38855f4870";
    const mediaId = creatorMediaId("creator-1", "project-1", requestId);
    const result = await saveCreatorUpload(
      { projectId: "project-1", creatorUid: "creator-1", requestId, file: maliciousFile },
      { database, storage },
    );

    const expectedPath = `public/projects/project-1/creator-media/${mediaId}.png`;
    expect(fileAt).toHaveBeenCalledWith(expectedPath);
    expect(fileAt.mock.calls[0]?.[0]).not.toContain("admin.svg");
    expect(save).toHaveBeenCalledWith(
      Buffer.from(png),
      expect.objectContaining({
        resumable: false,
        contentType: "image/png",
        metadata: expect.objectContaining({
          metadata: expect.objectContaining({
            projectId: "project-1",
            sha256: result.sha256,
          }),
        }),
      }),
    );
    expect(rows.get(`creatorMedia/${mediaId}`)).toMatchObject({
      mediaId,
      creatorUid: "creator-1",
      requestId,
      storagePath: expectedPath,
      sha256: result.sha256,
      status: "available",
    });
    expect(result.url).toBe(
      publicStorageUrl("audience-take.appspot.com", expectedPath),
    );
    expect(result.reused).toBe(false);

    const retried = await saveCreatorUpload(
      { projectId: "project-1", creatorUid: "creator-1", requestId, file: maliciousFile },
      { database, storage },
    );
    expect(retried).toMatchObject({ mediaId, reused: true });
    expect(save).toHaveBeenCalledTimes(1);

    await expect(
      saveCreatorUpload(
        {
          projectId: "project-1",
          creatorUid: "creator-1",
          requestId,
          file: { type: "image/jpeg", size: jpeg.length, arrayBuffer: async () => jpeg.buffer },
        },
        { database, storage },
      ),
    ).rejects.toMatchObject({ code: "upload_idempotency_conflict", status: 409 });
    expect(save).toHaveBeenCalledTimes(1);
  });
});
