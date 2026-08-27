import type { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { RateLimitError } from "@/lib/trust/rate-limit";

import { handleUploadPost } from "./handler";

const requestId = "5c043f46-e690-4d4e-9f3e-9f38855f4870";

function uploadRequest(options: { contentLength?: number } = {}) {
  const file = {
    type: "image/png",
    size: 8,
    arrayBuffer: async () => new ArrayBuffer(8),
  };
  const form = {
    keys: () => ["file"].values(),
    get: (key: string) => key === "file" ? file : null,
  } as unknown as FormData;
  const formData = vi.fn().mockResolvedValue(form);
  const request = {
    url: `http://localhost/api/uploads?projectId=project-1&requestId=${requestId}`,
    headers: new Headers({
      "content-type": "multipart/form-data; boundary=test",
      "content-length": String(options.contentLength ?? 512),
    }),
    formData,
  } as unknown as NextRequest;
  return { request, formData };
}

describe("POST /api/uploads ordering", () => {
  it("authorizes and consumes an idempotent rate limit before multipart parsing", async () => {
    const { request, formData } = uploadRequest();
    const verifyRequest = vi.fn().mockResolvedValue({ user: { uid: "creator-1" } });
    const authorize = vi.fn().mockResolvedValue({ roles: { approvedCreator: true } });
    const rateLimit = vi.fn().mockResolvedValue({ reused: false });
    const save = vi.fn().mockResolvedValue({ mediaId: "media-1", reused: false });

    const response = await handleUploadPost(request, { verifyRequest, authorize, rateLimit, save });

    expect(response.status).toBe(200);
    expect(authorize).toHaveBeenCalledWith(expect.anything(), "creator-1", "project-1");
    expect(rateLimit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ uid: "creator-1", idempotencyKey: `project-1:${requestId}` }),
    );
    expect(authorize.mock.invocationCallOrder[0]).toBeLessThan(rateLimit.mock.invocationCallOrder[0]!);
    expect(rateLimit.mock.invocationCallOrder[0]).toBeLessThan(formData.mock.invocationCallOrder[0]!);
    expect(formData.mock.invocationCallOrder[0]).toBeLessThan(save.mock.invocationCallOrder[0]!);
  });

  it("rejects an oversized declared body before authorization or parsing", async () => {
    const { request, formData } = uploadRequest({ contentLength: 6 * 1024 * 1024 });
    const authorize = vi.fn();
    const rateLimit = vi.fn();
    const response = await handleUploadPost(request, {
      verifyRequest: vi.fn().mockResolvedValue({ user: { uid: "creator-1" } }),
      authorize,
      rateLimit,
      save: vi.fn(),
    });
    expect(response.status).toBe(413);
    expect(authorize).not.toHaveBeenCalled();
    expect(rateLimit).not.toHaveBeenCalled();
    expect(formData).not.toHaveBeenCalled();
  });

  it("does not parse a rate-limited multipart body", async () => {
    const { request, formData } = uploadRequest();
    const response = await handleUploadPost(request, {
      verifyRequest: vi.fn().mockResolvedValue({ user: { uid: "creator-1" } }),
      authorize: vi.fn().mockResolvedValue({}),
      rateLimit: vi.fn().mockRejectedValue(new RateLimitError(30)),
      save: vi.fn(),
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(formData).not.toHaveBeenCalled();
  });
});
