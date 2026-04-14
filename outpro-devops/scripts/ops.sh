#!/usr/bin/env bash
# scripts/bootstrap-tfstate.sh
# Run ONCE before the first `terraform init` to create the S3 + DynamoDB state backend.
# After this script succeeds, commit the backend configuration and never run it again.

set -euo pipefail

REGION="ap-south-1"
BUCKET="outpro-india-tfstate"
TABLE="outpro-india-tfstate-lock"
KMS_ALIAS="alias/outpro-tfstate"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "Bootstrapping Terraform state backend..."
echo "Account: $ACCOUNT_ID | Region: $REGION"

# Create KMS key for state encryption
KEY_ID=$(aws kms create-key \
  --description "Outpro India Terraform state encryption" \
  --region "$REGION" \
  --query KeyMetadata.KeyId \
  --output text 2>/dev/null || \
  aws kms describe-key --key-id "$KMS_ALIAS" --query KeyMetadata.KeyId --output text)

aws kms create-alias \
  --alias-name "$KMS_ALIAS" \
  --target-key-id "$KEY_ID" \
  --region "$REGION" 2>/dev/null || true

echo "KMS key ready: $KEY_ID"

# Create S3 bucket with versioning + encryption
aws s3api create-bucket \
  --bucket "$BUCKET" \
  --region "$REGION" \
  --create-bucket-configuration LocationConstraint="$REGION" 2>/dev/null || true

aws s3api put-bucket-versioning \
  --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "$BUCKET" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "aws:kms",
        "KMSMasterKeyID": "'"$KEY_ID"'"
      }
    }]
  }'

aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo "S3 state bucket ready: s3://$BUCKET"

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name "$TABLE" \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION" 2>/dev/null || true

echo "DynamoDB lock table ready: $TABLE"
echo ""
echo "Bootstrap complete. Run: terraform init"


---


#!/usr/bin/env bash
# scripts/backup-database.sh
# Manual + scheduled database backup → S3
# Called by cron on ECS task or GitHub Actions scheduled workflow

set -euo pipefail

ENVIRONMENT="${ENVIRONMENT:-production}"
BACKUP_BUCKET="outpro-${ENVIRONMENT}-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="db/${TIMESTAMP}"

echo "[$(date -u)] Starting database backup: ${TIMESTAMP}"

# Pull DATABASE_URL from Secrets Manager (production-safe)
if [ -z "${DATABASE_URL:-}" ]; then
  SECRET_ARN="arn:aws:secretsmanager:ap-south-1:$(aws sts get-caller-identity --query Account --output text):secret:outpro-${ENVIRONMENT}/api-secrets"
  DATABASE_URL=$(aws secretsmanager get-secret-value \
    --secret-id "$SECRET_ARN" \
    --query SecretString \
    --output text | python3 -c "import json,sys; print(json.load(sys.stdin)['DATABASE_URL'])")
fi

# Create temp directory
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# pg_dump — schema + data, custom format for efficient restore
pg_dump \
  "$DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  --file="$TMPDIR/backup.dump"

# Encrypt with AWS KMS before upload
aws s3 cp \
  "$TMPDIR/backup.dump" \
  "s3://${BACKUP_BUCKET}/${BACKUP_DIR}/database.dump" \
  --sse aws:kms \
  --storage-class STANDARD \
  --no-progress

echo "[$(date -u)] Backup uploaded: s3://${BACKUP_BUCKET}/${BACKUP_DIR}/database.dump"

# Verify the backup is readable
OBJECT_SIZE=$(aws s3api head-object \
  --bucket "$BACKUP_BUCKET" \
  --key "${BACKUP_DIR}/database.dump" \
  --query ContentLength \
  --output text)

if [ "$OBJECT_SIZE" -lt 1024 ]; then
  echo "ERROR: Backup file suspiciously small ($OBJECT_SIZE bytes)" >&2
  exit 1
fi

echo "[$(date -u)] Backup verified: ${OBJECT_SIZE} bytes"
echo "[$(date -u)] Database backup complete ✓"


---


#!/usr/bin/env bash
# scripts/rotate-secrets.sh
# Rotate JWT secret and update both AWS Secrets Manager and Vercel env vars
# Run quarterly or after a suspected credential compromise

set -euo pipefail

ENVIRONMENT="${1:-production}"
AWS_REGION="ap-south-1"
SECRET_NAME="outpro-${ENVIRONMENT}/api-secrets"
VERCEL_PROJECT_ID="${VERCEL_PROJECT_ID:?VERCEL_PROJECT_ID must be set}"
VERCEL_TOKEN="${VERCEL_TOKEN:?VERCEL_TOKEN must be set}"

echo "Rotating JWT secret for environment: $ENVIRONMENT"
echo "WARNING: All active admin sessions will be invalidated."
read -r -p "Continue? (yes/no): " CONFIRM
[ "$CONFIRM" = "yes" ] || { echo "Aborted."; exit 0; }

# Generate cryptographically secure secret (128 hex chars = 64 bytes)
NEW_JWT_SECRET=$(openssl rand -hex 64)
NEW_REVALIDATION_SECRET=$(openssl rand -hex 32)

# Update AWS Secrets Manager
CURRENT_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_NAME" \
  --region "$AWS_REGION" \
  --query SecretString \
  --output text)

UPDATED_SECRET=$(echo "$CURRENT_SECRET" | python3 -c "
import json, sys
data = json.load(sys.stdin)
data['JWT_SECRET'] = '${NEW_JWT_SECRET}'
data['REVALIDATION_SECRET'] = '${NEW_REVALIDATION_SECRET}'
print(json.dumps(data))
")

aws secretsmanager update-secret \
  --secret-id "$SECRET_NAME" \
  --region "$AWS_REGION" \
  --secret-string "$UPDATED_SECRET"

echo "AWS Secrets Manager updated ✓"

# Update Vercel environment variables
# (JWT_SECRET is used by the Next.js middleware for JWT verification)
for KEY in JWT_SECRET REVALIDATION_SECRET; do
  VALUE=$([ "$KEY" = "JWT_SECRET" ] && echo "$NEW_JWT_SECRET" || echo "$NEW_REVALIDATION_SECRET")

  # Get existing env var ID
  ENV_ID=$(curl -sf \
    "https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" | \
    python3 -c "import json,sys; envs=json.load(sys.stdin)['envs']; [print(e['id']) for e in envs if e['key']=='${KEY}' and 'production' in e.get('target',[])]" | head -1)

  if [ -n "$ENV_ID" ]; then
    curl -sf -X PATCH \
      "https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env/${ENV_ID}" \
      -H "Authorization: Bearer ${VERCEL_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{\"value\": \"${VALUE}\"}" > /dev/null
    echo "Vercel $KEY updated ✓"
  fi
done

# Force ECS task replacement to pick up new secrets
echo "Forcing ECS task replacement..."
aws ecs update-service \
  --cluster "outpro-${ENVIRONMENT}-cluster" \
  --service "outpro-${ENVIRONMENT}-api" \
  --force-new-deployment \
  --region "$AWS_REGION" > /dev/null

echo "ECS deployment triggered ✓"
echo ""
echo "Secret rotation complete. New deployment will be live in ~2 minutes."
echo "All existing admin sessions have been invalidated — users must log in again."


---


#!/usr/bin/env bash
# scripts/rollback.sh
# Emergency rollback to the previous ECS task definition revision

set -euo pipefail

ENVIRONMENT="${1:-production}"
AWS_REGION="ap-south-1"
CLUSTER="outpro-${ENVIRONMENT}-cluster"
SERVICE="outpro-${ENVIRONMENT}-api"

echo "Rolling back $SERVICE in $CLUSTER..."

# Get current task definition ARN
CURRENT_TD=$(aws ecs describe-services \
  --cluster "$CLUSTER" \
  --services "$SERVICE" \
  --region "$AWS_REGION" \
  --query 'services[0].taskDefinition' \
  --output text)

echo "Current task definition: $CURRENT_TD"

# Get the previous revision (current - 1)
CURRENT_REVISION=$(echo "$CURRENT_TD" | grep -oP ':\K\d+$')
PREVIOUS_REVISION=$((CURRENT_REVISION - 1))
FAMILY=$(echo "$CURRENT_TD" | sed 's/:[0-9]*$//')
PREVIOUS_TD="${FAMILY}:${PREVIOUS_REVISION}"

echo "Rolling back to: $PREVIOUS_TD"
read -r -p "Confirm rollback? (yes/no): " CONFIRM
[ "$CONFIRM" = "yes" ] || { echo "Aborted."; exit 0; }

aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --task-definition "$PREVIOUS_TD" \
  --region "$AWS_REGION" \
  --force-new-deployment > /dev/null

echo "Rollback initiated. Monitoring deployment..."

aws ecs wait services-stable \
  --cluster "$CLUSTER" \
  --services "$SERVICE" \
  --region "$AWS_REGION"

echo "Rollback complete ✓ — service is stable on $PREVIOUS_TD"
