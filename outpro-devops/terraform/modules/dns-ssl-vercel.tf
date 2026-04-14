# terraform/modules/acm/main.tf
# ACM SSL Certificate with DNS validation via Cloudflare

variable "domain_name"        { type = string }
variable "api_subdomain"      { type = string }
variable "cloudflare_zone_id" { type = string }

# Certificate must be in us-east-1 for CloudFront
resource "aws_acm_certificate" "api" {
  provider          = aws.us_east_1  # Use alias set in root main.tf
  domain_name       = "${var.api_subdomain}.${var.domain_name}"
  validation_method = "DNS"

  subject_alternative_names = [
    "${var.api_subdomain}.${var.domain_name}",
    "*.${var.domain_name}",
  ]

  lifecycle {
    create_before_destroy = true  # Prevent downtime on certificate rotation
  }

  tags = { Name = "${var.api_subdomain}.${var.domain_name}" }
}

# Create DNS validation records in Cloudflare
resource "cloudflare_record" "acm_validation" {
  for_each = {
    for dvo in aws_acm_certificate.api.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }

  zone_id = var.cloudflare_zone_id
  name    = each.value.name
  type    = each.value.type
  content = each.value.value
  ttl     = 60
  comment = "ACM DNS validation — managed by Terraform"
}

resource "aws_acm_certificate_validation" "api" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.api.arn
  validation_record_fqdns = [for r in cloudflare_record.acm_validation : r.hostname]
}

output "certificate_arn" { value = aws_acm_certificate_validation.api.certificate_arn }


# ═════════════════════════════════════════════════════════════════════════════
# terraform/modules/route53/main.tf
# DNS records in Cloudflare pointing to ALB and Vercel
# ═════════════════════════════════════════════════════════════════════════════

variable "domain_name"        { type = string }
variable "api_subdomain"      { type = string }
variable "cloudflare_zone_id" { type = string }
variable "alb_dns_name"       { type = string }
variable "environment"        { type = string }

# API subdomain → ALB (proxied through Cloudflare WAF)
resource "cloudflare_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = var.api_subdomain          # api.outpro.india
  type    = "CNAME"
  content = var.alb_dns_name
  proxied = true                       # Cloudflare WAF + CDN enabled
  comment = "API ALB — ${var.environment} — managed by Terraform"
}

# www → Vercel (proxied)
resource "cloudflare_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www"
  type    = "CNAME"
  content = "cname.vercel-dns.com"
  proxied = true
  comment = "Frontend Vercel — managed by Terraform"
}

# Apex (outpro.india) → www redirect via Cloudflare
resource "cloudflare_record" "apex" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  type    = "A"
  content = "76.76.21.21"  # Vercel apex IP
  proxied = true
  comment = "Apex → Vercel — managed by Terraform"
}

# SPF record for email (Resend)
resource "cloudflare_record" "spf" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  type    = "TXT"
  content = "v=spf1 include:amazonses.com include:resend.com ~all"
  comment = "SPF for transactional email — managed by Terraform"
}

# DMARC policy
resource "cloudflare_record" "dmarc" {
  zone_id = var.cloudflare_zone_id
  name    = "_dmarc"
  type    = "TXT"
  content = "v=DMARC1; p=quarantine; rua=mailto:dmarc@outpro.india; pct=100"
  comment = "DMARC policy — managed by Terraform"
}

output "api_fqdn"     { value = "${var.api_subdomain}.${var.domain_name}" }
output "www_fqdn"     { value = "www.${var.domain_name}" }


# ═════════════════════════════════════════════════════════════════════════════
# terraform/modules/waf/main.tf
# Cloudflare WAF rules for the API
# ═════════════════════════════════════════════════════════════════════════════

variable "cloudflare_zone_id" { type = string }
variable "api_subdomain"      { type = string }
variable "domain_name"        { type = string }

# Rate limit — 100 req/min per IP on public API endpoints
resource "cloudflare_rate_limit" "api_public" {
  zone_id   = var.cloudflare_zone_id
  threshold = 100
  period    = 60
  match {
    request {
      url_pattern = "${var.api_subdomain}.${var.domain_name}/api/v1/contact*"
    }
  }
  action {
    mode    = "ban"
    timeout = 60
    response {
      content_type = "application/json"
      body         = "{\"success\":false,\"error\":{\"code\":\"RATE_LIMIT_EXCEEDED\",\"message\":\"Too many requests\"}}"
    }
  }
}

# Rate limit — 10 req/min per IP on auth endpoints
resource "cloudflare_rate_limit" "api_auth" {
  zone_id   = var.cloudflare_zone_id
  threshold = 10
  period    = 60
  match {
    request {
      url_pattern = "${var.api_subdomain}.${var.domain_name}/api/v1/auth/login*"
    }
  }
  action {
    mode    = "ban"
    timeout = 300  # 5-minute ban on auth brute-force
    response {
      content_type = "application/json"
      body         = "{\"success\":false,\"error\":{\"code\":\"RATE_LIMIT_EXCEEDED\",\"message\":\"Too many login attempts\"}}"
    }
  }
}

# Firewall rule — block common attack patterns
resource "cloudflare_firewall_rule" "block_bad_bots" {
  zone_id     = var.cloudflare_zone_id
  description = "Block known bad bots and scanners"
  paused      = false
  priority    = 1
  action      = "block"
  filter_id   = cloudflare_filter.bad_bots.id
}

resource "cloudflare_filter" "bad_bots" {
  zone_id     = var.cloudflare_zone_id
  description = "Bad bot user agents"
  expression  = "(cf.client.bot) and not (cf.verified_bot_category in {\"Search Engine Crawler\" \"Monitoring & Analytics\"})"
}


# ═════════════════════════════════════════════════════════════════════════════
# terraform/modules/vercel/main.tf
# Vercel project provisioning with env vars
# ═════════════════════════════════════════════════════════════════════════════

variable "domain_name"         { type = string }
variable "api_url"             { type = string }
variable "sanity_project_id"   { type = string }
variable "sanity_dataset"      { type = string }
variable "sanity_api_token"    { type = string; sensitive = true }
variable "recaptcha_site_key"  { type = string; sensitive = true }
variable "supabase_url"        { type = string }
variable "jwt_secret"          { type = string; sensitive = true }
variable "revalidation_secret" { type = string; sensitive = true }
variable "ga4_measurement_id"  { type = string }
variable "vercel_team_id"      { type = string }
variable "environment"         { type = string }

resource "vercel_project" "frontend" {
  name      = "outpro-india-frontend"
  framework = "nextjs"

  git_repository = {
    type = "github"
    repo = "outpro-india/outpro-frontend"
  }

  # Vercel build settings
  build_command    = "pnpm build"
  install_command  = "pnpm install --frozen-lockfile"
  output_directory = ".next"

  serverless_function_region = "bom1"  # Mumbai edge region

  # Environment variables for production
  environment = [
    {
      key    = "NEXT_PUBLIC_API_URL"
      value  = var.api_url
      target = ["production", "preview"]
    },
    {
      key    = "NEXT_PUBLIC_SANITY_PROJECT_ID"
      value  = var.sanity_project_id
      target = ["production", "preview"]
    },
    {
      key    = "NEXT_PUBLIC_SANITY_DATASET"
      value  = var.sanity_dataset
      target = ["production", "preview"]
    },
    {
      key    = "NEXT_PUBLIC_RECAPTCHA_SITE_KEY"
      value  = var.recaptcha_site_key
      target = ["production", "preview"]
    },
    {
      key    = "NEXT_PUBLIC_SUPABASE_URL"
      value  = var.supabase_url
      target = ["production", "preview"]
    },
    {
      key    = "NEXT_PUBLIC_GA4_MEASUREMENT_ID"
      value  = var.ga4_measurement_id
      target = ["production"]
    },
    {
      key       = "SANITY_API_TOKEN"
      value     = var.sanity_api_token
      target    = ["production", "preview"]
      sensitive = true
    },
    {
      key       = "RECAPTCHA_SECRET_KEY"
      value     = var.revalidation_secret  # Server-side reCAPTCHA secret
      target    = ["production", "preview"]
      sensitive = true
    },
    {
      key       = "REVALIDATION_SECRET"
      value     = var.revalidation_secret
      target    = ["production", "preview"]
      sensitive = true
    },
    {
      key       = "JWT_SECRET"
      value     = var.jwt_secret
      target    = ["production", "preview"]
      sensitive = true
    },
  ]
}

# Custom domain
resource "vercel_project_domain" "www" {
  project_id = vercel_project.frontend.id
  domain     = "www.${var.domain_name}"
}

resource "vercel_project_domain" "apex" {
  project_id = vercel_project.frontend.id
  domain     = var.domain_name
  redirect   = "www.${var.domain_name}"
}

output "vercel_project_id"  { value = vercel_project.frontend.id }
output "vercel_project_url" { value = "https://www.${var.domain_name}" }
