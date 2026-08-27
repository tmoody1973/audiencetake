import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ResearchProgress } from "./research-progress";

describe("ResearchProgress", () => {
  afterEach(cleanup);
  it("shows all six stages and clearly labels the config-free demo projection", () => {
    render(<ResearchProgress runId="demo-junichiro" />);
    expect(screen.getByText("Local Junichiro demonstration")).toBeInTheDocument();
    for (const label of ["Reading source", "Mapping story", "Parallel search", "Checking evidence", "Three pathways", "Publishing card"]) {
      expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText(/does not claim a completed provider result/i)).toBeInTheDocument();
    expect(screen.getByText("Public receipts")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Receipt categories present in this run" })).toHaveTextContent("Source receiptsTool receipts");
  });

  it("makes the filmstrip focusable and scrollable from the keyboard", () => {
    render(<ResearchProgress runId="demo-junichiro" />);
    const filmstrip = screen.getByRole("list", { name: "Research stages filmstrip" });
    const firstFrame = filmstrip.querySelector<HTMLElement>(".research-frame");
    Object.defineProperties(filmstrip, {
      clientWidth: { value: 300 },
      scrollWidth: { value: 900 },
    });
    if (firstFrame) Object.defineProperty(firstFrame, "offsetWidth", { value: 200 });
    expect(filmstrip).toHaveAttribute("tabindex", "0");
    expect(filmstrip).toHaveAccessibleDescription(/Left and Right Arrow keys/i);
    fireEvent.keyDown(filmstrip, { key: "ArrowRight" });
    expect(filmstrip.scrollLeft).toBe(200);
    fireEvent.keyDown(filmstrip, { key: "End" });
    expect(filmstrip.scrollLeft).toBe(600);
  });
});
