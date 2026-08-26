import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type UserCredential,
} from "firebase/auth";

import { getClientAuth } from "../firebase/client";

export function signInWithGoogle(): Promise<UserCredential> {
  return signInWithPopup(getClientAuth(), new GoogleAuthProvider());
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

export function signOutCurrentUser(): Promise<void> {
  return signOut(getClientAuth());
}
