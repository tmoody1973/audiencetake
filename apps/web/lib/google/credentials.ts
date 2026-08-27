import { getVercelOidcToken } from "@vercel/oidc";
import { ExternalAccountClient, type AuthClient } from "google-auth-library";

export type GoogleServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

export type VercelGoogleIdentity = {
  projectNumber: string;
  serviceAccountEmail: string;
  poolId: string;
  providerId: string;
  audience: string;
};

export class GoogleCredentialsConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleCredentialsConfigurationError";
  }
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new GoogleCredentialsConfigurationError(
      `GOOGLE_SERVICE_ACCOUNT_JSON is missing ${field}.`,
    );
  }
  return value.trim();
}

export function googleServiceAccountFromEnv(
  environment: Record<string, string | undefined> = process.env,
): GoogleServiceAccount | null {
  const raw = environment.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GoogleCredentialsConfigurationError(
      "GOOGLE_SERVICE_ACCOUNT_JSON must contain valid JSON.",
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new GoogleCredentialsConfigurationError(
      "GOOGLE_SERVICE_ACCOUNT_JSON must contain a service-account object.",
    );
  }

  const source = parsed as Record<string, unknown>;
  const projectId = requiredString(source.project_id, "project_id");
  const clientEmail = requiredString(source.client_email, "client_email");
  const privateKey = requiredString(source.private_key, "private_key").replace(/\\n/g, "\n");
  const configuredProject =
    environment.GOOGLE_CLOUD_PROJECT?.trim() ||
    environment.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();

  if (configuredProject && configuredProject !== projectId) {
    throw new GoogleCredentialsConfigurationError(
      "The service-account project does not match the configured Firebase project.",
    );
  }
  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new GoogleCredentialsConfigurationError(
      "GOOGLE_SERVICE_ACCOUNT_JSON contains an invalid private_key.",
    );
  }

  return { projectId, clientEmail, privateKey };
}

const WIF_ID = /^[a-z][a-z0-9-]{3,31}$/;
const PROJECT_NUMBER = /^\d{6,20}$/;
const SERVICE_ACCOUNT_EMAIL = /^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/;

export function vercelGoogleIdentityFromEnv(
  environment: Record<string, string | undefined> = process.env,
): VercelGoogleIdentity | null {
  const values = {
    projectNumber: environment.GCP_PROJECT_NUMBER?.trim() ?? "",
    serviceAccountEmail: environment.GCP_SERVICE_ACCOUNT_EMAIL?.trim() ?? "",
    poolId: environment.GCP_WORKLOAD_IDENTITY_POOL_ID?.trim() ?? "",
    providerId: environment.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID?.trim() ?? "",
  };
  if (Object.values(values).every((value) => !value)) return null;
  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) {
    throw new GoogleCredentialsConfigurationError(
      `Vercel Google identity is incomplete (${missing.join(", ")}).`,
    );
  }
  if (!PROJECT_NUMBER.test(values.projectNumber)) {
    throw new GoogleCredentialsConfigurationError("GCP_PROJECT_NUMBER is invalid.");
  }
  if (!SERVICE_ACCOUNT_EMAIL.test(values.serviceAccountEmail)) {
    throw new GoogleCredentialsConfigurationError("GCP_SERVICE_ACCOUNT_EMAIL is invalid.");
  }
  if (!WIF_ID.test(values.poolId) || !WIF_ID.test(values.providerId)) {
    throw new GoogleCredentialsConfigurationError(
      "The workload identity pool or provider ID is invalid.",
    );
  }

  return {
    ...values,
    audience:
      `//iam.googleapis.com/projects/${values.projectNumber}/locations/global/` +
      `workloadIdentityPools/${values.poolId}/providers/${values.providerId}`,
  };
}

export function googleAuthClientFromEnv(
  environment: Record<string, string | undefined> = process.env,
  subjectTokenSupplier: () => Promise<string> = getVercelOidcToken,
): AuthClient | null {
  const identity = vercelGoogleIdentityFromEnv(environment);
  if (!identity) return null;

  const client = ExternalAccountClient.fromJSON({
    type: "external_account",
    audience: identity.audience,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url:
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/` +
      `${identity.serviceAccountEmail}:generateAccessToken`,
    subject_token_supplier: { getSubjectToken: subjectTokenSupplier },
  });
  if (!client) {
    throw new GoogleCredentialsConfigurationError(
      "Could not initialize the Vercel Google identity client.",
    );
  }
  return client;
}
