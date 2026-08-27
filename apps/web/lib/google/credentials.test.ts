import { describe, expect, it } from "vitest";

import {
  GoogleCredentialsConfigurationError,
  googleServiceAccountFromEnv,
} from "./credentials";

const serviceAccount = JSON.stringify({
  project_id: "audience-take",
  client_email: "vercel-runtime@audience-take.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\\nsecret\\n-----END PRIVATE KEY-----\\n",
});

describe("Google server credentials", () => {
  it("uses platform credentials when no explicit service account is configured", () => {
    expect(googleServiceAccountFromEnv({})).toBeNull();
  });

  it("parses a Vercel service-account secret without exposing its raw shape", () => {
    expect(
      googleServiceAccountFromEnv({
        GOOGLE_SERVICE_ACCOUNT_JSON: serviceAccount,
        GOOGLE_CLOUD_PROJECT: "audience-take",
      }),
    ).toEqual({
      projectId: "audience-take",
      clientEmail: "vercel-runtime@audience-take.iam.gserviceaccount.com",
      privateKey: "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----\n",
    });
  });

  it("fails closed for malformed, incomplete, or cross-project credentials", () => {
    expect(() =>
      googleServiceAccountFromEnv({ GOOGLE_SERVICE_ACCOUNT_JSON: "{" }),
    ).toThrow(GoogleCredentialsConfigurationError);
    expect(() =>
      googleServiceAccountFromEnv({ GOOGLE_SERVICE_ACCOUNT_JSON: "{}" }),
    ).toThrow("project_id");
    expect(() =>
      googleServiceAccountFromEnv({
        GOOGLE_SERVICE_ACCOUNT_JSON: serviceAccount,
        GOOGLE_CLOUD_PROJECT: "different-project",
      }),
    ).toThrow("does not match");
  });
});
