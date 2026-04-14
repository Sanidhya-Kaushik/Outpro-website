# terraform/variables.tf

# ── Environment ───────────────────────────────────────────────────────────────

variable "environment" {
  description = "Deployment environment"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be 'staging' or 'production'."
  }
}

variable "aws_region" {
  description = "AWS primary region (Mumbai)"
  type        = string
  default     = "ap-south-1"
}

# ── Network ───────────────────────────────────────────────────────────────────

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "AZs to use within the region"
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]
}

# ── ECS ───────────────────────────────────────────────────────────────────────

variable "api_image_tag" {
  description = "Docker image tag for the API (ECR)"
  type        = string
  default     = "latest"
}

variable "api_cpu" {
  description = "Fargate task CPU units (1 vCPU = 1024)"
  type        = number
  default     = 512

  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.api_cpu)
    error_message = "CPU must be a valid Fargate CPU value."
  }
}

variable "api_memory" {
  description = "Fargate task memory in MiB"
  type        = number
  default     = 1024
}

variable "api_desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 2
}

variable "api_min_count" {
  description = "Minimum ECS tasks (auto-scaling)"
  type        = number
  default     = 1
}

variable "api_max_count" {
  description = "Maximum ECS tasks (auto-scaling)"
  type        = number
  default     = 6
}

# ── Domain & DNS ──────────────────────────────────────────────────────────────

variable "domain_name" {
  description = "Primary domain name"
  type        = string
  default     = "outpro.india"
}

variable "api_subdomain" {
  description = "API subdomain"
  type        = string
  default     = "api"
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for outpro.india"
  type        = string
  sensitive   = true
}

# ── Vercel ────────────────────────────────────────────────────────────────────

variable "vercel_api_token" {
  description = "Vercel API token"
  type        = string
  sensitive   = true
}

variable "vercel_team_id" {
  description = "Vercel team slug or ID"
  type        = string
  sensitive   = true
}

# ── Cloudflare ────────────────────────────────────────────────────────────────

variable "cloudflare_api_token" {
  description = "Cloudflare API token with Zone.DNS and Zone.WAF permissions"
  type        = string
  sensitive   = true
}

# ── Secrets (passed via AWS Secrets Manager — not stored in tfvars) ───────────

variable "jwt_secret" {
  description = "JWT signing secret (min 64 chars) — stored in AWS Secrets Manager"
  type        = string
  sensitive   = true
}

variable "database_url" {
  description = "PostgreSQL connection URL (Supabase) — stored in AWS Secrets Manager"
  type        = string
  sensitive   = true
}

variable "resend_api_key" {
  description = "Resend email API key — stored in AWS Secrets Manager"
  type        = string
  sensitive   = true
}

variable "recaptcha_secret_key" {
  description = "Google reCAPTCHA v3 secret key"
  type        = string
  sensitive   = true
}

variable "hubspot_api_key" {
  description = "HubSpot private app token (optional)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "supabase_service_role_key" {
  description = "Supabase service role key"
  type        = string
  sensitive   = true
}

variable "revalidation_secret" {
  description = "Next.js ISR revalidation webhook secret"
  type        = string
  sensitive   = true
}

# ── Backup ────────────────────────────────────────────────────────────────────

variable "backup_retention_days" {
  description = "S3 backup retention in days"
  type        = number
  default     = 30
}

# ── Alerting ──────────────────────────────────────────────────────────────────

variable "alert_email" {
  description = "Email address for CloudWatch alarms"
  type        = string
  default     = "devops@outpro.india"
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for deployment and alert notifications"
  type        = string
  sensitive   = true
  default     = ""
}
