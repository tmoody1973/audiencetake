import {
  applicationDefault,
  cert,
  type Credential,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import type { AuthClient } from "google-auth-library";
import { getAppCheck } from "firebase-admin/app-check";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import {
  googleAuthClientFromEnv,
  googleServiceAccountFromEnv,
} from "../google/credentials";

function firebaseCredentialFromGoogleAuth(client: AuthClient): Credential {
  return {
    async getAccessToken() {
      const result = await client.getAccessToken();
      if (!result.token) throw new Error("Google workload identity returned no access token.");
      const expiryDate = client.credentials.expiry_date;
      const expiresIn = expiryDate
        ? Math.max(1, Math.floor((expiryDate - Date.now()) / 1_000))
        : 3_000;
      return { access_token: result.token, expires_in: expiresIn };
    },
  };
}

function serverCredential(): Credential {
  const authClient = googleAuthClientFromEnv();
  if (authClient) return firebaseCredentialFromGoogleAuth(authClient);

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
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const isEmulated = Boolean(
    process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST,
  );

  return initializeApp({
    ...(isEmulated ? {} : { credential: serverCredential() }),
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
