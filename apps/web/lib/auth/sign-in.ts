import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  sendEmailVerification,
  sendSignInLinkToEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  type UserCredential,
} from "firebase/auth";

import { getClientAuth } from "../firebase/client";

const emailLinkStorageKey = "audienceTake.emailForSignIn";

function emailLinkActionSettings() {
  const base = process.env.NEXT_PUBLIC_APP_URL
    || (typeof window !== "undefined" ? window.location.origin : "");
  return { url: `${base}/sign-in`, handleCodeInApp: true };
}

export function signInWithGoogle(): Promise<UserCredential> {
  return signInWithPopup(getClientAuth(), new GoogleAuthProvider());
}

export function signInWithGoogleCredential(idToken: string): Promise<UserCredential> {
  return signInWithCredential(getClientAuth(), GoogleAuthProvider.credential(idToken));
}

export function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(getClientAuth(), email, password);
}

export async function createEmailAccount(email: string, password: string): Promise<UserCredential> {
  const credential = await createUserWithEmailAndPassword(getClientAuth(), email, password);
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== "true") {
    await sendEmailVerification(credential.user);
  }
  return credential;
}

export async function sendEmailSignInLink(email: string): Promise<void> {
  await sendSignInLinkToEmail(getClientAuth(), email, emailLinkActionSettings());
  if (typeof window !== "undefined") {
    window.localStorage.setItem(emailLinkStorageKey, email);
  }
}

export function isEmailSignInLink(url: string): boolean {
  return isSignInWithEmailLink(getClientAuth(), url);
}

export async function completeEmailLinkSignIn(url: string, email?: string): Promise<UserCredential> {
  const address = email ?? (typeof window !== "undefined"
    ? window.localStorage.getItem(emailLinkStorageKey)
    : null);
  if (!address) {
    throw new Error("Enter the email address that received the sign-in link.");
  }

  const credential = await signInWithEmailLink(getClientAuth(), address, url);
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(emailLinkStorageKey);
  }
  return credential;
}

export function signOutCurrentUser(): Promise<void> {
  return signOut(getClientAuth());
}
