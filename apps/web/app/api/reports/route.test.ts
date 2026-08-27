import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { AuthenticationError } from "@/lib/auth/verify-request";
import type { ReportStore } from "@/lib/reports/store";

import { handleReportPost } from "./handler";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/reports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function store(): ReportStore {
  return {
    submit: vi.fn().mockResolvedValue({
      reportId: "a".repeat(64),
      duplicate: false,
      status: "open",
      eventCount: 1,
    }),
    review: vi.fn(),
  };
}

const validBody = {
  target: { type: "take", id: "take-1" },
  reason: "harassment",
  context: "This text targets another participant.",
};

describe("POST /api/reports", () => {
  it("requires verified auth and App Check through the shared request boundary", async () => {
    const response = await handleReportPost(request(validBody), {
      verifyRequest: vi
        .fn()
        .mockRejectedValue(new AuthenticationError("App verification is required.", "missing_app_check")),
      store: store(),
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "missing_app_check" } });
  });

  it("rejects contract drift before calling the store", async () => {
    const reportStore = store();
    const response = await handleReportPost(request({ ...validBody, autoHide: true }), {
      verifyRequest: vi.fn().mockResolvedValue({ user: { uid: "fan-1" } }),
      store: reportStore,
    });
    expect(response.status).toBe(400);
    expect(reportStore.submit).not.toHaveBeenCalled();
  });

  it("returns only the reporter-safe case receipt", async () => {
    const reportStore = store();
    const response = await handleReportPost(request(validBody), {
      verifyRequest: vi.fn().mockResolvedValue({ user: { uid: "fan-1" } }),
      store: reportStore,
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { reportId: "a".repeat(64), duplicate: false, status: "open", eventCount: 1 },
      error: null,
    });
    expect(reportStore.submit).toHaveBeenCalledWith(validBody, "fan-1");
  });
});
