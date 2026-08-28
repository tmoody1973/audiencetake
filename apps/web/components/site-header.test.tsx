import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SiteHeader } from "./site-header";

const authMocks = vi.hoisted(() => ({
  getClientAuth: vi.fn(() => ({ name: "auth" })),
  onAuthStateChanged: vi.fn(),
  signOutCurrentUser: vi.fn(() => Promise.resolve()),
}));

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));
vi.mock("firebase/auth", () => ({ onAuthStateChanged: authMocks.onAuthStateChanged }));
vi.mock("../lib/firebase/client", () => ({ getClientAuth: authMocks.getClientAuth }));
vi.mock("../lib/firebase/config", () => ({ hasFirebaseClientConfig: () => true }));
vi.mock("../lib/auth/sign-in", () => ({ signOutCurrentUser: authMocks.signOutCurrentUser }));

describe("SiteHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue("/");
    authMocks.onAuthStateChanged.mockImplementation((_auth, next) => {
      next(null);
      return vi.fn();
    });
  });
  afterEach(cleanup);

  it("marks Home current only on the home route", () => {
    const { rerender } = render(<SiteHeader />);
    expect(screen.getByRole("link", { name: /^01 home$/i })).toHaveAttribute("aria-current", "page");

    vi.mocked(usePathname).mockReturnValue("/research/run-1");
    rerender(<SiteHeader />);
    expect(screen.getByRole("link", { name: /^01 home$/i })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /^02 scouting wall$/i })).not.toHaveAttribute("aria-current");
  });

  it("marks Scouting Wall current across project routes", () => {
    vi.mocked(usePathname).mockReturnValue("/projects/junichiro-live-project");
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: /^02 scouting wall$/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^01 home$/i })).not.toHaveAttribute("aria-current");
  });

  it("omits current-page state when the pathname is unavailable", () => {
    vi.mocked(usePathname).mockReturnValue(null as unknown as string);
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: /^01 home$/i })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /^02 scouting wall$/i })).not.toHaveAttribute("aria-current");
  });

  it("shows the return-aware sign-in link after Firebase reports a signed-out session", () => {
    vi.mocked(usePathname).mockReturnValue("/nominate");
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: /^sign in$/i })).toHaveAttribute("href", "/sign-in?returnTo=%2Fnominate");
  });

  it("replaces sign in with sign out for an authenticated user", async () => {
    authMocks.onAuthStateChanged.mockImplementation((_auth, next) => {
      next({ uid: "fan-1" });
      return vi.fn();
    });
    render(<SiteHeader />);

    expect(screen.queryByRole("link", { name: /^sign in$/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^sign out$/i }));
    await waitFor(() => expect(authMocks.signOutCurrentUser).toHaveBeenCalledOnce());
  });
});
