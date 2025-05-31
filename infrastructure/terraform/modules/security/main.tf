# ACM Certificate for HTTPS
resource "aws_acm_certificate" "main" {
  domain_name       = var.certificate_domains[0]
  validation_method = "DNS"

  subject_alternative_names = length(var.certificate_domains) > 1 ? slice(var.certificate_domains, 1, length(var.certificate_domains)) : []

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "${var.environment}-certificate"
    Environment = var.environment
  }
}

# WAF Web ACL
resource "aws_wafv2_web_acl" "main" {
  count = var.waf_config.enabled ? 1 : 0
  
  name  = "${var.environment}-aerofusion-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "RateLimitRule"
    priority = 1

    override_action {
      none {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_config.rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.environment}-RateLimitRule"
      sampled_requests_enabled   = true
    }

    action {
      block {}
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.environment}-WAF"
    sampled_requests_enabled   = true
  }

  tags = {
    Name        = "${var.environment}-waf"
    Environment = var.environment
  }
}

# Security Group for ALB
resource "aws_security_group" "alb" {
  name_prefix = "${var.environment}-alb-"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-alb-sg"
    Environment = var.environment
  }
}

# KMS Key for encryption
resource "aws_kms_key" "main" {
  description             = "KMS key for AeroFusionXR ${var.environment}"
  deletion_window_in_days = 7

  tags = {
    Name        = "${var.environment}-kms-key"
    Environment = var.environment
  }
}

resource "aws_kms_alias" "main" {
  name          = "alias/${var.environment}-aerofusion"
  target_key_id = aws_kms_key.main.key_id
} 