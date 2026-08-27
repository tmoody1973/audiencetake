import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/firebase/client", () => ({ getClientAuth: () => ({ currentUser: { getIdToken: async () => "token" } }), getClientAppCheckToken: async () => "app-check" }));

describe("socialCommand", () => {
  it("sends the authenticated envelope headers and body", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, data: { active: true } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const { socialCommand } = await import("./client");
    await expect(socialCommand("/api/projects/p1/follow", "PUT")).resolves.toEqual({ active: true });
    expect(fetcher).toHaveBeenCalledWith("/api/projects/p1/follow", expect.objectContaining({ method: "PUT", headers: expect.any(Headers) }));
  });
});
