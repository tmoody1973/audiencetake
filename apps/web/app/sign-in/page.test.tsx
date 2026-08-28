import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }), useSearchParams: () => new URLSearchParams("returnTo=https%3A%2F%2Fevil.test%2Fsteal") }));
vi.mock("../../lib/auth/sign-in", () => ({
  signInWithGoogle: vi.fn(() => Promise.resolve({ user: { uid: "u" } })),
  signInWithEmail: vi.fn(() => Promise.resolve({ user: { uid: "u" } })),
  createEmailAccount: vi.fn(() => Promise.resolve({ user: { uid: "u" } })),
  signInWithGoogleCredential: vi.fn(() => Promise.resolve({ user: { uid: "u" } })),
  sendEmailSignInLink: vi.fn(() => Promise.resolve()),
  isEmailSignInLink: vi.fn(() => false),
  completeEmailLinkSignIn: vi.fn(() => Promise.resolve({ user: { uid: "u" } })),
}));

describe("sign-in page", () => {
  it("sanitizes an external return target and supports account mode", async () => {
    const { default: Page } = await import("./page");
    render(<Page />);
    expect(screen.getByText(/Return destination:/)).toHaveTextContent("/");
    fireEvent.click(screen.getByRole("button", { name: /Create an account/ }));
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });
});
