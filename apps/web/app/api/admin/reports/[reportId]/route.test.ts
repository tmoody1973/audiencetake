import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { AuthenticationError } from "@/lib/auth/verify-request";
import type { ReportStore } from "@/lib/reports/store";
import { AuthorizationError } from "@/lib/trust/authorization";

import { handleReportReviewPatch } from "./handler";

const reportId = "a".repeat(64);

function request(body: unknown) {
  return new NextRequest(`http://localhost/api/admin/reports/${reportId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function store(): ReportStore {
  return {
    submit: vi.fn(),
    review: vi.fn().mockResolvedValue({ reportId, status: "resolved" }),
  };
}

const context = { params: Promise.resolve({ reportId }) };

describe("PATCH /api/admin/reports/[reportId]", () => {
  it("rejects unauthenticated and non-admin reviewers", async () => {
    const unauthenticated = await handleReportReviewPatch(request({ status: "reviewing" }), context, {
      verifyRequest: vi.fn().mockRejectedValue(new AuthenticationError("Sign in is required.", "missing_token")),
      authorizeAdmin: vi.fn(),
      store: store(),
    });
    expect(unauthenticated.status).toBe(401);

    const unauthorized = await handleReportReviewPatch(request({ status: "reviewing" }), context, {
      verifyRequest: vi.fn().mockResolvedValue({ user: { uid: "fan-1" } }),
      authorizeAdmin: vi
        .fn()
        .mockRejectedValue(new AuthorizationError("Administrator access is required.", "admin_required")),
      store: store(),
      database: {} as never,
    });
    expect(unauthorized.status).toBe(403);
    await expect(unauthorized.json()).resolves.toMatchObject({ error: { code: "admin_required" } });
  });

  it("rejects target-removal fields and records a private review through the store", async () => {
    const reportStore = store();
    const invalid = await handleReportReviewPatch(
      request({ status: "resolved", hideTarget: true }),
      context,
      {
        verifyRequest: vi.fn().mockResolvedValue({ user: { uid: "admin-1" } }),
        authorizeAdmin: vi.fn().mockResolvedValue({ roles: { admin: true } }),
        store: reportStore,
        database: {} as never,
      },
    );
    expect(invalid.status).toBe(400);
    expect(reportStore.review).not.toHaveBeenCalled();

    const valid = await handleReportReviewPatch(
      request({ status: "resolved", moderationNote: "No policy violation remains." }),
      context,
      {
        verifyRequest: vi.fn().mockResolvedValue({ user: { uid: "admin-1" } }),
        authorizeAdmin: vi.fn().mockResolvedValue({ roles: { admin: true } }),
        store: reportStore,
        database: {} as never,
      },
    );
    expect(valid.status).toBe(200);
    expect(reportStore.review).toHaveBeenCalledWith(
      reportId,
      { status: "resolved", moderationNote: "No policy violation remains." },
      "admin-1",
    );
  });
});
