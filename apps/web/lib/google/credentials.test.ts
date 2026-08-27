import { describe, expect, it } from "vitest";

import {
  GoogleCredentialsConfigurationError,
  googleAuthClientFromEnv,
  googleServiceAccountFromEnv,
  vercelGoogleIdentityFromEnv,
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

  it("builds a keyless Vercel workload-identity client from bounded configuration", () => {
    const environment = {
      GCP_PROJECT_NUMBER: "866111144888",
      GCP_SERVICE_ACCOUNT_EMAIL:
        "firebase-app-hosting-compute@test-app-mkark4.iam.gserviceaccount.com",
      GCP_WORKLOAD_IDENTITY_POOL_ID: "audience-take-vercel",
      GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: "audiencetake",
    };
    expect(vercelGoogleIdentityFromEnv(environment)).toEqual({
      projectNumber: "866111144888",
      serviceAccountEmail:
        "firebase-app-hosting-compute@test-app-mkark4.iam.gserviceaccount.com",
      poolId: "audience-take-vercel",
      providerId: "audiencetake",
      audience:
        "//iam.googleapis.com/projects/866111144888/locations/global/" +
        "workloadIdentityPools/audience-take-vercel/providers/audiencetake",
    });
    expect(googleAuthClientFromEnv(environment, async () => "signed-oidc-token")).not.toBeNull();
  });

  it("fails closed when Vercel workload-identity configuration is partial", () => {
    expect(() =>
      vercelGoogleIdentityFromEnv({ GCP_PROJECT_NUMBER: "866111144888" }),
    ).toThrow("incomplete");
  });
});
