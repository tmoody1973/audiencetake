data "google_project" "current" {
  project_id = var.project_id
}

locals {
  required_apis = toset([
    "aiplatform.googleapis.com",
    "artifactregistry.googleapis.com",
    "billingbudgets.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudtasks.googleapis.com",
    "firestore.googleapis.com",
    "iamcredentials.googleapis.com",
    "logging.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
  ])
}

resource "google_project_service" "required" {
  for_each           = local.required_apis
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_project_service_identity" "cloud_tasks" {
  provider = google-beta

  project = var.project_id
  service = "cloudtasks.googleapis.com"

  depends_on = [google_project_service.required]
}

resource "google_artifact_registry_repository" "agents" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_repository_id
  description   = "Audience Take agent service images"
  format        = "DOCKER"

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret" "parallel_api_key" {
  project   = var.project_id
  secret_id = var.parallel_secret_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_service_account" "task_invoker" {
  project      = var.project_id
  account_id   = "audience-take-task-invoker"
  display_name = "Audience Take Cloud Tasks invoker"
}

resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = "audience-take-agent-runtime"
  display_name = "Audience Take research runtime"
}

resource "google_cloud_tasks_queue" "research" {
  project  = var.project_id
  location = var.region
  name     = var.queue_name

  rate_limits {
    max_concurrent_dispatches = 1
    max_dispatches_per_second = 1
  }

  retry_config {
    # Cloud Tasks stops only after both attempt and duration limits are reached.
    # Pair one attempt with a one-second window so a failed provider-bearing
    # request cannot be redelivered after the five-second minimum backoff.
    max_attempts       = 1
    min_backoff        = "5s"
    max_backoff        = "300s"
    max_doublings      = 3
    max_retry_duration = "1s"
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service" "agents" {
  project  = var.project_id
  location = var.region
  name     = var.service_name
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account                  = google_service_account.runtime.email
    timeout                          = "900s"
    max_instance_request_concurrency = 1

    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }

    containers {
      image = var.container_image

      ports {
        container_port = 8080
      }

      resources {
        cpu_idle = true
        limits = {
          cpu    = "2"
          memory = "2Gi"
        }
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }

      env {
        name  = "GOOGLE_CLOUD_LOCATION"
        value = var.vertex_location
      }

      env {
        name  = "AUDIENCE_TAKE_GEMINI_MODEL"
        value = var.gemini_model
      }

      env {
        name  = "AUDIENCE_TAKE_MAX_TASK_RETRY_COUNT"
        value = "0"
      }

      env {
        name = "PARALLEL_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.parallel_api_key.secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        initial_delay_seconds = 1
        timeout_seconds       = 2
        period_seconds        = 5
        failure_threshold     = 12
        http_get {
          path = "/healthz"
          port = 8080
        }
      }
    }
  }

  depends_on = [
    google_project_service.required,
    google_secret_manager_secret_iam_member.runtime_parallel_secret,
  ]
}

resource "google_billing_budget" "audience_take" {
  billing_account = var.billing_account_id
  display_name    = "Audience Take monthly alert"

  lifecycle {
    prevent_destroy = true
  }

  budget_filter {
    projects               = ["projects/${data.google_project.current.number}"]
    credit_types_treatment = "EXCLUDE_ALL_CREDITS"
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.monthly_budget_usd)
    }
  }

  threshold_rules {
    threshold_percent = 0.1
  }

  threshold_rules {
    threshold_percent = 0.5
  }

  threshold_rules {
    threshold_percent = 0.9
  }

  threshold_rules {
    threshold_percent = 1.0
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service_iam_member" "task_invoker" {
  project  = google_cloud_run_v2_service.agents.project
  location = google_cloud_run_v2_service.agents.location
  name     = google_cloud_run_v2_service.agents.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.task_invoker.email}"
}

resource "google_service_account_iam_member" "tasks_can_mint_oidc" {
  service_account_id = google_service_account.task_invoker.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = google_project_service_identity.cloud_tasks.member
}

resource "google_service_account_iam_member" "app_can_attach_task_identity" {
  count = var.app_hosting_service_account_email == null ? 0 : 1

  service_account_id = google_service_account.task_invoker.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${var.app_hosting_service_account_email}"
}

resource "google_project_iam_member" "app_can_enqueue" {
  count = var.app_hosting_service_account_email == null ? 0 : 1

  project = var.project_id
  role    = "roles/cloudtasks.enqueuer"
  member  = "serviceAccount:${var.app_hosting_service_account_email}"
}

resource "google_project_iam_member" "runtime_roles" {
  for_each = toset([
    "roles/aiplatform.user",
    "roles/datastore.user",
    "roles/logging.logWriter",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_secret_manager_secret_iam_member" "runtime_parallel_secret" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.parallel_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}
