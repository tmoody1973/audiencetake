import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DecisionBrief } from "./decision-brief";
import { getScoutCardFixture } from "./data";

afterEach(cleanup);

describe("DecisionBrief", () => {
  it("surfaces unresolved identity, missing stage facts, and a bounded follow-up", () => {
    render(<DecisionBrief card={getScoutCardFixture("complete")} />);

    expect(screen.getByRole("heading", { name: "Decision brief" })).toBeInTheDocument();
    expect(screen.getByText("Relationship unresolved")).toBeInTheDocument();
    expect(screen.getAllByText("Unknown")).toHaveLength(6);
    expect(screen.getByText(/Confirm the project identity and primary work source/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review sources or submit evidence" })).toHaveAttribute("href", "#trust-and-ownership");
  });

  it("shows designated primary-work provenance when the contract supplies it", () => {
    const card = structuredClone(getScoutCardFixture("complete"));
    card.primaryWorkSourceId = card.sourceLedger[0].id;
    card.sourceLedger[0].sourceRole = "primary_work";
    card.sourceLedger[0].sourceTier = "creator_authorized";
    card.identity = { relationshipStatus: "creator_confirmed", primarySourceId: card.sourceLedger[0].id };

    render(<DecisionBrief card={card} />);

    expect(screen.getByText("Creator confirmed")).toBeInTheDocument();
    expect(screen.getByText("Primary work / Creator-authorized")).toBeInTheDocument();
  });
});
