import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getScoutCardFixture } from "./data";
import { ScoutCard } from "./scout-card";

afterEach(cleanup);

describe("ScoutCard", () => {
  it("renders the complete card with cited claims and exactly three pathway hypotheses", () => {
    render(<ScoutCard card={getScoutCardFixture("complete")} />);

    expect(screen.getByRole("heading", { level: 1, name: "Junichiro Jackson" })).toBeInTheDocument();
    const pathways = screen.getByRole("heading", { name: "Pathway hypotheses" }).closest("section");
    expect(pathways).not.toBeNull();
    expect(within(pathways as HTMLElement).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getAllByText("[S1]", { selector: ".citation-marks" })).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Junichiro Jackson public project video" })).toHaveAttribute("href", "https://www.youtube.com/watch?v=M2djoKmnOTY");
    expect(screen.getByText(/No native audience count is claimed\./)).toBeInTheDocument();
  });

  it("keeps the comparative Industry Lens collapsed until a reader expands it", () => {
    const { container } = render(<ScoutCard card={getScoutCardFixture("complete")} />);
    const disclosure = container.querySelector(".industry-lens details");
    expect(disclosure).not.toHaveAttribute("open");

    fireEvent.click(screen.getByText("Industry Lens — comparative view"));
    expect(disclosure).toHaveAttribute("open");
    expect(screen.getByRole("table", { name: "Industry Lens comparison of the three pathway hypotheses" })).toBeInTheDocument();
  });

  it("announces a Partial card and names its missing research sections", () => {
    render(<ScoutCard card={getScoutCardFixture("partial")} />);
    expect(screen.getByRole("status")).toHaveTextContent("Partial Scout Card");
    expect(screen.getByText("parallel web sources / verified comparables")).toBeInTheDocument();
  });

  it("shows an accessible non-player state when submitted media is unavailable", () => {
    render(<ScoutCard card={getScoutCardFixture("unavailable")} />);
    expect(screen.queryByTitle("Watch the submitted Junichiro Jackson source video")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Submitted Junichiro Jackson source video unavailable" })).toHaveTextContent("Media is unavailable");
  });

  it("labels a saved fallback without implying a live refresh", () => {
    render(<ScoutCard card={getScoutCardFixture("fallback")} />);
    expect(screen.getByRole("status")).toHaveTextContent("Previously generated — live refresh unavailable.");
  });

  it("rejects malformed cards that do not contain exactly three pathways", () => {
    const card = structuredClone(getScoutCardFixture("complete"));
    card.pathways.pop();
    expect(() => render(<ScoutCard card={card} />)).toThrow("exactly three pathways");
  });
});
