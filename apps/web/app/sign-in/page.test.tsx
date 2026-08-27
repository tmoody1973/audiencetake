import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }), useSearchParams: () => new URLSearchParams("returnTo=https%3A%2F%2Fevil.test%2Fsteal") }));
vi.mock("../../lib/auth/sign-in", () => ({ signInWithGoogle: vi.fn(() => Promise.resolve()), signInWithEmail: vi.fn(() => Promise.resolve()), createEmailAccount: vi.fn(() => Promise.resolve()) }));

describe("sign-in page", () => {
  it("sanitizes an external return target and supports account mode", async () => {
    const { default: Page } = await import("./page");
    render(<Page />);
    expect(screen.getByText(/Return destination:/)).toHaveTextContent("/");
    fireEvent.click(screen.getByRole("button", { name: /Create an account/ }));
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });
});
