# terraform/modules/ecs/main.tf
# ECS Fargate — API backend with ALB, auto-scaling, and Secrets Manager

variable "name_prefix"              { type = string }
variable "environment"              { type = string }
variable "vpc_id"                   { type = string }
variable "public_subnet_ids"        { type = list(string) }
variable "private_subnet_ids"       { type = list(string) }
variable "sg_alb_id"                { type = string }
variable "sg_ecs_id"                { type = string }
variable "ecr_repository_url"       { type = string }
variable "api_image_tag"            { type = string }
variable "cpu"                      { type = number }
variable "memory"                   { type = number }
variable "desired_count"            { type = number }
variable "min_count"                { type = number }
variable "max_count"                { type = number }
variable "certificate_arn"          { type = string }
variable "domain_name"              { type = string }
variable "api_subdomain"            { type = string }
variable "secrets_arn"              { type = string }  # ARN of the Secrets Manager secret
variable "aws_region"               { type = string }
variable "account_id"               { type = string }

locals {
  api_fqdn = "${var.api_subdomain}.${var.domain_name}"
}

# ── ECR — Container Registry ──────────────────────────────────────────────────

resource "aws_ecr_repository" "api" {
  name                 = "${var.name_prefix}-api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true  # Automatic vulnerability scanning on every push
  }

  encryption_configuration {
    encryption_type = "KMS"
  }

  tags = { Name = "${var.name_prefix}-api-ecr" }
}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 production images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Expire untagged images after 7 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = { type = "expire" }
      }
    ]
  })
}

# ── ECS Cluster ───────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "main" {
  name = "${var.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"  # Container-level CPU, memory, network metrics in CloudWatch
  }

  tags = { Name = "${var.name_prefix}-cluster" }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1  # Always keep 1 FARGATE (not SPOT) task running
  }
}

# ── IAM ───────────────────────────────────────────────────────────────────────

# Task Execution Role — used by ECS agent to pull images and push logs
resource "aws_iam_role" "ecs_execution" {
  name = "${var.name_prefix}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow ECS to read secrets from Secrets Manager
resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${var.name_prefix}-ecs-secrets"
  role = aws_iam_role.ecs_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [var.secrets_arn]
    }]
  })
}

# Task Role — what the running application container can access
resource "aws_iam_role" "ecs_task" {
  name = "${var.name_prefix}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# S3 access for backups (write-only to backup bucket)
resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "${var.name_prefix}-ecs-task-s3"
  role = aws_iam_role.ecs_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject"]
      Resource = ["arn:aws:s3:::${var.name_prefix}-backups/*"]
    }]
  })
}

# ── Secrets Manager — all API secrets in a single secret ─────────────────────

resource "aws_secretsmanager_secret" "api" {
  name                    = "${var.name_prefix}/api-secrets"
  recovery_window_in_days = 7
  tags                    = { Name = "${var.name_prefix}-api-secrets" }
}

resource "aws_secretsmanager_secret_version" "api" {
  secret_id = aws_secretsmanager_secret.api.id
  # Secret values are injected via terraform.tfvars — never hardcoded
  secret_string = jsonencode({
    NODE_ENV                  = var.environment
    PORT                      = "5000"
    DATABASE_URL              = "PLACEHOLDER_SET_VIA_CLI"
    JWT_SECRET                = "PLACEHOLDER_SET_VIA_CLI"
    RESEND_API_KEY            = "PLACEHOLDER_SET_VIA_CLI"
    RECAPTCHA_SECRET_KEY      = "PLACEHOLDER_SET_VIA_CLI"
    REVALIDATION_SECRET       = "PLACEHOLDER_SET_VIA_CLI"
    SUPABASE_URL              = "PLACEHOLDER_SET_VIA_CLI"
    SUPABASE_SERVICE_ROLE_KEY = "PLACEHOLDER_SET_VIA_CLI"
    HUBSPOT_API_KEY           = "PLACEHOLDER_SET_VIA_CLI"
    ALLOWED_ORIGINS           = "https://www.${var.domain_name},https://${var.domain_name}"
  })

  lifecycle {
    ignore_changes = [secret_string]  # Managed by deployment scripts, not Terraform
  }
}

# ── CloudWatch Log Group ──────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.name_prefix}-api"
  retention_in_days = 30

  tags = { Name = "${var.name_prefix}-api-logs" }
}

# ── ECS Task Definition ───────────────────────────────────────────────────────

resource "aws_ecs_task_definition" "api" {
  family                   = "${var.name_prefix}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = "${var.ecr_repository_url}:${var.api_image_tag}"
      essential = true

      portMappings = [{ containerPort = 5000, hostPort = 5000, protocol = "tcp" }]

      # Pull ALL secrets from Secrets Manager — no plaintext in task definition
      secrets = [
        { name = "NODE_ENV",                  valueFrom = "${aws_secretsmanager_secret.api.arn}:NODE_ENV::" },
        { name = "PORT",                       valueFrom = "${aws_secretsmanager_secret.api.arn}:PORT::" },
        { name = "DATABASE_URL",               valueFrom = "${aws_secretsmanager_secret.api.arn}:DATABASE_URL::" },
        { name = "JWT_SECRET",                 valueFrom = "${aws_secretsmanager_secret.api.arn}:JWT_SECRET::" },
        { name = "RESEND_API_KEY",             valueFrom = "${aws_secretsmanager_secret.api.arn}:RESEND_API_KEY::" },
        { name = "RECAPTCHA_SECRET_KEY",       valueFrom = "${aws_secretsmanager_secret.api.arn}:RECAPTCHA_SECRET_KEY::" },
        { name = "REVALIDATION_SECRET",        valueFrom = "${aws_secretsmanager_secret.api.arn}:REVALIDATION_SECRET::" },
        { name = "SUPABASE_URL",               valueFrom = "${aws_secretsmanager_secret.api.arn}:SUPABASE_URL::" },
        { name = "SUPABASE_SERVICE_ROLE_KEY",  valueFrom = "${aws_secretsmanager_secret.api.arn}:SUPABASE_SERVICE_ROLE_KEY::" },
        { name = "HUBSPOT_API_KEY",            valueFrom = "${aws_secretsmanager_secret.api.arn}:HUBSPOT_API_KEY::" },
        { name = "ALLOWED_ORIGINS",            valueFrom = "${aws_secretsmanager_secret.api.arn}:ALLOWED_ORIGINS::" },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.api.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }

      # Health check — ECS marks task unhealthy if this fails 3 times
      healthCheck = {
        command     = ["CMD-SHELL", "curl -sf http://localhost:5000/api/v1/health || exit 1"]
        interval    = 30
        timeout     = 10
        retries     = 3
        startPeriod = 60  # Grace period on cold start
      }

      # Hard resource limits prevent runaway containers
      ulimits = [{ name = "nofile", softLimit = 65536, hardLimit = 65536 }]

      # Read-only root filesystem — security hardening
      readonlyRootFilesystem = false  # false because app writes logs to /app/logs

      stopTimeout = 30  # Time for graceful SIGTERM handling before SIGKILL
    }
  ])

  tags = { Name = "${var.name_prefix}-api-task" }
}

# ── Application Load Balancer ─────────────────────────────────────────────────

resource "aws_lb" "api" {
  name               = "${var.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.sg_alb_id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection       = var.environment == "production"
  enable_cross_zone_load_balancing = true
  drop_invalid_header_fields       = true  # Security: reject malformed HTTP headers

  access_logs {
    bucket  = aws_s3_bucket.alb_logs.bucket
    prefix  = "alb"
    enabled = true
  }

  tags = { Name = "${var.name_prefix}-alb" }
}

resource "aws_s3_bucket" "alb_logs" {
  bucket        = "${var.name_prefix}-alb-logs"
  force_destroy = var.environment != "production"
  tags          = { Name = "${var.name_prefix}-alb-logs" }
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  rule {
    id     = "expire-old-logs"
    status = "Enabled"
    filter { prefix = "" }
    expiration { days = 30 }
  }
}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { AWS = "arn:aws:iam::718504428378:root" }  # ALB account for ap-south-1
      Action    = "s3:PutObject"
      Resource  = "${aws_s3_bucket.alb_logs.arn}/alb/AWSLogs/${var.account_id}/*"
    }]
  })
}

# HTTP → HTTPS redirect
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS listener with TLS 1.2+ policy
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"  # TLS 1.3 preferred, 1.2 minimum
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

resource "aws_lb_target_group" "api" {
  name        = "${var.name_prefix}-api-tg"
  port        = 5000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"  # Required for Fargate awsvpc networking

  health_check {
    path                = "/api/v1/health"
    interval            = 30
    timeout             = 10
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  deregistration_delay = 30  # Allow in-flight requests to complete

  tags = { Name = "${var.name_prefix}-api-tg" }
}

# ── ECS Service ───────────────────────────────────────────────────────────────

resource "aws_ecs_service" "api" {
  name                               = "${var.name_prefix}-api"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.api.arn
  desired_count                      = var.desired_count
  launch_type                        = "FARGATE"
  platform_version                   = "LATEST"
  health_check_grace_period_seconds  = 120

  # Enable circuit breaker — auto-rollback on deployment failure
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_controller {
    type = "ECS"
  }

  # Rolling deployment — never below 50%, never above 200% capacity
  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  network_configuration {
    subnets          = var.private_subnet_ids  # Tasks in private subnets
    security_groups  = [var.sg_ecs_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 5000
  }

  # Spread tasks across AZs and hosts for resilience
  ordered_placement_strategy {
    type  = "spread"
    field = "attribute:ecs.availability-zone"
  }

  lifecycle {
    ignore_changes = [desired_count]  # Managed by auto-scaling
  }

  tags = { Name = "${var.name_prefix}-api-service" }
}

# ── Auto Scaling ──────────────────────────────────────────────────────────────

resource "aws_appautoscaling_target" "api" {
  max_capacity       = var.max_count
  min_capacity       = var.min_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Scale on CPU utilisation
resource "aws_appautoscaling_policy" "cpu" {
  name               = "${var.name_prefix}-api-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 60.0   # Scale at 60% CPU — leaves headroom
    scale_in_cooldown  = 300    # 5-minute cool-down prevents thrashing
    scale_out_cooldown = 60     # Scale out quickly (60s)
  }
}

# Scale on memory utilisation
resource "aws_appautoscaling_policy" "memory" {
  name               = "${var.name_prefix}-api-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "alb_dns_name"         { value = aws_lb.api.dns_name }
output "alb_zone_id"          { value = aws_lb.api.zone_id }
output "ecr_repository_url"   { value = aws_ecr_repository.api.repository_url }
output "ecs_cluster_name"     { value = aws_ecs_cluster.main.name }
output "ecs_service_name"     { value = aws_ecs_service.api.name }
output "secrets_arn"          { value = aws_secretsmanager_secret.api.arn }
output "log_group_name"       { value = aws_cloudwatch_log_group.api.name }
