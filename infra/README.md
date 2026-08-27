# Audience Take research infrastructure

This directory describes the private research worker boundary without assuming
a Google Cloud project, region, domain, secret value, or deploy authority.
Nothing here deploys by itself.

## What the Terraform plan creates

- a private-by-IAM Cloud Run v2 service for `POST /tasks/research`;
- a Cloud Tasks queue constrained to one total delivery during controlled launch;
- separate App Hosting enqueue, task-invoker, and runtime identities;
- only `roles/run.invoker` for the task identity on this Cloud Run service;
- an Artifact Registry Docker repository and Secret Manager secret metadata;
- runtime access to Firestore, Vertex AI, logging, and the Parallel secret;
- the API enablement and service-agent token permission Cloud Tasks needs to
  mint the configured OIDC token.

## Cost guardrails

- Cloud Run has zero minimum instances and a maximum of one instance.
- The research queue dispatches one task at a time. Its one-attempt and
  one-second retry limits are paired because Cloud Tasks stops only after both
  configured limits are reached.
- Terraform creates a project-scoped monthly budget alert; a budget is an alert,
  not a hard billing cap.
- Keep the research queue paused outside controlled smoke tests and demos. Resume
  it only for an authorized run, then pause it again after the terminal receipt.

Cloud Run uses public ingress because Cloud Tasks is an external Google-managed
caller, but the service has no `allUsers` invoker binding. Cloud Run IAM validates
the task identity's OIDC token and audience before the container receives the
request. The app additionally requires Cloud Tasks transport headers and binds
the deterministic task ID to the request body.

## Safe operator workflow

1. Apply the API, Artifact Registry, secret-metadata, identity, and queue bootstrap
   resources, then add the Parallel secret version directly from a local secret
   source so its value never enters Terraform state.
2. Build and push `services/agents/Dockerfile` to the Terraform-managed Artifact Registry.
3. Copy `terraform/example.tfvars` outside source control and replace every
   placeholder with reviewed environment values.
4. From `infra/terraform`, run `terraform init`, `terraform fmt -check`,
   `terraform validate`, and `terraform plan -var-file=...`.
5. Review the plan for project, region, identities, secret, image digest, and IAM.
6. Only an authorized operator may run `terraform apply` in the intended project.
7. Configure the web backend with the queue output, Cloud Run URI/audience, and
   task-invoker email. Do not download service-account keys.

The template intentionally does not grant the App Hosting identity Cloud Run
invocation and does not grant the Cloud Tasks identity Firestore, Vertex AI, or
secret access.

## Queue request contract

The producer creates the task ID `research-{runId}-attempt-{attempt}` and targets
`{cloud_run_uri}/tasks/research` with an OIDC token whose audience is exactly the
Cloud Run service URI. Queue retry configuration is queue-level, as required by
Cloud Tasks.

```json
{
  "runId": "opaque_run_id",
  "projectId": "opaque_project_id",
  "attempt": 1,
  "researchVersion": 1,
  "taskName": "research-opaque_run_id-attempt-1"
}
```

The handler returns 2xx for terminal, superseded, or healthy-owner duplicate
deliveries. A retryable executor failure releases the lease and returns 503.
Provider orchestration is intentionally injected into the runtime in the next
slice; an unconfigured deployment returns 503 instead of acknowledging lost work.
