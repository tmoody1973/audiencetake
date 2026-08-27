import {
  applicationDefault,
  cert,
  type Credential,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getVercelOidcTokenSync } from "@vercel/oidc";
import { getAppCheck } from "firebase-admin/app-check";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import {
  googleServiceAccountFromEnv,
  vercelGoogleIdentityFromEnv,
} from "../google/credentials";
import { prepareVercelGoogleApplicationDefault } from "../google/adc-files";

function refreshVercelApplicationDefault(): boolean {
  if (!vercelGoogleIdentityFromEnv()) return false;
  prepareVercelGoogleApplicationDefault(getVercelOidcTokenSync());
  return true;
}

function serverCredential(vercelApplicationDefaultReady: boolean): Credential {
  if (vercelApplicationDefaultReady) return applicationDefault();

  const serviceAccount = googleServiceAccountFromEnv();
  if (serviceAccount) {
    return cert({
      projectId: serviceAccount.projectId,
      clientEmail: serviceAccount.clientEmail,
      privateKey: serviceAccount.privateKey,
    });
  }
  return applicationDefault();
}

function getAdminApp() {
  const isEmulated = Boolean(
    process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST,
  );
  // Refresh the file-sourced token even when the Admin app is already warm;
  // Google's external-account client rereads this file for later exchanges.
  const vercelApplicationDefaultReady = isEmulated
    ? false
    : refreshVercelApplicationDefault();
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  return initializeApp({
    ...(isEmulated ? {} : { credential: serverCredential(vercelApplicationDefaultReady) }),
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminAppCheck() {
  return getAppCheck(getAdminApp());
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp());
}

export function getAdminStorage() {
  return getStorage(getAdminApp());
}
