# terraform/envs/production/terraform.tfvars
# Production environment — all sensitive values via AWS Secrets Manager or CI/CD env vars
# DO NOT commit this file with real values — use terraform.tfvars.example as the template

environment        = "production"
aws_region         = "ap-south-1"
vpc_cidr           = "10.0.0.0/16"
availability_zones = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]

# ECS sizing — 2 tasks baseline, scales to 6
api_cpu           = 512      # 0.5 vCPU
api_memory        = 1024     # 1 GB
api_desired_count = 2
api_min_count     = 1
api_max_count     = 6

domain_name    = "outpro.india"
api_subdomain  = "api"

# Backups and monitoring
backup_retention_days = 365
alert_email           = "devops@outpro.india"

# ── Secrets (injected at CI/CD time — NOT stored here) ────────────────────────
# These are set via environment variables in GitHub Actions:
#   TF_VAR_jwt_secret
#   TF_VAR_database_url
#   TF_VAR_resend_api_key
#   TF_VAR_recaptcha_secret_key
#   TF_VAR_supabase_service_role_key
#   TF_VAR_revalidation_secret
#   TF_VAR_cloudflare_zone_id
#   TF_VAR_cloudflare_api_token
#   TF_VAR_vercel_api_token
#   TF_VAR_vercel_team_id
#   TF_VAR_slack_webhook_url
