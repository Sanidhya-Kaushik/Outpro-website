# terraform/main.tf
# Outpro.India — Root Terraform Configuration
# Architecture: Vercel (Frontend) + AWS ECS Fargate (Backend) + Supabase (DB)
# Regions: ap-south-1 (Mumbai) primary + us-east-1 (CloudFront/ACM)

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    vercel = {
      source  = "vercel/vercel"
      version = "~> 1.4"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.26"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Remote state — S3 + DynamoDB locking
  # Bootstrap: run scripts/bootstrap-tfstate.sh once before terraform init
  backend "s3" {
    bucket         = "outpro-india-tfstate"
    key            = "infrastructure/terraform.tfstate"
    region         = "ap-south-1"
    encrypt        = true
    dynamodb_table = "outpro-india-tfstate-lock"
    kms_key_id     = "alias/outpro-tfstate"
  }
}

# ── AWS Provider (Mumbai — primary) ──────────────────────────────────────────

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "outpro-india"
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = "devops@outpro.india"
    }
  }
}

# AWS provider in us-east-1 — required for ACM certificates used by CloudFront
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "outpro-india"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# ── Vercel Provider ───────────────────────────────────────────────────────────

provider "vercel" {
  api_token = var.vercel_api_token
  team      = var.vercel_team_id
}

# ── Cloudflare Provider (WAF + DNS) ──────────────────────────────────────────

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# ── Data sources ──────────────────────────────────────────────────────────────

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id  = data.aws_caller_identity.current.account_id
  region      = data.aws_region.current.name
  name_prefix = "outpro-${var.environment}"

  common_tags = {
    Project     = "outpro-india"
    Environment = var.environment
    Region      = local.region
  }
}
