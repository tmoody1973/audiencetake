import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AudiencePulseStrip } from "./audience-pulse-strip";

describe("AudiencePulseStrip", () => {
  afterEach(cleanup);

  it("shows the five organic participation signals without implying controls", () => {
    render(<AudiencePulseStrip counts={{
      follows: 12,
      wouldWatch: 1284,
      wouldPay: 7,
      bringToCity: 3,
      backNextChapter: 21,
    }} />);

    expect(screen.getByRole("region", { name: "Audience Pulse organic participation signals" })).toBeInTheDocument();
    expect(screen.getByLabelText("Watch: 1,284")).toHaveTextContent("1.3K");
    expect(screen.getByText("My city")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
