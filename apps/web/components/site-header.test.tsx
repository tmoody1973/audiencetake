import { cleanup, render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SiteHeader } from "./site-header";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));

describe("SiteHeader", () => {
  beforeEach(() => vi.mocked(usePathname).mockReturnValue("/"));
  afterEach(cleanup);

  it("marks Home current only on the home route", () => {
    const { rerender } = render(<SiteHeader />);
    expect(screen.getByRole("link", { name: /^01 home$/i })).toHaveAttribute("aria-current", "page");

    vi.mocked(usePathname).mockReturnValue("/research/run-1");
    rerender(<SiteHeader />);
    expect(screen.getByRole("link", { name: /^01 home$/i })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /^02 nominate$/i })).not.toHaveAttribute("aria-current");
  });

  it("marks Nominate current across its route subtree", () => {
    vi.mocked(usePathname).mockReturnValue("/nominate/review");
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: /^02 nominate$/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^01 home$/i })).not.toHaveAttribute("aria-current");
  });

  it("omits current-page state when the pathname is unavailable", () => {
    vi.mocked(usePathname).mockReturnValue(null as unknown as string);
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: /^01 home$/i })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /^02 nominate$/i })).not.toHaveAttribute("aria-current");
  });
});
