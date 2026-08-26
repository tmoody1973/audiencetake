import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getToken,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from "firebase/app-check";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

import {
  firebaseClientConfig,
  firebaseEmulatorConfig,
  hasFirebaseClientConfig,
} from "./config";

let emulatorConnected = false;
let appCheckStarted = false;
let appCheckInstance: AppCheck | null = null;

function getClientApp() {
  if (!hasFirebaseClientConfig()) {
    throw new Error("Firebase client configuration is not available.");
  }

  return getApps().length > 0 ? getApp() : initializeApp(firebaseClientConfig);
}

function connectLocalEmulators() {
  if (emulatorConnected || !firebaseEmulatorConfig.enabled) {
    return;
  }

  const app = getClientApp();
  const { host, authPort, firestorePort, storagePort } = firebaseEmulatorConfig;
  connectAuthEmulator(getAuth(app), `http://${host}:${authPort}`, { disableWarnings: true });
  connectFirestoreEmulator(getFirestore(app), host, firestorePort);
  connectStorageEmulator(getStorage(app), host, storagePort);
  emulatorConnected = true;
}

export function getClientAuth() {
  const auth = getAuth(getClientApp());
  connectLocalEmulators();
  return auth;
}

export function getClientFirestore() {
  const firestore = getFirestore(getClientApp());
  connectLocalEmulators();
  return firestore;
}

export function getClientStorage() {
  const storage = getStorage(getClientApp());
  connectLocalEmulators();
  return storage;
}

export function startAppCheck(): AppCheck | null {
  const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY;
  if (appCheckStarted) {
    return appCheckInstance;
  }
  if (!siteKey || typeof window === "undefined") {
    return null;
  }

  if (process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG === "true") {
    Object.assign(globalThis, { FIREBASE_APPCHECK_DEBUG_TOKEN: true });
  }

  appCheckInstance = initializeAppCheck(getClientApp(), {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  appCheckStarted = true;
  return appCheckInstance;
}

export async function getClientAppCheckToken(): Promise<string | undefined> {
  const appCheck = startAppCheck();
  if (!appCheck) return undefined;
  return (await getToken(appCheck)).token;
}
