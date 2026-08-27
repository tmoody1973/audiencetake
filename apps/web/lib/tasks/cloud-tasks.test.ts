import { describe, expect, it, vi } from "vitest";

import {
  CloudTasksConfigurationError,
  cloudTaskConfigFromEnv,
  createCloudTasksResearchDispatcher,
  deterministicResearchTaskId,
  type CloudTaskDispatcherConfig,
} from "./cloud-tasks";

const config: CloudTaskDispatcherConfig = {
  project: "audience-take",
  location: "us-central1",
  queue: "research",
  serviceUrl: "https://agents.example.run.app",
  audience: "https://agents.example.run.app",
  serviceAccountEmail: "task-invoker@audience-take.iam.gserviceaccount.com",
};

function client() {
  return {
    queuePath: vi.fn((project, location, queue) => `projects/${project}/locations/${location}/queues/${queue}`),
    taskPath: vi.fn((project, location, queue, task) => `projects/${project}/locations/${location}/queues/${queue}/tasks/${task}`),
    createTask: vi.fn().mockResolvedValue([{}]),
  };
}

describe("Cloud Tasks research dispatcher", () => {
  it("creates one deterministic OIDC-authenticated task with the worker contract", async () => {
    const fake = client();
    const dispatch = createCloudTasksResearchDispatcher(config, fake);
    await dispatch({ runId: "run_7", projectId: "project_3", nominationId: "private", attempt: 2 });

    const request = fake.createTask.mock.calls[0][0];
    expect(request.parent).toBe("projects/audience-take/locations/us-central1/queues/research");
    expect(request.task.name.endsWith("/tasks/research-run_7-attempt-2")).toBe(true);
    expect(request.task.httpRequest).toMatchObject({
      httpMethod: "POST",
      url: "https://agents.example.run.app/tasks/research",
      oidcToken: {
        serviceAccountEmail: config.serviceAccountEmail,
        audience: config.audience,
      },
    });
    const payload = JSON.parse(Buffer.from(request.task.httpRequest.body, "base64").toString("utf8"));
    expect(payload).toEqual({
      runId: "run_7",
      projectId: "project_3",
      attempt: 2,
      researchVersion: 1,
      taskName: "research-run_7-attempt-2",
    });
    expect(JSON.stringify(payload)).not.toContain("private");
  });

  it("treats ALREADY_EXISTS as an idempotent enqueue success", async () => {
    const fake = client();
    fake.createTask.mockRejectedValueOnce(Object.assign(new Error("exists"), { code: 6 }));
    await expect(
      createCloudTasksResearchDispatcher(config, fake)({
        runId: "run-1",
        projectId: "project-1",
        nominationId: "nomination-1",
        attempt: 1,
      }),
    ).resolves.toBeUndefined();
  });

  it("fails closed when local configuration is missing or insecure", () => {
    expect(() => cloudTaskConfigFromEnv({})).toThrow(CloudTasksConfigurationError);
    expect(() =>
      createCloudTasksResearchDispatcher({ ...config, serviceUrl: "http://127.0.0.1:8080" }, client()),
    ).toThrow("HTTPS");
    expect(() => deterministicResearchTaskId("not/a/run", 1)).toThrow();
  });
});
