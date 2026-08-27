export type GoogleServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
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

