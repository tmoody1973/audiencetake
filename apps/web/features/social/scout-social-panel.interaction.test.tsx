import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getScoutCardFixture } from "../scout-card/data";
import { ScoutSocialPanel } from "./scout-social-panel";

const mocks = vi.hoisted(() => ({
  socialCommand: vi.fn(),
}));

vi.mock("../../lib/firebase/config", () => ({ hasFirebaseClientConfig: () => true }));
vi.mock("../../lib/firebase/client", () => ({
  getClientAuth: () => ({}),
  getClientFirestore: () => ({}),
}));
vi.mock("./client", () => ({ socialCommand: mocks.socialCommand }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: { uid: string }) => void) => {
    callback({ uid: "fan-1" });
    return vi.fn();
  },
}));
vi.mock("firebase/firestore", () => ({
  collection: (...parts: unknown[]) => ({ kind: "collection", parts }),
  doc: (...parts: unknown[]) => ({ kind: "doc", parts }),
  query: (...parts: unknown[]) => ({ kind: "query", parts }),
  where: (...parts: unknown[]) => ({ kind: "where", parts }),
  onSnapshot: (_reference: unknown, callback: (snapshot: unknown) => void) => {
    callback({
      data: () => ({ commitmentCounts: {}, demoCommitmentCounts: {} }),
      docs: [],
    });
    return vi.fn();
  },
}));

afterEach(() => {
  cleanup();
  mocks.socialCommand.mockReset();
});

describe("ScoutSocialPanel commitment interactions", () => {
  it("sends valid JSON and displays the authoritative organic count", async () => {
    mocks.socialCommand.mockResolvedValue({
      active: true,
      type: "would_watch",
      counterKind: "organic",
      count: 1,
    });
    render(<ScoutSocialPanel card={getScoutCardFixture("complete")} />);

    const button = await screen.findByRole("button", { name: /I would watch/ });
    fireEvent.click(button);

    await waitFor(() => expect(mocks.socialCommand).toHaveBeenCalledWith(
      "/api/projects/junichiro-jackson/commitments/would_watch",
      "PUT",
      {},
    ));
    await waitFor(() => expect(button).toHaveTextContent("1"));
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("group", { name: "Commitments" })).getByRole("status"))
      .toHaveTextContent("Saved");
  });

  it("reverts the selection and exposes a rejection beside Commitments", async () => {
    mocks.socialCommand.mockRejectedValue(new Error("Send valid JSON."));
    render(<ScoutSocialPanel card={getScoutCardFixture("complete")} />);

    const button = await screen.findByRole("button", { name: /I would watch/ });
    fireEvent.click(button);

    const commitments = screen.getByRole("group", { name: "Commitments" });
    expect(await within(commitments).findByRole("alert")).toHaveTextContent("Send valid JSON.");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveTextContent("0");
  });
});
