variable "project_id" {
  description = "Existing Google Cloud project ID."
  type        = string
}

variable "billing_account_id" {
  description = "Billing account that funds the project and owns its budget."
  type        = string
}

variable "monthly_budget_usd" {
  description = "Monthly alert budget in whole USD; alerts do not automatically cap billing."
  type        = number
  default     = 10
}

variable "region" {
  description = "Region shared by Cloud Run and Cloud Tasks."
  type        = string
}

variable "service_name" {
  description = "Private Cloud Run service name."
  type        = string
  default     = "audience-take-agents"
}

variable "queue_name" {
  description = "Cloud Tasks queue ID."
  type        = string
  default     = "audience-take-research"
}

variable "container_image" {
  description = "Immutable Artifact Registry image reference, preferably by digest."
  type        = string

  validation {
    condition     = strcontains(var.container_image, "@sha256:")
    error_message = "Use an immutable container image digest."
  }
}

variable "artifact_repository_id" {
  description = "Artifact Registry Docker repository ID."
  type        = string
  default     = "audience-take"
}

variable "parallel_secret_id" {
  description = "Secret Manager secret ID whose versions are added outside Terraform."
  type        = string
  default     = "audience-take-parallel-api-key"
}

variable "app_hosting_service_account_email" {
  description = "Firebase App Hosting backend service-account email, once the backend exists."
  type        = string
  default     = null
  nullable    = true
}

variable "vertex_location" {
  description = "Vertex AI location used by the runtime."
  type        = string
}

variable "gemini_model" {
  description = "Reviewed Vertex AI Gemini model name."
  type        = string
}
