import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getScoutCardFixture } from "../scout-card/data";
import { ScoutSocialPanel } from "./scout-social-panel";

vi.mock("../../lib/firebase/config", () => ({ hasFirebaseClientConfig: () => false }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("ScoutSocialPanel", () => {
  it("shows native-only participation labels and all commitment definitions", () => {
    render(<ScoutSocialPanel card={getScoutCardFixture("complete")} />);
    expect(screen.getByRole("heading", { name: "Audience Pulse" })).toBeInTheDocument();
    expect(screen.getByText(/Audience Pulse is native-only/)).toBeInTheDocument();
    expect(screen.getByText("Signal intent to watch.")).toBeInTheDocument();
    expect(screen.getByText("Signal willingness to pay.")).toBeInTheDocument();
    expect(screen.getByText("Tell the team where to bring it.")).toBeInTheDocument();
    expect(screen.getByText("Signal support for another chapter.")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("routes a signed-out protected action to the card pulse return", () => {
    render(<ScoutSocialPanel card={getScoutCardFixture("complete")} />);
    expect(screen.getByRole("link", { name: "Continue to sign in" })).toHaveAttribute("href", "/sign-in?returnTo=%2Fprojects%2Fjunichiro-jackson%23audience-pulse");
  });
});
