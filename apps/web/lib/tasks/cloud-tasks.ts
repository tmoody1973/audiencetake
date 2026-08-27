import { CloudTasksClient } from "@google-cloud/tasks";

import type { ResearchDispatcher } from "../nomination/service";
import {
  googleAuthClientFromEnv,
  googleServiceAccountFromEnv,
} from "../google/credentials";

const MAX_TASK_BODY_BYTES = 4_096;
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

type CloudTasksClientLike = {
  queuePath(project: string, location: string, queue: string): string;
  taskPath(project: string, location: string, queue: string, task: string): string;
  createTask(request: {
    parent: string;
    task: {
      name: string;
      httpRequest: {
        httpMethod: "POST";
        url: string;
        headers: Record<string, string>;
        oidcToken: { serviceAccountEmail: string; audience: string };
        body: string;
      };
    };
  }): Promise<unknown>;
};

export type CloudTaskDispatcherConfig = {
  project: string;
  location: string;
  queue: string;
  serviceUrl: string;
  audience: string;
  serviceAccountEmail: string;
};

export class CloudTasksConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudTasksConfigurationError";
  }
}

export function cloudTasksClientOptionsFromEnv(
  project: string,
  environment: Record<string, string | undefined> = process.env,
) {
  const authClient = googleAuthClientFromEnv(environment);
  if (authClient) return { projectId: project, authClient };
  const serviceAccount = googleServiceAccountFromEnv(environment);
  return serviceAccount
    ? {
        projectId: project,
        credentials: {
          client_email: serviceAccount.clientEmail,
          private_key: serviceAccount.privateKey,
        },
      }
    : { projectId: project };
}

export function deterministicResearchTaskId(runId: string, attempt: number): string {
  if (!SAFE_ID.test(runId) || !Number.isInteger(attempt) || attempt < 1 || attempt > 100) {
    throw new Error("Invalid research task identity.");
  }
  return `research-${runId}-attempt-${attempt}`;
}

export function cloudTaskConfigFromEnv(
  environment: Record<string, string | undefined> = process.env,
): CloudTaskDispatcherConfig {
  const config = {
    project: environment.GOOGLE_CLOUD_PROJECT?.trim() ?? "",
    location: environment.CLOUD_TASKS_LOCATION?.trim() ?? "",
    queue: environment.CLOUD_TASKS_QUEUE?.trim() ?? "",
    serviceUrl: environment.AGENT_SERVICE_URL?.trim() ?? "",
    audience: environment.AGENT_SERVICE_AUDIENCE?.trim() ?? "",
    serviceAccountEmail: environment.CLOUD_TASKS_SERVICE_ACCOUNT?.trim() ?? "",
  };
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) {
    throw new CloudTasksConfigurationError(
      `Cloud Tasks dispatch is not configured (${missing.join(", ")}).`,
    );
  }
  return config;
}

function researchEndpoint(serviceUrl: string): string {
  let endpoint: URL;
  try {
    endpoint = new URL("/tasks/research", serviceUrl);
  } catch {
    throw new CloudTasksConfigurationError("AGENT_SERVICE_URL must be an absolute URL.");
  }
  if (endpoint.protocol !== "https:") {
    throw new CloudTasksConfigurationError("AGENT_SERVICE_URL must use HTTPS.");
  }
  return endpoint.toString();
}

function isAlreadyExists(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; status?: unknown };
  return candidate.code === 6 || candidate.code === "6" || candidate.status === "ALREADY_EXISTS";
}

export function createCloudTasksResearchDispatcher(
  config: CloudTaskDispatcherConfig = cloudTaskConfigFromEnv(),
  client: CloudTasksClientLike = new CloudTasksClient(
    cloudTasksClientOptionsFromEnv(config.project),
  ) as CloudTasksClientLike,
): ResearchDispatcher {
  const endpoint = researchEndpoint(config.serviceUrl);
  return async ({ runId, projectId, attempt }) => {
    if (!SAFE_ID.test(projectId)) throw new Error("Invalid research project identity.");
    const taskId = deterministicResearchTaskId(runId, attempt);
    const payload = JSON.stringify({
      runId,
      projectId,
      attempt,
      researchVersion: 1,
      taskName: taskId,
    });
    if (Buffer.byteLength(payload, "utf8") > MAX_TASK_BODY_BYTES) {
      throw new Error("Research task payload exceeds the safe size limit.");
    }

    const parent = client.queuePath(config.project, config.location, config.queue);
    try {
      await client.createTask({
        parent,
        task: {
          name: client.taskPath(config.project, config.location, config.queue, taskId),
          httpRequest: {
            httpMethod: "POST",
            url: endpoint,
            headers: { "Content-Type": "application/json" },
            oidcToken: {
              serviceAccountEmail: config.serviceAccountEmail,
              audience: config.audience,
            },
            body: Buffer.from(payload, "utf8").toString("base64"),
          },
        },
      });
    } catch (error) {
      // A deterministic task name makes a retried enqueue safe. The worker's
      // lease remains the correctness boundary after Cloud Tasks accepts it.
      if (!isAlreadyExists(error)) throw error;
    }
  };
}
