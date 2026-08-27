import { deleteApp, getApps } from "firebase-admin/app";
import { afterEach, describe, expect, it, vi } from "vitest";

const getVercelOidcTokenSync = vi.hoisted(() =>
  vi.fn(() => "signed-vercel-oidc-token"),
);

vi.mock("@vercel/oidc", () => ({ getVercelOidcTokenSync }));

import { getAdminFirestore } from "./admin";

const identityEnvironment = {
  GCP_PROJECT_NUMBER: "866111144888",
  GCP_SERVICE_ACCOUNT_EMAIL:
    "firebase-app-hosting-compute@test-app-mkark4.iam.gserviceaccount.com",
  GCP_WORKLOAD_IDENTITY_POOL_ID: "audience-take-vercel",
  GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: "audiencetake",
  GOOGLE_CLOUD_PROJECT: "test-app-mkark4",
};

describe("Firebase Admin workload identity", () => {
  afterEach(async () => {
    await Promise.all(getApps().map((app) => deleteApp(app)));
    vi.unstubAllEnvs();
    getVercelOidcTokenSync.mockClear();
  });

  it("uses Firestore-compatible application-default credentials and refreshes the token file on warm access", () => {
    for (const [name, value] of Object.entries(identityEnvironment)) {
      vi.stubEnv(name, value);
    }

    expect(() => getAdminFirestore()).not.toThrow();
    expect(getApps()[0].options.credential?.constructor.name).toBe(
      "ApplicationDefaultCredential",
    );
    expect(() => getAdminFirestore()).not.toThrow();
    expect(getVercelOidcTokenSync).toHaveBeenCalledTimes(2);
  });

  it("does not request a production identity token for emulator access", () => {
    for (const [name, value] of Object.entries(identityEnvironment)) {
      vi.stubEnv(name, value);
    }
    vi.stubEnv("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080");

    expect(() => getAdminFirestore()).not.toThrow();
    expect(getVercelOidcTokenSync).not.toHaveBeenCalled();
  });
});
