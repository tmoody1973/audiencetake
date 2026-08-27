import { readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ExternalAccountClient } from "google-auth-library";
import { describe, expect, it } from "vitest";

import { prepareVercelGoogleApplicationDefault } from "./adc-files";

const environment = {
  GCP_PROJECT_NUMBER: "866111144888",
  GCP_SERVICE_ACCOUNT_EMAIL:
    "firebase-app-hosting-compute@test-app-mkark4.iam.gserviceaccount.com",
  GCP_WORKLOAD_IDENTITY_POOL_ID: "audience-take-vercel",
  GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: "audiencetake",
};

describe("Vercel Google application-default files", () => {
  it("writes a private ADC config whose file supplier rereads the current OIDC token", async () => {
    const directory = join(tmpdir(), `audience-take-adc-${process.pid}-${Date.now()}`);
    const mutableEnvironment: Record<string, string | undefined> = { ...environment };
    const configPath = prepareVercelGoogleApplicationDefault(
      "first-signed-oidc-token",
      mutableEnvironment,
      directory,
    );

    expect(configPath).toBe(join(directory, "external-account.json"));
    expect(mutableEnvironment.GOOGLE_APPLICATION_CREDENTIALS).toBe(configPath);
    expect(statSync(directory).mode & 0o777).toBe(0o700);
    expect(statSync(join(directory, "vercel-oidc-token")).mode & 0o777).toBe(0o600);
    expect(statSync(configPath!).mode & 0o777).toBe(0o600);

    const configText = readFileSync(configPath!, "utf8");
    expect(configText).not.toContain("first-signed-oidc-token");
    expect(configText).not.toContain("private_key");
    const client = ExternalAccountClient.fromJSON(JSON.parse(configText)) as unknown as {
      retrieveSubjectToken(): Promise<string>;
    };
    await expect(client.retrieveSubjectToken()).resolves.toBe("first-signed-oidc-token");

    prepareVercelGoogleApplicationDefault(
      "refreshed-signed-oidc-token",
      mutableEnvironment,
      directory,
    );
    await expect(client.retrieveSubjectToken()).resolves.toBe("refreshed-signed-oidc-token");
  });
});
