# terraform/modules/monitoring/main.tf
# CloudWatch alarms, SNS notifications, dashboard, and S3 backup bucket

variable "name_prefix"       { type = string }
variable "environment"       { type = string }
variable "alert_email"       { type = string }
variable "slack_webhook_url" { type = string; default = "" }
variable "ecs_cluster_name"  { type = string }
variable "ecs_service_name"  { type = string }
variable "alb_arn_suffix"    { type = string }
variable "tg_arn_suffix"     { type = string }
variable "log_group_name"    { type = string }
variable "aws_region"        { type = string }

# ── SNS Topic for alerts ──────────────────────────────────────────────────────

resource "aws_sns_topic" "alerts" {
  name              = "${var.name_prefix}-alerts"
  kms_master_key_id = "alias/aws/sns"
  tags              = { Name = "${var.name_prefix}-alerts" }
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Slack via Lambda (if webhook configured)
resource "aws_sns_topic_subscription" "lambda_slack" {
  count     = var.slack_webhook_url != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.slack_notify[0].arn
}

# Lambda to forward SNS → Slack
resource "aws_lambda_function" "slack_notify" {
  count            = var.slack_webhook_url != "" ? 1 : 0
  function_name    = "${var.name_prefix}-slack-notify"
  role             = aws_iam_role.lambda_slack[0].arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 10
  filename         = data.archive_file.slack_lambda[0].output_path

  environment {
    variables = { SLACK_WEBHOOK_URL = var.slack_webhook_url }
  }

  tags = { Name = "${var.name_prefix}-slack-notify" }
}

data "archive_file" "slack_lambda" {
  count       = var.slack_webhook_url != "" ? 1 : 0
  type        = "zip"
  output_path = "/tmp/slack_notify.zip"
  source {
    content  = <<-JS
      const https = require('https');
      const url = new URL(process.env.SLACK_WEBHOOK_URL);
      exports.handler = async (event) => {
        const msg = JSON.parse(event.Records[0].Sns.Message);
        const text = `*[${msg.AlarmName}]* ${msg.NewStateReason}\nAccount: ${msg.AWSAccountId} | Region: ${msg.Region}`;
        const payload = JSON.stringify({ text });
        return new Promise((resolve, reject) => {
          const req = https.request({ hostname: url.hostname, path: url.pathname + url.search, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': payload.length } }, r => { r.resume(); resolve(); });
          req.on('error', reject);
          req.write(payload);
          req.end();
        });
      };
    JS
    filename = "index.js"
  }
}

resource "aws_iam_role" "lambda_slack" {
  count = var.slack_webhook_url != "" ? 1 : 0
  name  = "${var.name_prefix}-lambda-slack-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_slack_basic" {
  count      = var.slack_webhook_url != "" ? 1 : 0
  role       = aws_iam_role.lambda_slack[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ── CloudWatch Alarms ─────────────────────────────────────────────────────────

# ECS CPU > 80% for 5 minutes
resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  alarm_name          = "${var.name_prefix}-ecs-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "ECS CPU utilization > 80% for 10 minutes"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }
}

# ECS memory > 85%
resource "aws_cloudwatch_metric_alarm" "ecs_memory_high" {
  alarm_name          = "${var.name_prefix}-ecs-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "ECS memory utilization > 85% for 10 minutes"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }
}

# ALB 5xx error rate > 1%
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${var.name_prefix}-alb-5xx-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 1
  alarm_description   = "ALB 5xx error rate > 1% for 10 minutes"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  metric_query {
    id          = "error_rate"
    expression  = "100 * errors / MAX([errors, requests])"
    label       = "5xx Error Rate (%)"
    return_data = true
  }

  metric_query {
    id = "errors"
    metric {
      metric_name = "HTTPCode_Target_5XX_Count"
      namespace   = "AWS/ApplicationELB"
      period      = 300
      stat        = "Sum"
      dimensions  = { LoadBalancer = var.alb_arn_suffix }
    }
  }

  metric_query {
    id = "requests"
    metric {
      metric_name = "RequestCount"
      namespace   = "AWS/ApplicationELB"
      period      = 300
      stat        = "Sum"
      dimensions  = { LoadBalancer = var.alb_arn_suffix }
    }
  }
}

# ALB response time > 2 seconds (p95)
resource "aws_cloudwatch_metric_alarm" "alb_latency" {
  alarm_name          = "${var.name_prefix}-alb-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  extended_statistic  = "p95"
  threshold           = 2.0
  alarm_description   = "ALB p95 response time > 2s for 15 minutes"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = { LoadBalancer = var.alb_arn_suffix }
}

# ECS service task count drops below desired
resource "aws_cloudwatch_metric_alarm" "ecs_tasks_low" {
  alarm_name          = "${var.name_prefix}-ecs-tasks-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "RunningTaskCount"
  namespace           = "ECS/ContainerInsights"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  alarm_description   = "ECS running task count below 1 — possible service outage"
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }
}

# API error log metric filter + alarm
resource "aws_cloudwatch_log_metric_filter" "api_errors" {
  name           = "${var.name_prefix}-api-errors"
  pattern        = "[timestamp, level=\"ERROR\", ...]"
  log_group_name = var.log_group_name

  metric_transformation {
    name          = "ApiErrorCount"
    namespace     = "OutproIndia/API"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "api_errors" {
  alarm_name          = "${var.name_prefix}-api-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ApiErrorCount"
  namespace           = "OutproIndia/API"
  period              = 300
  statistic           = "Sum"
  threshold           = 20
  alarm_description   = "More than 20 API errors in 10 minutes"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

# ── CloudWatch Dashboard ──────────────────────────────────────────────────────

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.name_prefix}-operations"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "text"
        properties = { markdown = "# Outpro.India — ${var.environment} Operations Dashboard\nLast updated: auto-refresh every 5 minutes" }
        x = 0; y = 0; width = 24; height = 2
      },
      {
        type = "metric"
        properties = {
          title  = "ECS CPU Utilization (%)"
          view   = "timeSeries"
          stat   = "Average"
          period = 300
          metrics = [["AWS/ECS", "CPUUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", var.ecs_service_name]]
          yAxis  = { left = { min = 0, max = 100 } }
        }
        x = 0; y = 2; width = 8; height = 6
      },
      {
        type = "metric"
        properties = {
          title   = "ECS Memory Utilization (%)"
          view    = "timeSeries"
          stat    = "Average"
          period  = 300
          metrics = [["AWS/ECS", "MemoryUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", var.ecs_service_name]]
          yAxis   = { left = { min = 0, max = 100 } }
        }
        x = 8; y = 2; width = 8; height = 6
      },
      {
        type = "metric"
        properties = {
          title   = "ALB Request Count"
          view    = "timeSeries"
          stat    = "Sum"
          period  = 60
          metrics = [["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix]]
        }
        x = 16; y = 2; width = 8; height = 6
      },
      {
        type = "metric"
        properties = {
          title   = "ALB Response Time p50/p95/p99 (s)"
          view    = "timeSeries"
          period  = 300
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", var.alb_arn_suffix, { stat = "p50", label = "p50" }],
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", var.alb_arn_suffix, { stat = "p95", label = "p95" }],
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", var.alb_arn_suffix, { stat = "p99", label = "p99" }],
          ]
        }
        x = 0; y = 8; width = 12; height = 6
      },
      {
        type = "metric"
        properties = {
          title   = "ALB HTTP Status Codes"
          view    = "timeSeries"
          stat    = "Sum"
          period  = 300
          metrics = [
            ["AWS/ApplicationELB", "HTTPCode_Target_2XX_Count", "LoadBalancer", var.alb_arn_suffix, { label = "2xx" }],
            ["AWS/ApplicationELB", "HTTPCode_Target_4XX_Count", "LoadBalancer", var.alb_arn_suffix, { label = "4xx" }],
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", var.alb_arn_suffix, { label = "5xx" }],
          ]
        }
        x = 12; y = 8; width = 12; height = 6
      },
      {
        type = "log"
        properties = {
          title   = "API Errors (last hour)"
          query   = "SOURCE '${var.log_group_name}' | filter level = 'ERROR' | fields timestamp, message, error | sort timestamp desc | limit 50"
          region  = var.aws_region
          view    = "table"
        }
        x = 0; y = 14; width = 24; height = 8
      }
    ]
  })
}

# ── S3 Backup Bucket ──────────────────────────────────────────────────────────

resource "aws_s3_bucket" "backups" {
  bucket        = "${var.name_prefix}-backups"
  force_destroy = false  # Protect backup bucket from accidental deletion
  tags          = { Name = "${var.name_prefix}-backups", DataClassification = "confidential" }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = "alias/aws/s3"
    }
    bucket_key_enabled = true  # Reduce KMS API calls and cost
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket                  = aws_s3_bucket.backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "db-backups-lifecycle"
    status = "Enabled"
    filter { prefix = "db/" }

    transition {
      days          = 7
      storage_class = "STANDARD_IA"  # Cheaper after 7 days
    }

    transition {
      days          = 30
      storage_class = "GLACIER_IR"   # Archival after 30 days
    }

    expiration {
      days = 365  # Delete after 1 year
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  rule {
    id     = "audit-logs-lifecycle"
    status = "Enabled"
    filter { prefix = "audit-logs/" }

    transition {
      days          = 30
      storage_class = "GLACIER_IR"
    }

    expiration {
      days = 730  # Audit logs retained 2 years
    }
  }
}

# Cross-region replication for disaster recovery
resource "aws_s3_bucket" "backups_replica" {
  provider      = aws.us_east_1  # US East as DR region
  bucket        = "${var.name_prefix}-backups-dr"
  force_destroy = false
  tags          = { Name = "${var.name_prefix}-backups-dr", Role = "disaster-recovery" }
}

resource "aws_s3_bucket_replication_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  role   = aws_iam_role.s3_replication.arn

  rule {
    id     = "replicate-all"
    status = "Enabled"
    filter { prefix = "" }
    destination {
      bucket        = aws_s3_bucket.backups_replica.arn
      storage_class = "STANDARD_IA"
    }
  }

  depends_on = [aws_s3_bucket_versioning.backups]
}

resource "aws_iam_role" "s3_replication" {
  name = "${var.name_prefix}-s3-replication"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "s3.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy" "s3_replication" {
  name = "${var.name_prefix}-s3-replication"
  role = aws_iam_role.s3_replication.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetReplicationConfiguration", "s3:ListBucket"]
        Resource = [aws_s3_bucket.backups.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObjectVersionForReplication", "s3:GetObjectVersionAcl", "s3:GetObjectVersionTagging"]
        Resource = ["${aws_s3_bucket.backups.arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ReplicateObject", "s3:ReplicateDelete", "s3:ReplicateTags"]
        Resource = ["${aws_s3_bucket.backups_replica.arn}/*"]
      }
    ]
  })
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "sns_topic_arn"      { value = aws_sns_topic.alerts.arn }
output "backup_bucket_name" { value = aws_s3_bucket.backups.bucket }
output "dashboard_name"     { value = aws_cloudwatch_dashboard.main.dashboard_name }
