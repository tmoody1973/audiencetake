import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../firebase/client", () => ({ getClientAuth: () => ({ name: "auth" }) }));

vi.mock("firebase/auth", () => {
  class GoogleAuthProvider {
    static credential = vi.fn((token: string) => ({ providerId: "google.com", token }));
  }
  return {
    GoogleAuthProvider,
    createUserWithEmailAndPassword: vi.fn(),
    isSignInWithEmailLink: vi.fn(() => true),
    sendEmailVerification: vi.fn(),
    sendSignInLinkToEmail: vi.fn(() => Promise.resolve()),
    signInWithCredential: vi.fn(() => Promise.resolve({ user: { uid: "google-uid" } })),
    signInWithEmailAndPassword: vi.fn(),
    signInWithEmailLink: vi.fn(() => Promise.resolve({ user: { uid: "link-uid" } })),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
  };
});

import {
  GoogleAuthProvider,
  sendSignInLinkToEmail,
  signInWithCredential,
  signInWithEmailLink,
} from "firebase/auth";

import {
  completeEmailLinkSignIn,
  sendEmailSignInLink,
  signInWithGoogleCredential,
} from "./sign-in";

const storageKey = "audienceTake.emailForSignIn";

afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("Google credential sign-in", () => {
  it("signs in with a One-Tap credential", async () => {
    await signInWithGoogleCredential("id-token");
    expect(GoogleAuthProvider.credential).toHaveBeenCalledWith("id-token");
    expect(signInWithCredential).toHaveBeenCalledWith(
      { name: "auth" },
      { providerId: "google.com", token: "id-token" },
    );
  });
});

describe("email-link sign-in", () => {
  it("sends a link to an in-app return url and remembers the email", async () => {
    await sendEmailSignInLink("fan@example.com");
    const [, email, settings] = (sendSignInLinkToEmail as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0];
    expect(email).toBe("fan@example.com");
    expect(settings).toMatchObject({ handleCodeInApp: true });
    expect((settings as { url: string }).url).toMatch(/\/sign-in$/);
    expect(window.localStorage.getItem(storageKey)).toBe("fan@example.com");
  });

  it("completes with the remembered email and clears it", async () => {
    window.localStorage.setItem(storageKey, "fan@example.com");
    const credential = await completeEmailLinkSignIn("https://audiencetake.com/sign-in?link");
    expect(signInWithEmailLink).toHaveBeenCalledWith(
      { name: "auth" },
      "fan@example.com",
      "https://audiencetake.com/sign-in?link",
    );
    expect(credential.user.uid).toBe("link-uid");
    expect(window.localStorage.getItem(storageKey)).toBeNull();
  });

  it("prefers an explicit email over the remembered one", async () => {
    window.localStorage.setItem(storageKey, "remembered@example.com");
    await completeEmailLinkSignIn("https://audiencetake.com/sign-in", "typed@example.com");
    expect(signInWithEmailLink).toHaveBeenCalledWith(
      { name: "auth" },
      "typed@example.com",
      "https://audiencetake.com/sign-in",
    );
  });

  it("asks for the email when none is available", async () => {
    await expect(completeEmailLinkSignIn("https://audiencetake.com/sign-in")).rejects.toThrow(
      /email address/,
    );
    expect(signInWithEmailLink).not.toHaveBeenCalled();
  });
});
