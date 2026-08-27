import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClientAuth, getClientAppCheckToken } = vi.hoisted(() => ({
  getClientAuth: vi.fn(),
  getClientAppCheckToken: vi.fn(),
}));
vi.mock("@/lib/firebase/client", () => ({ getClientAuth, getClientAppCheckToken }));

import { trustCommand } from "./client";

describe("trustCommand", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getClientAuth.mockReturnValue({ currentUser: { getIdToken: vi.fn().mockResolvedValue("id-token") } });
    getClientAppCheckToken.mockResolvedValue("app-check-token");
  });

  it("sends authenticated JSON commands and unwraps the safe envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { id: "saved" } }),
    }));
    await expect(trustCommand<{ id: string }>("/api/reports", "POST", { reason: "spam" }))
      .resolves.toEqual({ id: "saved" });
    expect(fetch).toHaveBeenCalledWith("/api/reports", expect.objectContaining({
      method: "POST",
      headers: expect.any(Headers),
      body: JSON.stringify({ reason: "spam" }),
    }));
  });

  it("requires sign-in before making a request", async () => {
    getClientAuth.mockReturnValue({ currentUser: null });
    await expect(trustCommand("/api/reports", "POST", {})).rejects.toThrow("Sign in");
  });

  it("preserves FormData for safe server-mediated uploads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { mediaId: "media-1" } }),
    }));
    const form = new FormData();
    form.set("projectId", "project-1");
    await trustCommand("/api/uploads", "POST", form);
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(init.body).toBe(form);
    expect((init.headers as Headers).has("content-type")).toBe(false);
  });
});
