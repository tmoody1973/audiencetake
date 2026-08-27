output "queue_path" {
  value = google_cloud_tasks_queue.research.id
}

output "cloud_run_uri_and_oidc_audience" {
  value = google_cloud_run_v2_service.agents.uri
}

output "task_invoker_service_account_email" {
  value = google_service_account.task_invoker.email
}

output "runtime_service_account_email" {
  value = google_service_account.runtime.email
}

output "artifact_repository" {
  value = google_artifact_registry_repository.agents.name
}

output "parallel_secret_id" {
  value = google_secret_manager_secret.parallel_api_key.secret_id
}
