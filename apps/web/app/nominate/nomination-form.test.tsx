import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NominationForm } from "./nomination-form";

describe("NominationForm", () => {
  beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  });

  afterEach(() => cleanup());

  it("accepts a separate YouTube player alongside a campaign URL", () => {
    render(<NominationForm />);

    fireEvent.change(screen.getByLabelText(/Public project URL/), {
      target: { value: "https://www.kickstarter.com/projects/teamto/junichiro-live" },
    });
    fireEvent.change(screen.getByLabelText(/Trailer or proof-of-concept video/), {
      target: { value: "https://youtu.be/s8G7425lfKs" },
    });
    fireEvent.change(screen.getByLabelText(/Why should this grow/), {
      target: { value: "The campaign and video show a distinctive animated project." },
    });
    const reviewButton = screen.getByRole("button", { name: /Review nomination/ });
    fireEvent.submit(reviewButton.closest("form")!);

    expect(screen.getByRole("heading", { name: "Review your nomination" })).toBeInTheDocument();
    expect(screen.getByText("https://www.kickstarter.com/projects/teamto/junichiro-live")).toBeInTheDocument();
    expect(screen.getByText("https://youtu.be/s8G7425lfKs")).toBeInTheDocument();
  });

  it("explains that a YouTube video can be proposed later", () => {
    render(<NominationForm />);
    expect(screen.getByText(/You can also propose a video later from the published card/)).toBeInTheDocument();
  });
});
