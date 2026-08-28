import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getScoutCardFixture } from "../scout-card/data";
import { IndustryLens } from "./industry-lens";

afterEach(cleanup);

describe("IndustryLens", () => {
  it("keeps semantic comparison headers and marks absent execution facts Unknown", () => {
    render(<IndustryLens card={getScoutCardFixture("complete")} />);

    const table = screen.getByRole("table", { name: "Industry Lens comparison of the three pathway hypotheses" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(4);
    expect(within(table).getAllByRole("rowheader")).toHaveLength(7);
    expect(within(table).getAllByText("Unknown")).toHaveLength(18);
    expect(within(table).getAllByText(/early signal rather than verified demand/i)).toHaveLength(1);
  });

  it("renders supplied execution conditions instead of replacing them with defaults", () => {
    const card = structuredClone(getScoutCardFixture("complete"));
    card.pathways[0].nextExperiment.owner = "Creator or authorized producer";
    card.pathways[0].nextExperiment.requiredPermission = "Creator approval";
    card.pathways[0].nextExperiment.costClass = "low";
    card.pathways[0].nextExperiment.successCriterion = "Defined before launch";

    render(<IndustryLens card={card} />);

    expect(screen.getByText("Creator or authorized producer")).toBeInTheDocument();
    expect(screen.getByText("Creator approval")).toBeInTheDocument();
    expect(screen.getByText("Defined before launch")).toBeInTheDocument();
  });
});
