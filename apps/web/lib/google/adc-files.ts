import { randomUUID } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  GoogleCredentialsConfigurationError,
  googleExternalAccountFileConfigFromEnv,
} from "./credentials";

const DEFAULT_ADC_DIRECTORY = join(tmpdir(), "audience-take-google-auth");
const SUBJECT_TOKEN_FILENAME = "vercel-oidc-token";
const EXTERNAL_ACCOUNT_FILENAME = "external-account.json";

function atomicPrivateWrite(filePath: string, value: string): void {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}`;
  try {
    writeFileSync(temporaryPath, value, { encoding: "utf8", flag: "wx", mode: 0o600 });
    renameSync(temporaryPath, filePath);
    chmodSync(filePath, 0o600);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

export function prepareVercelGoogleApplicationDefault(
  subjectToken: string,
  environment: Record<string, string | undefined> = process.env,
  directory = DEFAULT_ADC_DIRECTORY,
): string | null {
  const token = subjectToken.trim();
  if (!token) {
    throw new GoogleCredentialsConfigurationError(
      "Vercel workload identity returned an empty subject token.",
    );
  }

  const subjectTokenFile = join(directory, SUBJECT_TOKEN_FILENAME);
  const config = googleExternalAccountFileConfigFromEnv(subjectTokenFile, environment);
  if (!config) return null;

  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  atomicPrivateWrite(subjectTokenFile, token);

  const configFile = join(directory, EXTERNAL_ACCOUNT_FILENAME);
  atomicPrivateWrite(configFile, JSON.stringify(config));
  environment.GOOGLE_APPLICATION_CREDENTIALS = configFile;
  return configFile;
}
