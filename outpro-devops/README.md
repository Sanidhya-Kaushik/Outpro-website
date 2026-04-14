# Outpro.India — DevOps & Infrastructure

## Architecture Overview

```
                        ┌─────────────────────────────────────────────┐
                        │         CLOUDFLARE (Global Edge)             │
                        │   WAF · DDoS · Bot Management · CDN Cache    │
                        └────────────────┬───────────────┬────────────┘
                                         │               │
                    ┌────────────────────▼──┐    ┌───────▼────────────────┐
                    │   VERCEL (Frontend)    │    │   AWS ALB (API)        │
                    │   Next.js 14 SSG/ISR  │    │   ap-south-1           │
                    │   Mumbai edge (bom1)  │    │   TLS 1.3              │
                    └───────────────────────┘    └───────┬────────────────┘
                                                         │
                                         ┌───────────────▼──────────────────┐
                                         │  ECS FARGATE (Private Subnets)   │
                                         │  2–6 tasks · Node.js API          │
                                         │  Auto-scaling · Circuit breaker   │
                                         └──────┬──────────────┬────────────┘
                                                │              │
                                    ┌───────────▼──┐  ┌────────▼───────────┐
                                    │  SUPABASE DB │  │  AWS SECRETS MGR   │
                                    │  PostgreSQL  │  │  All credentials    │
                                    │  + Storage   │  │  AES-256 encrypted  │
                                    └──────────────┘  └────────────────────┘
```

## Stack Decision Matrix

| Layer | Service | Rationale |
|---|---|---|
| Frontend hosting | **Vercel** | Native Next.js support, atomic deploys, ISR, Edge Functions, Mumbai PoP |
| API hosting | **AWS ECS Fargate** | Serverless containers, auto-scaling, no instance management |
| Database | **Supabase (PostgreSQL)** | Managed Postgres, RLS, Storage, real-time — $25/month |
| CDN + WAF | **Cloudflare Pro** | 200+ PoPs, OWASP WAF, DDoS protection, rate limiting |
| Container registry | **AWS ECR** | Private, co-located with ECS, lifecycle policies |
| Secrets | **AWS Secrets Manager** | Automatic rotation, ECS native integration |
| TLS certificates | **AWS ACM** | Managed renewal, zero-cost, ELB-integrated |
| Monitoring | **CloudWatch** | Native ECS metrics, container insights, log aggregation |
| IaC | **Terraform** | Reproducible, state-managed, module-based |
| CI/CD | **GitHub Actions** | OIDC auth (no long-lived keys), artifact caching |

## Estimated Monthly Costs (Production)

| Service | Tier | Est. Cost (USD) |
|---|---|---|
| Vercel | Pro (1 seat) | $20 |
| AWS ECS Fargate | 2 tasks × 0.5 vCPU × 1 GB, ~720h | ~$18 |
| AWS ALB | 1 × Mumbai | ~$18 |
| AWS NAT Gateways | 3 AZs × $0.045/hr | ~$100 |
| AWS ECR | ~5 GB storage | ~$0.50 |
| AWS Secrets Manager | 1 secret | ~$0.40 |
| AWS CloudWatch | Logs + metrics + dashboard | ~$5 |
| AWS S3 (backups) | ~5 GB + replication | ~$0.25 |
| Supabase | Pro tier | $25 |
| Cloudflare | Pro | $20 |
| **Total** | | **~$207/month** |

> **NAT Gateway cost-saving option**: Replace NAT Gateways ($100/mo) with a single NAT instance (~$8/mo) for non-production environments. In production, keep 3 NAT Gateways for HA.

## Repository Layout

```
devops/
├── terraform/
│   ├── main.tf              # Root config, providers, backend
│   ├── variables.tf         # All input variables with validation
│   ├── outputs.tf           # Infrastructure outputs
│   └── modules/
│       ├── vpc/             # Network: subnets, NAT, SGs, VPC endpoints
│       ├── ecs/             # Fargate: cluster, task def, service, ALB, ASG
│       ├── monitoring/      # CloudWatch alarms, dashboard, SNS, S3 backups
│       └── dns-ssl-vercel.tf # ACM, Cloudflare DNS/WAF, Vercel project
│
├── github-actions/
│   ├── backend-deploy.yml   # Backend: test → build → ECR → ECS deploy
│   ├── frontend-deploy.yml  # Frontend: build → Vercel → Lighthouse → E2E
│   └── lighthouse-e2e-terraform.yml  # Lighthouse CI, smoke tests, Terraform CI
│
└── scripts/
    ├── bootstrap-tfstate.sh # One-time S3 + DynamoDB state backend setup
    ├── backup-database.sh   # pg_dump → S3 (KMS encrypted)
    ├── rotate-secrets.sh    # JWT rotation: Secrets Manager + Vercel + ECS redeploy
    └── rollback.sh          # Emergency ECS task definition rollback
```

## Deployment Flows

### Backend (API) Deployment

```
developer pushes to main
        │
        ▼
GitHub Actions — backend-deploy.yml
        │
        ├── quality     TypeScript · ESLint · pnpm audit · CodeQL SAST
        ├── test        Vitest unit + integration tests with coverage
        ├── build       Docker multi-arch build (amd64 + arm64) → ECR push
        │               Trivy vulnerability scan (fail on CRITICAL/HIGH)
        ├── deploy-staging  ECS rolling deploy → smoke tests
        └── deploy-production ECS rolling deploy with circuit breaker
                              → 3× health check → Slack notification
```

### Frontend Deployment

```
developer pushes to main
        │
        ▼
GitHub Actions — frontend-deploy.yml
        │
        ├── quality     TypeScript · ESLint · TruffleHog secret scan
        ├── build       Next.js build → bundle size check
        ├── deploy      Vercel --prod deploy
        ├── lighthouse  3× Lighthouse runs across 4 pages (thresholds enforced)
        └── e2e         Playwright smoke tests: navigation, forms, security headers
```

### Infrastructure Changes

```
engineer creates PR with Terraform changes
        │
        ▼
GitHub Actions — terraform.yml
        │
        ├── terraform plan   Printed as PR comment
        └── (on merge to main) terraform apply
```

## First-Time Setup

### 1. Bootstrap Terraform state

```bash
aws configure --profile outpro-prod
AWS_PROFILE=outpro-prod bash devops/scripts/bootstrap-tfstate.sh
```

### 2. Configure GitHub Secrets

Set these in `Settings → Secrets and variables → Actions`:

```
# AWS OIDC
AWS_DEPLOY_ROLE_ARN
AWS_STAGING_DEPLOY_ROLE_ARN
AWS_PROD_DEPLOY_ROLE_ARN
AWS_TERRAFORM_ROLE_ARN

# Cloudflare
TF_VAR_CLOUDFLARE_ZONE_ID
TF_VAR_CLOUDFLARE_API_TOKEN

# Vercel
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
TF_VAR_VERCEL_API_TOKEN
TF_VAR_VERCEL_TEAM_ID

# Application secrets (passed to Terraform → Secrets Manager)
TF_VAR_JWT_SECRET
TF_VAR_DATABASE_URL
TF_VAR_RESEND_API_KEY
TF_VAR_RECAPTCHA_SECRET_KEY
TF_VAR_SUPABASE_SERVICE_ROLE_KEY
TF_VAR_REVALIDATION_SECRET

# Sanity CMS
SANITY_PROJECT_ID
SANITY_API_TOKEN

# Monitoring
SLACK_WEBHOOK_URL
```

### 3. Set up AWS OIDC for GitHub Actions (no long-lived keys)

```bash
# Create OIDC provider
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com

# Create deploy role with trust policy
cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike":  { "token.actions.githubusercontent.com:sub": "repo:outpro-india/*:ref:refs/heads/main" }
    }
  }]
}
EOF

aws iam create-role \
  --role-name outpro-prod-deploy \
  --assume-role-policy-document file://trust-policy.json
```

### 4. Provision infrastructure

```bash
cd devops/terraform
terraform init
terraform workspace new production
terraform plan -var-file=envs/production/terraform.tfvars
terraform apply -var-file=envs/production/terraform.tfvars
```

### 5. Update secrets in Secrets Manager

```bash
# Set real secret values (never via tfvars)
aws secretsmanager update-secret \
  --secret-id "outpro-production/api-secrets" \
  --secret-string '{
    "DATABASE_URL": "postgresql://...",
    "JWT_SECRET": "your-64-char-secret",
    "RESEND_API_KEY": "re_...",
    "RECAPTCHA_SECRET_KEY": "...",
    "SUPABASE_SERVICE_ROLE_KEY": "...",
    "REVALIDATION_SECRET": "..."
  }'
```

### 6. Run database migrations

```bash
# Connect to a temporary ECS exec session or run via CI
DATABASE_URL="$(aws secretsmanager get-secret-value --secret-id outpro-production/api-secrets --query SecretString --output text | python3 -c "import json,sys; print(json.load(sys.stdin)['DATABASE_URL'])")" \
  pnpm --dir backend migrate
```

## Operational Runbooks

### Rollback API to previous version

```bash
bash devops/scripts/rollback.sh production
```

### Emergency: rotate all secrets

```bash
VERCEL_PROJECT_ID=xxx VERCEL_TOKEN=yyy bash devops/scripts/rotate-secrets.sh production
```

### Manual database backup

```bash
ENVIRONMENT=production bash devops/scripts/backup-database.sh
```

### Restore database from backup

```bash
# List available backups
aws s3 ls s3://outpro-production-backups/db/ --recursive

# Download and restore
TIMESTAMP="20260413_020001"
aws s3 cp s3://outpro-production-backups/db/${TIMESTAMP}/database.dump /tmp/restore.dump
pg_restore --clean --no-owner --no-acl -d "$DATABASE_URL" /tmp/restore.dump
```

### Force ECS task replacement (picks up new secrets)

```bash
aws ecs update-service \
  --cluster outpro-production-cluster \
  --service outpro-production-api \
  --force-new-deployment
```

### Scale up API manually (traffic spike)

```bash
aws ecs update-service \
  --cluster outpro-production-cluster \
  --service outpro-production-api \
  --desired-count 4
```

### View live API logs

```bash
aws logs tail /ecs/outpro-production-api \
  --follow \
  --filter-pattern "[timestamp, level=ERROR, ...]"
```

## Security Controls

| Control | Implementation |
|---|---|
| No long-lived AWS keys | GitHub Actions uses OIDC role assumption |
| No secrets in code | All secrets in AWS Secrets Manager, injected at runtime |
| Container image scanning | Trivy on every push + ECR scan-on-push |
| SAST | CodeQL on every PR merge to main |
| Secret scanning | TruffleHog in frontend CI |
| TLS 1.3 | ALB policy `ELBSecurityPolicy-TLS13-1-2-2021-06` |
| WAF | Cloudflare OWASP ruleset + custom rate limits |
| Container isolation | ECS tasks in private subnets, SG: only ALB inbound |
| State encryption | S3 backend with KMS-CMK |
| Backup encryption | S3 SSE-KMS + cross-region replication |
| Audit trail | CloudWatch audit log metric filter + alarm |
| Deployment circuit breaker | Auto-rollback on failed health checks |

## Backup Policy

| Data | Frequency | Retention | Storage |
|---|---|---|---|
| PostgreSQL (via Supabase) | Daily automatic | 7 days (Supabase Pro) | Supabase managed |
| PostgreSQL (manual pg_dump) | Daily via cron | 30 days standard, 1 year Glacier | S3 + S3 DR replica |
| ALB access logs | Continuous | 30 days | S3 |
| API logs (CloudWatch) | Continuous | 30 days | CloudWatch Logs |
| Audit logs (exported) | Weekly | 2 years | S3 Glacier |
| ECR images | Per push | 10 tagged versions | ECR |
| Terraform state | Per apply | Versioned forever | S3 with versioning |

## SLO Targets

| Metric | Target | Monitoring |
|---|---|---|
| API uptime | 99.9% | CloudWatch + UptimeRobot |
| API p95 latency | < 500ms | CloudWatch ALB metric |
| Frontend LCP | < 2.5s | Lighthouse CI |
| Frontend PageSpeed | ≥ 90 (mobile) | Lighthouse CI |
| Deployment frequency | ≥ 1/week | GitHub Actions |
| MTTR on P1 incident | < 30 minutes | PagerDuty / Slack |
| Recovery point objective | 24 hours | Backup schedule |
| Recovery time objective | < 2 hours | Rollback runbook |
